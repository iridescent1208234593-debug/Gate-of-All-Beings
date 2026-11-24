import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient

from lab.admin_app import create_admin_app
from lab.app import create_app
from lab.auth import PlayerTestCodesClosed, set_admin_password
from labctl import main as labctl_main
from test_account_broker import make_lab


class PlayerCodeClosureTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.env = patch.dict(os.environ, {})
        self.env.start()
        self.addCleanup(self.env.stop)

    def setenv(self, key, value):
        os.environ[key] = value

    def test_close_legacy_while_preserving_existing_hall_and_operations_sessions(self):
        lab = make_lab(self.root, self)
        self.addCleanup(lab.store.close)
        player_cid, player_code = lab.auth.create_code(role="player")
        old_token, _, _ = lab.auth.login(player_code, "fixture")
        assert lab.auth.session(old_token)["code_id"] == player_cid
        hall_token, _ = lab.account.resolve_identity("fixture-hall-subject", None)
        art_cid, art_code = lab.auth.create_code(role="art")
        art_token, _, _ = lab.auth.login(art_code, "fixture")
        assert lab.auth.session(art_token)["code_id"] == art_cid

        # Regression uses the same Auth instance to exercise concurrent old cookies and new logins;
        # production config controls a new instance on restart.
        lab.auth.player_test_codes_enabled = False
        with self.assertRaises(PlayerTestCodesClosed):
            lab.auth.create_code(role="player")
        assert lab.auth.session(old_token) is None
        assert lab.auth.session(hall_token)["role"] == "player"
        assert lab.auth.session(art_token)["role"] == "art"
        assert lab.auth.create_code(role="monitor")
        with TestClient(create_app(lab), base_url="http://127.0.0.1:18300") as client:
            assert client.post("/api/login", json={"code": player_code}).status_code == 401
            assert client.post("/api/login", json={"code": art_code}).status_code == 200
            assert client.get("/api/me").json()["role"] == "art"

        assert lab.store.one("SELECT digest FROM codes WHERE id=?", (player_cid,))[0] == lab.auth.code_digest(player_code)


    def test_closed_legacy_without_broker_does_not_accept_existing_cookie(self):
        lab = make_lab(self.root, self, enabled=False)
        self.addCleanup(lab.store.close)
        _, code = lab.auth.create_code()
        token, _, _ = lab.auth.login(code, "fixture")
        lab.auth.player_test_codes_enabled = False
        assert lab.auth.session(token) is None


    def test_admin_issuance_uses_config_and_preserves_separate_operations_access(self):
        lab = make_lab(self.root, self)
        self.addCleanup(lab.store.close)
        set_admin_password(lab.cfg.secrets, "synthetic-admin-test-password")
        lab.auth.player_test_codes_enabled = False
        admin_app = create_admin_app(lab)
        async def loopback_peer(scope, receive, send):
            await admin_app(dict(scope, client=("127.0.0.1", 12345)), receive, send)
        with TestClient(loopback_peer, base_url="http://127.0.0.1:18302") as admin:
            headers = {"X-Lab-Admin": "1", "Origin": "http://127.0.0.1:18302"}
            self.assertEqual(admin.post("/admin/api/login", headers=headers, json={
                "password": "synthetic-admin-test-password",
            }).status_code, 200)
            self.assertEqual(admin.post("/admin/api/codes", headers=headers, json={
                "role": "player",
            }).status_code, 409)
            self.assertEqual(admin.post("/admin/api/codes", headers=headers, json={
                "role": "monitor",
            }).status_code, 200)

        cfg = self.root / "fixture.config.json"
        cfg.write_text(json.dumps({"runtime": str(lab.cfg.runtime), "secrets": str(lab.cfg.secrets),
                                   "player_test_codes_enabled": False}))
        self.setenv("LAB_CONFIG", str(cfg))
        with self.assertRaisesRegex(SystemExit, "player_test_codes_closed"):
            labctl_main(["code-create", "--role", "player"])
