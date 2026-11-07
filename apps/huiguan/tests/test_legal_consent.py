"""《用户须知》《隐私政策》：注册必须同意当前版本，同意被记到账号上，阅读页与服务端版本一致。"""
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from http.cookies import SimpleCookie
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "services" / "platform"))
from legal_consent import CURRENT_VERSION as LEGAL_VERSION  # noqa: E402

HUIGUAN = Path(__file__).resolve().parents[1]
LAUNCH = r'''
import http.server, sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
sys.path.insert(0, str(Path(sys.argv[1]).parents[1] / "services" / "platform"))
from storage_paths import initialize_storage
initialize_storage()
import server_huiguan as s
s.init_user_db()
conn = s.db()
conn.execute("INSERT INTO local_users (username, pass_hash, nickname, role, status, created_at, last_login) VALUES (?,?,?,?,?,?,?)",
             ("old_member", s.hash_password("test-password-123"), "old_member", "executor", "active", s.now_iso(), s.now_iso()))
conn.commit(); conn.close()
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[2])), s.Handler).serve_forever()
'''


class Client:
    def __init__(self, base):
        self.base, self.session = base, ""

    def call(self, path, body=None):
        headers = {"Content-Type": "application/json"}
        if self.session:
            headers["Cookie"] = "session=" + self.session
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(self.base + path, data=data, headers=headers)
        try:
            response = urllib.request.urlopen(request, timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            cookie = SimpleCookie()
            for header in response.headers.get_all("Set-Cookie") or []:
                cookie.load(header)
            if "session" in cookie:
                self.session = cookie["session"].value
            raw = response.read()
            try:
                return response.status, json.loads(raw or b"{}")
            except ValueError:
                return response.status, raw.decode("utf-8", "replace")


class LegalConsentTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = tempfile.TemporaryDirectory()
        env = {k: v for k, v in os.environ.items() if not k.startswith("IRIDESCENTLY_") and not k.startswith("TURNSTILE_")}
        env.update(IRIDESCENTLY_STORAGE_ROOT=cls.root.name, IRIDESCENTLY_ENVIRONMENT="test",
                   HX_SSO_SECRET="test-only-secret", PYTHONDONTWRITEBYTECODE="1")
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        cls.proc = subprocess.Popen([sys.executable, "-c", LAUNCH, str(HUIGUAN), str(port)],
                                    env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cls.base = f"http://127.0.0.1:{port}"
        for _ in range(100):
            try:
                urllib.request.urlopen(cls.base + "/api/fan/list", timeout=1).close()
                break
            except OSError:
                if cls.proc.poll() is not None:
                    raise RuntimeError("test server exited")
                time.sleep(0.1)

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(10)
        cls.root.cleanup()

    def register(self, client, name, **extra):
        body = {"username": name, "password": "test-password-123", "email": name + "@example.com"}
        body.update(extra)
        return client.call("/api/register", body)

    def test_visitor_sees_current_version(self):
        status, result = Client(self.base).call("/api/legal")
        self.assertEqual(status, 200)
        self.assertEqual(result["legal_version"], LEGAL_VERSION)
        self.assertFalse(result["logged_in"])
        self.assertNotIn("is_accepted", result)

    def test_register_requires_current_version_and_records_it(self):
        client = Client(self.base)
        for extra in ({}, {"legal_version": ""}, {"legal_version": "2000-01-01"}, {"legal_version": True}):
            with self.subTest(extra=extra):
                status, result = self.register(client, "no_consent", **extra)
                self.assertEqual(status, 400)
                self.assertEqual(result["code"], "legal_consent_required")
                self.assertEqual(result["legal_version"], LEGAL_VERSION)
                self.assertFalse(client.session)
        # The refused attempts created no account: the name is still free.
        status, _ = self.register(client, "no_consent", legal_version=LEGAL_VERSION)
        self.assertEqual(status, 200)
        status, result = client.call("/api/legal")
        self.assertTrue(result["logged_in"])
        self.assertTrue(result["is_accepted"])
        self.assertIsInstance(result["accepted_at"], float)

    def test_existing_account_accepts_after_login(self):
        client = Client(self.base)
        self.assertEqual(client.call("/api/legal/accept", {"legal_version": LEGAL_VERSION})[0], 401)
        status, _ = client.call("/api/login", {"username": "old_member", "password": "test-password-123"})
        self.assertEqual(status, 200)
        self.assertFalse(client.call("/api/legal")[1]["is_accepted"])
        # Existing Accounts must agree before uploading or publishing anything.
        sheet = {"code": "LC-1", "html": "", "data": {"code": "LC-1", "name": "同意前"}}
        for path, body in (("/api/save-character", sheet), ("/api/fan/publish", {"character_codes": ["LC-1"]}),
                           ("/api/save-all-characters", {"characters": [], "versions": {}})):
            with self.subTest(path=path):
                status, result = client.call(path, body)
                self.assertEqual(status, 403)
                self.assertEqual(result["code"], "legal_consent_required")
        status, result = client.call("/api/legal/accept", {"legal_version": "2000-01-01", "context": "reconsent"})
        self.assertEqual(status, 409)
        self.assertEqual(result["code"], "legal_version_mismatch")
        status, result = client.call("/api/legal/accept", {"legal_version": LEGAL_VERSION, "context": "reconsent"})
        self.assertEqual(status, 200)
        self.assertTrue(result["is_accepted"])
        first = result["accepted_at"]
        # Accepting again keeps the first record.
        status, result = client.call("/api/legal/accept", {"legal_version": LEGAL_VERSION, "context": "oc-submit"})
        self.assertEqual(status, 200)
        self.assertEqual(result["accepted_at"], first)
        status, result = client.call("/api/save-character", sheet)
        self.assertEqual(status, 200, result)

    def test_reading_pages_match_server_version_and_carry_no_review_notes(self):
        client = Client(self.base)
        for page in ("/terms.html", "/privacy.html"):
            with self.subTest(page=page):
                status, html = client.call(page)
                self.assertEqual(status, 200)
                self.assertIn(f'data-legal-version="{LEGAL_VERSION}"', html)
                self.assertIn('class="legal-body"', html)
                for marker in ("上线前核对", "核对稿", "未上线", "发布前删除", "□"):
                    self.assertNotIn(marker, html)
                # Every table-of-contents entry points at a section that exists.
                for target in re.findall(r'<li><a href="#(s\d+)">', html):
                    self.assertIn(f'<section id="{target}"', html)


if __name__ == "__main__":
    unittest.main()
