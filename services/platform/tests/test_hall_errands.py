"""会馆托付: one errand per account and per holder, presence-only time, capped pings, paid once.

Mirrors test_task_chains.py: runs against a temporary project root so the real
huiguan/users.db is never opened.
"""
import http.client
import json
import os
import sqlite3
import sys
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TEMP = tempfile.TemporaryDirectory(prefix="hall-errands-", ignore_cleanup_errors=True)
sys.path.insert(0, str(ROOT / "services" / "platform"))
from testing_storage import configure
DATA = configure(TEMP.name)
(DATA / "huiguan").mkdir(parents=True, exist_ok=True)
os.environ.setdefault("HX_SSO_SECRET", "test-secret-for-hall-errands")
sys.path.insert(0, str(ROOT))
import account_progress as ap  # noqa: E402
import hall_errands as he  # noqa: E402
import hx_sso  # noqa: E402

DB = DATA / "huiguan" / "users.db"
seed = sqlite3.connect(DB)
# Minimal local-account table: only what account_profile.resolve_sso_identity reads.
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

T0 = datetime(2026, 11, 4, 2, 0, tzinfo=timezone.utc)
HERBS = "ximu-herbs"            # 120 s at 西木会馆
GATE = "ximu-gate"              # 300 s at 西木会馆
PLACE = he.ERRANDS[HERBS]["place"]


def at(seconds):
    return T0 + timedelta(seconds=seconds)


class Base(unittest.TestCase):
    def setUp(self):
        self.c = he.open_db(DATA)
        for t in ("hall_errand_runs", "account_points", "account_point_events"):
            self.c.execute(f"DELETE FROM {t}")

    def tearDown(self):
        self.c.close()

    def ping(self, seconds, place=PLACE, present=True, uid="7"):
        return he.presence(self.c, "local", uid, place, present, now=at(seconds))

    def stay(self, total, step=60, start=0, uid="7"):
        """Ping every `step` seconds from `start` until `total` seconds have been credited."""
        t = start
        self.ping(t, uid=uid)
        while self.ping(t := t + step, uid=uid)["present_seconds"] < total:
            pass
        return t


class Accept(Base):
    def test_one_active_errand_per_account(self):
        he.accept(self.c, "local", "7", HERBS, now=at(0))
        with self.assertRaises(ValueError):
            he.accept(self.c, "local", "7", GATE, now=at(1))

    def test_an_errand_has_one_holder(self):
        he.accept(self.c, "local", "7", HERBS, now=at(0))
        with self.assertRaises(ValueError):
            he.accept(self.c, "local", "8", HERBS, now=at(1))
        board = he.board(self.c, ("local", "8"), now=at(2))
        herbs = next(e for e in board["errands"] if e["errand_id"] == HERBS)
        self.assertEqual((herbs["is_held"], herbs["is_mine"]), (True, False))

    def test_kind_scopes_the_owner(self):
        he.accept(self.c, "local", "7", HERBS, now=at(0))
        he.accept(self.c, "usso", "7", GATE, now=at(0))  # same uid, different account
        self.assertIsNone(he.board(self.c, ("local", "8"), now=at(1))["active"])

    def test_untouched_hold_is_released_after_a_day(self):
        he.accept(self.c, "local", "7", HERBS, now=at(0))
        later = at(he.HOLD_MAX_SECONDS + 1)
        run = he.accept(self.c, "local", "8", HERBS, now=later)
        self.assertEqual(run["status"], "active")
        self.assertIsNone(he.board(self.c, ("local", "7"), now=later)["active"])

    def test_hold_survives_at_24_hours_then_expires(self):
        he.accept(self.c, "local", "7", HERBS, now=at(0))
        boundary = he.HOLD_MAX_SECONDS
        self.assertIsNotNone(he.board(self.c, ("local", "7"), now=at(boundary))["active"])
        self.assertIsNone(he.board(self.c, ("local", "7"), now=at(boundary + 1))["active"])

    def test_unknown_errand(self):
        with self.assertRaises(KeyError):
            he.accept(self.c, "local", "7", "nope", now=at(0))


