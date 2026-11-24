"""Legacy auto-bind store contract: synthetic credential data and no network."""
from concurrent.futures import ThreadPoolExecutor
import json
import os
import secrets
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

from lab.account_broker import Denied, LegacyClaimConflict
from test_account_broker import make_lab


class LegacyClaimTest(unittest.TestCase):
    def setenv(self, key, value):
        os.environ[key] = value

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        env = patch.dict(os.environ, {})
        env.start()
        self.addCleanup(env.stop)
        self.lab = make_lab(Path(tmp.name), self)
        self.broker = self.lab.account
        self.store = self.lab.store
        self.addCleanup(self.store.close)
        self.cid, self.token, self.pid = self.old_player()
        self.subject = "synthetic-hall-subject-one"

    def old_player(self, role="player", allow=True, save=True):
        cid, code = self.lab.auth.create_code(role=role)
        token, reason, _ = self.lab.auth.login(code, "fixture")
        self.assertEqual(reason, "ok")
        if allow:
            self.broker.migratable = self.broker.migratable | {cid}
        return cid, token, self.lab.hub.player_record(cid)["pid"] if save else None

    def finish(self, token=None, subject=None, claim=None, *, confirmed=True):
        token = self.token if token is None else token
        claim = self.broker.prepare_legacy_claim(self.token) if claim is None else claim
        return self.broker.finish_legacy_claim(subject or self.subject, claim, token,
                                              restore_confirmed=confirmed)

    def test_same_old_session_and_confirmation_are_required_and_save_id_stays_stable(self):
        initial = self.store.one("SELECT digest,status,role FROM codes WHERE id=?", (self.cid,))[:]
        self.store.exec("""INSERT INTO spaces(id,kind,title,owner_pid,template,created_at)
                         VALUES('claim-space','private','Synthetic space',?,'fixture',0)""", (self.pid,))
        self.store.exec("INSERT INTO space_acl VALUES(?,?,?)", ("claim-space", self.pid, 0))
        claim = self.broker.prepare_legacy_claim(self.token)
        _, another, _ = self.old_player()
        for kwargs in ({"token": another}, {"confirmed": False}):
            with self.assertRaises(Denied):
                self.finish(claim=claim, **kwargs)
        self.assertIsNone(self.store.one("SELECT 1 FROM account_links"))
        new_token, _ = self.finish(claim=claim)
        self.assertEqual(self.lab.auth.session(new_token)["code_id"], self.cid)
        self.assertIsNone(self.lab.auth.session(self.token))
        self.assertEqual(self.lab.hub.player_record(self.cid)["pid"], self.pid)
        self.assertEqual(self.store.one("SELECT owner_pid FROM spaces WHERE id='claim-space'")[0], self.pid)
        self.assertEqual(self.store.one("SELECT pid FROM space_acl WHERE space_id='claim-space'")[0], self.pid)
        self.assertEqual(self.store.one("SELECT digest,status,role FROM codes WHERE id=?", (self.cid,))[:], initial)
        events = self.store.all("SELECT target,detail FROM audit WHERE action='account.claim_legacy_player'")
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["target"], self.cid)
        self.assertEqual(json.loads(events[0]["detail"]), {"legacy_sessions_invalidated": 1})
        self.assertIsNone(self.broker.prepare_legacy_claim(new_token))
        with self.assertRaises(LegacyClaimConflict):
            self.finish(claim=claim)

    def test_no_shared_unused_or_operations_claim_and_recheck_prior_to_commit(self):
        for role, allowed, saved in (("player", False, True), ("player", True, False),
                                      ("art", True, True), ("monitor", True, True)):
            _, token, _ = self.old_player(role, allowed, saved)
            self.assertIsNone(self.broker.prepare_legacy_claim(token))
        claim = self.broker.prepare_legacy_claim(self.token)
        self.store.exec("UPDATE sessions SET expires_at=? WHERE digest=?", (time.time() - 1, claim.session_digest))
        with self.assertRaises(Denied):
            self.finish(claim=claim)
        self.assertIsNone(self.store.one("SELECT 1 FROM account_links"))

    def test_existing_distinct_account_save_never_merges_and_does_not_consume_legacy(self):
        hall_token, _ = self.broker.resolve_identity(self.subject, None)
        hall_cid = self.lab.auth.session(hall_token)["code_id"]
        hall_pid = self.lab.hub.player_record(hall_cid)["pid"]
        with self.assertRaises(LegacyClaimConflict):
            self.finish()
        self.assertEqual(self.lab.hub.player_record(hall_cid)["pid"], hall_pid)
        self.assertEqual(self.lab.hub.player_record(self.cid)["pid"], self.pid)
        self.assertEqual(self.lab.auth.session(self.token)["code_id"], self.cid)
        self.assertIsNone(self.store.one("SELECT 1 FROM audit WHERE action='account.claim_legacy_player'"))

    def test_second_session_of_same_principal_cannot_finish_first_flow(self):
        claim = self.broker.prepare_legacy_claim(self.token)
        other = secrets.token_urlsafe(32)
        now = time.time()
        self.store.exec("INSERT INTO sessions VALUES(?,?,?,?,?)",
                        (self.lab.auth.token_digest(other), self.cid, now, now + 60, now))
        self.assertEqual(self.lab.auth.session(other)["code_id"], self.cid)
        with self.assertRaises(Denied):
            self.finish(claim=claim, token=other)
        self.assertIsNone(self.store.one("SELECT 1 FROM account_links"))

    def test_direct_claim_expiry_even_if_legacy_session_is_still_current(self):
        claim = self.broker.prepare_legacy_claim(self.token)
        with patch("lab.account_broker.time.time", return_value=claim.expires_at):
            self.assertIsNotNone(self.lab.auth.session(self.token))
            with self.assertRaises(Denied):
                self.finish(claim=claim)
        self.assertEqual(self.lab.auth.session(self.token)["code_id"], self.cid)
        self.assertIsNone(self.store.one("SELECT 1 FROM account_links"))

    def test_simultaneous_different_subjects_have_one_winner(self):
        claim = self.broker.prepare_legacy_claim(self.token)

        def attempt(subject):
            try:
                self.finish(claim=claim, subject=subject)
                return True
            except LegacyClaimConflict:
                return False

        with ThreadPoolExecutor(max_workers=2) as pool:
            decisions = list(pool.map(attempt, (self.subject, "synthetic-hall-subject-two")))
        self.assertEqual(sorted(decisions), [False, True])
        self.assertEqual(self.store.one("SELECT COUNT(*) FROM account_links")[0], 1)
        self.assertEqual(self.store.one("SELECT COUNT(*) FROM account_sessions")[0], 1)
        self.assertEqual(self.store.one("SELECT COUNT(*) FROM audit WHERE action='account.claim_legacy_player'")[0], 1)


if __name__ == "__main__":
    unittest.main()
