"""Cross-game task chains: derived progress, idempotent claims, HTTP surface.

Mirrors test_account_progress.py: runs against a temporary project root so the
real portal/huiguan/users.db is never opened.
"""
import http.client
import json
import os
import sqlite3
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMP = tempfile.TemporaryDirectory(prefix="task-chains-", ignore_cleanup_errors=True)
DATA = Path(TEMP.name)
(DATA / "portal" / "huiguan").mkdir(parents=True)
# No IRIDESCENTLY_PROJECT_ROOT here: every call below passes DATA explicitly, and
# setting the global env at import time would leak into sibling test files that
# read it at call time (test_site_admin does). Only the SSO secret is process-wide.
os.environ.setdefault("HX_SSO_SECRET", "test-secret-for-task-chains")
sys.path.insert(0, str(ROOT / "server"))
sys.path.insert(0, str(ROOT))
import account_progress as ap  # noqa: E402
import hx_sso  # noqa: E402
import task_chains as tc  # noqa: E402

DB = DATA / "portal" / "huiguan" / "users.db"
seed = sqlite3.connect(DB)
# Minimal local-account table: only what account_profile.resolve_sso_identity reads.
# Deliberately no 会馆 module import here — importing it would rebind shared sys.modules
# state and break sibling test files under `unittest discover` (see test_account_progress).
seed.executescript("""
CREATE TABLE IF NOT EXISTS local_users (
    uid INTEGER PRIMARY KEY, username TEXT, nickname TEXT,
    picture TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active',
    pass_hash TEXT NOT NULL DEFAULT '', points INTEGER NOT NULL DEFAULT 0);
INSERT INTO local_users (uid, username, nickname, status) VALUES
    (7, 'seven', '本地七', 'active'), (8, 'eight', '', 'active');
""")
seed.commit()
seed.close()


def conn():
    return ap.open_db(DATA)


def report(c, kind, uid, **body):
    return ap.record_report(c, kind, uid, "名" + uid, ap.clean_report(body))


def my_view(c, chain_id, kind="local", uid="7"):
    return next(c2 for c2 in tc.view(c, kind, uid) if c2["id"] == chain_id)


class Progress(unittest.TestCase):
    def setUp(self):
        self.c = conn()
        for t in ("account_points", "account_point_events", "game_scores", "game_score_daily", "game_runs"):
            self.c.execute(f"DELETE FROM {t}")

    def tearDown(self):
        self.c.close()

    def test_progress_is_derived_from_reports(self):
        report(self.c, "local", "7", game="slay", score=5, finished=True, won=True, ref="r1")
        view = my_view(self.c, "first-steps")
        self.assertTrue(view["steps"][0]["done"])                      # 完成任意一局
        self.assertEqual(view["steps"][1]["progress"], 1)              # 三种玩法
        self.assertTrue(view["steps"][2]["done"])                      # 赢下一局
        self.assertFalse(view["complete"])
        report(self.c, "local", "7", game="cards", score=1, finished=True, ref="r2")
        report(self.c, "local", "7", game="ecology", score=1, finished=True, ref="r3")
        self.assertTrue(my_view(self.c, "first-steps")["complete"])

    def test_star_metrics_aggregate_across_games(self):
        for game in ("slay", "cards"):
            report(self.c, "local", "7", game=game, score=1, finished=True, ref=game)
        games = my_view(self.c, "explorer")["steps"][0]
        self.assertEqual((games["progress"], games["target"], games["done"]), (2, 3, False))
        runs = my_view(self.c, "first-steps")["steps"][0]
        self.assertEqual((runs["progress"], runs["done"]), (1, True))  # progress reads at the target cap

    def test_progress_is_capped_at_target_and_retroactive(self):
        # An account with history from before the chain existed qualifies immediately.
        self.c.execute("INSERT INTO game_scores (kind, uid, game, best_score, runs, wins, display_name) "
                       "VALUES ('local','7','slay',12,4,1,'名7')")
        peak = my_view(self.c, "peak")
        self.assertEqual([s["done"] for s in peak["steps"]], [False, True, False])
        first = my_view(self.c, "first-steps")
        self.assertEqual([s["done"] for s in first["steps"]], [True, False, True])

    def test_kind_scopes_progress(self):
        report(self.c, "local", "7", game="slay", score=9, finished=True, ref="a")
        self.assertEqual(my_view(self.c, "peak")["steps"][1]["done"], False)
        report(self.c, "usso", "7", game="slay", score=12, finished=True, ref="b")
        self.assertEqual(my_view(self.c, "peak", kind="usso")["steps"][1]["done"], True)


