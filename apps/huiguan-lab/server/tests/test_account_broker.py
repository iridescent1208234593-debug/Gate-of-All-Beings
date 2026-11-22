"""Local account bridge integration: no real site sessions or production state."""
from __future__ import annotations

import asyncio
from types import SimpleNamespace
import time

from fastapi.testclient import TestClient

from lab.app import Lab, create_app
from lab.config import Config
from lab.auth import SESSION_COOKIE


def make_lab(tmp_path, monkeypatch, enabled=True):
    folder = tmp_path / "secrets"
    folder.mkdir()
    (folder / "account-broker.key").write_text("a" * 43)
    monkeypatch.setenv("LAB_ACCOUNT_TEST_LOOPBACK", "1")
    cfg = Config(runtime=tmp_path / "runtime", secrets=folder, r4_enabled=False)
    if enabled:
        cfg.account_issuer = "http://127.0.0.1:19288"
    return Lab(cfg)


def test_account_preserves_legacy_room_and_separate_revocation(tmp_path, monkeypatch):
    lab = make_lab(tmp_path, monkeypatch)
    state = SimpleNamespace(status="pending", allowed=True, revoked=0)
    async def upstream(action, **body):
        if action == "start":
            assert len(body["challenge"]) == 43
            return {"request_id": "a"*32, "state": "b"*32, "expires_in": 300, "match_code": "012345"}
        if action == "poll":
            return {"status": state.status, "code": "c"*43}
        if action == "redeem":
            assert len(body["verifier"]) == 43
            return {"sub": "site-id-" + "d"*32, "grant": "e"*43, "expires_in": 3600}
        if action == "introspect":
            return {"active": state.allowed, "expires_in": 3000}
        if action == "revoke":
            state.revoked += 1
            return {"revoked": True}
        raise AssertionError(action)
    lab.account.request = upstream
    base = "http://127.0.0.1:18300"
    with TestClient(create_app(lab), base_url=base) as client:
        cid, code = lab.auth.create_code()
        pid = lab.hub.player_record(cid)["pid"]
        lab.account.migratable = frozenset({cid})
        assert client.post("/api/login", json={"code": code}).status_code == 200
        old_cookie = client.cookies.get(SESSION_COOKIE)
        assert client.get("/account-link").status_code == 200
        assert client.get("/api/account/available").json() == {"enabled": True}
        post = lambda action, **kw: client.post("/api/account/"+action, json={"mode":"link", **kw})
        start = post("start")
        assert start.status_code == 200
        data = start.json()
        assert data["match_code"] == "012345" and "012345" not in data["approval_url"]
        assert set(data) == {"approval_url", "poll_key", "expires_in", "match_code"}
        key = data["poll_key"]
        assert post("poll", poll_key=key).json() == {"status":"pending"}
        state.status = "approved"
        lab.account.pending[lab.auth.token_digest(key)].retry_at = 0
        minted = post("poll", poll_key=key)
        assert minted.json() == {"status":"ok", "next":"/play/"}
        assert "HttpOnly" in minted.headers["set-cookie"]
        new_cookie = client.cookies.get(SESSION_COOKIE)
        assert new_cookie != old_cookie
        assert client.get("/api/me").json()["role"] == "player"
        assert lab.auth.session(new_cookie)["code_id"] == cid
        assert lab.hub.player_record(cid)["pid"] == pid
        assert post("poll", poll_key=key).status_code == 403
        state.allowed = False
        asyncio.run(lab.account.refresh(next(iter(lab.account.grants.values()))))
        assert client.get("/api/me").status_code == 401
        assert lab.auth.session(old_cookie) is None
        assert client.post("/api/login", json={"code": code}).status_code == 401
        lab.auth.protect_linked_codes = False
        assert client.post("/api/login", json={"code": code}).status_code == 200
        assert lab.store.one("SELECT code_id FROM account_links")["code_id"] == cid


def test_feature_disabled_keeps_old_entry(tmp_path, monkeypatch):
    lab = make_lab(tmp_path, monkeypatch, enabled=False)
    with TestClient(create_app(lab), base_url="http://127.0.0.1:18300") as client:
        assert client.get("/api/account/available").status_code == 404
        assert client.get("/account-link").status_code == 404
        _, code = lab.auth.create_code()
        assert client.post("/api/login", json={"code": code}).status_code == 200
        assert client.get("/api/me").status_code == 200
