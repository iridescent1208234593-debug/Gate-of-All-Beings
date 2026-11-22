import base64
from concurrent.futures import ThreadPoolExecutor
from email.message import Message
from datetime import datetime, timezone
import hashlib
from io import BytesIO
from pathlib import Path
import re
import sqlite3
import sys
import tempfile
import threading
import unittest
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from lab_account_broker import LabAccountBroker, get_access, init_schema, invalidate_account, set_access

ORIGIN = "https://huiguan.example.test"
AUDIENCE = "example.test"
VERIFIER = "x" * 43
CHALLENGE = base64.urlsafe_b64encode(hashlib.sha256(VERIFIER.encode()).digest()).decode().rstrip("=")


class Handler:
    def __init__(self, path, headers=None, body=b"", account=None, sid=None):
        self.path, self.headers = path, headers or {}
        self.rfile, self.wfile = BytesIO(body), BytesIO()
        self.account, self.sid = account, sid
        self.response_headers = {}

    def _get_session(self):
        return self.sid

    def _require_ident_optional(self):
        return self.account

    def send_response(self, status):
        self.status = status

    def send_header(self, name, value):
        self.response_headers[name] = value

    def end_headers(self):
        pass

    def csrf(self):
        return re.search(rb'name="csrf" value="([^"]+)"', self.wfile.getvalue())[1].decode()


class BrokerTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.database = Path(temp.name) / "fake.db"
        self.now = 1_800_000_000
        self.account = {"kind": "local", "uid": "42", "nickname": "<creator>"}
        self.sid = "fixture-not-a-real-session"
        self.allowed = True
        self.consent = True
        self.lock = threading.Lock()
        self.broker = self.make_broker()
        with self.db() as c:
            c.executescript("""
                CREATE TABLE sessions_db(sid TEXT PRIMARY KEY, kind TEXT, uid TEXT,
                                         expires_at TEXT, audience TEXT);
                CREATE TABLE users(user_id TEXT PRIMARY KEY);
            """)
            init_schema(c)
            self.assertFalse(get_access(c, "local", "42"))
        self.add_session(self.sid)

    def db(self):
        conn = sqlite3.connect(self.database)
        conn.row_factory = sqlite3.Row
        return conn

    def make_broker(self, origin=ORIGIN):
        return LabAccountBroker(self.db, self.lock,
                                lambda k, u: self.account if self.allowed else None,
                                "fake-fixture-service-bearer-not-real", origin, AUDIENCE,
                                lambda conn, kind, uid: self.consent, lambda: self.now)

    def add_session(self, sid, ttl=6000, audience=AUDIENCE):
        with self.db() as c:
            exp = datetime.fromtimestamp(self.now + ttl, timezone.utc).isoformat()
            c.execute("INSERT INTO sessions_db VALUES(?,?,?,?,?)",
                      (sid, "local", "42", exp, audience))

    def access(self, enabled=True):
        with self.db() as c:
            set_access(c, "local", "42", enabled)
            self.assertEqual(get_access(c, "local", "42"), enabled)
            self.assertFalse(get_access(c, "usso", "42"))

    def start(self):
        status, transaction = self.broker.api("start", {"challenge": CHALLENGE})
        self.assertEqual(status, 200)
        self.assertNotIn(transaction["state"], transaction["approval_path"])
        self.assertNotIn(transaction["match_code"], transaction["approval_path"].split("=")[0])
        return transaction

    def review(self, transaction):
        req = Handler(transaction["approval_path"], account=self.account, sid=self.sid)
        self.broker.handle(req, "GET", req.path.split("?")[0])
        self.assertEqual(req.status, 200)
        self.assertIn(b"&lt;creator&gt;", req.wfile.getvalue())
        self.assertNotIn(b"<creator>", req.wfile.getvalue())
        self.assertIn("frame-ancestors 'none'", req.response_headers["Content-Security-Policy"])
        self.assertEqual(req.response_headers["Cache-Control"], "no-store")
        return req

    def confirm(self, transaction, *, origin=ORIGIN, sid=None, csrf=None, match=None, decision="approve"):
        csrf = csrf or self.review(transaction).csrf()
        body = urlencode({"request_id": transaction["request_id"], "csrf": csrf, "decision": decision,
                          "match_code": match if match is not None else transaction["match_code"]}).encode()
        req = Handler("/api/lab-auth/approve",
                      {"Origin": origin, "Content-Type": "application/x-www-form-urlencoded",
                       "Content-Length": str(len(body))}, body, self.account, sid or self.sid)
        self.broker.handle(req, "POST", req.path)
        return req.status

    def prepare_redeem(self):
        tx = self.start()
        self.assertEqual(self.confirm(tx), 200)
        status, result = self.broker.api("poll", tx)
        self.assertEqual((status, result["status"]), (200, "approved"))
        return {**tx, "code": result["code"], "verifier": VERIFIER}

    def issue(self):
        status, grant = self.broker.api("redeem", self.prepare_redeem())
        self.assertEqual(status, 200)
        return grant

    def test_browser_confirmation_pkce_single_use(self):
        self.access()
        tx = self.start()
        self.assertEqual(self.broker.api("poll", tx), (200, {"status": "pending"}))
        self.assertEqual(self.broker.api("poll", tx), (429, {"error": "slow_down"}))
        self.assertEqual(self.confirm(tx, origin="https://other.example.test"), 403)
        second_sid = "different-website-session"
        self.add_session(second_sid)
        self.assertEqual(self.confirm(tx, sid=second_sid), 403)
        self.assertEqual(self.confirm(tx, match="123abc"), 403)
        self.assertEqual(self.confirm(tx), 200)
        self.now += 2
        status, result = self.broker.api("poll", tx)
        self.assertEqual((status, result["status"]), (200, "approved"))
        cmd = {**tx, "code": result["code"], "verifier": "y" * 43}
        self.assertEqual(self.broker.api("redeem", cmd), (400, {"error": "invalid_grant"}))
        cmd["verifier"] = VERIFIER
        status, grant = self.broker.api("redeem", cmd)
        self.assertEqual(status, 200)
        self.assertEqual(set(grant), {"sub", "grant", "expires_in"})
        self.assertNotEqual(grant["sub"], "42")
        self.assertEqual(self.broker.api("redeem", cmd), (400, {"error": "invalid_grant"}))
        other = self.issue()
        self.assertEqual(grant["sub"], other["sub"])
        self.assertNotEqual(grant["grant"], other["grant"])
        with self.db() as c:
            stored = " ".join(str(tuple(row)) for name in ("lab_auth_requests", "lab_auth_grants")
                              for row in c.execute(f"SELECT * FROM {name}"))
        for secret in (grant["grant"], result["code"], self.sid, tx["state"]):
            self.assertNotIn(secret, stored)

    def test_revocation_legal_logout_expiration_and_audience(self):
        self.access()
        grant = self.issue()
        inspect = lambda: self.broker.api("introspect", grant)[1]
        self.assertTrue(inspect()["active"])
        self.consent = False
        self.assertEqual(inspect(), {"active": False})
        self.consent = True
        self.allowed = False
        self.assertEqual(inspect(), {"active": False})
        self.allowed = True
        with self.db() as c:
            c.execute("UPDATE sessions_db SET expires_at='invalid'")
        self.assertEqual(inspect(), {"active": False})
        with self.db() as c:
            c.execute("DELETE FROM sessions_db")
        self.add_session("replacement")   # Rowid reuse must not resurrect another session.
        self.assertEqual(inspect(), {"active": False})
        self.add_session(self.sid, ttl=9)
        short = self.issue()
        self.assertEqual(short["expires_in"], 9)
        self.now += 9
        self.assertEqual(self.broker.api("introspect", short)[1], {"active": False})
        with self.db() as c:
            c.execute("DELETE FROM sessions_db WHERE sid=?", (self.sid,))
        self.add_session(self.sid, audience="other.test")
        self.assertEqual(self.confirm(self.start()), 403)

    def test_entitlement_removal_cannot_revive_old_grant(self):
        self.assertEqual(self.confirm(self.start()), 403)
        self.access()
        grant = self.issue()
        self.access(False)
        self.access()
        self.assertEqual(self.broker.api("introspect", grant)[1], {"active": False})
        self.assertEqual(self.issue()["sub"], grant["sub"])
        grant = self.issue()
        with self.db() as c:
            invalidate_account(c, "local", "42")
        self.assertEqual(self.broker.api("introspect", grant)[1], {"active": False})

    def test_cross_instance_redeem_race(self):
        self.access()
        cmd = self.prepare_redeem()
        other = self.make_broker()
        other.lock = threading.Lock()
        with ThreadPoolExecutor(max_workers=2) as pool:
            pending = [pool.submit(b.api, "redeem", cmd) for b in (self.broker, other)]
            outcomes = sorted(item.result()[0] for item in pending)
        self.assertEqual(outcomes, [200, 400])

    def test_duplicate_headers_and_rejected_body_close(self):
        for name, value, second, path in (
            ("Origin", ORIGIN, ORIGIN, "/api/lab-auth/approve"),
            ("Authorization", "Bearer " + self.broker.bearer,
             "Bearer " + self.broker.bearer, "/api/lab-auth/start"),
        ):
            headers = Message()
            headers.add_header(name, value)
            headers.add_header(name, second)
            req = Handler(path, headers, b"unread")
            req.command = "POST"
            self.broker.handle(req, "POST", path)
            self.assertIn(req.status, (401, 403))
            self.assertEqual(req.rfile.tell(), 0)
            self.assertTrue(req.close_connection)
            self.assertEqual(req.response_headers["Connection"], "close")
        req = Handler("/api/lab-auth/start", {
            "Authorization": "Bearer " + self.broker.bearer,
            "Content-Type": "application/json", "Content-Length": "5",
            "Transfer-Encoding": "chunked",
        }, b"unread")
        req.command = "POST"
        self.broker.handle(req, "POST", req.path)
        self.assertEqual(req.status, 400)
        self.assertTrue(req.close_connection)
        self.assertEqual(req.rfile.tell(), 0)

    def test_deny_expire_revoke_and_service_auth(self):
        self.access()
        tx = self.start()
        self.assertEqual(self.confirm(tx, decision="deny"), 200)
        self.assertEqual(self.broker.api("poll", tx), (200, {"status": "denied"}))
        pending = self.prepare_redeem()
        self.now += 46
        self.assertEqual(self.broker.api("redeem", pending), (410, {"error": "expired"}))
        grant = self.issue()
        self.assertEqual(self.broker.api("revoke", grant), (200, {"revoked": True}))
        self.assertEqual(self.broker.api("introspect", grant)[1], {"active": False})
        req = Handler("/api/lab-auth/start")
        self.broker.handle(req, "POST", req.path)
        self.assertEqual(req.status, 401)
        disabled = self.make_broker(origin="http://huiguan.example.test")
        disabled.handle(req, "POST", req.path)
        self.assertEqual(req.status, 503)


if __name__ == "__main__":
    unittest.main()
