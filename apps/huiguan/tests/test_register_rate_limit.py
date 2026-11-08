"""Registration limits: typos never spend the creation budget, and one client IP never locks out another."""

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "services" / "platform"))
from legal_consent import CURRENT_VERSION as LEGAL_VERSION  # noqa: E402

HUIGUAN = Path(__file__).resolve().parents[1]
LAUNCH = r'''
import sys, http.server
sys.path.insert(0, sys.argv[1])
sys.path.insert(0, str(__import__("pathlib").Path(sys.argv[1]).parents[1] / "services" / "platform"))
from storage_paths import initialize_storage; initialize_storage(); import server_huiguan as s
s.init_user_db()
s.REGISTER_CREATE_LIMIT = 2
s.REGISTER_ATTEMPT_LIMIT = 6
class EdgeHandler(s.Handler):
    # Stands in for portal ingress on the production Tunnel path (see test_login_throttle).
    def parse_request(self):
        ok = super().parse_request()
        self._edge_identity_trusted = ok
        return ok
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2])), EdgeHandler).serve_forever()
'''


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class RegisterRateLimitTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = tempfile.TemporaryDirectory()
        (Path(cls.root.name) / "apps" / "huiguan").mkdir(parents=True)
        port = free_port()
        env = dict(os.environ, IRIDESCENTLY_STORAGE_ROOT=cls.root.name,
                   IRIDESCENTLY_ENVIRONMENT="test", HX_SSO_SECRET="test-only-secret")
        for key in ("DATA", "ASSETS", "CACHE", "RELEASE", "BACKUP", "PROJECT"):
            env.pop(f"IRIDESCENTLY_{key}_ROOT", None)
        env.pop("TURNSTILE_SECRET_KEY", None)
        cls.proc = subprocess.Popen([sys.executable, "-c", LAUNCH, str(HUIGUAN), str(port)], env=env,
                                    stdout=subprocess.DEVNULL, stderr=None)
        cls.base = f"http://127.0.0.1:{port}"
        for _ in range(100):
            try:
                urllib.request.urlopen(cls.base + "/api/fan/list", timeout=1).close()
                break
            except OSError:
                time.sleep(0.1)

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(10)
        cls.root.cleanup()

    def register(self, username, client_ip, password="register-password-123"):
        body = {"username": username, "password": password, "email": username + "@example.test",
                "legal_version": LEGAL_VERSION}
        request = urllib.request.Request(self.base + "/api/register", data=json.dumps(body).encode(),
                                         headers={"Content-Type": "application/json", "CF-Connecting-IP": client_ip,
                                                  "CF-Ray": "0123456789abcdef-HKG"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            with error:
                return error.code, json.loads(error.read() or b"{}")

    def test_typos_do_not_spend_the_creation_budget(self):
        ip = "198.51.100.10"
        for attempt in range(3):
            self.assertEqual(self.register("!", ip)[0], 400)  # invalid username
        self.assertEqual(self.register("typo_ok_1", ip)[0], 200)
        self.assertEqual(self.register("typo_ok_2", ip)[0], 200)
        status, body = self.register("typo_ok_3", ip)
        self.assertEqual(status, 429)
        self.assertEqual(body.get("code"), "register_rate_limited")

    def test_attempt_flood_is_capped_and_other_ips_are_unaffected(self):
        ip = "198.51.100.20"
        statuses = [self.register("!", ip)[0] for _ in range(8)]
        self.assertEqual(statuses[:6], [400] * 6)
        self.assertEqual(statuses[6:], [429, 429])
        self.assertEqual(self.register("other_ip_ok", "198.51.100.21")[0], 200)


if __name__ == "__main__":
    unittest.main()
