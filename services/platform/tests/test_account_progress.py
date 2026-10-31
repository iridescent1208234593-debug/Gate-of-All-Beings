"""Account points, level curve, daily caps, leaderboards and the points reset.

Runs against a temporary project root: IRIDESCENTLY_PROJECT_ROOT is set before any
server module is imported, so the real huiguan/users.db is never opened.
"""
import http.client
import importlib
import json
import os
import sqlite3
import sys
import tempfile
import threading
import unittest
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TEMP = tempfile.TemporaryDirectory(prefix="account-progress-", ignore_cleanup_errors=True)
sys.path.insert(0, str(ROOT / "services" / "platform"))
from testing_storage import configure
from storage_paths import assets_root
DATA = configure(TEMP.name)
(DATA / "huiguan").mkdir(parents=True, exist_ok=True)
os.environ["IRIDESCENTLY_PROJECT_ROOT"] = str(ROOT)
os.environ.setdefault("HX_SSO_SECRET", "test-secret-for-account-progress")
sys.path.insert(0, str(ROOT / "services" / "platform"))
sys.path.insert(0, str(ROOT))
# Importing the 会馆 module creates the real schema (local_users, user_flags, ...) in the temp users.db.
huiguan = importlib.import_module("apps.huiguan.server_huiguan")
import account_progress as ap  # noqa: E402
import hx_sso  # noqa: E402

DB = DATA / "huiguan" / "users.db"
seed = sqlite3.connect(DB)
seed.executescript("""
INSERT INTO local_users (uid, username, nickname, pass_hash, status, points) VALUES
    (7, 'iridescent', '本地七', 'x', 'active', 40), (8, 'eight', '', 'x', 'active', 0), (9, 'gone', '', 'x', 'banned', 5);
INSERT INTO users (user_id, nickname) VALUES ('7', 'USSO七');
INSERT INTO user_flags (kind, uid, points) VALUES ('usso', '7', 30);
""")
seed.commit()
seed.close()
NOON = datetime(2026, 10, 20, 4, 0, tzinfo=timezone.utc)      # 12:00 北京时间
NEXT_DAY = datetime(2026, 10, 20, 16, 30, tzinfo=timezone.utc)  # 次日 00:30 北京时间


def conn():
    return ap.open_db(DATA)


def report(c, kind, uid, now=NOON, **body):
    return ap.record_report(c, kind, uid, "名" + uid, ap.clean_report(body), now=now)


class LevelCurve(unittest.TestCase):
    def test_each_level_costs_one_more(self):
        self.assertEqual([ap.level_for(x * 10) for x in (0, 1, 2, 3, 5, 6, 9, 10, 15, 55)], [0, 1, 1, 2, 2, 3, 3, 4, 5, 10])
        self.assertEqual(ap.level_for(29), 1)   # 2.9 points
        self.assertEqual(ap.level_for(30), 2)   # 3.0 points
        for n in range(0, 200):
            self.assertEqual(ap.level_for(5 * n * (n + 1)), n)
            if n:
                self.assertEqual(ap.level_for(5 * n * (n + 1) - 1), n - 1)
        info = ap.level_info(70)
        self.assertEqual((info["level"], info["level_floor"], info["next_level_at"]), (3, 6, 10))


