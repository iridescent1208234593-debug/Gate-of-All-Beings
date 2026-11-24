"""Exact gateway routes + SQLite under FastAPI TestClient; only Hall transport is synthetic."""
from base64 import urlsafe_b64encode
import hashlib
import os
from pathlib import Path
from secrets import token_urlsafe
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

from fastapi.testclient import TestClient

from lab.account_broker import Denied
from lab.account_direct_web import CALLBACK, START, FINISH, TX_COOKIE
from lab.app import create_app
from lab.auth import SESSION_COOKIE
from test_account_broker import make_lab


class HallFixture:
    def __init__(self):
        self.pending = {}
        self.subject = token_urlsafe(32)
        self.grant = token_urlsafe(32)
        self.redemptions = 0
        self.revocations = 0

    async def request(self, action, **args):
        if action == "direct/start":
            rid = token_urlsafe(32)
            assert args["code_challenge_method"] == "S256"
            assert set(args) == {"client_id", "redirect_uri", "state", "intent",
                                 "code_challenge", "code_challenge_method"}
            self.pending[rid] = args | {"code": token_urlsafe(32)}
            return {"request_id": rid, "expires_in": 300}
        if action == "direct/redeem":
            row = self.pending.get(args["request_id"])
            if (not row or not row.get("confirmed")
                    or any(row[k] != args[k] for k in ("client_id", "redirect_uri", "state", "code"))
                    or row["code_challenge"] != urlsafe_b64encode(
                        hashlib.sha256(args["code_verifier"].encode()).digest()).decode().rstrip("=")):
                raise Denied
            self.pending.pop(args["request_id"])
            self.redemptions += 1
            return {"sub": self.subject, "grant": self.grant, "expires_in": 20, "intent": row["intent"]}
        if action == "direct/introspect":
            return {"active": True, "expires_in": 20}
        if action == "direct/revoke":
            assert (args["sub"], args["grant"]) == (self.subject, self.grant)
            self.revocations += 1
            return {"revoked": True}
        raise AssertionError(action)

    def confirm(self, url):
        p = urlsplit(url)
        assert p.path == "/api/lab-auth/direct/approve"
        rid = parse_qs(p.query)["request_id"][0]
        row = self.pending[rid]
        row["confirmed"] = True
        return {k: row[k] for k in ("state", "code")}


class DirectGatewayTest(unittest.TestCase):
    def setenv(self, key, val):
        os.environ[key] = val

    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        env = patch.dict(os.environ, {})
        env.start()
        self.addCleanup(env.stop)
        self.lab = make_lab(Path(temp.name), self)
        self.addCleanup(self.lab.store.close)
        self.hall = HallFixture()
        self.lab.account.request = self.hall.request
        self.origin = "https://" + self.lab.cfg.public_host

    def client(self, enabled=True):
        self.lab.cfg.account_direct_web_enabled = enabled
        c = TestClient(create_app(self.lab), base_url=self.origin)
        self.addCleanup(c.close)
        return c

    def post(self, client, path, data):
        return client.post(path, json=data, headers={"Origin": self.origin})

    def start(self, client, mode="login"):
        r = self.post(client, START, {"intent": mode})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(set(r.json()), {"authorization_url"})
        self.assertIn("Secure", r.headers["set-cookie"])
        self.assertIn("HttpOnly", r.headers["set-cookie"])
        self.assertIn("SameSite=lax", r.headers["set-cookie"])
        return r.json()["authorization_url"]

    def create_old(self, client):
        cid, code = self.lab.auth.create_code()
        pid = self.lab.hub.player_record(cid)["pid"]
        self.lab.account.migratable = frozenset({cid})
        self.assertEqual(self.post(client, "/api/login", {"code": code}).status_code, 200)
        return cid, pid, client.cookies.get(SESSION_COOKIE)

    def test_off_is_404_and_original_legacy_path_remains(self):
        self.assertFalse(self.lab.cfg.account_direct_web_enabled)
        c = self.client(enabled=False)
        self.assertEqual(self.post(c, START, {"intent": "login"}).status_code, 404)
        self.create_old(c)
        self.assertEqual(c.get("/api/me").status_code, 200)

    def test_origin_redirect_ownership_replay_and_new_login(self):
        c = self.client()
        self.assertEqual(c.post(START, json={"intent": "login"}).status_code, 403)
        self.assertEqual(self.post(c, START, {"intent": "login", "redirect_uri": "https://invalid.example"}).status_code, 400)
        url = self.start(c)
        code = self.hall.confirm(url)
        page = c.get(CALLBACK)
        self.assertEqual(page.status_code, 200)
        self.assertNotIn(code["code"], page.text)
        self.assertEqual(c.get(CALLBACK, params=code).status_code, 400)
        self.assertEqual(c.get("/static/direct-account-callback.js").status_code, 200)
        other = self.client()
        self.assertEqual(self.post(other, FINISH, code).status_code, 403)
        self.assertEqual(self.post(c, FINISH, code | {"state": token_urlsafe(32)}).status_code, 403)
        self.assertEqual(self.hall.redemptions, 0)
        r = self.post(c, FINISH, code)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"next": "/play/"})
        self.assertNotIn(self.hall.grant, " ".join(r.headers.values()))
        self.assertNotIn(TX_COOKIE, c.cookies)
        self.assertEqual(c.get("/api/me").json()["role"], "player")
        self.assertEqual(self.post(c, FINISH, code).status_code, 403)

    def test_restore_keeps_exact_existing_pid_and_digest(self):
        c = self.client()
        cid, pid, old = self.create_old(c)
        digest = self.lab.store.one("SELECT digest FROM codes WHERE id=?", (cid,))[0]
        url = self.start(c, "restore")
        self.assertNotIn(cid, url)
        self.assertNotIn(old, url)
        self.assertEqual(self.post(c, FINISH, self.hall.confirm(url)).status_code, 200)
        self.assertEqual(self.lab.hub.player_record(cid)["pid"], pid)
        self.assertEqual(self.lab.store.one("SELECT digest FROM codes WHERE id=?", (cid,))[0], digest)
        self.assertEqual(self.lab.auth.session(c.cookies.get(SESSION_COOKIE))["code_id"], cid)
        self.assertIsNone(self.lab.auth.session(old))

    def test_existing_distinct_save_denies_restore_and_revokes_issuer_grant(self):
        c = self.client()
        cid, _, old = self.create_old(c)
        self.lab.account.resolve_identity(self.hall.subject, None)
        r = self.post(c, FINISH, self.hall.confirm(self.start(c, "restore")))
        self.assertEqual(r.status_code, 409)
        self.assertEqual(self.hall.revocations, 1)
        self.assertEqual(self.lab.auth.session(old)["code_id"], cid)

    def test_no_issuer_confirmation_or_expired_old_proof_never_mints(self):
        c = self.client()
        url = self.start(c)
        rid = parse_qs(urlsplit(url).query)["request_id"][0]
        self.assertEqual(self.post(c, FINISH, {k:self.hall.pending[rid][k] for k in ("state", "code")}).status_code, 403)
        _, _, old = self.create_old(c)
        proof = self.hall.confirm(self.start(c, "restore"))
        self.lab.store.exec("UPDATE sessions SET expires_at=0 WHERE digest=?", (self.lab.auth.token_digest(old),))
        self.assertEqual(self.post(c, FINISH, proof).status_code, 403)
        self.assertEqual(self.lab.store.one("SELECT COUNT(*) FROM account_links")[0], 0)
        self.assertEqual(self.hall.redemptions, 0)


if __name__ == "__main__":
    unittest.main()