class Presence(Base):
    def setUp(self):
        super().setUp()
        he.accept(self.c, "local", "7", HERBS, now=at(0))

    def test_first_ping_only_starts_the_clock(self):
        self.assertEqual(self.ping(10)["credited_seconds"], 0)
        self.assertEqual(self.ping(70)["credited_seconds"], 60)

    def test_gap_is_capped(self):
        self.ping(0)
        self.assertEqual(self.ping(3600)["credited_seconds"], he.PRESENCE_MAX_GAP_SECONDS)

    def test_wrong_place_or_not_present_credits_nothing_and_breaks_the_chain(self):
        self.ping(0)
        self.assertEqual(self.ping(60, place="粤东会馆")["credited_seconds"], 0)
        self.assertEqual(self.ping(120)["credited_seconds"], 0)        # back: clock restarts
        self.assertEqual(self.ping(180, present=False)["credited_seconds"], 0)
        self.assertEqual(self.ping(240)["credited_seconds"], 0)
        self.assertEqual(self.ping(300)["present_seconds"], 60)

    def test_inactive_then_return_resumes_without_crediting_absence(self):
        self.ping(0)
        self.assertEqual(self.ping(90)["credited_seconds"], 90)
        self.assertEqual(self.ping(91, present=False)["present_seconds"], 90)
        self.assertEqual(self.ping(151)["credited_seconds"], 0)
        self.assertEqual(self.ping(242)["credited_seconds"], 90)

    def test_no_active_errand(self):
        with self.assertRaises(LookupError):
            he.presence(self.c, "local", "8", PLACE, True, now=at(0))


class Report(Base):
    def test_report_needs_enough_presence(self):
        he.accept(self.c, "local", "7", HERBS, now=at(0))
        self.ping(0)
        self.ping(60)
        with self.assertRaises(ValueError):
            he.report(self.c, "local", "7", "本地七", now=at(61))
        self.assertEqual(ap.get_points_x10(self.c, "local", "7"), 0)

    def test_report_pays_once_and_frees_the_errand(self):
        he.accept(self.c, "local", "7", HERBS, now=at(0))
        t = self.stay(120)
        done = he.report(self.c, "local", "7", "本地七", now=at(t + 1))
        self.assertEqual(done["status"], "done")
        self.assertEqual(done["awarded"][0]["rule"], "errand")
        self.assertEqual(ap.get_points_x10(self.c, "local", "7"), ap.RULES["errand"]["x10"])
        with self.assertRaises(LookupError):
            he.report(self.c, "local", "7", "本地七", now=at(t + 2))
        self.assertEqual(he.accept(self.c, "local", "8", HERBS, now=at(t + 3))["status"], "active")

    def test_daily_errand_cap(self):
        t = 0
        for _ in range(ap.RULES["errand"]["cap"] + 1):
            he.accept(self.c, "local", "7", HERBS, now=at(t))
            t = self.stay(120, start=t)
            he.report(self.c, "local", "7", "本地七", now=at(t))
            t += 1
        paid = self.c.execute("SELECT COUNT(*) FROM account_point_events WHERE rule='errand'").fetchone()[0]
        self.assertEqual(paid, ap.RULES["errand"]["cap"])

    def test_abandon(self):
        he.accept(self.c, "local", "7", HERBS, now=at(0))
        he.abandon(self.c, "local", "7", now=at(1))
        self.assertIsNone(he.board(self.c, ("local", "7"), now=at(2))["active"])
        with self.assertRaises(LookupError):
            he.abandon(self.c, "local", "7", now=at(3))


