"""验证编辑码未配置时拒绝授权，并保留正常的编辑权限流程。"""
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
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[2])), s.Handler).serve_forever()
'''


class EditorCodeTest(unittest.TestCase):
    def start_server(self, configured):
        root = tempfile.TemporaryDirectory()
        self.addCleanup(root.cleanup)
        env = {k: v for k, v in os.environ.items()
               if not k.startswith("IRIDESCENTLY_") and k != "HUIGUAN_EDITOR_CODE"}
        env.update(IRIDESCENTLY_STORAGE_ROOT=root.name, IRIDESCENTLY_ENVIRONMENT="test",
                   HX_SSO_SECRET="test-only-secret", PYTHONDONTWRITEBYTECODE="1")
        if configured is not None:
            env["HUIGUAN_EDITOR_CODE"] = configured
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        proc = subprocess.Popen([sys.executable, "-c", LAUNCH, str(HUIGUAN), str(port)],
                                env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        def stop():
            proc.terminate()
            proc.wait(timeout=10)
        self.addCleanup(stop)
        self.base = f"http://127.0.0.1:{port}"
        self.session = ""
        for _ in range(100):
            try:
                urllib.request.urlopen(self.base + "/api/fan/list", timeout=1).close()
                break
            except OSError:
                if proc.poll() is not None:
                    self.fail("test server exited before becoming ready")
                time.sleep(0.1)
        else:
            self.fail("test server did not become ready")
        status, _ = self.call("/api/register", {"legal_version": LEGAL_VERSION, "username": "editor_test", "password": "test-password-123",
                                                 "nickname": "editor_test", "email": "t@example.com"})
        self.assertEqual(status, 200)

    def call(self, path, body=None):
        headers = {"Content-Type": "application/json"}
        if self.session:
            headers["Cookie"] = "session=" + self.session
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(self.base + path, data=data, headers=headers)
        try:
            response = urllib.request.urlopen(request, timeout=10)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            cookie = SimpleCookie()
            for header in response.headers.get_all("Set-Cookie") or []:
                cookie.load(header)
            if "session" in cookie:
                self.session = cookie["session"].value
            return response.status, json.loads(response.read() or b"{}")

    def test_unconfigured_rejects_all_codes_without_changing_role(self):
        for configured in (None, "", "   "):
            with self.subTest(configured=configured):
                self.start_server(configured)
                # 拼出历史默认码，避免在源码中重新引入该明文。
                old_code = "".join(map(str, (20, 14, 20, 10)))
                for code in (old_code, "another-old-code", "anything"):
                    status, result = self.call("/api/editor/code", {"code": code})
                    self.assertEqual(status, 503)
                    self.assertNotIn("ok", result)
                status, user = self.call("/api/user")
                self.assertEqual(status, 200)
                self.assertNotEqual(user.get("edit_role"), "scribe")

    def test_configured_code_and_existing_editor(self):
        self.start_server("test-code-123")
        self.assertEqual(self.call("/api/editor/code", {"code": "wrong"})[0], 400)
        self.assertNotEqual(self.call("/api/user")[1].get("edit_role"), "scribe")
        status, result = self.call("/api/editor/code", {"code": "test-code-123"})
        self.assertEqual(status, 200)
        self.assertTrue(result["ok"])
        self.assertEqual(self.call("/api/user")[1].get("edit_role"), "scribe")
        status, result = self.call("/api/editor/code", {"code": "wrong"})
        self.assertEqual(status, 200)
        self.assertTrue(result["already"])


if __name__ == "__main__":
    unittest.main()
