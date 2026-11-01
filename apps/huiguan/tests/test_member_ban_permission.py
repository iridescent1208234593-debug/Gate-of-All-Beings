"""Only administrators may ban or unban accounts through /api/member/user/update."""

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
PASSWORD = "test-password-123"
LAUNCH = r'''
import sys, http.server
sys.path.insert(0, sys.argv[1])
sys.path.insert(0, str(__import__("pathlib").Path(sys.argv[1]).parents[1] / "services" / "platform"))
from storage_paths import initialize_storage; initialize_storage(); import server_huiguan as s
s.init_user_db()
conn = s.db()
for username, role, status in (("elder_user", "elder", "active"), ("admin_user", "admin", "active"),
                               ("target_user", "executor", "active"), ("banned_user", "executor", "banned")):
    conn.execute("INSERT INTO local_users (username, pass_hash, nickname, role, status, created_at, last_login) VALUES (?,?,?,?,?,?,?)",
                 (username, s.hash_password("test-password-123"), username, role, status, s.now_iso(), s.now_iso()))
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

    def call(self, path, body=None):
        data = None if body is None else json.dumps(body, ensure_ascii=False).encode()
        headers = {"Content-Type": "application/json"}
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


class MemberBanPermissionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = tempfile.TemporaryDirectory()
        (Path(cls.root.name) / "apps" / "huiguan").mkdir(parents=True)
        port = free_port()
        env = dict(os.environ, IRIDESCENTLY_STORAGE_ROOT=cls.root.name,
                   IRIDESCENTLY_ENVIRONMENT="test", HX_SSO_SECRET="test-only-secret")
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

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(10)
        cls.root.cleanup()

    def login(self, username):
        client = Client(self.base)
        status, result = client.call("/api/auth", {"username": username, "password": PASSWORD})
        self.assertEqual(status, 200, result)
        return client

    def members(self, client):
        status, result = client.call("/api/member/users")
        self.assertEqual(status, 200, result)
        return {u["name"]: u for u in result["users"]}

    def update(self, client, name, field, value):
        uid = self.members(client)[name]["uid"]
        return client.call("/api/member/user/update",
                           {"kind": "local", "uid": uid, "set": {field: value}})

    def test_elder_cannot_ban_or_unban(self):
        elder = self.login("elder_user")
        status, result = self.update(elder, "target_user", "status", "banned")
        self.assertEqual(status, 403)
        self.assertIn("仅管理员", result["error"])
        status, result = self.update(elder, "banned_user", "status", "active")
        self.assertEqual(status, 403)

    def test_elder_can_still_manage_executor_flags(self):
        elder = self.login("elder_user")
        status, result = self.update(elder, "target_user", "edit_role", "scribe")
        self.assertEqual(status, 200, result)
        self.assertEqual(self.members(elder)["target_user"]["edit_role"], "scribe")
        status, result = self.update(elder, "target_user", "role", "elder")
        self.assertEqual(status, 403)

    def test_admin_can_ban_and_unban(self):
        admin = self.login("admin_user")
        status, result = self.update(admin, "target_user", "status", "banned")
        self.assertEqual(status, 200, result)
        self.assertEqual(self.members(admin)["target_user"]["status"], "banned")
        blocked = Client(self.base)
        self.assertEqual(blocked.call("/api/auth", {"username": "target_user", "password": PASSWORD})[0], 403)
        status, result = self.update(admin, "target_user", "status", "active")
        self.assertEqual(status, 200, result)
        self.assertEqual(self.members(admin)["target_user"]["status"], "active")

    def test_anonymous_update_is_rejected(self):
        client = Client(self.base)
        status, result = client.call("/api/member/user/update",
                                     {"kind": "local", "uid": "3", "set": {"status": "banned"}})
        self.assertEqual(status, 401)


if __name__ == "__main__":
    unittest.main()
