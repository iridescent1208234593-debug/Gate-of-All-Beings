"""Failed logins are limited per account+IP, per IP across accounts and per account across IPs."""

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

HUIGUAN = Path(__file__).resolve().parents[1]
LAUNCH = r'''
import sys, http.server
sys.path.insert(0, sys.argv[1])
sys.path.insert(0, str(__import__("pathlib").Path(sys.argv[1]).parents[1] / "services" / "platform"))
from storage_paths import initialize_storage; initialize_storage(); import server_huiguan as s
s.init_user_db()
conn=s.db()
for name in ("target_member", "bystander"):
    conn.execute("INSERT INTO local_users (username, pass_hash, nickname, role, status, created_at, last_login) VALUES (?,?,?,?,?,?,?)", (name, s.hash_password("test-password-123"), name, "executor", "active", s.now_iso(), s.now_iso()))
conn.commit(); conn.close()
class EdgeHandler(s.Handler):
    # Stands in for portal ingress on the production Tunnel path: host_policy.enforce_request
    # vouches for CF-Connecting-IP there, never on a standalone server (issue #36).
    def parse_request(self):
        ok = super().parse_request()
        self._edge_identity_trusted = ok
        return ok
handler = EdgeHandler if sys.argv[3] == 'edge' else s.Handler
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2])), handler).serve_forever()
'''


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class LoginThrottleTest(unittest.TestCase):
    mode = "edge"

    @classmethod
    def setUpClass(cls):
        cls.root = tempfile.TemporaryDirectory()
        (Path(cls.root.name) / "apps" / "huiguan").mkdir(parents=True)
        port = free_port()
        env = dict(os.environ, IRIDESCENTLY_STORAGE_ROOT=cls.root.name,
                   IRIDESCENTLY_ENVIRONMENT="test", HX_SSO_SECRET="test-only-secret")
        for key in ("DATA", "ASSETS", "CACHE", "RELEASE", "BACKUP", "PROJECT"):
            env.pop(f"IRIDESCENTLY_{key}_ROOT", None)
        cls.proc = subprocess.Popen([sys.executable, "-c", LAUNCH, str(HUIGUAN), str(port), cls.mode], env=env,
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

    def login(self, path, username, password, client_ip):
        request = urllib.request.Request(self.base + path, data=json.dumps({"username": username, "password": password}).encode(),
                                         headers={"Content-Type": "application/json", "CF-Connecting-IP": client_ip,
                                                  "CF-Ray": "0123456789abcdef-HKG"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status
        except urllib.error.HTTPError as error:
            with error:
                return error.code

    def test_legacy_auth_only_logs_in_existing_accounts(self):
        ip = "198.51.100.71"
        self.assertEqual(self.login("/api/auth", "unknown_fixture", "test-password-123", ip), 410)
        self.assertEqual(self.login("/api/login", "unknown_fixture", "test-password-123", ip), 401)
        self.assertEqual(self.login("/api/auth", "bystander", "wrong-password-0", ip), 401)
        self.assertEqual(self.login("/api/auth", "bystander", "test-password-123", ip), 200)

    def test_one_ip_sweeping_many_usernames_is_limited(self):
        ip = "198.51.100.7"
        for index in range(30):
            self.assertEqual(self.login("/api/login", f"sweep_{index}", "wrong-password-0", ip), 401)
        self.assertEqual(self.login("/api/login", "sweep_next", "wrong-password-0", ip), 429)
        # Another address is unaffected.
        self.assertEqual(self.login("/api/login", "bystander", "test-password-123", "198.51.100.8"), 200)

    def test_one_account_guessed_from_many_ips_is_limited(self):
        for index in range(20):
            self.assertEqual(self.login("/api/auth", "target_member", "wrong-password-0", f"203.0.113.{index + 1}"), 401)
        self.assertEqual(self.login("/api/auth", "target_member", "test-password-123", "203.0.113.200"), 429)

    def test_single_account_and_ip_keeps_its_original_limit(self):
        ip = "192.0.2.77"
        for _ in range(8):
            self.assertEqual(self.login("/api/login", "bystander", "wrong-password-0", ip), 401)
        self.assertEqual(self.login("/api/login", "bystander", "test-password-123", ip), 429)


class StandaloneForgedForwardingTest(unittest.TestCase):
    """Issue #36: a standalone server keys limits on the TCP peer, whatever the client claims."""

    @classmethod
    def setUpClass(cls):
        cls.mode = "standalone"
        LoginThrottleTest.setUpClass.__func__(cls)

    @classmethod
    def tearDownClass(cls):
        LoginThrottleTest.tearDownClass.__func__(cls)

    login = LoginThrottleTest.login

    def test_rotating_forged_client_ip_does_not_escape_the_per_ip_limit(self):
        for index in range(30):
            self.assertEqual(self.login("/api/login", f"forged_{index}", "wrong-password-0", f"198.51.100.{index + 1}"), 401)
        # Same TCP peer, yet another invented CF-Connecting-IP: still the same identity.
        self.assertEqual(self.login("/api/login", "forged_next", "wrong-password-0", "192.0.2.250"), 429)


if __name__ == "__main__":
    unittest.main()
