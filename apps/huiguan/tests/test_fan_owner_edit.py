"""Fan revisions requeue the original gallery card for independent review."""

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
    "s.init_user_db(); c = s.db(); c.execute(\"INSERT INTO local_users (username, pass_hash, nickname, role, status, is_fan_reviewer, created_at, last_login) VALUES ('owner_test', ?, 'owner_test', 'executor', 'active', 1, '', '')\", (s.hash_password('test-password-123'),)); s.legal_consent.record(c, 'local', c.execute(\"SELECT uid FROM local_users WHERE username='owner_test'\").fetchone()[0]); c.execute(\"INSERT INTO local_users (username,pass_hash,nickname,role,status) VALUES ('moderator_test',?,'Moderator Fixture','admin','active')\", (s.hash_password('test-password-123'),)); s.legal_consent.record(c, 'local', c.execute(\"SELECT uid FROM local_users WHERE username='moderator_test'\").fetchone()[0]); c.commit(); c.close(); "
    "http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2])), s.Handler).serve_forever()"
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
        cls.owner, cls.other, cls.reviewer = Client(cls.base), Client(cls.base), Client(cls.base)
        # owner_test 是同人审核员、other_test 是普通作者，moderator_test 独立审核。
        status, _ = cls.owner.call("/api/auth", {"username": "owner_test", "password": "test-password-123"})
        assert status == 200, status
        assert cls.reviewer.call("/api/auth", {"username": "moderator_test", "password": "test-password-123"})[0] == 200
        status, _ = cls.other.call("/api/register", {"legal_version": LEGAL_VERSION, "username": "other_test", "password": "test-password-123", "nickname": "other_test", "email": "t@example.com"})
        assert status == 200, status

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(10)
        cls.root.cleanup()

    def public(self, client, code):
        # 测试设表都没有立绘，属于「纯文字设」分区
        _, listing = client.call("/api/fan/list?limit=60&view=text")
        return [c for c in listing["characters"] if c["code"] == code]

    def queue_item(self, client, fid):
        status, response = client.call("/api/fan/review/queue")
        self.assertEqual(status, 200)
        return next(r for r in response["characters"] if r["id"] == fid)

    def decide(self, client, row, decision="approve"):
        return client.call("/api/fan/review/decide", {"id": row["id"], "decision": decision,
                           "review_version": row["review_version"], "note": "Fixture review reason"})

    def publish(self, code):
        return self.owner.call("/api/fan/publish", {"character_codes": [code]})

    def test_owner_edits_published_character_in_place(self):
        code = "A-1"
        original = sheet(code, "阿青", "旧故事")
        self.assertEqual(self.owner.call("/api/save-character", original)[0], 200)
        self.assertEqual(self.publish(code)[1]["published"], 1)
        published = self.public(self.other, code)[0]
        fid = published["id"]  # Existing reviewer first-publication rule remains.
        self.assertEqual(self.other.call("/api/fan/react", {"character_id": fid, "type": "up"})[0], 200)
        self.assertEqual(self.other.call("/api/fan/react", {"character_id": fid, "type": "fav"})[0], 200)
        self.assertEqual(self.other.call("/api/fan/reactions")[1]["up"][str(fid)], 1)
        self.assertFalse(self.owner.call("/api/save-character", original)[1]["fan_review_pending"])
        self.assertEqual(self.public(self.other, code)[0]["id"], fid)

        age_edit = sheet(code, "阿青", "旧故事")
        age_edit["data"]["age"] = 123
        self.assertTrue(self.owner.call("/api/save-character", age_edit)[1]["fan_review_pending"])
        self.assertEqual(self.public(self.other, code), [])
        first_revision = self.queue_item(self.reviewer, fid)
        own = self.queue_item(self.owner, fid)
        self.assertTrue(first_revision["needs_independent_review"] and first_revision["can_approve"])
        self.assertFalse(own["can_approve"])
        self.assertEqual(self.decide(self.owner, own)[1]["code"], "fan_revision_self_review_forbidden")

        art_edit = sheet(code, "阿青", "旧故事")
        art_edit["data"].update(age=123, art_source="ai")
        self.assertTrue(self.owner.call("/api/save-character", art_edit)[1]["fan_review_pending"])
        self.assertEqual(self.decide(self.reviewer, first_revision)[0], 409)
        self.assertEqual(self.publish(code)[1]["pending"], 1)
        self.assertEqual(self.public(self.other, code), [])
        active = self.queue_item(self.reviewer, fid)
        self.assertEqual(active["art_source"], "ai")
        self.assertEqual(self.decide(self.reviewer, active)[0], 200)
        row = self.public(self.other, code)[0]
        self.assertEqual((row["id"], row["like_count"], row["is_mine"]), (fid, 1, False))
        self.assertEqual(self.other.call("/api/fan/reactions")[1]["fav"][str(fid)], 1)

        self.assertEqual(self.owner.call("/api/fan/toggle", {"id": fid,"is_public":False})[0], 200)
        art_edit["data"]["story"] = "私下修改"
        self.assertFalse(self.owner.call("/api/save-character",art_edit)[1]["fan_review_pending"])
        self.assertNotIn(fid, [r["id"] for r in self.reviewer.call("/api/fan/review/queue")[1]["characters"]])
        self.assertEqual(self.publish(code)[1]["pending"], 1)
        self.assertEqual(self.public(self.owner, code), [])
        self.assertEqual(self.decide(self.reviewer, self.queue_item(self.reviewer, fid))[0], 200)
        self.assertEqual(self.public(self.owner, code)[0]["id"], fid)

        # Editing the saved code still revises the original card instead of moving reactions.
        renamed = sheet("A-2", "阿青·改", "换编号")
        renamed["previous_code"] = code
        self.assertTrue(self.owner.call("/api/save-character", renamed)[1]["fan_review_pending"])
        self.assertEqual(self.public(self.owner, code), [])
        self.assertEqual(self.decide(self.reviewer, self.queue_item(self.reviewer, fid))[0], 200)
        self.assertEqual(self.public(self.owner, "A-2")[0]["id"], fid)
        _, history = self.reviewer.call(f"/api/admin/fan/history?id={fid}")
        newer = history["events"][:2]
        self.assertEqual([(event["action"], event["actor_name"]) for event in newer],
                         [("review_approve", "Moderator Fixture"), ("owner_revision_submitted", "owner_test")])
        _, mine = self.owner.call("/api/get-characters")
        codes = [c["code"] for c in mine["characters"]]
        self.assertEqual((codes.count(code), codes.count("A-2")), (0, 1))

    def test_legacy_code_only_link_cannot_erase_independent_review(self):
        # Direct submissions historically have a blank gallery code.
        draft = sheet("legacy-link", "未编号原稿", "同一段")["data"]
        status, created = self.owner.call("/api/fan/submit", draft)
        self.assertEqual((status, created["review_status"]), (200, "approved"))
        fid = created["id"]
        _, gallery = self.reviewer.call("/api/fan/list?view=text")
        row = next(r for r in gallery["characters"] if r["id"] == fid)
        self.assertEqual(self.decide(self.reviewer, row, "reject")[0], 200)
        self.assertEqual(self.owner.call("/api/fan/toggle", {"id": fid, "is_public": True})[1]["review_status"], "pending")
        self.assertFalse(self.queue_item(self.owner, fid)["needs_independent_review"])
        self.assertEqual(self.owner.call("/api/save-character", {"code": "legacy-link", "data": draft})[0], 200)
        self.assertEqual(self.publish("legacy-link")[1]["pending"], 1)
        changed = self.queue_item(self.owner, fid)
        self.assertEqual(changed["code"], "legacy-link")
        self.assertTrue(changed["needs_independent_review"])
        self.assertEqual(self.decide(self.owner, changed)[0], 403)
        self.assertEqual(self.decide(self.reviewer, self.queue_item(self.reviewer, fid))[0], 200)
        self.assertEqual(self.public(self.owner, "legacy-link")[0]["id"], fid)

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
        self.assertEqual([r["name"] for r in self.public(self.other, "B-1")], ["林风"])  # 冒名的还在待审核
        _, queue = self.owner.call("/api/fan/review/queue")
        pending = [r for r in queue["characters"] if r["code"] == "B-1"]
        self.assertEqual([r["name"] for r in pending], ["冒名"])
        self.assertEqual(self.owner.call("/api/fan/review/decide", {"id": pending[0]["id"], "decision": "approve", "review_version": pending[0]["review_version"]})[0], 200)
        mine_flags = sorted((r["name"], r["is_mine"]) for r in self.public(self.other, "B-1"))
        self.assertEqual(mine_flags, [("冒名", True), ("林风", False)])

    def test_unpublished_draft_keeps_first_submission_rule(self):
        # 从未公开过的草稿：作者本人是审核员时，改稿不需要另一位审核员。
        code = "D-1"
        self.assertEqual(self.owner.call("/api/save-character", sheet(code, "草稿角色", "初稿"))[0], 200)
        self.assertFalse(self.owner.call("/api/save-character", sheet(code, "草稿角色", "改过一遍"))[1]["fan_review_pending"])
        body = self.publish(code)[1]
        self.assertEqual((body["published"], body["pending"]), (1, 0))
        published = self.public(self.other, code)
        self.assertEqual(len(published), 1)
        fid = published[0]["id"]

        # 公开之后再改，才要求另一位审核员处理。
        self.assertTrue(self.owner.call("/api/save-character", sheet(code, "草稿角色", "公开后再改"))[1]["fan_review_pending"])
        self.assertEqual(self.public(self.other, code), [])
        self.assertTrue(self.queue_item(self.reviewer, fid)["needs_independent_review"])
        self.assertFalse(self.queue_item(self.owner, fid)["can_approve"])
        self.assertEqual(self.decide(self.owner, self.queue_item(self.owner, fid))[1]["code"], "fan_revision_self_review_forbidden")
        self.assertEqual(self.decide(self.reviewer, self.queue_item(self.reviewer, fid))[0], 200)
        self.assertEqual(self.public(self.other, code)[0]["id"], fid)


if __name__ == "__main__":
    unittest.main()
