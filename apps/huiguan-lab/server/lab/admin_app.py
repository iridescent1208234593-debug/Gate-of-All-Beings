"""Loopback-only LAB admin console (127.0.0.1:<admin_port>, never routed by the tunnel).

Admin is a separate, stronger credential than any test code: an scrypt-hashed password in
secrets/lab-v2/admin.json, a 12-hour in-memory admin session, SameSite=Strict cookie, a required
custom header on every write (CSRF), Host pinned to loopback, and login rate limiting.
"""
from __future__ import annotations

import asyncio
import json
import secrets
import shutil
import time

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response

from . import config as config_mod
from .auth import ADMIN_COOKIE, PlayerTestCodesClosed, RateLimiter, check_admin_password
from .metrics import process_metrics, system_metrics

ADMIN_TTL = 12 * 3600


def create_admin_app(lab, supervisor_status=None) -> FastAPI:
    app = FastAPI(title="ZSZM LAB admin", docs_url=None, redoc_url=None, openapi_url=None)
    cfg = lab.cfg
    sessions: dict[str, float] = {}
    limiter = RateLimiter(max_failures=5, window=900, lockout=900)
    hosts = {f"127.0.0.1:{cfg.admin_port}", f"localhost:{cfg.admin_port}"}
    origins = {f"http://{h}" for h in hosts}

    def authed(request: Request) -> bool:
        tok = request.cookies.get(ADMIN_COOKIE)
        exp = sessions.get(tok or "")
        if exp and exp > time.time():
            return True
        sessions.pop(tok or "", None)
        return False

    @app.middleware("http")
    async def guard(request: Request, call_next):
        peer = request.client.host if request.client else ""
        if peer not in ("127.0.0.1", "::1") or (request.headers.get("host") or "") not in hosts \
                or request.headers.get("cf-ray"):
            return JSONResponse({"error": "loopback_only"}, status_code=403)
        path = request.url.path
        if request.method != "GET":
            if request.headers.get("x-lab-admin") != "1" or request.headers.get("origin", next(iter(origins))) not in origins:
                return JSONResponse({"error": "csrf"}, status_code=403)
        if path.startswith("/admin/api/") and path != "/admin/api/login" and not authed(request):
            return JSONResponse({"error": "admin_login_required"}, status_code=401)
        resp = await call_next(request)
        resp.headers["Cache-Control"] = "no-store"
        resp.headers["X-Frame-Options"] = "DENY"
        resp.headers["Content-Security-Policy"] = ("default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; "
                                                   "frame-ancestors 'none'; base-uri 'none'")
        return resp

    def audit(action, target="", **detail):
        lab.store.audit("admin", action, target, **detail)

    @app.get("/")
    async def page():
        return FileResponse(config_mod.SOURCE_ROOT / "web" / "admin.html", media_type="text/html; charset=utf-8")

    @app.get("/static/{name}")
    async def page_static(name: str):
        if name not in ("admin.js", "lab.css"):
            return Response(status_code=404)
        return FileResponse(config_mod.SOURCE_ROOT / "web" / "static" / name,
                            media_type="text/javascript" if name.endswith(".js") else "text/css")

    @app.post("/admin/api/login")
    async def login(request: Request):
        key = "admin"
        if limiter.locked(key):
            lab.store.security("admin_login_locked")
            return JSONResponse({"error": "locked"}, status_code=429)
        body = await request.json()
        ok = await asyncio.to_thread(check_admin_password, cfg.secrets, str(body.get("password", ""))[:200])
        if not ok:
            limiter.fail(key)
            lab.store.security("admin_login_failed")
            await asyncio.sleep(0.5)
            return JSONResponse({"error": "invalid"}, status_code=401)
        limiter.success(key)
        tok = secrets.token_urlsafe(32)
        sessions[tok] = time.time() + ADMIN_TTL
        lab.store.security("admin_login_ok")
        resp = JSONResponse({"ok": True})
        resp.set_cookie(ADMIN_COOKIE, tok, max_age=ADMIN_TTL, httponly=True, samesite="strict", path="/")
        return resp

    @app.post("/admin/api/logout")
    async def logout(request: Request):
        sessions.pop(request.cookies.get(ADMIN_COOKIE, ""), None)
        return {"ok": True}

    # -- codes ------------------------------------------------------------------------
    @app.get("/admin/api/codes")
    async def codes():
        rows = lab.store.all("SELECT c.id,c.label,c.role,c.status,c.created_at,c.last_used_at,c.use_count,"
                             "(SELECT count(*) FROM sessions s WHERE s.code_id=c.id AND s.expires_at>?) AS sessions,"
                             "p.pid,p.nickname FROM codes c LEFT JOIN players p ON p.code_id=c.id ORDER BY c.created_at DESC",
                             (time.time(),))
        online = {c.code_id for c in lab.hub.conns.values()}
        return {"codes": [dict(r) | {"online": r["id"] in online} for r in rows]}

    @app.post("/admin/api/codes")
    async def create_codes(request: Request):
        body = await request.json()
        count = int(body.get("count", 1))
        if not 1 <= count <= 50:
            return JSONResponse({"error": "count 1..50"}, status_code=400)
        try:
            created = [lab.auth.create_code(str(body.get("label", ""))[:60], body.get("role", "player"))
                       for _ in range(count)]
        except PlayerTestCodesClosed:
            return JSONResponse({"error": "player_test_codes_closed"}, status_code=409)
        # Plaintext codes are returned once, to the admin's screen only; they are never stored or logged.
        return {"created": [{"id": cid, "code": code} for cid, code in created]}

    @app.post("/admin/api/codes/{cid}/{action}")
    async def code_action(cid: str, action: str):
        status = {"disable": "disabled", "enable": "active", "revoke": "revoked"}.get(action)
        if not status:
            return JSONResponse({"error": "bad_action"}, status_code=400)
        try:
            removed = lab.auth.set_status(cid, status)
        except (KeyError, ValueError) as error:
            return JSONResponse({"error": str(error)}, status_code=400)
        kicked = await lab.hub.kick_code(cid, "code_" + status) if status != "active" else 0
        return {"ok": True, "sessions_removed": removed, "connections_closed": kicked}

    # -- live state -------------------------------------------------------------------
    @app.get("/admin/api/overview")
    async def overview():
        hub = lab.hub
        players = [{"pid": c.pid, "nick": c.nick, "space": c.space, "client": c.client, "version": c.version,
                    "x": c.x, "z": c.z, "rtt_ms": round(c.rtt_ms, 1), "connected_s": round(time.time() - c.connected_at),
                    "corrections": c.corrections, "sent_kb": round(c.sent_bytes / 1024, 1),
                    "recv_kb": round(c.recv_bytes / 1024, 1), "queue": c.queue.qsize()} for c in hub.conns.values()]
        spaces = [dict(r) | {"online": len(hub.members(r["id"])), "paused": r["id"] in hub.paused_spaces,
                             "guests": [g["pid"] for g in lab.store.all("SELECT pid FROM space_acl WHERE space_id=?", (r["id"],))]}
                  for r in lab.store.all("SELECT id,kind,title,owner_pid,template,r4_branch,created_at FROM spaces ORDER BY created_at")]
        sup = supervisor_status() if supervisor_status else {}
        return {"server_version": config_mod.VERSION, "client_version": lab.client_version,
                "hub": hub.stats(), "players": players, "spaces": spaces, "system": system_metrics(),
                "ws_handshake_rejects": lab.ws_handshake_rejects, "r4": lab.r4.status(),
                "processes": {k: process_metrics(v) for k, v in sup.get("pids", {}).items()},
                "supervisor": sup, "now": time.time()}

    @app.get("/admin/api/logs")
    async def logs():
        hub = lab.hub
        sec = [dict(r) for r in lab.store.all("SELECT at,kind,ip_hint,code_id,detail FROM security_events ORDER BY id DESC LIMIT 100")]
        aud = [dict(r) for r in lab.store.all("SELECT at,actor,action,target,detail FROM audit ORDER BY id DESC LIMIT 100")]
        tail = []
        f = cfg.log_dir / "gateway.log"
        if f.exists():
            with f.open("rb") as fh:
                fh.seek(max(0, f.stat().st_size - 20000))
                tail = fh.read().decode("utf-8", "replace").splitlines()[-120:]
        return {"errors": list(hub.errors)[-100:], "events": list(hub.events)[-100:], "security": sec, "audit": aud,
                "log_tail": tail}

    @app.get("/admin/api/snapshot")
    async def snapshot(space: str = "hall"):
        row = lab.hub.space_row(space)
        if not row:
            return JSONResponse({"error": "no_space"}, status_code=404)
        branch = "public" if row["kind"] == "public" else row["r4_branch"]
        return {"space": dict(row), "objects": lab.hub.objects_state(space), "npcs": lab.hub.npcs(space),
                "clock": lab.hub.clock(space), "r4_branch": lab.r4.branch(branch),
                "players": [lab.hub.player_view(c) for c in lab.hub.members(space)]}

    # -- debug operations (explicit scope + confirm field) ----------------------------
    @app.post("/admin/api/space/{sid}/{action}")
    async def space_action(sid: str, action: str, request: Request):
        body = await request.json() if (await request.body()) else {}
        row = lab.hub.space_row(sid)
        if not row:
            return JSONResponse({"error": "no_space"}, status_code=404)
        if row["kind"] == "public" and action in ("pause", "resume", "advance") and body.get("confirm") != sid:
            return JSONResponse({"error": "confirm_required", "hint": f"send confirm='{sid}' to act on the public world"}, status_code=409)
        branch = "public" if row["kind"] == "public" else row["r4_branch"]
        try:
            if action == "pause":
                lab.hub.paused_spaces.add(sid)
                lab.store.exec("UPDATE spaces SET paused=1 WHERE id=?", (sid,))
                if branch:
                    await lab.r4.set_schedule(branch, False)
            elif action == "resume":
                lab.hub.paused_spaces.discard(sid)
                lab.store.exec("UPDATE spaces SET paused=0 WHERE id=?", (sid,))
                if branch:
                    await lab.r4.set_schedule(branch, True)
            elif action == "advance":
                if not branch or branch == "public":
                    return JSONResponse({"error": "only private branches advance manually"}, status_code=400)
                await lab.r4.advance(branch, int(body.get("ticks", 1)))
                await lab.r4.poll()
            elif action == "spawn_npc":
                npc = lab.hub.spawn_test_npc(sid, str(body.get("species", "Spirit")))
                audit("npc.spawn", sid, npc=npc["id"])
                return {"ok": True, "npc": npc}
            elif action == "clear_npcs":
                for k in [k for k, v in lab.hub.test_npcs.items() if v["space"] == sid]:
                    lab.hub.test_npcs.pop(k)
            else:
                return JSONResponse({"error": "bad_action"}, status_code=400)
        except Exception as error:
            return JSONResponse({"error": str(error)[:200]}, status_code=502)
        audit("space." + action, sid, body={k: v for k, v in body.items() if k != "confirm"})
        lab.hub.broadcast(sid, {"t": "clock", "clock": lab.hub.clock(sid)})
        return {"ok": True, "clock": lab.hub.clock(sid)}

    @app.post("/admin/api/kick/{pid}")
    async def kick(pid: str):
        c = lab.hub.conns.get(pid)
        if not c:
            return JSONResponse({"error": "offline"}, status_code=404)
        lab.hub.send(c, {"t": "kicked", "reason": "admin"})
        await lab.hub.detach(c, "admin")
        audit("player.kick", pid)
        return {"ok": True}

    # -- art review ---------------------------------------------------------------------
    @app.get("/admin/api/art")
    async def art_list():
        return {"assets": [dict(r) for r in lab.store.all("SELECT * FROM art_assets ORDER BY created_at DESC LIMIT 200")]}

    @app.get("/admin/api/art/{aid}.png")
    async def art_file(aid: str):
        row = lab.store.one("SELECT status FROM art_assets WHERE id=?", (aid,))
        if not row:
            return Response(status_code=404)
        f = cfg.art_dir / ("approved" if row["status"] == "approved" else "pending") / f"{aid}.png"
        return FileResponse(f, media_type="image/png") if f.exists() else Response(status_code=404)

    @app.post("/admin/api/art/{aid}/{decision}")
    async def art_review(aid: str, decision: str):
        row = lab.store.one("SELECT status FROM art_assets WHERE id=?", (aid,))
        if not row or row["status"] != "pending" or decision not in ("approve", "reject"):
            return JSONResponse({"error": "bad_request"}, status_code=400)
        src = cfg.art_dir / "pending" / f"{aid}.png"
        if decision == "approve" and src.exists():
            shutil.move(str(src), str(cfg.art_dir / "approved" / f"{aid}.png"))
        elif src.exists():
            src.unlink()
        lab.store.exec("UPDATE art_assets SET status=?, reviewed_at=?, reviewer='admin' WHERE id=?",
                       ("approved" if decision == "approve" else "rejected", time.time(), aid))
        audit("art." + decision, aid)
        return {"ok": True}

    # -- anonymized report ----------------------------------------------------------------
    @app.get("/admin/api/report")
    async def report():
        hub = lab.hub
        alias = {}
        def anon(pid):
            return alias.setdefault(pid, f"player-{len(alias) + 1}")
        data = {"generated_at": time.time(), "server_version": config_mod.VERSION, "client_version": lab.client_version,
                "hub": hub.stats(), "system": system_metrics(), "r4": {k: v for k, v in lab.r4.status().items() if k != "branches"},
                "players_online": [{"player": anon(c.pid), "space_kind": "public" if c.space == "hall" else "private",
                                    "client": c.client, "rtt_ms": round(c.rtt_ms, 1), "corrections": c.corrections}
                                   for c in hub.conns.values()],
                "codes": {r["status"]: r["n"] for r in lab.store.all("SELECT status, count(*) n FROM codes GROUP BY status")},
                "spaces": lab.store.one("SELECT count(*) n FROM spaces WHERE kind='private'")["n"],
                "security_event_counts": {r["kind"]: r["n"] for r in lab.store.all("SELECT kind, count(*) n FROM security_events GROUP BY kind")},
                "recent_errors": [{"at": e["at"], "error": e.get("error", "")[:120]} for e in list(hub.errors)[-30:]]}
        resp = JSONResponse(data)
        resp.headers["Content-Disposition"] = f"attachment; filename=lab-report-{time.strftime('%Y%m%dT%H%M%S')}.json"
        return resp

    return app
