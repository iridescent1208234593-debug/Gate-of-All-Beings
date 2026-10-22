"""Official worldview character names are rejected as new account titles and renames."""

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
from http.cookies import SimpleCookie
from pathlib import Path

HUIGUAN = Path(__file__).resolve().parents[1]
LAUNCH = r'''
import sys, http.server
sys.path.insert(0, sys.argv[1])
import server_huiguan as s
s.init_user_db()
conn=s.db()
conn.execute("INSERT INTO local_users (username, pass_hash, nickname, role, status, created_at, last_login) VALUES (?,?,?,?,?,?,?)", ("existing_official", s.hash_password("test-password-123"), "罗小黑", "executor", "active", s.now_iso(), s.now_iso()))
conn.commit(); conn.close()
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2])), s.Handler).serve_forever()
'''


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class Client:
    def __init__(self, base):
        self.base = base
        self.session = ""

    def call(self, path, body=None, client_ip=None):
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode()
        headers = {"Content-Type": "application/json"}
        if client_ip:
            headers["CF-Connecting-IP"] = client_ip
        if self.session:
            headers["Cookie"] = "session=" + self.session
        request = urllib.request.Request(self.base + path, data=data, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                cookie = SimpleCookie()
                for header in response.headers.get_all("Set-Cookie") or []:
                    cookie.load(header)
                if "session" in cookie:
                    self.session = cookie["session"].value
                return response.status, json.loads(response.read() or b"{}")
        except urllib.error.HTTPError as error:
            with error:
                return error.code, json.loads(error.read() or b"{}")


class OfficialTitleBlacklistTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = tempfile.TemporaryDirectory()
        (Path(cls.root.name) / "portal" / "huiguan").mkdir(parents=True)
        port = free_port()
        env = dict(os.environ, IRIDESCENTLY_PROJECT_ROOT=cls.root.name,
                   IRIDESCENTLY_ENVIRONMENT="development", HX_SSO_SECRET="test-only-secret")
        cls.proc = subprocess.Popen([sys.executable, "-c", LAUNCH, str(HUIGUAN), str(port)], env=env,
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cls.base = f"http://127.0.0.1:{port}"
        for _ in range(100):
            try:
                urllib.request.urlopen(cls.base + "/api/fan/list", timeout=1).close()
                break
            except OSError:
                time.sleep(0.1)
        cls.client = Client(cls.base)

    def setUp(self):
        self.client = Client(self.base)

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(10)
        cls.root.cleanup()

    def test_register_rejects_official_display_name(self):
        status, result = self.client.call("/api/register", {
            "username": "new_member", "password": "test-password-123", "nickname": "罗小黑"},
            client_ip="192.0.2.10")
        self.assertEqual(status, 400)
        self.assertIn("官方世界观角色名", result["error"])

    def test_register_rejects_normalized_official_name_variants(self):
        for index, nickname in enumerate(("ＭＴ", "mT", "M\u200bT", "M T")):
            with self.subTest(nickname=nickname):
                status, result = self.client.call("/api/register", {
                    "username": f"variant_{index}", "password": "test-password-123", "nickname": nickname},
                    client_ip=f"192.0.2.{20 + index}")
                self.assertEqual(status, 400)
                self.assertIn("官方世界观角色名", result["error"])

    def test_matching_remains_exact_after_normalization(self):
        status, result = self.client.call("/api/register", {
            "username": "near_match", "password": "test-password-123", "nickname": "余某"},
            client_ip="192.0.2.11")
        self.assertEqual(status, 200, result)

    def test_registration_keeps_existing_numeric_name_behavior(self):
        status, result = self.client.call("/api/register", {
            "username": "numeric_name", "password": "test-password-123", "nickname": "123456"},
            client_ip="192.0.2.15")
        self.assertEqual(status, 200, result)
        status, result = self.client.call("/api/auth", {
            "username": "654321", "password": "test-password-123"}, client_ip="192.0.2.16")
        self.assertEqual((status, result.get("registered")), (200, True))

    def test_auth_rejects_official_name_only_for_new_accounts(self):
        status, result = self.client.call("/api/auth", {
            "username": "罗小黑", "password": "test-password-123"}, client_ip="192.0.2.12")
        self.assertEqual(status, 400)
        self.assertIn("官方世界观角色名", result["error"])

        # An existing account can still log in even if its stored display title is a role name.
        status, result = self.client.call("/api/auth", {
            "username": "existing_official", "password": "test-password-123"}, client_ip="192.0.2.13")
        self.assertEqual((status, result.get("registered")), (200, False))

    def test_rename_rejects_official_and_numeric_names(self):
        status, result = self.client.call("/api/register", {
            "username": "rename_member", "password": "test-password-123", "nickname": "普通名号"},
            client_ip="192.0.2.14")
        self.assertEqual(status, 200, result)
        status, result = self.client.call("/api/rename", {"nickname": "罗小黑"})
        self.assertEqual(status, 400)
        self.assertIn("官方世界观角色名", result["error"])
        self.assertEqual(self.client.call("/api/rename", {"nickname": "123456"})[0], 400)
        self.assertEqual(self.client.call("/api/rename", {"nickname": "新的名号"})[0], 200)


if __name__ == "__main__":
    unittest.main()
