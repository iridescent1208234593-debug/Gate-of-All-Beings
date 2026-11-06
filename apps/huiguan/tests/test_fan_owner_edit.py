"""A published fan character stays editable by its owner; edits update the one gallery record in place."""

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


def sheet(code, name, story):
    return {"code": code, "data": {"code": code, "name": name, "story": story, "species": "猫妖"}, "html": "<html><head></head><body>" + story + "</body></html>"}


class FanOwnerEditTest(unittest.TestCase):
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
        cls.owner, cls.other = Client(cls.base), Client(cls.base)
        for client, name in ((cls.owner, "owner_test"), (cls.other, "other_test")):
            status, _ = client.call("/api/register", {"legal_version": LEGAL_VERSION, "username": name, "password": "test-password-123", "nickname": name, "email": "t@example.com"})
            assert status == 200, status

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(10)
        cls.root.cleanup()

    def public(self, client, code):
        _, listing = client.call("/api/fan/list?limit=60")
        return [c for c in listing["characters"] if c["code"] == code]

    def test_owner_edits_published_character_in_place(self):
        self.assertEqual(self.owner.call("/api/save-character", sheet("A-1", "阿青", "旧故事"))[0], 200)
        status, result = self.owner.call("/api/fan/publish", {"character_codes": ["A-1"]})
        self.assertEqual((status, result["published"]), (200, 1))

        # 公开后仍可编辑：改名 + 改故事，画廊记录原位更新
        self.assertEqual(self.owner.call("/api/save-character", sheet("A-1", "阿青·改", "新故事"))[0], 200)
        rows = self.public(self.owner, "A-1")
        self.assertEqual([(r["name"], r["story"], r["is_mine"]) for r in rows], [("阿青·改", "新故事", True)])
        self.assertEqual([r["is_mine"] for r in self.public(self.other, "A-1")], [False])

        # 改名后再次公开不产生副本
        status, result = self.owner.call("/api/fan/publish", {"character_codes": ["A-1"]})
        self.assertEqual((status, result["published"], result["skipped"]), (200, 0, 1))
        self.assertEqual(len(self.public(self.owner, "A-1")), 1)

        # 编辑时改编号：原位改名，画廊记录跟随
        body = sheet("A-2", "阿青·改", "换编号")
        body["previous_code"] = "A-1"
        self.assertEqual(self.owner.call("/api/save-character", body)[0], 200)
        self.assertEqual(self.public(self.owner, "A-1"), [])
        self.assertEqual([r["story"] for r in self.public(self.owner, "A-2")], ["换编号"])
        _, mine = self.owner.call("/api/get-characters")
        codes = [c["code"] for c in mine["characters"]]
        self.assertEqual((codes.count("A-1"), codes.count("A-2")), (0, 1))

    def test_non_owner_cannot_change_public_record(self):
        self.owner.call("/api/save-character", sheet("B-1", "林风", "原文"))
        self.owner.call("/api/fan/publish", {"character_codes": ["B-1"]})
        fid = self.public(self.owner, "B-1")[0]["id"]

        # 同编号保存只写进自己的名册，不改别人的公开记录
        self.assertEqual(self.other.call("/api/save-character", sheet("B-1", "冒名", "篡改"))[0], 200)
        self.assertEqual(self.other.call("/api/save-all-characters", {"characters": [{"code": "B-1", "name": "冒名", "story": "篡改"}]})[0], 200)
        self.assertEqual([(r["name"], r["story"]) for r in self.public(self.owner, "B-1")], [("林风", "原文")])
        self.assertEqual(self.other.call("/api/fan/toggle", {"id": fid, "is_public": False})[0], 403)
        self.assertEqual(self.other.call("/api/fan/publish", {"character_codes": ["B-1"]})[1]["published"], 1)
        mine_flags = sorted((r["name"], r["is_mine"]) for r in self.public(self.other, "B-1"))
        self.assertEqual(mine_flags, [("冒名", True), ("林风", False)])


if __name__ == "__main__":
    unittest.main()
