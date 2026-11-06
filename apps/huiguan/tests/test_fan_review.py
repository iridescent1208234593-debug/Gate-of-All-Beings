"""Fan Review: the fan gallery, its fallback showcase and the B站 Toy only show approved entries.

Covers the reviewer role (granted by admin/elder or by an approved application), the review queue,
approve / reject, edits sending an entry back to review, the art / text / ai gallery views, and the
one-time migration that keeps entries that were already public before review existed.
"""

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
PRELUDE = r'''
import sys, http.server
sys.path.insert(0, sys.argv[1])
sys.path.insert(0, str(__import__("pathlib").Path(sys.argv[1]).parents[1] / "services" / "platform"))
from storage_paths import initialize_storage; initialize_storage(); import server_huiguan as s
'''
SEED = PRELUDE + r'''
s.init_user_db()
conn = s.db()
for username, role, reviewer in (("admin_user", "admin", 0), ("reviewer_user", "executor", 1),
                                 ("author_user", "executor", 0), ("applicant_user", "executor", 0),
                                 ("elder_user", "elder", 0)):
    conn.execute("INSERT INTO local_users (username, pass_hash, nickname, role, status, is_fan_reviewer, created_at, last_login) VALUES (?,?,?,?,?,?,?,?)",
                 (username, s.hash_password("test-password-123"), username, role, "active", reviewer, s.now_iso(), s.now_iso()))
conn.commit(); conn.close()
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[2])), s.Handler).serve_forever()
'''
# A database from before Fan Review: fan_characters without the review columns.
LEGACY = PRELUDE + r'''
import os, sqlite3
os.makedirs(os.path.dirname(s.USER_DB), exist_ok=True)
old = sqlite3.connect(s.USER_DB)
old.execute("DROP TABLE IF EXISTS fan_characters")  # importing the server may already have created the current schema
old.execute("""CREATE TABLE fan_characters (id INTEGER PRIMARY KEY AUTOINCREMENT, user_kind TEXT NOT NULL, user_uid TEXT NOT NULL,
    user_name TEXT DEFAULT '', name TEXT NOT NULL, type TEXT DEFAULT '', species TEXT DEFAULT '', gender TEXT DEFAULT '',
    faction TEXT DEFAULT '', ability TEXT DEFAULT '', appearance TEXT DEFAULT '', story TEXT DEFAULT '', image_data TEXT DEFAULT '',
    is_public INTEGER DEFAULT 1, code TEXT DEFAULT '', created_at TEXT, updated_at TEXT)""")
old.execute("INSERT INTO fan_characters (user_kind, user_uid, user_name, name, image_data, is_public, code) VALUES ('local','9','旧作者','旧公开','/assets/uploads/" + "c" * 32 + ".png',1,'OLD-1')")
old.execute("INSERT INTO fan_characters (user_kind, user_uid, user_name, name, image_data, is_public, code) VALUES ('local','9','旧作者','旧私密','/assets/uploads/" + "d" * 32 + ".png',0,'OLD-2')")
old.commit(); old.close()
s.init_user_db()
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


def start(test_class, launch):
    test_class.root = tempfile.TemporaryDirectory()
    (Path(test_class.root.name) / "apps" / "huiguan").mkdir(parents=True)
    port = free_port()
    env = dict(os.environ, IRIDESCENTLY_STORAGE_ROOT=test_class.root.name,
               IRIDESCENTLY_ENVIRONMENT="test", HX_SSO_SECRET="test-only-secret")
    for key in ("DATA", "ASSETS", "CACHE", "RELEASE", "BACKUP", "PROJECT"):
        env.pop(f"IRIDESCENTLY_{key}_ROOT", None)
    test_class.proc = subprocess.Popen([sys.executable, "-c", launch, str(HUIGUAN), str(port)], env=env,
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    test_class.base = f"http://127.0.0.1:{port}"
    for _ in range(100):
        try:
            urllib.request.urlopen(test_class.base + "/api/fan/list", timeout=1).close()
            return
        except OSError:
            time.sleep(0.1)
    stop(test_class)
    raise RuntimeError("huiguan test server did not start")


def stop(test_class):
    test_class.proc.terminate()
    test_class.proc.wait(10)
    test_class.root.cleanup()


def sheet(code, name, story, image=None, art_source=None):
    data = {"code": code, "name": name, "story": story, "species": "猫妖"}
    if image:
        data["image"] = image
    if art_source:
        data["art_source"] = art_source
    return {"code": code, "data": data, "html": "<html><body>" + story + "</body></html>"}


def upload(n):
    return "/assets/uploads/" + f"{n:064x}" + ".png"


class FanReviewTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        start(cls, SEED)

    @classmethod
    def tearDownClass(cls):
        stop(cls)

    def login(self, username):
        client = Client(self.base)
        status, result = client.call("/api/auth", {"username": username, "password": PASSWORD})
        self.assertEqual(status, 200, result)
        return client

    def listed(self, view="art", client=None):
        status, listing = (client or Client(self.base)).call("/api/fan/list?limit=60&view=" + view)
        self.assertEqual(status, 200, listing)
        return listing

    def codes(self, view="art"):
        return [c["code"] for c in self.listed(view)["characters"]]

    def my_row(self, client, code):
        _, mine = client.call("/api/fan/my")
        return next(r for r in mine["characters"] if r["code"] == code)

    def publish(self, client, *sheets):
        for body in sheets:
            self.assertEqual(client.call("/api/save-character", body)[0], 200)
        status, result = client.call("/api/fan/publish", {"character_codes": [b["code"] for b in sheets]})
        self.assertEqual(status, 200, result)
        return result

    def test_author_entry_waits_for_review_then_shows(self):
        author, reviewer = self.login("author_user"), self.login("reviewer_user")
        result = self.publish(author, sheet("R-1", "青岚", "第一版", upload(1)))
        self.assertEqual((result["published"], result["pending"]), (1, 1))
        self.assertNotIn("R-1", self.codes())
        row = self.my_row(author, "R-1")
        self.assertEqual(row["review_status"], "pending")
        self.assertNotIn("reviewed_by", row)

        # 普通作者看不到审核队列，也不能做决定
        self.assertEqual(author.call("/api/fan/review/queue")[0], 403)
        self.assertEqual(author.call("/api/fan/review/decide", {"id": row["id"], "decision": "approve"})[0], 403)

        _, queue = reviewer.call("/api/fan/review/queue")
        item = next(r for r in queue["characters"] if r["code"] == "R-1")
        self.assertNotIn("user_uid", item)
        status, result = reviewer.call("/api/fan/review/decide", {"id": item["id"], "decision": "approve", "review_version": item["review_version"]})
        self.assertEqual((status, result["review_status"]), (200, "approved"))
        self.assertIn("R-1", self.codes())

        # 作者修改已通过的设表：内容变了就重新进入审核，审核前不在画廊
        self.assertEqual(author.call("/api/save-character", sheet("R-1", "青岚", "第二版", upload(1)))[0], 200)
        self.assertEqual(self.my_row(author, "R-1")["review_status"], "pending")
        self.assertNotIn("R-1", self.codes())

    def test_stale_review_cannot_approve_edited_content(self):
        author, reviewer = self.login("author_user"), self.login("reviewer_user")
        self.publish(author, sheet("R-STALE", "旧稿", "审核员看到的内容", upload(3)))
        _, queue = reviewer.call("/api/fan/review/queue")
        item = next(r for r in queue["characters"] if r["code"] == "R-STALE")
        body = {"id": item["id"], "decision": "approve", "review_version": item["review_version"]}
        self.assertEqual(author.call("/api/save-character", sheet("R-STALE", "新稿", "尚未审核的新内容", upload(3)))[0], 200)
        self.assertEqual(reviewer.call("/api/fan/review/decide", body)[0], 409)
        self.assertEqual(self.my_row(author, "R-STALE")["review_status"], "pending")
        self.assertNotIn("R-STALE", self.codes())
        self.assertEqual(reviewer.call("/api/fan/review/decide", {"id": item["id"], "decision": "approve"})[0], 409)
        _, queue = reviewer.call("/api/fan/review/queue")
        current = next(r for r in queue["characters"] if r["code"] == "R-STALE")
        body["review_version"] = current["review_version"]
        self.assertEqual(reviewer.call("/api/fan/review/decide", body)[0], 200)
        self.assertIn("R-STALE", self.codes())

    def test_reject_needs_a_note_and_republish_resubmits(self):
        author, reviewer = self.login("author_user"), self.login("reviewer_user")
        self.publish(author, sheet("R-2", "赤羽", "设定", upload(2)))
        fid = self.my_row(author, "R-2")["id"]
        _, queue = reviewer.call("/api/fan/review/queue")
        version = next(r["review_version"] for r in queue["characters"] if r["id"] == fid)
        self.assertEqual(reviewer.call("/api/fan/review/decide", {"id": fid, "decision": "reject"})[0], 400)
        status, _ = reviewer.call("/api/fan/review/decide", {"id": fid, "decision": "reject", "note": "立绘看不清，请换一张", "review_version": version})
        self.assertEqual(status, 200)
        row = self.my_row(author, "R-2")
        self.assertEqual((row["review_status"], row["review_note"]), ("rejected", "立绘看不清，请换一张"))
        self.assertNotIn("R-2", self.codes())
        # 取消公开再重新公开 = 重新提交审核
        author.call("/api/fan/toggle", {"id": fid, "is_public": False})
        status, result = author.call("/api/fan/toggle", {"id": fid, "is_public": True})
        self.assertEqual((status, result["review_status"]), (200, "pending"))

    def test_views_split_art_text_and_ai(self):
        admin = self.login("admin_user")
        result = self.publish(admin, sheet("V-ART", "有图", "有图", upload(10)),
                              sheet("V-TEXT", "文字设", "只有文字"),
                              sheet("V-AI", "AI 立绘", "AI", upload(11), "ai"))
        self.assertEqual(result["pending"], 0)  # 管理员自己的公开直接通过
        self.assertIn("V-ART", self.codes("art"))
        self.assertNotIn("V-TEXT", self.codes("art"))
        self.assertNotIn("V-AI", self.codes("art"))
        self.assertEqual(self.codes("text").count("V-TEXT"), 1)
        self.assertEqual(self.codes("ai").count("V-AI"), 1)
        listing = self.listed("art")
        self.assertEqual(set(listing["counts"]), {"art", "text", "ai"})
        self.assertEqual(Client(self.base).call("/api/fan/list?view=bogus")[0], 400)
        # 审核员把已通过的设表更正为 AI：移到 AI 分区
        reviewer = self.login("reviewer_user")
        fid = self.my_row(admin, "V-ART")["id"]
        item = next(r for r in self.listed(client=reviewer)["characters"] if r["id"] == fid)
        status, _ = reviewer.call("/api/fan/review/decide", {"id": fid, "decision": "approve", "art_source": "ai", "review_version": item["review_version"]})
        self.assertEqual(status, 200)
        self.assertNotIn("V-ART", self.codes("art"))
        self.assertIn("V-ART", self.codes("ai"))
        # B站 Toy 与画廊默认分区同一口径
        with urllib.request.urlopen(self.base + "/api/toy/archive", timeout=10) as res:
            toy = [c["code"] for c in json.loads(res.read())["fan"]]
        for hidden in ("V-TEXT", "V-AI", "V-ART"):
            self.assertNotIn(hidden, toy)

    def test_reviewer_role_by_application_and_by_member_admin(self):
        applicant, admin, elder = self.login("applicant_user"), self.login("admin_user"), self.login("elder_user")
        _, me = applicant.call("/api/user")
        self.assertEqual((me["can_review_fan"], me["fan_reviewer_pending"]), (False, False))
        status, result = applicant.call("/api/fan/reviewer-apply", {"message": "常在群里，愿意帮忙审核"})
        self.assertEqual(status, 200, result)
        self.assertEqual(applicant.call("/api/fan/reviewer-apply", {"message": "再来一次"})[0], 409)
        _, me = applicant.call("/api/user")
        self.assertEqual((me["fan_reviewer_pending"], me["scribe_pending"]), (True, False))
        # 编辑申请与审核员申请互不占用
        self.assertEqual(applicant.call("/api/official/scribe-apply", {"message": "也想当编辑"})[0], 200)

        _, requests = admin.call("/api/admin/scribe-requests")
        mine = {r["requested_role"]: r for r in requests["requests"] if r["user_name"] == "applicant_user"}
        self.assertEqual(set(mine), {"scribe", "fan_reviewer"})
        self.assertEqual(admin.call("/api/admin/scribe/decide", {"id": mine["fan_reviewer"]["id"], "approve": True})[0], 200)
        _, me = applicant.call("/api/user")
        self.assertEqual((me["can_review_fan"], me["is_fan_reviewer"], me["edit_role"]), (True, True, "none"))

        # 长老在成员管理里撤销 / 授予审核员
        _, members = elder.call("/api/member/users")
        target = next(u for u in members["users"] if u["name"] == "applicant_user")
        self.assertTrue(target["is_fan_reviewer"])
        status, _ = elder.call("/api/member/user/update", {"kind": "local", "uid": target["uid"], "set": {"is_fan_reviewer": False}})
        self.assertEqual(status, 200)
        _, me = applicant.call("/api/user")
        self.assertFalse(me["can_review_fan"])
        self.assertEqual(elder.call("/api/member/user/update", {"kind": "local", "uid": target["uid"], "set": {"is_fan_reviewer": "yes"}})[0], 400)


class FanReviewMigrationTest(unittest.TestCase):
    """Owner decision 2026-11-06: every entry from before review existed goes to review; none is deleted or unpublished."""

    @classmethod
    def setUpClass(cls):
        start(cls, LEGACY)

    @classmethod
    def tearDownClass(cls):
        stop(cls)

    def test_legacy_entries_wait_for_review_and_keep_their_data(self):
        _, listing = Client(self.base).call("/api/fan/list?limit=60")
        self.assertEqual(listing["characters"], [])
        with urllib.request.urlopen(self.base + "/api/toy/archive", timeout=10) as res:
            self.assertEqual(json.loads(res.read())["fan"], [])
        import sqlite3
        db = sqlite3.connect(next(Path(self.root.name).rglob("users.db")))
        rows = db.execute("SELECT code, is_public, review_status, image_data FROM fan_characters ORDER BY code").fetchall()
        db.close()
        self.assertEqual([r[:3] for r in rows], [("OLD-1", 1, "pending"), ("OLD-2", 0, "pending")])
        self.assertTrue(all(r[3] for r in rows))


if __name__ == "__main__":
    unittest.main()
