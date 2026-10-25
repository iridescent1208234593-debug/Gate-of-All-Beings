"""官方角色档案 主册角色页 / 副册 的同人图：反应共用、排名公式、评论两套线程、删除不留孤儿数据。

在临时数据根下起一个真实服务（子进程），只用临时 users.db，不碰真实数据。
"""

import http.client
import io
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import uuid
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parents[1]

BOOT = r'''
import json, os, sys, http.server
sys.path.insert(0, sys.argv[1])
sys.path.insert(0, str(__import__("pathlib").Path(sys.argv[1]).parents[1] / "server"))
from storage_paths import initialize_storage; initialize_storage(); import server_huiguan as s
s.init_user_db()
conn = s.db()
sids = {}
for name in ("owner", "alice", "bob"):
    uid = conn.execute("INSERT INTO local_users (username, pass_hash, nickname, role, status, created_at) VALUES (?,?,?,?,?,?)",
                       (name, "x", name, "user", "active", "2026-10-21")).lastrowid
    sids[name] = uid
arts = {}
for key, created in (("old", "2026-10-01"), ("mid", "2026-10-02"), ("new", "2026-10-03")):
    arts[key] = conn.execute("INSERT INTO official_fanart (character_id,user_kind,user_uid,user_name,image_url,caption,created_at) VALUES (1,'local',?,?,?,?,?)",
                             (str(sids["owner"]), "owner", "/assets/uploads/x.png", key, created)).lastrowid
conn.commit(); conn.close()
sessions = {n: s.create_session("local", str(uid)) for n, uid in sids.items()}
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), s.Handler)
print(json.dumps({"port": srv.server_address[1], "sessions": sessions, "arts": arts, "db": s.USER_DB}), flush=True)
srv.serve_forever()
'''


class FanartVolumesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = tempfile.mkdtemp(prefix="fanart-volumes-")
        (Path(cls.root) / "portal" / "huiguan").mkdir(parents=True)
        cls.err = open(os.path.join(cls.root, "server.err"), "w")
        env = {**os.environ, "IRIDESCENTLY_STORAGE_ROOT": cls.root, "IRIDESCENTLY_ENVIRONMENT": "test", "PYTHONIOENCODING": "utf-8"}
        for key in ("DATA", "ASSETS", "CACHE", "RELEASE", "BACKUP", "PROJECT"):
            env.pop(f"IRIDESCENTLY_{key}_ROOT", None)
        cls.proc = subprocess.Popen([sys.executable, "-c", BOOT, str(HERE)], env=env, stdout=subprocess.PIPE, stderr=cls.err, text=True)
        info = json.loads(cls.proc.stdout.readline())
        cls.port, cls.sessions, cls.arts, cls.db_path = info["port"], info["sessions"], info["arts"], info["db"]
        assert cls.root in cls.db_path

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate(); cls.proc.wait(timeout=10)
        cls.proc.stdout.close(); cls.err.close()
        import shutil
        if os.environ.get("KEEP_FANART_TEST_ROOT") != "1":
            shutil.rmtree(cls.root, ignore_errors=True)

    def call(self, method, path, user=None, body=None, raw=None, ctype="application/json"):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=20)
        headers = {"Content-Type": ctype}
        if user:
            headers["Cookie"] = "session=" + self.sessions[user]
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        c.request(method, path, body=data, headers=headers)
        r = c.getresponse(); out = (r.status, json.loads(r.read() or b"{}")); c.close()
        return out

    def react(self, user, fid, rtype):
        st, d = self.call("POST", "/api/official/fanart/react", user, {"id": fid, "type": rtype})
        self.assertEqual(st, 200, d)
        return d["state"]

    def items(self, sort="", user=None):
        q = "&sort=" + sort if sort else ""
        return {i["id"]: i for i in self.call("GET", f"/api/official/fanart?cid=1&limit=30{q}", user)[1]["items"]}

    def test_1_reactions_are_shared_and_ranked(self):
        a = self.arts
        # old: 喜欢 2 + 点赞 1 = 3；mid: 点赞 2 + 喜欢 1 = 3（同分，mid 更新）；new: 点赞 1 - 踩 1×2 = -1
        self.react("alice", a["old"], "fav"); self.react("bob", a["old"], "fav"); self.react("alice", a["old"], "up")
        self.react("alice", a["mid"], "up"); self.react("bob", a["mid"], "up"); self.react("owner", a["mid"], "fav")
        self.react("alice", a["new"], "up"); self.react("bob", a["new"], "down")
        # 改票：bob 先赞后踩，只算一次踩
        self.react("owner", a["new"], "up"); state = self.react("owner", a["new"], "up")
        self.assertEqual((state["up"], state["down"], state["my_vote"]), (1, 1, 0))
        main, sub = self.items(user="alice"), self.items("popular", user="alice")
        for fid in a.values():  # 主册角色页（默认排序）与副册（popular）读到同一份数字
            for key in ("likes", "up", "down", "score", "liked", "my_vote"):
                self.assertEqual(main[fid][key], sub[fid][key], (fid, key))
        self.assertEqual([main[a[k]]["score"] for k in ("old", "mid", "new")], [3, 3, -1])
        self.assertEqual(list(sub), [a["mid"], a["old"], a["new"]])  # 同分时新上传在前
        self.assertEqual(list(main), [a["new"], a["mid"], a["old"]])  # 主册角色页仍按最新在前
        self.assertEqual((main[a["old"]]["liked"], main[a["old"]]["my_vote"]), (True, 1))
        cover = self.call("GET", "/api/official/fanart/summary?cids=1")[1]["summary"]["1"]
        self.assertEqual(cover["count"], 3)

    def test_2_comment_threads_are_independent(self):
        fid = self.arts["old"]
        st, main = self.call("POST", "/api/official/fanart/comment", "alice", {"id": fid, "content": "主册：角色设定讨论"})
        self.assertEqual((st, main["count"]), (200, 1))
        st, sub = self.call("POST", "/api/official/fanart/comment", "bob", {"id": fid, "content": "副册：这张画得真好", "thread": "sub"})
        self.assertEqual((st, sub["count"]), (200, 1))
        main_list = self.call("GET", f"/api/official/fanart/comments?id={fid}")[1]["comments"]
        sub_list = self.call("GET", f"/api/official/fanart/comments?id={fid}&thread=sub")[1]["comments"]
        self.assertEqual([c["content"] for c in main_list], ["主册：角色设定讨论"])
        self.assertEqual([c["content"] for c in sub_list], ["副册：这张画得真好"])
        item = self.items()[fid]
        self.assertEqual((item["comments"], item["sub_comments"]), (1, 1))
        # 两张表各自编号：alice 用副册语境删「主册评论的编号」，命中的是副册里 bob 的评论 → 无权删除；主册评论不受影响
        self.assertEqual(self.call("POST", "/api/official/fanart/comment/delete", "alice", {"id": main["id"], "thread": "sub"})[0], 403)
        self.assertEqual(len(self.call("GET", f"/api/official/fanart/comments?id={fid}")[1]["comments"]), 1)
        self.assertEqual(len(self.call("GET", f"/api/official/fanart/comments?id={fid}&thread=sub")[1]["comments"]), 1)
        # 主册删除自己的评论，只影响主册
        st, d = self.call("POST", "/api/official/fanart/comment/delete", "alice", {"id": main["id"]})
        self.assertEqual((st, d["count"]), (200, 0))
        self.assertEqual(len(self.call("GET", f"/api/official/fanart/comments?id={fid}&thread=sub")[1]["comments"]), 1)
        self.assertEqual(self.call("GET", f"/api/official/fanart/comments?id={fid}&thread=other")[0], 400)

    def test_3_delete_leaves_no_orphans(self):
        fid = self.arts["mid"]
        self.call("POST", "/api/official/fanart/comment", "alice", {"id": fid, "content": "主册评论"})
        self.call("POST", "/api/official/fanart/comment", "alice", {"id": fid, "content": "副册评论", "thread": "sub"})
        self.assertEqual(self.call("POST", "/api/official/fanart/delete", "alice", {"id": fid})[0], 403)
        self.assertEqual(self.call("POST", "/api/official/fanart/delete", "owner", {"id": fid})[0], 200)
        import sqlite3
        conn = sqlite3.connect(self.db_path)
        try:
            for table in ("official_fanart", "official_fanart_likes", "official_fanart_votes",
                          "official_fanart_comments", "official_fanart_sub_comments"):
                col = "id" if table == "official_fanart" else "fanart_id"
                self.assertEqual(conn.execute(f"SELECT COUNT(*) FROM {table} WHERE {col}=?", (fid,)).fetchone()[0], 0, table)
        finally:
            conn.close()
        self.assertEqual(self.call("POST", "/api/official/fanart/react", "alice", {"id": fid, "type": "up"})[0], 404)

    def test_4_other_uploads_and_old_like_endpoint_unchanged(self):
        buf = io.BytesIO(); Image.new("P", (8, 8)).save(buf, "GIF")
        gif = buf.getvalue() + b"\0" * (6 * 1024 * 1024 - len(buf.getvalue()))
        bd = uuid.uuid4().hex
        form = (f'--{bd}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n{{}}\r\n--{bd}\r\n'
                f'Content-Disposition: form-data; name="image"; filename="a.gif"\r\nContent-Type: image/gif\r\n\r\n').encode() + gif + f"\r\n--{bd}--\r\n".encode()
        st, d = self.call("POST", "/api/images/upload", "alice", raw=form, ctype="multipart/form-data; boundary=" + bd)
        self.assertEqual(st, 400, d)  # 其他上传仍是 动图 ≤5MB
        st, d = self.call("POST", "/api/official/fanart/like", "bob", {"id": self.arts["new"]})
        self.assertEqual((st, d["liked"]), (200, True))  # 旧的喜欢接口照常可用，并计入同一份喜欢
        self.assertEqual(self.items()[self.arts["new"]]["likes"], 1)


if __name__ == "__main__":
    unittest.main()
