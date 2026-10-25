import unittest
from email.message import Message

from host_policy import DEVELOPMENT_HOSTS, PRODUCTION_HOSTS, enforce_request, forwarded_headers, normalize_host


class Headers:
    def __init__(self, pairs):
        self._pairs = pairs

    def get_all(self, name, default=None):
        values = [value for key, value in self._pairs if key.lower() == name.lower()]
        return values if values else default


class Request:
    def __init__(self, headers, peer="127.0.0.1", path="/safe?x=1"):
        self.headers = Headers(headers)
        self.client_address = (peer, 12345)
        self.path = path
        self.command = "GET"
        self.close_connection = False
        self.response = []

    def send_response_only(self, status):
        self.response.append(("status", status))

    def send_header(self, name, value):
        self.response.append((name, value))

    def end_headers(self):
        self.response.append(("end", None))


class HostPolicyTest(unittest.TestCase):
    def test_canonical_registered_hosts_and_rejects_malformed_authorities(self):
        self.assertEqual(normalize_host("ZSZM.Iridescently.xyz"), "zszm.iridescently.xyz")
        self.assertEqual(normalize_host("zszm.iridescently.xyz:443"), "zszm.iridescently.xyz")
        for host in (
            "zszm.iridescently.xyz#", "zszm.iridescently.xyz?",
            "zszm.iridescently.xyz/evil", "user@zszm.iridescently.xyz", "zszm.iridescently.xyz.",
            "zszm.iridescently.xyz:0", "zszm.iridescently.xyz:8080", "zszm.iridescently.xyz:65536",
            "zszm.iridescently.xyz:abc", "[v1.fe80::]", "bad..iridescently.xyz", "bad host",
        ):
            with self.subTest(host=host):
                self.assertIsNone(normalize_host(host))
        self.assertNotIn("zszm.iridescently.xyz.evil.example", PRODUCTION_HOSTS)

    def test_host_allowlist_precedes_routing_and_duplicate_host_is_rejected(self):
        for headers in (
            [("Host", "evil.example"), ("X-Forwarded-Proto", "https")],
            [("Host", "zszm.iridescently.xyz"), ("Host", "evil.example"), ("X-Forwarded-Proto", "https")],
            [("Host", "zszm.iridescently.xyz#"), ("X-Forwarded-Proto", "https")],
        ):
            request = Request(headers)
            self.assertFalse(enforce_request(request))
            self.assertEqual(request.response[0], ("status", 421))
            self.assertTrue(request.close_connection)

    def test_https_redirect_uses_only_validated_host_and_is_not_tricked_by_forwarded_proto(self):
        request = Request([
            ("Host", "zszm.iridescently.xyz"),
            ("X-Forwarded-Proto", "https"),
            ("X-Forwarded-Host", "evil.example"),
        ], peer="203.0.113.9")
        self.assertFalse(enforce_request(request))
        self.assertIn(("Location", "https://zszm.iridescently.xyz/safe?x=1"), request.response)
        self.assertNotIn(("Location", "https://evil.example/safe?x=1"), request.response)

    def test_only_single_loopback_https_assertion_is_trusted(self):
        for forwarded in (["http"], ["https", "https"], ["https, http"]):
            request = Request([("Host", "zszm.iridescently.xyz"), *[("X-Forwarded-Proto", v) for v in forwarded]])
            self.assertFalse(enforce_request(request))
            self.assertEqual(request.response[0], ("status", 308))
            self.assertEqual(request.response[1], ("Location", "https://zszm.iridescently.xyz/safe?x=1"))
        request = Request([("Host", "zszm.iridescently.xyz"), ("X-Forwarded-Proto", "https")])
        self.assertTrue(enforce_request(request))
        self.assertTrue(request._trusted_external_scheme)

    def test_development_loopback_hosts_remain_available(self):
        for host in DEVELOPMENT_HOSTS:
            authority = f"[{host}]" if ":" in host else host
            request = Request([("Host", authority)], peer="127.0.0.1")
            self.assertTrue(enforce_request(request, "development"))
        request = Request([("Host", "localhost")], peer="203.0.113.9")
        self.assertFalse(enforce_request(request, "development"))
        self.assertTrue(PRODUCTION_HOSTS)

    def test_upstream_proxy_identity_headers_are_replaced(self):
        incoming = Message()
        for name in (
            "X-Forwarded-For", "X-Forwarded-Host", "X-Forwarded-Port", "X-Forwarded-Prefix",
            "X-Forwarded-Proto", "X-Forwarded-Scheme", "X-Original-Host", "X-Original-URL",
            "X-Rewrite-URL", "Forwarded", "X-Real-IP", "CF-Connecting-IP", "CF-Visitor",
        ):
            incoming[name] = "attacker-value"
        incoming["Authorization"] = "Bearer test-token"
        result = forwarded_headers(incoming, "zszm.iridescently.xyz", True)
        lower = {key.lower(): value for key, value in result.items()}
        self.assertEqual(lower["x-forwarded-host"], "zszm.iridescently.xyz")
        self.assertEqual(lower["x-forwarded-proto"], "https")
        self.assertEqual(lower["authorization"], "Bearer test-token")
        self.assertFalse(set(lower).intersection({
            "forwarded", "x-forwarded-for", "x-forwarded-port", "x-forwarded-prefix", "x-forwarded-scheme",
            "x-original-host", "x-original-url", "x-rewrite-url", "x-real-ip", "cf-connecting-ip", "cf-visitor",
        }))

    def test_validated_websocket_gets_only_the_required_upgrade_headers(self):
        incoming = Message()
        incoming["Connection"] = "keep-alive, Upgrade"
        incoming["Upgrade"] = "websocket"
        incoming["X-Forwarded-Host"] = "attacker.example"
        result = forwarded_headers(incoming, "spirit.iridescently.xyz", True, websocket=True)
        lower = {key.lower(): value for key, value in result.items()}
        self.assertEqual(lower["connection"], "Upgrade")
        self.assertEqual(lower["upgrade"], "websocket")
        self.assertEqual(lower["x-forwarded-host"], "spirit.iridescently.xyz")


if __name__ == "__main__":
    unittest.main()