class Awards(unittest.TestCase):
    def setUp(self):
        self.c = conn()
        for t in ("account_points", "account_point_events", "game_scores", "game_score_daily", "game_runs"):
            self.c.execute(f"DELETE FROM {t}")

    def tearDown(self):
        self.c.close()

    def test_small_rewards_and_idempotent_runs(self):
        r = report(self.c, "local", "7", game="slay", score=5, finished=True, ref="run-1")
        # play 0.5 + finish 0.2 + daily task "finish any run" 1.0
        self.assertEqual(sorted(a["rule"] for a in r["awarded"]), ["finish", "play", "task-finish"])
        self.assertEqual(r["points"], 1.7)
        again = report(self.c, "local", "7", game="slay", score=5, finished=True, ref="run-1")
        self.assertEqual(again["awarded"], [])
        self.assertEqual(again["points"], 1.7)
        row = self.c.execute("SELECT runs, best_score FROM game_scores WHERE kind='local' AND uid='7' AND game='slay'").fetchone()
        self.assertEqual(tuple(row), (1, 5))
        better = report(self.c, "local", "7", game="slay", score=9, finished=True, won=True, ref="run-2")
        self.assertEqual(sorted(a["rule"] for a in better["awarded"]), ["best", "finish", "win"])
        self.assertAlmostEqual(better["points"], 1.7 + 0.2 + 0.3 + 0.5)

    def test_kind_is_part_of_the_owner(self):
        report(self.c, "local", "7", game="cards", score=4, finished=True, ref="a")
        self.assertEqual(ap.get_points_x10(self.c, "usso", "7"), 0)
        report(self.c, "usso", "7", game="cards", score=2, finished=True, ref="a")
        board = ap.leaderboard(self.c, "cards", me=("usso", "7"))
        self.assertEqual([(r["name"], r["score"]) for r in board["rows"]], [("名7", 4), ("名7", 2)])
        self.assertEqual(board["mine"], {"rank": 2, "score": 2})
        self.assertEqual([r["me"] for r in board["rows"]], [False, True])
        self.assertNotIn("uid", board["rows"][0])

    def test_daily_caps(self):
        for i in range(30):
            report(self.c, "local", "8", game="cards", score=1, finished=True, ref=f"r{i}")
        finish = self.c.execute("SELECT COUNT(*) FROM account_point_events WHERE uid='8' AND rule='finish'").fetchone()[0]
        self.assertEqual(finish, ap.RULES["finish"]["cap"])
        for g in ap.GAMES:
            for i in range(10):
                report(self.c, "local", "8", game=g, score=min(i + 1, ap.GAMES[g]["max"]), finished=True, won=True, ref=f"{g}{i}")
        self.assertEqual(ap.get_points_x10(self.c, "local", "8"), ap.DAILY_CAP_X10)
        s = ap.summary(self.c, "local", "8", now=NOON)
        self.assertEqual(s["today"]["earned"], 8.0)
        self.assertTrue(all(t["done"] for t in s["today"]["tasks"]))
        # The cap is per Beijing day: just after midnight the account can earn again.
        nxt = report(self.c, "local", "8", now=NEXT_DAY, game="cards", score=1, finished=True, ref="tomorrow")
        self.assertGreater(nxt["points"], 8.0)

    def test_explore_task_needs_three_games(self):
        report(self.c, "local", "8", game="cards", score=1)
        report(self.c, "local", "8", game="slay", score=1)
        self.assertEqual(ap.get_points_x10(self.c, "local", "8"), 10)
        r = report(self.c, "local", "8", game="aeon", score=1)
        self.assertIn("task-explore", [a["rule"] for a in r["awarded"]])

    def test_sum_board_is_capped_per_day(self):
        for _ in range(40):
            report(self.c, "local", "8", game="softie", score=5)
        best = self.c.execute("SELECT best_score FROM game_scores WHERE uid='8' AND game='softie'").fetchone()[0]
        self.assertEqual(best, ap.GAMES["softie"]["day_max"])

    def test_validation(self):
        for body in ({"game": "nope", "score": 1}, {"game": "slay", "score": -1}, {"game": "slay", "score": 10**9},
                     {"game": "slay", "score": "9"}, {"game": "slay", "score": float("nan")},
                     {"game": "slay", "score": 1, "finished": True}, {"game": "slay", "score": True}):
            with self.assertRaises(ValueError, msg=body):
                ap.clean_report(body)

    def test_sheet_points_only_for_new_sheets(self):
        a = ap.award_sheet(self.c, "local", "7", "x", "C1", custom_color=True, now=NOON)
        self.assertEqual([x["amount"] for x in a], [1.0, 0.5])
        self.assertEqual(ap.award_sheet(self.c, "local", "7", "x", "C1", now=NOON), [])
        ap.award_sheet(self.c, "local", "7", "x", "C2", now=NOON)
        self.assertEqual(ap.award_sheet(self.c, "local", "7", "x", "C3", now=NOON), [])  # cap 2 per day
        self.assertEqual(ap.get_points_x10(self.c, "local", "7"), 25)

    def test_level_board(self):
        report(self.c, "local", "7", game="slay", score=5, finished=True, ref="x")
        report(self.c, "local", "8", game="slay", score=1)
        board = ap.leaderboard(self.c, "level", me=("local", "8"))
        self.assertEqual([r["name"] for r in board["rows"]], ["名7", "名8"])
        self.assertEqual(board["mine"]["rank"], 2)


