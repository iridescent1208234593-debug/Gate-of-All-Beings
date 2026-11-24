"""End-to-end checks against a real gateway process (temporary runtime, R4 disabled)."""
from __future__ import annotations

import base64
import json
import sqlite3
import time

import httpx
import pytest
from websockets.exceptions import ConnectionClosed, InvalidStatus
from websockets.sync.client import connect

from conftest import png_bytes


def ws(gw, client, origin=True, host=None):
    headers = {"Cookie": gw.cookie_header(client)} if client else {}
    if origin:
        headers["Origin"] = gw.base
    if host:
        headers["Host"] = host
    return connect(f"ws://127.0.0.1:{gw.port}/ws", additional_headers=headers, max_size=8 * 1024 * 1024, open_timeout=5)


def recv_until(sock, kind, timeout=5.0, pred=None):
    end = time.time() + timeout
    while time.time() < end:
        msg = json.loads(sock.recv(timeout=max(0.05, end - time.time())))
        if msg["t"] == kind and (pred is None or pred(msg)):
            return msg
    raise AssertionError(f"no {kind}")


def enter(gw, client, nick):
    s = ws(gw, client)
    s.send(json.dumps({"t": "hello", "client": "test", "version": "1"}))
    welcome = recv_until(s, "welcome")
    s.send(json.dumps({"t": "profile", "nick": nick}))
    return s, welcome


# ---------------------------------------------------------------- A. entry and security
def test_entry_requires_code(gateway):
    r = httpx.get(gateway.base + "/play/", follow_redirects=False)
    assert r.status_code == 303 and r.headers["location"] == "/"
    assert httpx.get(gateway.base + "/").status_code == 200
    assert httpx.get(gateway.base + "/api/me").status_code == 401


def test_invalid_code_rejected_and_lockout(gateway):
    for i in range(5):
        r = httpx.post(gateway.base + "/api/login", json={"code": f"ZSZM-AAAA-BBBB-CCCC-DDD{i}"}, timeout=10)
        assert r.status_code in (401, 429)
    r = httpx.post(gateway.base + "/api/login", json={"code": "ZSZM-AAAA-BBBB-CCCC-DDDD"}, timeout=10)
    assert r.status_code == 429 and int(r.headers["retry-after"]) > 0
    cid, code = gateway.new_code()
    r = httpx.post(gateway.base + "/api/login", json={"code": code}, timeout=10)
    assert r.status_code == 429, "lockout applies to the address even for a valid code"


def test_valid_code_session_seven_days(gateway):
    cid, code = gateway.new_code()
    c = gateway.login(code)
    cookie = next(iter(c.cookies.jar))
    assert cookie.name == "zszm_lab_session"
    assert 7 * 86400 - 120 < cookie.expires - time.time() <= 7 * 86400 + 5
    assert c.get("/api/me").status_code == 200
    db = sqlite3.connect(gateway.tmp / "runtime" / "data" / "lab.sqlite")
    stored = [r[0] for r in db.execute("SELECT digest FROM codes")] + [r[0] for r in db.execute("SELECT digest FROM sessions")]
    assert code not in json.dumps(stored) and cookie.value not in json.dumps(stored), "only digests are stored"
    events = json.dumps([list(r) for r in db.execute("SELECT * FROM security_events")])
    assert code not in events and code.replace("-", "") not in events


def test_expired_session_rejected(gateway):
    cid, code = gateway.new_code()
    c = gateway.login(code)
    db = sqlite3.connect(gateway.tmp / "runtime" / "data" / "lab.sqlite", isolation_level=None)
    db.execute("UPDATE sessions SET expires_at=?", (time.time() - 1,))
    assert c.get("/api/me").status_code == 401
    with pytest.raises(InvalidStatus):
        ws(gateway, c)


