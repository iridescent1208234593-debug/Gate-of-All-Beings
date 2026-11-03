"""Issue #36: the client IP used for rate limits cannot be chosen by the client."""
from email.message import Message
import os
from pathlib import Path
import sys
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from host_policy import edge_client_identity, enforce_request, trusted_client_ip  # noqa: E402

HOST = "huiguan.iridescently.xyz"
RAY = "8d1f2e3a4b5c6d7e-HKG"


class Request:
    def __init__(self, headers, peer="127.0.0.1"):
        self.headers = Message()
        for name, value in headers:
            self.headers[name] = value
        self.client_address = (peer, 40000)
        self.path = "/api/login"
        self.command = "GET"
        self.close_connection = False
        self.response = []

    def send_response_only(self, status):
        self.response.append(("status", status))

    def send_header(self, name, value):
        self.response.append((name, value))

    def end_headers(self):
        self.response.append(("end", None))


def edge(*extra, peer="127.0.0.1", host=HOST, ray=RAY, environment="production", mode="production"):
    """A request as cloudflared (or the HK nginx in front of the portal) hands it to portal ingress."""
    headers = [("Host", host), ("X-Forwarded-Proto", "https")]
    if ray is not None:
        headers.append(("CF-Ray", ray))
    request = Request([*headers, *extra], peer=peer)
    with mock.patch.dict(os.environ, {"IRIDESCENTLY_ENVIRONMENT": environment}):
        admitted = enforce_request(request, mode)
    return request, admitted


class TrustedClientIpTest(unittest.TestCase):
    def test_production_tunnel_path_keeps_the_real_visitor_ip(self):
        request, admitted = edge(("CF-Connecting-IP", "198.51.100.23"))
        self.assertTrue(admitted)
        self.assertEqual(edge_client_identity(request), ("198.51.100.23", RAY, True))
        request, _ = edge(("CF-Connecting-IP", " 2001:DB8::0:1 "))
        self.assertEqual(trusted_client_ip(request), "2001:db8::1")

    def test_standalone_server_uses_the_tcp_peer(self):
        forged = [("Host", HOST), ("X-Forwarded-Proto", "https"), ("CF-Ray", RAY), ("CF-Connecting-IP", "198.51.100.23")]
        # No portal ingress ran: neither a remote nor a local peer can choose its identity.
        self.assertEqual(edge_client_identity(Request(forged, peer="203.0.113.9")), ("203.0.113.9", RAY, False))
        self.assertEqual(trusted_client_ip(Request(forged, peer="127.0.0.1")), "127.0.0.1")
        with mock.patch.dict(os.environ, {"IRIDESCENTLY_ENVIRONMENT": "production"}):
            self.assertEqual(trusted_client_ip(Request(forged, peer="127.0.0.1")), "127.0.0.1")

    def test_other_forwarding_headers_are_never_an_identity(self):
        for name in ("X-Real-IP", "X-Forwarded-For", "True-Client-IP", "X-Client-IP", "Forwarded"):
            with self.subTest(header=name):
                request, _ = edge((name, "198.51.100.99"))
                self.assertEqual(trusted_client_ip(request), "127.0.0.1")
                self.assertEqual(trusted_client_ip(Request([(name, "198.51.100.99")], peer="203.0.113.9")), "203.0.113.9")

    def test_every_tunnel_condition_is_required(self):
        claim = ("CF-Connecting-IP", "198.51.100.23")
        cases = {
            "test environment": edge(claim, environment="test"),
            "development mode": edge(claim, mode="development", host="localhost"),
            "unset environment": edge(claim, environment=""),
            "missing CF-Ray": edge(claim, ray=None),
            "malformed CF-Ray": edge(claim, ray="bad ray\r\nX: y"),
            "duplicate CF-Ray": edge(claim, ("CF-Ray", "other-ray")),
            "unparseable claim": edge(("CF-Connecting-IP", "198.51.100.23, 10.0.0.1")),
            "duplicate claim": edge(claim, ("CF-Connecting-IP", "192.0.2.1")),
        }
        for name, (request, _) in cases.items():
            with self.subTest(name):
                self.assertEqual(trusted_client_ip(request), "127.0.0.1")
                self.assertFalse(edge_client_identity(request)[2])
        # Plain HTTP is redirected before any app runs and leaves nothing trusted behind.
        request = Request([("Host", HOST), ("CF-Ray", RAY), claim])
        with mock.patch.dict(os.environ, {"IRIDESCENTLY_ENVIRONMENT": "production"}):
            self.assertFalse(enforce_request(request, "production"))
        self.assertEqual(trusted_client_ip(request), "127.0.0.1")

    def test_trust_does_not_survive_into_the_next_keep_alive_request(self):
        request, _ = edge(("CF-Connecting-IP", "198.51.100.23"))
        self.assertTrue(request._edge_identity_trusted)
        with mock.patch.dict(os.environ, {"IRIDESCENTLY_ENVIRONMENT": "test"}):
            enforce_request(request, "production")
        self.assertFalse(request._edge_identity_trusted)
        self.assertEqual(trusted_client_ip(request), "127.0.0.1")


if __name__ == "__main__":
    unittest.main()
