"""/api/toy/archive: an anonymous, any-origin digest of the top public fan characters for the B站 Toy page."""

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
from http.cookies import SimpleCookie
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "services" / "platform"))
from legal_consent import CURRENT_VERSION as LEGAL_VERSION  # noqa: E402

HUIGUAN = Path(__file__).resolve().parents[1]
LAUNCH = (
    "import sys, http.server; sys.path.insert(0, sys.argv[1]); sys.path.insert(0, str(__import__('pathlib').Path(sys.argv[1]).parents[1] / 'services' / 'platform')); from storage_paths import initialize_storage; initialize_storage(); import server_huiguan as s; "
    "s.init_user_db(); http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2])), s.Handler).serve_forever()"
)


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class Client:
    """The session cookie is scoped to .iridescently.xyz, so carry it by hand on 127.0.0.1."""

    def __init__(self, base):
        self.base = base
        self.session = ""

    def call(self, path, body=None):
        data = None if body is None else json.dumps(body).encode()
        headers = {"Content-Type": "application/json"}
        if self.session:
            headers["Cookie"] = "session=" + self.session
        req = urllib.request.Request(self.base + path, data=data, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                cookie = SimpleCookie()
                for header in res.headers.get_all("Set-Cookie") or []:
                    cookie.load(header)
                if "session" in cookie:
                    self.session = cookie["session"].value
                return res.status, json.loads(res.read() or b"{}")
        except urllib.error.HTTPError as error:
            with error:
                return error.code, json.loads(error.read() or b"{}")


def sheet(code, name, story, image=None):
    data = {"code": code, "name": name, "story": story, "species": "猫妖"}
    if image:
        data["image"] = image
    return {"code": code, "data": data, "html": "<html><head></head><body>" + story + "</body></html>"}


class ToyArchiveTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = tempfile.TemporaryDirectory()
        (Path(cls.root.name) / "apps" / "huiguan").mkdir(parents=True)
        port = free_port()
        env = dict(os.environ, IRIDESCENTLY_STORAGE_ROOT=cls.root.name, IRIDESCENTLY_ENVIRONMENT="test",
                   HX_SSO_SECRET="test-only-secret")
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
        cls.owner = Client(cls.base)
        status, _ = cls.owner.call("/api/register", {"legal_version": LEGAL_VERSION, "username": "toy_owner", "password": "test-password-123", "nickname": "作者甲", "email": "t@example.com"})
        assert status == 200, status
        codes = [f"T-{i:02d}" for i in range(12)]
        for code in codes:
            status, _ = cls.owner.call("/api/save-character", sheet(code, "角色" + code, "故事" * 200))
            assert status == 200, status
        status, result = cls.owner.call("/api/fan/publish", {"character_codes": codes})
        assert status == 200 and result["published"] == 12, result
        _, listing = cls.owner.call("/api/fan/list?limit=60")
        private = next(c for c in listing["characters"] if c["code"] == "T-11")
        status, _ = cls.owner.call("/api/fan/toggle", {"id": private["id"], "is_public": False})
        assert status == 200, status

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(10)
        cls.root.cleanup()

    def fetch(self, cookie=""):
        headers = {"Origin": "https://www.bilibili.com"}
        if cookie:
            headers["Cookie"] = "session=" + cookie
        req = urllib.request.Request(self.base + "/api/toy/archive", headers=headers)
        with urllib.request.urlopen(req, timeout=10) as res:
            return res.headers, json.loads(res.read())

    def test_digest_is_public_anonymous_and_bounded(self):
        headers, data = self.fetch(self.owner.session)
        self.assertEqual(headers["Access-Control-Allow-Origin"], "*")
        self.assertIsNone(headers.get("Access-Control-Allow-Credentials"))
        self.assertIsNone(headers.get("Set-Cookie"))
        self.assertIn("public", headers["Cache-Control"])
        self.assertEqual(data["schema_version"], 1)
        fan = data["fan"]
        self.assertEqual(len(fan), 10)
        self.assertNotIn("T-11", [c["code"] for c in fan])
        allowed = {"code", "name", "user_name", "type", "species", "gender", "story", "image", "url"}
        for item in fan:
            self.assertEqual(set(item), allowed)
            self.assertLessEqual(len(item["story"]), 300)
            self.assertTrue(item["url"].startswith("https://huiguan."), item["url"])
            self.assertTrue(item["url"].endswith("/show.html?code=" + item["code"]))
            self.assertEqual(item["image"], "")
        self.assertEqual(fan[0]["user_name"], "作者甲")
        self.assertIsInstance(data["official"], list)

    def test_same_answer_with_or_without_a_session(self):
        self.assertEqual(self.fetch(self.owner.session)[1], self.fetch()[1])


if __name__ == "__main__":
    unittest.main()