def test_ws_requires_session_origin_and_host(gateway):
    with pytest.raises((InvalidStatus, ConnectionClosed, Exception)):
        s = ws(gateway, None)
        s.recv(timeout=2)
    cid, code = gateway.new_code()
    c = gateway.login(code)
    headers = {"Cookie": gateway.cookie_header(c), "Origin": "https://evil.example"}
    with pytest.raises(Exception):
        s = connect(f"ws://127.0.0.1:{gateway.port}/ws", additional_headers=headers, open_timeout=5)
        s.recv(timeout=2)
    r = httpx.get(gateway.base + "/healthz", headers={"Host": "evil.example"})
    assert r.status_code == 421
    # Through-the-tunnel requests without an Origin are refused (browsers always send one).
    headers = {"Cookie": gateway.cookie_header(c), "CF-Ray": "test"}
    with pytest.raises(Exception):
        s = connect(f"ws://127.0.0.1:{gateway.port}/ws", additional_headers=headers, open_timeout=5)
        s.recv(timeout=2)


def test_revoked_code_closes_session_and_socket(gateway):
    cid, code = gateway.new_code()
    c = gateway.login(code)
    s, _ = enter(gateway, c, "甲")
    gateway.ctl("admin-password") if False else None
    from lab.auth import set_admin_password
    set_admin_password(gateway.tmp / "secrets", "correct horse battery")
    a = httpx.Client(base_url=gateway.admin, headers={"X-Lab-Admin": "1"})
    assert a.post("/admin/api/login", json={"password": "correct horse battery"}).status_code == 200
    r = a.post(f"/admin/api/codes/{cid}/revoke")
    assert r.status_code == 200 and r.json()["connections_closed"] == 1
    kicked = recv_until(s, "kicked")
    assert kicked["reason"] == "code_revoked"
    assert c.get("/api/me").status_code == 401
    assert httpx.post(gateway.base + "/api/login", json={"code": code}).status_code == 401
    with pytest.raises(Exception):
        ws(gateway, c).recv(timeout=2)


def test_player_cannot_reach_admin(gateway):
    cid, code = gateway.new_code()
    c = gateway.login(code)
    assert c.get("/admin/api/overview").status_code == 404, "admin routes do not exist on the public port"
    assert c.get("/monitor").status_code == 403 and c.get("/api/monitor").status_code == 403
    a = httpx.Client(base_url=gateway.admin)
    assert a.get("/admin/api/overview").status_code == 401
    assert a.post("/admin/api/codes", json={}).status_code == 403, "writes need the CSRF header"
    assert a.get("/admin/api/overview", headers={"CF-Ray": "x"}).status_code == 403
    mid, mcode = gateway.new_code(role="monitor")
    m = gateway.login(mcode)
    data = m.get("/api/monitor").json()
    assert "hub" in data and mcode not in json.dumps(data)


# ---------------------------------------------------------------- B. realtime multiplayer
def test_two_players_see_movement_and_chat(gateway):
    _, ca = gateway.new_code(label="A"); _, cb = gateway.new_code(label="B")
    a_http, b_http = gateway.login(ca), gateway.login(cb)
    a, wa = enter(gateway, a_http, "阿甲")
    b, wb = enter(gateway, b_http, "阿乙")
    assert any(p["pid"] == wa["pid"] for p in wb["players"])
    pa = wa["you"]
    a.send(json.dumps({"t": "move", "x": pa["x"] + 0.3, "z": pa["z"], "dir": 0, "anim": "walk", "seq": 1}))
    snap = recv_until(b, "s", pred=lambda m: any(r[0] == wa["pid"] and abs(r[1] - (pa["x"] + 0.3)) < 1e-6 for r in m["p"]))
    assert snap
    pb = wb["you"]
    time.sleep(0.2)
    b.send(json.dumps({"t": "move", "x": pb["x"], "z": pb["z"] - 0.3, "dir": 1, "anim": "walk", "seq": 1}))
    recv_until(a, "s", pred=lambda m: any(r[0] == wb["pid"] and abs(r[2] - (pb["z"] - 0.3)) < 1e-6 for r in m["p"]))
    a.send(json.dumps({"t": "chat", "text": "你好 <b>LAB</b>‮"}))
    chat = recv_until(b, "chat")
    assert chat["nick"] == "阿甲" and chat["text"] == "你好 <b>LAB</b>"
    # cheating move is corrected
    a.send(json.dumps({"t": "move", "x": 1.0, "z": 1.0, "seq": 2}))
    corr = recv_until(a, "correct")
    assert corr["reason"] in ("too_fast", "blocked")