class TieBreak(unittest.TestCase):
    def test_my_rank_matches_the_row_order_on_ties(self):
        c = conn()
        try:
            for t in ("account_points", "account_point_events", "game_scores", "game_score_daily", "game_runs"):
                c.execute(f"DELETE FROM {t}")
            for uid in ("7", "8"):
                report(c, "local", uid, game="slay", score=4, finished=True, ref="same")
            c.execute("UPDATE account_points SET updated_at='2026-10-20T00:00:00+00:00'")
            c.execute("UPDATE game_scores SET best_at='2026-10-20T00:00:00+00:00'")
            for board in ("level", "slay"):
                for me in (("local", "7"), ("local", "8")):
                    data = ap.leaderboard(c, board, me=me)
                    shown = next(r["rank"] for r in data["rows"] if r["me"])
                    self.assertEqual(data["mine"]["rank"], shown, (board, me))
        finally:
            c.close()


class Reset(unittest.TestCase):
    def test_reset_archives_zeroes_and_restores(self):
        c = conn()
        try:
            c.execute("UPDATE local_users SET points=40 WHERE uid=7")
            c.execute("UPDATE user_flags SET points=30 WHERE kind='usso' AND uid='7'")
            report(c, "local", "8", game="slay", score=3, finished=True, ref="pre")
            plan = ap.reset_plan(c)
            self.assertEqual((plan["legacy_accounts_with_points"], plan["legacy_points_total"]), (3, 75))
            ap.apply_reset(c)
            self.assertEqual(c.execute("SELECT COALESCE(SUM(points),0) FROM local_users").fetchone()[0], 0)
            self.assertEqual(c.execute("SELECT COALESCE(SUM(points),0) FROM user_flags").fetchone()[0], 0)
            self.assertEqual(c.execute("SELECT COUNT(*) FROM account_points").fetchone()[0], 0)
            # Leaderboard scores survive; only points are reset.
            self.assertEqual(c.execute("SELECT best_score FROM game_scores WHERE uid='8' AND game='slay'").fetchone()[0], 3)
            with self.assertRaises(RuntimeError):
                ap.apply_reset(c)
            self.assertEqual(ap.restore_legacy(c), 3)
            self.assertEqual(c.execute("SELECT points FROM local_users WHERE uid=7").fetchone()[0], 40)
            self.assertEqual(c.execute("SELECT points FROM user_flags WHERE uid='7'").fetchone()[0], 30)
        finally:
            c.close()


