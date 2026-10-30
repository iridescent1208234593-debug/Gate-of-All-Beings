"""Turnstile gates account entry points: missing, rejected, wrong-action and foreign-host tokens fail."""

import http.server
import json
import os
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HUIGUAN = Path(__file__).resolve().parents[1]
PLATFORM = HUIGUAN.parents[1] / "services" / "platform"
LAUNCH = r'''
import sys, http.server
sys.path.insert(0, sys.argv[1])
sys.path.insert(0, str(__import__("pathlib").Path(sys.argv[1]).parents[1] / "services" / "platform"))
from storage_paths import initialize_storage; initialize_storage(); import server_huiguan as s
s.init_user_db()
conn=s.db()
conn.execute("INSERT INTO local_users (username, pass_hash, nickname, role, status, created_at, last_login) VALUES (?,?,?,?,?,?,?)", ("gate_member", s.hash_password("test-password-123"), "gate_member", "executor", "active", s.now_iso(), s.now_iso()))
conn.commit(); conn.close()
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2])), s.Handler).serve_forever()
'''
# token -> siteverify answer (the mock stands in for challenges.cloudflare.com)
ANSWERS = {
    "good-auth": {"success": True, "hostname": "127.0.0.1", "action": "auth"},
    "good-register": {"success": True, "hostname": "127.0.0.1", "action": "register"},
    "wrong-action": {"success": True, "hostname": "127.0.0.1", "action": "login"},
    "foreign-host": {"success": True, "hostname": "evil.example", "action": "auth"},
    "rejected": {"success": False, "error-codes": ["invalid-input-response"]},
}
SECRET = "0x4AAAAAAA-test-only-not-a-real-secret"


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class Siteverify(http.server.BaseHTTPRequestHandler):
    seen = []

    def do_POST(self):
        fields = urllib.parse.parse_qs(self.rfile.read(int(self.headers["Content-Length"])).decode())
        Siteverify.seen.append(fields)
        ok_secret = fields.get("secret") == [SECRET]
        body = json.dumps(ANSWERS.get(fields.get("response", [""])[0], {"success": False}) if ok_secret else {"success": False}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


class TurnstileGateTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.verifier = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Siteverify)
        threading.Thread(target=cls.verifier.serve_forever, daemon=True).start()
        cls.root = tempfile.TemporaryDirectory()
        (Path(cls.root.name) / "apps" / "huiguan").mkdir(parents=True)
        port = free_port()
        env = dict(os.environ, IRIDESCENTLY_STORAGE_ROOT=cls.root.name, IRIDESCENTLY_ENVIRONMENT="test",
                   HX_SSO_SECRET="test-only-secret", TURNSTILE_SECRET=SECRET, TURNSTILE_SITE_KEY="0x4AAAAAAA-site-key",
                   TURNSTILE_VERIFY_URL=f"http://127.0.0.1:{cls.verifier.server_address[1]}/siteverify")
        for key in ("DATA", "ASSETS", "CACHE", "RELEASE", "BACKUP", "PROJECT"):
            env.pop(f"IRIDESCENTLY_{key}_ROOT", None)
        cls.proc = subprocess.Popen([sys.executable, "-c", LAUNCH, str(HUIGUAN), str(port)], env=env,
                                    stdout=subprocess.DEVNULL, stderr=None)
        cls.base = f"http://127.0.0.1:{port}"
        for _ in range(100):
            try:
                urllib.request.urlopen(cls.base + "/api/fan/list", timeout=1).close()
                break
            except OSError:
                time.sleep(0.1)
        cls.ip = 0

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(10)
        cls.verifier.shutdown()
        cls.root.cleanup()

    def post(self, path, body):
        TurnstileGateTest.ip += 1
        request = urllib.request.Request(self.base + path, data=json.dumps(body).encode(), headers={
            "Content-Type": "application/json", "CF-Connecting-IP": f"198.18.5.{self.ip}"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            with error:
                return error.code, json.loads(error.read() or b"{}")

    def test_site_key_is_public_and_secret_is_not(self):
        with urllib.request.urlopen(self.base + "/api/turnstile", timeout=10) as response:
            text = response.read().decode()
        self.assertEqual(json.loads(text), {"siteKey": "0x4AAAAAAA-site-key"})
        self.assertNotIn(SECRET, text)

    def test_valid_token_logs_in(self):
        status, result = self.post("/api/auth", {"username": "gate_member", "password": "test-password-123", "turnstile": "good-auth"})
        self.assertEqual((status, result.get("registered")), (200, False))

    def test_bad_tokens_are_refused_before_the_password_is_checked(self):
        for token in ("", "rejected", "wrong-action", "foreign-host", "x" * 3000):
            with self.subTest(token=token[:20]):
                status, result = self.post("/api/auth", {"username": "gate_member", "password": "test-password-123", "turnstile": token})
                self.assertEqual(status, 403)
                self.assertTrue(result.get("turnstile"))
        status, _ = self.post("/api/auth", {"username": "gate_member", "password": "test-password-123"})
        self.assertEqual(status, 403)

    def test_register_and_login_endpoints_need_their_own_action(self):
        self.assertEqual(self.post("/api/register", {"username": "gate_new", "password": "test-password-123", "email": "gate_new@example.com", "turnstile": "good-auth"})[0], 403)
        self.assertEqual(self.post("/api/register", {"username": "gate_new", "password": "test-password-123", "email": "gate_new@example.com", "turnstile": "good-register"})[0], 200)
        self.assertEqual(self.post("/api/login", {"username": "gate_member", "password": "test-password-123", "turnstile": "good-auth"})[0], 403)

    def test_secret_and_client_ip_are_sent_to_siteverify(self):
        Siteverify.seen.clear()
        self.post("/api/auth", {"username": "gate_member", "password": "test-password-123", "turnstile": "good-auth"})
        self.assertEqual(Siteverify.seen[-1]["secret"], [SECRET])
        self.assertTrue(Siteverify.seen[-1]["remoteip"][0].startswith("198.18.5."))


class TurnstileModuleTest(unittest.TestCase):
    def setUp(self):
        sys.path.insert(0, str(PLATFORM))
        import turnstile
        self.turnstile = turnstile
        self.saved = {k: os.environ.get(k) for k in ("TURNSTILE_SECRET", "TURNSTILE_SITE_KEY", "TURNSTILE_VERIFY_URL", "IRIDESCENTLY_ENVIRONMENT")}

    def tearDown(self):
        for key, value in self.saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def handler(self):
        class Fake:
            headers = {"Host": "huiguan.iridescently.xyz"}
            client_address = ("127.0.0.1", 1)
        return Fake()

    def test_disabled_without_secret(self):
        os.environ.pop("TURNSTILE_SECRET", None)
        os.environ["TURNSTILE_SITE_KEY"] = "public"
        self.assertEqual(self.turnstile.verify(self.handler(), "", "auth"), (True, ""))
        self.assertEqual(self.turnstile.site_key(), "")

    def test_unreachable_siteverify_fails_closed(self):
        os.environ["TURNSTILE_SECRET"] = SECRET
        os.environ["TURNSTILE_VERIFY_URL"] = f"http://127.0.0.1:{free_port()}/siteverify"
        self.assertEqual(self.turnstile.verify(self.handler(), "token", "auth", timeout=2), (False, "unavailable"))

    def test_test_secret_is_refused_in_production(self):
        os.environ["TURNSTILE_SECRET"] = "1x0000000000000000000000000000000AA"
        os.environ["IRIDESCENTLY_ENVIRONMENT"] = "production"
        original = self.turnstile._post
        self.turnstile._post = lambda url, fields, timeout: {"success": True, "hostname": "example.com"}
        try:
            self.assertEqual(self.turnstile.verify(self.handler(), "token", "auth"), (False, "unavailable"))
            os.environ["IRIDESCENTLY_ENVIRONMENT"] = "test"
            self.assertEqual(self.turnstile.verify(self.handler(), "token", "auth"), (True, ""))
        finally:
            self.turnstile._post = original

    def test_same_root_hosts_only(self):
        os.environ["TURNSTILE_SECRET"] = SECRET
        os.environ["IRIDESCENTLY_ENVIRONMENT"] = "production"
        original = self.turnstile._post
        try:
            for reported, expected in (("zszm.iridescently.xyz", True), ("huiguan.iridescently.cn", False), ("evil.example", False)):
                self.turnstile._post = lambda url, fields, timeout, h=reported: {"success": True, "hostname": h, "action": "auth"}
                self.assertEqual(self.turnstile.verify(self.handler(), "token", "auth")[0], expected, reported)
        finally:
            self.turnstile._post = original


if __name__ == "__main__":
    unittest.main()