class Http(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from http.server import BaseHTTPRequestHandler

        class Handler(BaseHTTPRequestHandler):
            def _serve(self):
                he.handle(self, self.command, self.path, str(DATA))

            do_GET = do_HEAD = do_POST = _serve

            def log_message(self, *args):
                pass

        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        c = he.open_db(DATA)
        for t in ("hall_errand_runs", "account_points", "account_point_events"):
            c.execute(f"DELETE FROM {t}")
        c.close()
        self.token = hx_sso.make_token("7", "local", "seven")

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

    def test_anonymous_sees_the_board_only(self):
        status, body = self.call("GET", "/api/errands")
        self.assertEqual((status, body["logged_in"], body["active"]), (200, False, None))
        self.assertEqual(body["terms"], he.TERMS)
        self.assertEqual(self.call("POST", "/api/errands/accept", {"errand_id": HERBS})[0], 401)

    def test_flow_over_http(self):
        status, run = self.call("POST", "/api/errands/accept", {"errand_id": HERBS}, cookie=self.token)
        self.assertEqual((status, run["status"]), (200, "active"))
        self.assertEqual(self.call("POST", "/api/errands/accept", {"errand_id": GATE}, cookie=self.token)[0], 409)
        status, ping = self.call("POST", "/api/errands/presence", {"place": PLACE, "is_present": True},
                                 cookie=self.token)
        self.assertEqual((status, ping["is_present"]), (200, True))
        status, early = self.call("POST", "/api/errands/report", {}, cookie=self.token)
        self.assertEqual(status, 400)
        self.assertIn("到场", early["error"])
        mine = self.call("GET", "/api/errands", cookie=self.token)[1]["active"]
        self.assertEqual(mine["errand_id"], HERBS)
        self.assertEqual(self.call("POST", "/api/errands/abandon", {}, cookie=self.token)[0], 200)

    def simultaneous(self, *requests):
        gate = threading.Barrier(len(requests))

        def submit(request):
            gate.wait(timeout=5)
            path, body, token = request
            return self.call("POST", "/api/errands/" + path, body, cookie=token)

        with ThreadPoolExecutor(max_workers=len(requests)) as pool:
            return list(pool.map(submit, requests))

    def test_two_accounts_competing_for_one_errand(self):
        other = hx_sso.make_token("8", "local", "eight")
        result = self.simultaneous(("accept", {"errand_id": HERBS}, self.token),
                                   ("accept", {"errand_id": HERBS}, other))
        self.assertEqual(sorted(status for status, _ in result), [200, 409])
        winner = self.token if result[0][0] == 200 else other
        loser = other if winner == self.token else self.token
        self.assertIsNotNone(self.call("GET", "/api/errands", cookie=winner)[1]["active"])
        self.assertIsNone(self.call("GET", "/api/errands", cookie=loser)[1]["active"])
        self.assertEqual(self.call("POST", "/api/errands/presence",
                                   {"place": PLACE, "is_present": True}, cookie=loser)[0], 409)
        self.assertEqual(self.call("POST", "/api/errands/report", {}, cookie=loser)[0], 409)

    def test_same_account_competing_for_two_errands(self):
        result = self.simultaneous(("accept", {"errand_id": HERBS}, self.token),
                                   ("accept", {"errand_id": GATE}, self.token))
        self.assertEqual(sorted(status for status, _ in result), [200, 409])
        c = he.open_db(DATA)
        try:
            self.assertEqual(c.execute("SELECT COUNT(*) FROM hall_errand_runs WHERE status='active'").fetchone()[0], 1)
        finally:
            c.close()

    def test_simultaneous_reports_and_repeat_award_only_once(self):
        now = datetime.now(timezone.utc)
        c = he.open_db(DATA)
        try:
            start = now - timedelta(seconds=130)
            run = he.accept(c, "local", "7", HERBS, now=start)
            for offset in (0, 60, 120):
                he.presence(c, "local", "7", PLACE, True, now=start + timedelta(seconds=offset))
            result = self.simultaneous(("report", {}, self.token), ("report", {}, self.token))
            self.assertEqual(sorted(status for status, _ in result), [200, 409])
            self.assertEqual(self.call("POST", "/api/errands/report", {}, cookie=self.token)[0], 409)
            self.assertEqual(c.execute("SELECT status FROM hall_errand_runs WHERE id=?", (run["run_id"],)).fetchone()[0], "done")
            self.assertEqual(c.execute("SELECT COUNT(*) FROM account_point_events WHERE rule='errand'").fetchone()[0], 1)
            self.assertEqual(ap.get_points_x10(c, "local", "7"), ap.RULES["errand"]["x10"])
        finally:
            c.close()

    def test_guards(self):
        self.assertEqual(self.call("POST", "/api/errands/accept", {"errand_id": "nope"}, cookie=self.token)[0], 400)
        self.assertEqual(self.call("POST", "/api/errands/presence", {"place": PLACE}, cookie=self.token)[0], 400)
        self.assertEqual(self.call("POST", "/api/errands/accept", {"errand_id": HERBS}, cookie=self.token,
                                   headers={"Origin": "https://evil.example"})[0], 403)
        self.assertEqual(self.call("POST", "/api/errands/accept", {"errand_id": HERBS}, cookie=self.token,
                                   headers={"Content-Type": "text/plain"})[0], 415)
        self.assertEqual(self.call("POST", "/api/errands/report", {}, cookie=self.token)[0], 409)
        self.assertEqual(self.call("GET", "/api/errands/nope")[0], 404)


if __name__ == "__main__":
    unittest.main()