class Claim(unittest.TestCase):
    def setUp(self):
        self.c = conn()
        for t in ("account_points", "account_point_events", "game_scores", "game_score_daily", "game_runs"):
            self.c.execute(f"DELETE FROM {t}")

    def tearDown(self):
        self.c.close()

    def test_claim_requires_a_finished_chain(self):
        report(self.c, "local", "7", game="slay", score=5, finished=True, won=True, ref="r1")
        before = ap.get_points_x10(self.c, "local", "7")  # the report itself already paid its rules
        self.assertGreater(before, 0)
        with self.assertRaises(ValueError):
            tc.claim(self.c, "local", "7", "名七", "first-steps")
        self.assertEqual(ap.get_points_x10(self.c, "local", "7"), before)
        self.assertFalse(my_view(self.c, "first-steps")["claimed"])

    def test_claim_pays_once_and_bypasses_the_daily_cap(self):
        for i, game in enumerate(("slay", "cards", "ecology")):
            report(self.c, "local", "7", game=game, score=1, finished=True, won=(i == 0), ref=game)
        before = ap.get_points_x10(self.c, "local", "7")
        reward = tc.claim(self.c, "local", "7", "名七", "first-steps")
        self.assertEqual((reward["ok"], reward["already"]), (True, False))
        self.assertEqual(ap.get_points_x10(self.c, "local", "7"), before + 30)
        self.assertTrue(my_view(self.c, "first-steps")["claimed"])
        again = tc.claim(self.c, "local", "7", "名七", "first-steps")
        self.assertTrue(again["already"])
        self.assertEqual(ap.get_points_x10(self.c, "local", "7"), before + 30)
        ledger = self.c.execute("SELECT COUNT(*) FROM account_point_events WHERE rule='chain' AND game='first-steps'").fetchone()[0]
        self.assertEqual(ledger, 1)

    def test_unknown_chain_is_keyerror(self):
        with self.assertRaises(KeyError):
            tc.claim(self.c, "local", "7", "名七", "nope")

    def test_clean_claim_validates_body(self):
        for body in (None, {}, {"chain": ""}, {"chain": "nope"}, {"chain": 3}):
            with self.assertRaises(ValueError, msg=body):
                tc.clean_claim(body)
        self.assertEqual(tc.clean_claim({"chain": "peak"}), "peak")


class Http(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        class Handler(ap_handler_base()):
            pass

        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

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

    def test_anonymous_sees_catalog_but_no_progress(self):
        status, body = self.call("GET", "/api/progress/chains")
        self.assertEqual(status, 200)
        self.assertEqual((body["logged_in"], len(body["chains"])), (False, len(tc.CHAINS)))
        self.assertNotIn("progress", body["chains"][0]["steps"][0])  # labels only, no account data

    def test_claim_flow_end_to_end(self):
        token = hx_sso.make_token("7", "local", "seven")
        self.assertEqual(self.call("POST", "/api/progress/chains/claim", {"chain": "first-steps"},
                                   cookie=token)[0], 400)  # unfinished
        for game in ("slay", "cards", "ecology"):
            self.call("POST", "/api/progress/report", {"game": game, "score": 1, "finished": True, "ref": game},
                      cookie=token)
        self.call("POST", "/api/progress/report", {"game": "slay", "score": 2, "finished": True, "won": True,
                                                   "ref": "win"}, cookie=token)
        status, chains = self.call("GET", "/api/progress/chains", cookie=token)
        self.assertEqual(status, 200)
        first = next(c for c in chains["chains"] if c["id"] == "first-steps")
        self.assertTrue(first["complete"] and not first["claimed"])
        status, claimed = self.call("POST", "/api/progress/chains/claim", {"chain": "first-steps"}, cookie=token)
        self.assertEqual((status, claimed["ok"], claimed["already"]), (200, True, False))
        me = self.call("GET", "/api/progress/me", cookie=token)[1]
        # play 3×0.5 + finish 4×0.2 + win 0.3 + best 0.5 + task-finish 1.0 + task-explore 1.0 + chain 3.0
        self.assertEqual(me["points"], 8.1)
        status, again = self.call("POST", "/api/progress/chains/claim", {"chain": "first-steps"}, cookie=token)
        self.assertEqual((status, again["already"]), (200, True))

    def test_claim_guards(self):
        token = hx_sso.make_token("7", "local", "seven")
        self.assertEqual(self.call("POST", "/api/progress/chains/claim", {"chain": "first-steps"})[0], 401)
        self.assertEqual(self.call("POST", "/api/progress/chains/claim", {"chain": "nope"}, cookie=token)[0], 400)
        self.assertEqual(self.call("POST", "/api/progress/chains/claim", {"chain": "peak"}, cookie=token,
                                   headers={"Origin": "https://evil.example"})[0], 403)
        self.assertEqual(self.call("POST", "/api/progress/chains/claim", {"chain": "peak"}, cookie=token,
                                   headers={"Content-Type": "text/plain"})[0], 415)


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