def test_reconnect_replaces_old_socket_without_ghost(gateway):
    _, code = gateway.new_code()
    c = gateway.login(code)
    s1, w1 = enter(gateway, c, "重连者")
    s1.send(json.dumps({"t": "move", "x": w1["you"]["x"] + 0.2, "z": w1["you"]["z"], "seq": 1}))
    time.sleep(6)   # persist loop saves every 5 s
    s2, w2 = enter(gateway, c, "重连者")
    assert w2["pid"] == w1["pid"]
    assert recv_until(s1, "kicked")["reason"] == "replaced"
    assert abs(w2["you"]["x"] - (w1["you"]["x"] + 0.2)) < 1e-6, "position restored"
    _, code_b = gateway.new_code()
    b, wb = enter(gateway, gateway.login(code_b), "旁观")
    assert [p["pid"] for p in wb["players"]].count(w1["pid"]) == 1


def test_persistence_across_restart(gateway):
    _, code = gateway.new_code()
    c = gateway.login(code)
    s, w = enter(gateway, c, "种花人")
    me = w["you"]
    # walk to the lantern flower (12.5, 12.5) in legal steps
    x, z = me["x"], me["z"]
    target = (13.3, 13.3)
    seq = 0
    while abs(x - target[0]) > 0.01 or abs(z - target[1]) > 0.01:
        x += max(-0.35, min(0.35, target[0] - x)); z += max(-0.35, min(0.35, target[1] - z)); seq += 1
        s.send(json.dumps({"t": "move", "x": x, "z": z, "seq": seq}))
        time.sleep(0.12)
    s.send(json.dumps({"t": "interact", "object": "lantern-flower"}))
    obj = recv_until(s, "object")
    assert obj["state"]["stage"] == 1
    s.close()
    time.sleep(0.5)
    gateway.stop(); gateway.start()
    s, w = enter(gateway, gateway.login(code), "种花人")
    assert w["objects"]["lantern-flower"]["stage"] == 1
    assert abs(w["you"]["x"] - x) < 0.05 and abs(w["you"]["z"] - z) < 0.05


# ---------------------------------------------------------------- C. OC
def test_oc_upload_and_visibility(gateway):
    _, ca = gateway.new_code(); _, cb = gateway.new_code()
    a, wa = enter(gateway, gateway.login(ca), "画手")
    b, wb = enter(gateway, gateway.login(cb), "看客")
    a.send(json.dumps({"t": "oc_set", "data": base64.b64encode(png_bytes()).decode(), "source": "upload"}))
    res = recv_until(a, "oc_result")
    assert res["ok"] and res["alpha"]
    changed = recv_until(b, "oc_changed")
    b.send(json.dumps({"t": "oc_get", "pid": wa["pid"]}))
    oc = recv_until(b, "oc")
    assert oc["digest"] == changed["digest"] and base64.b64decode(oc["png"])[:8] == b"\x89PNG\r\n\x1a\n"
    # forged file: script renamed to PNG
    a.send(json.dumps({"t": "oc_set", "data": base64.b64encode(b"<script>alert(1)</script>" * 10).decode()}))
    assert recv_until(a, "oc_result")["reason"] == "not_png_or_webp"
    # PNG magic followed by garbage
    a.send(json.dumps({"t": "oc_set", "data": base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"\0" * 200).decode()}))
    assert recv_until(a, "oc_result")["reason"] == "undecodable"
    # oversized dimensions
    a.send(json.dumps({"t": "oc_set", "data": base64.b64encode(png_bytes(2100, 40, False)).decode()}))
    assert recv_until(a, "oc_result")["reason"] == "dimensions_exceeded"


# ---------------------------------------------------------------- D. spaces
def walk_to(sock, start, target):
    x, z = start
    seq = 0
    while abs(x - target[0]) > 0.01 or abs(z - target[1]) > 0.01:
        x += max(-0.35, min(0.35, target[0] - x)); z += max(-0.35, min(0.35, target[1] - z)); seq += 1
        sock.send(json.dumps({"t": "move", "x": x, "z": z, "seq": seq}))
        time.sleep(0.12)
    return x, z


def to_door(sock, welcome):
    p = walk_to(sock, (welcome["you"]["x"], welcome["you"]["z"]), (13.2, welcome["you"]["z"]))
    p = walk_to(sock, p, (13.2, 6.4))
    return walk_to(sock, p, (15.5, 6.4))