class Http(unittest.TestCase):
    @classmethod
    def setUpClass(cls):

        class Handler(ap_handler_base()):
            pass

        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def call(self, method, path, body=None, cookie=None, headers=None):
        h = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=10)
        hdrs = dict(headers or {})
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            hdrs.setdefault("Content-Type", "application/json")
        if cookie:
            hdrs["Cookie"] = "hx_sso=" + cookie
        h.request(method, path, body=data, headers=hdrs)
        r = h.getresponse()
        out = (r.status, json.loads(r.read() or b"{}"))
        h.close()
        return out

    def test_anonymous_plays_but_is_not_ranked(self):
        status, body = self.call("POST", "/api/progress/report", {"game": "shengsheng-shoot", "score": 120})
        self.assertEqual((status, body["ranked"]), (200, False))
        self.assertEqual(self.call("GET", "/api/progress/me")[1]["logged_in"], False)

    def test_logged_in_report_and_board(self):
        token = hx_sso.make_token("8", "local", "eight")
        status, body = self.call("POST", "/api/progress/report",
                                 {"game": "shengsheng-shoot", "score": 450, "finished": True, "ref": "h1"}, cookie=token)
        self.assertEqual(status, 200, body)
        self.assertTrue(body["ranked"])
        status, board = self.call("GET", "/api/progress/leaderboard?board=shengsheng-shoot", cookie=token)
        self.assertEqual(board["mine"]["score"], 450)
        status, me = self.call("GET", "/api/progress/me", cookie=token)
        self.assertEqual(me["games"]["shengsheng-shoot"]["best"], 450)
        self.assertEqual(self.call("GET", "/api/progress/leaderboard?board=nope")[0], 404)
        self.assertEqual(len(self.call("GET", "/api/progress/boards")[1]["boards"]), len(ap.GAMES) + 1)

    def test_mini_games_use_existing_http_without_rewards(self):
        token = hx_sso.make_token("8", "local", "eight")
        before = self.call("GET", "/api/progress/me", cookie=token)[1]
        for game in ("oc-run", "oc-run-coins", "frog-crossing"):
            payload = {"game": game, "score": 20, "distance": 300, "finished": True, "ref": "mini-http"}
            status, guest = self.call("POST", "/api/progress/report", payload)
            self.assertEqual((status, guest["ranked"]), (200, False))
            for _ in range(2):
                status, result = self.call("POST", "/api/progress/report", payload, cookie=token)
                self.assertEqual(status, 200, result)
                self.assertEqual(result["awarded"], [])
            status, board = self.call("GET", "/api/progress/leaderboard?board=" + game, cookie=token)
            self.assertEqual((status, board["mine"]["score"]), (200, 20))
            if game == "oc-run-coins": self.assertEqual(board["mine"]["distance"], 300)
        after = self.call("GET", "/api/progress/me", cookie=token)[1]
        self.assertEqual(after["points"], before["points"])
        self.assertEqual(after["today"], before["today"])
        bad = {"game": "oc-run-coins", "score": 20, "distance": -1, "finished": True, "ref": "invalid"}
        self.assertEqual(self.call("POST", "/api/progress/report", bad, cookie=token)[0], 400)

    def test_banned_or_forged_identity_is_anonymous(self):
        banned = hx_sso.make_token("9", "local", "gone")
        self.assertFalse(self.call("POST", "/api/progress/report", {"game": "slay", "score": 3}, cookie=banned)[1]["ranked"])
        self.assertFalse(self.call("POST", "/api/progress/report", {"game": "slay", "score": 3}, cookie="x.y")[1]["ranked"])

    def test_cross_site_and_non_json_posts_are_refused(self):
        token = hx_sso.make_token("8", "local", "eight")
        self.assertEqual(self.call("POST", "/api/progress/report", {"game": "slay", "score": 1}, cookie=token,
                                   headers={"Origin": "https://evil.example"})[0], 403)
        self.assertEqual(self.call("POST", "/api/progress/report", {"game": "slay", "score": 1}, cookie=token,
                                   headers={"Content-Type": "text/plain"})[0], 415)


class HuiguanSheet(unittest.TestCase):
    """会馆设表：只有新登记的设表计分，修改不计；返回新的等级字段。"""

    def test_new_sheet_pays_edit_does_not(self):
        c = conn()
        c.execute("DELETE FROM account_point_events WHERE uid='7' AND kind='local'")
        c.execute("DELETE FROM account_points WHERE uid='7' AND kind='local'")
        c.close()
        ident = {"kind": "local", "uid": "7", "username": "iridescent", "nickname": "本地七", "email": "",
                 "picture": "", "role": "executor", "is_admin": False}

        class Handler(huiguan.Handler):
            def _require_ident(self):
                return dict(ident)

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            def save(code):
                h = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=10)
                body = json.dumps({"code": code, "data": {"name": "测试", "colorPrimary": "#123456", "colorIndex": -1}})
                h.request("POST", "/api/save-character", body=body, headers={"Content-Type": "application/json"})
                r = h.getresponse()
                out = r.status, json.loads(r.read())
                h.close()
                return out

            status, first = save("SHEET-T1")
            self.assertEqual(status, 200, first)
            self.assertEqual((first["earned"], first["points"], first["level"]), (1.5, 1.5, 1))
            status, edit = save("SHEET-T1")
            self.assertEqual((edit["earned"], edit["points"]), (0, 1.5))
        finally:
            server.shutdown()
            server.server_close()


def ap_handler_base():
    from http.server import BaseHTTPRequestHandler

    class Handler(BaseHTTPRequestHandler):
        def _serve(self):
            ap.handle(self, self.command, self.path, str(DATA))

        do_GET = do_HEAD = do_POST = _serve

        def log_message(self, *args):
            pass

    return Handler


if __name__ == "__main__":
    unittest.main()