def test_private_space_invite_revoke_isolation(gateway):
    _, ca = gateway.new_code(); _, cb = gateway.new_code(); _, cc = gateway.new_code()
    a, wa = enter(gateway, gateway.login(ca), "主人")
    b, wb = enter(gateway, gateway.login(cb), "客人")
    c, wc = enter(gateway, gateway.login(cc), "路人")
    a.send(json.dumps({"t": "space_create"}))
    assert recv_until(a, "error")["code"] == "go_to_rainbow_door"
    to_door(a, wa)
    a.send(json.dumps({"t": "space_create", "title": "小院"}))
    sid = recv_until(a, "space_created")["space"]["id"]
    a.send(json.dumps({"t": "space_enter", "space": sid}))
    wel = recv_until(a, "welcome")
    assert wel["space"]["id"] == sid and wel["space"]["kind"] == "private"
    # uninvited player cannot enter even from the door
    to_door(c, wc)
    c.send(json.dumps({"t": "space_enter", "space": sid}))
    assert recv_until(c, "error")["code"] == "space_forbidden"
    # invite b
    a.send(json.dumps({"t": "space_invite", "pid": wb["pid"]}))
    inv = recv_until(b, "invited")
    assert inv["space"]["id"] == sid
    to_door(b, wb)
    b.send(json.dumps({"t": "space_enter", "space": sid}))
    wb2 = recv_until(b, "welcome")
    assert wb2["space"]["id"] == sid and any(p["pid"] == wa["pid"] for p in wb2["players"])
    # isolation: chat in private space does not reach the hall
    a.send(json.dumps({"t": "chat", "text": "私语"}))
    recv_until(b, "chat")
    with pytest.raises(Exception):
        recv_until(c, "chat", timeout=1.0)
    # revoke b -> moved back to hall
    a.send(json.dumps({"t": "space_revoke", "pid": wb["pid"]}))
    recv_until(b, "notice")
    back = recv_until(b, "welcome")
    assert back["space"]["id"] == "hall"
    # return from private space to the hall
    a.send(json.dumps({"t": "space_enter", "space": "hall"}))
    assert recv_until(a, "welcome")["space"]["id"] == "hall"


# ---------------------------------------------------------------- G. new-player guide (chapter "life")
def test_life_guide_progress_is_per_player_and_survives_reconnect(gateway):
    _, code = gateway.new_code()
    c = gateway.login(code)
    s, w = enter(gateway, c, "新来的")
    assert w["guide"] == {"status": "new", "seen": []}
    s.send(json.dumps({"t": "guide", "seen": ["move", "Bad Key!", "move", "chat"]}))
    g = recv_until(s, "guide")
    assert g == {"t": "guide", "status": "active", "seen": ["move", "chat"]}
    s.send(json.dumps({"t": "guide", "status": "paused"}))
    assert recv_until(s, "guide")["status"] == "paused"
    s.send(json.dumps({"t": "guide", "status": "veteran"}))
    assert recv_until(s, "error")["code"] == "bad_request", "only the server decides veteran"
    s.close()
    s2, w2 = enter(gateway, c, "新来的")          # another device / client of the same player
    assert w2["guide"] == {"status": "paused", "seen": ["move", "chat"]}
    s2.send(json.dumps({"t": "guide", "reset": True}))
    assert recv_until(s2, "guide") == {"t": "guide", "status": "active", "seen": []}
    _, other = gateway.new_code()
    _, wo = enter(gateway, gateway.login(other), "别人")
    assert wo["guide"]["status"] == "new", "progress belongs to one player"


def test_life_guide_veteran_players_are_not_walked_through(gateway):
    _, code = gateway.new_code()
    c = gateway.login(code)
    s, w = enter(gateway, c, "老玩家")
    s.close()
    time.sleep(0.3)
    # simulate a player from before the guide existed: drop the guide row, age the player record
    db = sqlite3.connect(gateway.tmp / "runtime" / "data" / "lab.sqlite")
    with db:
        db.execute("DELETE FROM life_guide WHERE pid=?", (w["pid"],))
        db.execute("UPDATE players SET nickname='老玩家', updated_at=1700000000 WHERE pid=?", (w["pid"],))
    db.close()
    _, w2 = enter(gateway, c, "老玩家")
    assert w2["guide"]["status"] == "veteran"
