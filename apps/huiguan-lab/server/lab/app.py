"""Public LAB gateway (the only service routed by the LAB tunnel).

Routes
  GET  /                 test-code page (public)
  POST /api/login        test code -> 7-day session cookie
  POST /api/logout
  GET  /api/me           session check
  GET  /play/...         Godot web build (session required)
  WS   /ws               realtime protocol (session cookie + Origin + Host checked at handshake)
  GET  /monitor, /api/monitor   read-only monitor (monitor role only)
  GET  /art, POST /api/art      art-team test uploads (art role only), reviewed by admin
  GET  /healthz          liveness, no data
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import json
import logging
import os
import re
import secrets
import time
from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse, Response
from PIL import Image

from .admission import Admission
from . import account_broker
from . import config as config_mod
from .auth import SESSION_COOKIE, Auth, load_pepper
from .oc import OCCache, OCRejected, sniff
from .r4bridge import R4Bridge
from .store import Store
from .world import Hub, clean_text

log = logging.getLogger("lab.app")
WEB_STATIC = config_mod.SOURCE_ROOT / "web"
SPACES_FILE = config_mod.SOURCE_ROOT / "client" / "data" / "spaces.json"
MIME = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".wasm": "application/wasm",
        ".pck": "application/octet-stream", ".png": "image/png", ".svg": "image/svg+xml", ".css": "text/css",
        ".json": "application/json", ".ico": "image/x-icon", ".webp": "image/webp", ".woff2": "font/woff2"}


class Lab:
    """Process-wide state shared by the public app and the loopback admin app."""

    def __init__(self, cfg: config_mod.Config):
        cfg.ensure_dirs()
        self.cfg = cfg
        self.store = Store(cfg.db_path)
        self.pepper = load_pepper(cfg.secrets)
        self.auth = Auth(self.store, self.pepper, cfg.session_days,
                         player_test_codes_enabled=cfg.player_test_codes_enabled)
        self.account = None
        if cfg.account_issuer:
            credential = (cfg.secrets / "account-broker.key").read_text(encoding="utf-8").strip()
            if not re.fullmatch(r"[A-Za-z0-9_-]{32,200}", credential):
                raise ValueError("Invalid account broker credential")
            migration_file = cfg.secrets / "account-migration.json"
            ids = json.loads(migration_file.read_text(encoding="utf-8")) if migration_file.is_file() else []
            if not isinstance(ids, list) or not all(isinstance(cid, str) and re.fullmatch(r"c_[0-9a-f]{10}", cid) for cid in ids):
                raise ValueError("Invalid account migration allowlist")
            self.account = account_broker.Broker(self.auth, cfg.account_issuer, credential, migratable=ids,
                                                 loopback=os.environ.get("LAB_ACCOUNT_TEST_LOOPBACK") == "1")
        elif self.store.one("SELECT 1 FROM sqlite_master WHERE name='account_sessions' AND type='table'"):
            # Turning the feature off leaves legacy sessions and linked saves intact.
            self.store.exec("DELETE FROM sessions WHERE digest IN (SELECT digest FROM account_sessions)")
        self.oc = OCCache(cfg.oc_dir, cfg.oc_cache_budget_bytes, cfg.oc_ttl_seconds)
        self.r4 = R4Bridge(cfg.r4_port, cfg.secrets, cfg.r4_enabled)
        self.hub = Hub(self.store, SPACES_FILE, self.oc, self.r4, config_mod.VERSION)
        self.hub.oc_limits = {"max_bytes": cfg.oc_max_bytes, "max_side": cfg.oc_max_side,
                              "display_side": cfg.oc_display_side}
        self.client_version = self._client_version()
        self.tasks: list[asyncio.Task] = []
        self.ws_handshake_rejects = 0
        if type(cfg.admission_max_waiters) is not int or not 0 <= cfg.admission_max_waiters <= 1000:
            raise ValueError("admission_max_waiters must be an integer from 0 through 1000")
        if cfg.admission_max_waiters and (not self.account or type(cfg.max_players) is not int or cfg.max_players < 1):
            raise ValueError("admission requires an approved Hall issuer and positive max_players")
        if type(cfg.admission_legacy_players) is not bool:
            raise ValueError("admission_legacy_players must be a boolean")
        if cfg.admission_legacy_players and not (cfg.admission_max_waiters and cfg.player_test_codes_enabled):
            raise ValueError("legacy admission requires enabled queue and legacy player login")
        self.admission = (Admission(cfg.max_players, cfg.admission_max_waiters, self.auth,
                                    legacy_players=cfg.admission_legacy_players)
                          if cfg.admission_max_waiters else None)

    def _client_version(self) -> str:
        f = self.cfg.web_dir / "build-info.json"
        if f.is_file():
            try:
                return json.loads(f.read_text(encoding="utf-8")).get("version", "?")
            except ValueError:
                return "?"
        return "not-built"

    def start(self) -> None:
        loop = asyncio.get_running_loop()
        self.tasks = [loop.create_task(self.hub.tick_loop()), loop.create_task(self.hub.persist_loop()),
                      loop.create_task(self.hub.r4_loop()), loop.create_task(self.hub.housekeeping_loop(self.auth))]
        if self.account:
            self.tasks.append(loop.create_task(self.account.maintain(self.hub)))

    async def stop(self) -> None:
        for c in list(self.hub.conns.values()):
            self.hub.save_player(c)
        for t in self.tasks:
            t.cancel()

    # -- request identity helpers ---------------------------------------------------
    def ip_hint(self, peer: str | None, headers) -> str:
        """A salted hash of the client address; raw IPs are not stored."""
        ip = peer or "?"
        if ip in ("127.0.0.1", "::1") and headers.get("cf-connecting-ip"):
            ip = headers.get("cf-connecting-ip")          # set by Cloudflare at the edge, via the LAB tunnel
        return hashlib.sha256(self.pepper + ip.encode()).hexdigest()[:12]

    def via_tunnel(self, headers) -> bool:
        return bool(headers.get("cf-ray"))

    def host_ok(self, headers) -> bool:
        return (headers.get("host") or "").lower() in self.cfg.hosts()

    def secure(self, headers) -> bool:
        return (headers.get("host") or "").lower() == self.cfg.public_host


def page_csp(nonce_hashes: list[str] | None = None, connect: str = "'self'") -> str:
    scripts = " ".join(["'self'", "'wasm-unsafe-eval'", *(nonce_hashes or [])])
    return ("default-src 'self'; script-src " + scripts + "; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob:; font-src 'self'; connect-src " + connect + "; worker-src 'self' blob:; "
            "frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'")


def security_headers(resp: Response, csp: str) -> Response:
    resp.headers["Content-Security-Policy"] = csp
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Referrer-Policy"] = "no-referrer"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    resp.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return resp


def inline_script_hashes(html: str) -> list[str]:
    out = []
    for body in re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, flags=re.S | re.I):
        out.append("'sha256-" + base64.b64encode(hashlib.sha256(body.encode()).digest()).decode() + "'")
    return out


def create_app(lab: Lab) -> FastAPI:
    app = FastAPI(title="ZSZM LAB gateway", docs_url=None, redoc_url=None, openapi_url=None)
    cfg = lab.cfg

    def session_of(request) -> dict | None:
        return lab.auth.session(request.cookies.get(SESSION_COOKIE))

    gate = lab.admission

    def is_hall_player(session):
        return (session["role"] == "player" and lab.store.one(
            "SELECT 1 FROM account_sessions WHERE digest=?", (session["digest"],)) is not None)

    def admission_mode(session):
        if session["role"] != "player":
            return "staff"
        if is_hall_player(session):
            return "hall"
        if session["role"] == "player" and gate.legacy_available(session["code_id"]):
            return "legacy"
        return None

    def queue_response(payload, code=200):
        headers = {"Cache-Control": "private, no-store"}
        if payload.get("retry_after"):
            headers["Retry-After"] = str(payload["retry_after"])
        return JSONResponse(payload, status_code=code, headers=headers)

    @app.api_route("/api/admission", methods=["GET", "POST", "DELETE"])
    async def admission(request: Request):
        if gate is None:
            return queue_response({"state": "disabled"})
        session = session_of(request)
        if not session:
            return queue_response({"error": "no_session"}, 401)
        mode = admission_mode(session)
        if mode is None:
            return queue_response({"error": "hall_account_required"}, 403)
        principal = session["code_id"]
        if request.method == "GET":
            return queue_response(gate.status(principal, touch=True))
        if request.headers.get("origin") not in cfg.origins():
            return queue_response({"error": "bad_origin"}, 403)
        if request.method == "DELETE":
            gate.cancel(principal)
            return queue_response(gate.status(principal))
        try:
            body = bytearray()
            async for part in request.stream():
                if len(body) + len(part) > 1024:
                    return queue_response({"error": "body_too_large"}, 413)
                body.extend(part)
            data = json.loads(body or b"{}")
            if not isinstance(data, dict):
                raise ValueError()
            code = data.get("priority_code", "")
            if not isinstance(code, str) or len(code) > 64:
                raise ValueError()
        except (TypeError, ValueError):
            return queue_response({"error": "bad_request"}, 400)
        # Session may have changed during the request body await.
        fresh = session_of(request)
        if not fresh or fresh["code_id"] != principal or admission_mode(fresh) != mode:
            return queue_response({"error": "no_session"}, 401)
        if code:
            if mode != "hall":
                return queue_response({"error": "priority_unavailable"}, 400)
            address = lab.ip_hint(request.client.host if request.client else None, request.headers)
            if not gate.prove(principal, code, address):
                return queue_response({"error": "priority_unavailable"}, 400)
        result = gate.join(principal, legacy=mode == "legacy")
        return queue_response(result, 503 if result["state"] == "full" else 200)

    @app.middleware("http")
    async def host_guard(request: Request, call_next):
        if not lab.host_ok(request.headers):
            return JSONResponse({"error": "unknown_host"}, status_code=421)
        resp = await call_next(request)
        if lab.secure(request.headers):
            resp.headers["Strict-Transport-Security"] = "max-age=31536000"
        return resp

    if lab.account:
        account_broker.install(app, lab, lab.account)
        if cfg.account_direct_web_enabled is True:
            from .account_direct_web import install
            install(app, lab, lab.account)

    @app.get("/api/account/native/available")
    async def native_available(request: Request):
        enabled = (cfg.account_direct_native_enabled is True and cfg.account_direct_web_enabled is True
                   and lab.account is not None and lab.secure(request.headers) and request.url.scheme == "https")
        methods = ["windows_loopback"] if enabled else []
        if (enabled and cfg.account_direct_native_android_enabled is True
                and cfg.public_host == "pc-lab.iridescently.cn"
                and request.headers.getlist("host") == [cfg.public_host]):
            methods.append("android_app_link")
        return JSONResponse({"enabled": enabled, "methods": methods},
                            headers={"Cache-Control":"no-store"})

    @app.get("/healthz")
    async def healthz():
        return {"ok": True, "version": config_mod.VERSION}

    @app.get("/")
    async def index(request: Request):
        if session_of(request):
            return RedirectResponse("/play/", status_code=303)
        resp = FileResponse(WEB_STATIC / "login.html", media_type="text/html; charset=utf-8")
        resp.headers["Cache-Control"] = "no-store"
        return security_headers(resp, page_csp())

    @app.get("/static/{name}")
    async def static(name: str):
        f = WEB_STATIC / "static" / name
        if not re.fullmatch(r"[a-z0-9._-]+", name) or not f.is_file():
            return Response(status_code=404)
        resp = FileResponse(f, media_type=MIME.get(f.suffix, "application/octet-stream"))
        resp.headers["Cache-Control"] = "public, max-age=300"
        resp.headers["X-Content-Type-Options"] = "nosniff"
        return resp

    @app.post("/api/login")
    async def login(request: Request):
        origin = request.headers.get("origin")
        if origin and origin not in cfg.origins():
            return JSONResponse({"error": "bad_origin"}, status_code=403)
        try:
            body = await request.json()
            code = str(body.get("code", ""))[:64]
        except Exception:
            return JSONResponse({"error": "bad_request"}, status_code=400)
        ip = lab.ip_hint(request.client.host if request.client else None, request.headers)
        token, reason, wait = lab.auth.login(code, ip)
        if not token:
            await asyncio.sleep(0.4)                  # flatten timing between unknown and disabled codes
            status = 429 if reason == "locked" else 401
            resp = JSONResponse({"error": reason, "retry_after": int(wait)}, status_code=status)
            if wait:
                resp.headers["Retry-After"] = str(int(wait))
            return resp
        resp = JSONResponse({"ok": True, "next": "/play/"})
        resp.set_cookie(SESSION_COOKIE, token, max_age=cfg.session_days * 86400, httponly=True,
                        secure=lab.secure(request.headers), samesite="strict", path="/")
        return resp

    @app.post("/api/logout")
    async def logout(request: Request):
        token = request.cookies.get(SESSION_COOKIE)
        if gate and (session := session_of(request)):
            gate.cancel(session["code_id"])
        lab.auth.logout(token)
        if lab.account:
            for c in list(lab.hub.conns.values()):
                if token and secrets.compare_digest(c.token, token):
                    await lab.hub.detach(c, "logged_out")
            await lab.account.close(token)
        resp = JSONResponse({"ok": True})
        resp.delete_cookie(SESSION_COOKIE, path="/")
        return resp

    @app.get("/api/me")
    async def me(request: Request):
        s = session_of(request)
        if not s:
            return JSONResponse({"error": "no_session"}, status_code=401)
        return {"role": s["role"], "expires_at": s["expires_at"], "client_version": lab.client_version,
                "server_version": config_mod.VERSION}

    @app.get("/admission")
    async def admission_page(request: Request):
        if gate is None:
            return RedirectResponse("/play/", status_code=303)
        session = session_of(request)
        if not session:
            return RedirectResponse("/", status_code=303)
        mode = admission_mode(session)
        if mode is None:
            return security_headers(HTMLResponse(
                '<!doctype html><meta charset="utf-8"><title>进入众生之门</title>'
                '<p>此会话暂不能排队。请从<a href="/account/direct/login">会馆账户入口</a>重新验证。</p>',
                status_code=403, headers={"Cache-Control": "no-store"}), page_csp())
        html = (WEB_STATIC / "admission.html").read_text(encoding="utf-8")
        return security_headers(HTMLResponse(html.replace("__LAB_QUEUE_MODE__",mode),
                                             headers={"Cache-Control":"private, no-store"}), page_csp())

    @app.get("/play")
    async def play_redirect():
        return RedirectResponse("/play/", status_code=301)

    @app.get("/play/{path:path}")
    async def play(path: str, request: Request):
        session = session_of(request)
        if not session:
            return RedirectResponse("/", status_code=303)
        if gate:
            mode = admission_mode(session)
            if mode is None:
                if path in ("", "index.html"):
                    return RedirectResponse("/admission", status_code=303, headers={"Cache-Control":"no-store"})
                return queue_response({"error": "hall_account_required"}, 403)
            status = (gate.join(session["code_id"], legacy=mode == "legacy")
                      if mode in ("legacy", "staff") else gate.status(session["code_id"]))
            if status["state"] not in ("ready", "playing"):
                if path in ("", "index.html"):
                    return RedirectResponse("/admission", status_code=303, headers={"Cache-Control":"no-store"})
                return queue_response(status, 409)
        path = path or "index.html"
        if not re.fullmatch(r"[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*", path) or ".." in path:
            return Response(status_code=404)
        root = cfg.web_dir.resolve()
        f = (root / path).resolve()
        if root not in f.parents or not f.is_file():
            return Response(status_code=404)
        connect = "'self' wss://" + cfg.public_host + f" ws://127.0.0.1:{cfg.port} ws://localhost:{cfg.port}"
        if f.suffix == ".html":
            html = f.read_text(encoding="utf-8")
            resp = HTMLResponse(html)
            resp.headers["Cache-Control"] = "no-store"
            return security_headers(resp, page_csp(inline_script_hashes(html), connect))
        # Revalidate with a cheap 304 instead of re-sending ~10 MB through the home uplink on every reload.
        st = f.stat()
        etag = f'"{st.st_size:x}-{st.st_mtime_ns:x}"'
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304, headers={"ETag": etag, "Cache-Control": "private, no-cache"})
        accept = request.headers.get("accept-encoding", "")
        encoded = None
        for enc, suffix in (("br", ".br"), ("gzip", ".gz")):
            if enc in accept and (f.parent / (f.name + suffix)).is_file():
                encoded = (enc, f.parent / (f.name + suffix))
                break
        resp = FileResponse(encoded[1] if encoded else f, media_type=MIME.get(f.suffix, "application/octet-stream"))
        if encoded:
            resp.headers["Content-Encoding"] = encoded[0]
            resp.headers["Vary"] = "Accept-Encoding"
        resp.headers["Cache-Control"] = "private, no-cache"
        resp.headers["ETag"] = etag
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        return resp

    @app.websocket("/ws")
    async def ws_endpoint(ws: WebSocket):
        headers = ws.headers
        origin = headers.get("origin")
        reason = None
        if not lab.host_ok(headers):
            reason = "host"
        elif origin is None and lab.via_tunnel(headers):
            reason = "origin_missing"                 # browsers always send Origin; only local native clients may omit it
        elif origin is not None and origin not in cfg.origins():
            reason = "origin"
        session = None if reason else lab.auth.session(ws.cookies.get(SESSION_COOKIE))
        if not reason and not session:
            reason = "session"
        if not reason and session["role"] not in ("player", "art", "monitor"):
            reason = "role"
        if not reason and gate is None and len(lab.hub.conns) >= cfg.max_players:
            reason = "full"
        mode = admission_mode(session) if not reason and gate and session["role"] == "player" else None
        if not reason and gate and session["role"] == "player" and mode is None:
            reason = "hall_account_required"
        if reason:
            lab.ws_handshake_rejects += 1
            lab.store.security("ws_rejected", ip_hint=lab.ip_hint(ws.client.host if ws.client else None, headers),
                               reason=reason)
            await ws.close(code=4401 if reason == "session" else 4403)
            return
        principal = session["code_id"]
        token = ws.cookies.get(SESSION_COOKIE)
        lease = None
        if gate:
            if mode == "legacy":
                gate.join(principal, legacy=True)  # old client can still start at /ws
            elif session["role"] != "player":
                # Preserve staff gameplay as an ordinary admission; never grant priority.
                gate.join(principal)
            lease = gate.begin(principal)  # reserve synchronously before ASGI awaits
            if lease is None:
                status = gate.status(principal)
                await ws.accept()
                await ws.send_json({"t": "admission", **status})
                await ws.close(code=4429)
                return
        conn = writer = None
        try:
            if gate:
                await asyncio.wait_for(ws.accept(), timeout=5)
            else:
                await ws.accept()
            current = lab.auth.session(token) if gate else session
            if not current or (gate and (current["code_id"] != principal or
                           (current["role"] == "player" and admission_mode(current) != mode))):
                await ws.close(code=4401)
                return
            conn = await lab.hub.attach(ws, current, token, lab.ip_hint(ws.client.host if ws.client else None, headers))
            if gate:
                gate.confirm(principal, lease)
            writer = asyncio.create_task(lab.hub.writer(conn))
            while not conn.closed:
                msg = await ws.receive()
                if msg["type"] == "websocket.disconnect":
                    break
                text = msg.get("text")
                if text is None and msg.get("bytes") is not None:
                    text = msg["bytes"].decode("utf-8", "replace")
                if text is None:
                    continue
                if len(text) > 8 * 1024 * 1024:
                    break
                await lab.hub.handle(conn, text)
        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            try:
                if conn is not None:
                    await lab.hub.detach(conn, "closed")
            finally:
                if writer is not None:
                    writer.cancel()
                if gate:
                    reconnect = False
                    try:
                        reconnect = conn is not None and bool(lab.auth.session(token))
                    finally:
                        gate.release(principal, lease, connected=reconnect)


    # -- monitor (read-only) ----------------------------------------------------------
    @app.get("/monitor")
    async def monitor_page(request: Request):
        s = session_of(request)
        if not s or s["role"] != "monitor":
            return Response("monitor role required", status_code=403)
        resp = FileResponse(WEB_STATIC / "monitor.html", media_type="text/html; charset=utf-8")
        return security_headers(resp, page_csp())

    @app.get("/api/monitor")
    async def monitor_api(request: Request):
        s = session_of(request)
        if not s or s["role"] != "monitor":
            return JSONResponse({"error": "forbidden"}, status_code=403)
        from .metrics import system_metrics
        return {"hub": lab.hub.stats(), "system": system_metrics(), "r4": lab.r4.status(),
                "server_version": config_mod.VERSION, "client_version": lab.client_version}

    # -- art team uploads ---------------------------------------------------------------
    @app.get("/art")
    async def art_page(request: Request):
        s = session_of(request)
        if not s or s["role"] not in ("art",):
            return Response("art role required", status_code=403)
        resp = FileResponse(WEB_STATIC / "art.html", media_type="text/html; charset=utf-8")
        return security_headers(resp, page_csp())

    @app.post("/api/art")
    async def art_upload(request: Request):
        s = session_of(request)
        if not s or s["role"] != "art":
            return JSONResponse({"error": "forbidden"}, status_code=403)
        if request.headers.get("origin") not in cfg.origins():
            return JSONResponse({"error": "bad_origin"}, status_code=403)
        category = request.headers.get("x-art-category", "other")
        if category not in ("tree", "bridge", "ground", "building", "character", "prop", "other"):
            return JSONResponse({"error": "bad_category"}, status_code=400)
        data = await request.body()
        if len(data) > 10 * 1024 * 1024:
            return JSONResponse({"error": "too_large"}, status_code=413)
        kind = sniff(data)
        try:
            with Image.open(io.BytesIO(data)) as img:
                if kind is None or (img.format or "").lower() != kind or max(img.size) > 4096:
                    raise OCRejected("format")
                img.load()
                w, h = img.size
                out = io.BytesIO()
                img.convert("RGBA").save(out, "PNG", optimize=True)
        except Exception:
            return JSONResponse({"error": "invalid_image"}, status_code=400)
        aid = "a_" + secrets.token_hex(6)
        name = clean_text(request.headers.get("x-art-name", "untitled"), 40)
        (cfg.art_dir / "pending" / f"{aid}.png").write_bytes(out.getvalue())
        lab.store.exec("INSERT INTO art_assets(id,uploader,category,filename,mime,width,height,bytes,created_at) "
                       "VALUES(?,?,?,?,?,?,?,?,?)", (aid, s["code_id"], category, name, "image/png", w, h,
                                                     len(out.getvalue()), time.time()))
        return {"ok": True, "id": aid, "status": "pending"}

    @app.get("/api/art/approved")
    async def art_list(request: Request):
        if not session_of(request):
            return JSONResponse({"error": "no_session"}, status_code=401)
        rows = lab.store.all("SELECT id,category,filename,width,height FROM art_assets WHERE status='approved' ORDER BY reviewed_at DESC")
        return {"assets": [dict(r) for r in rows]}

    @app.get("/api/art/file/{aid}")
    async def art_file(aid: str, request: Request):
        s = session_of(request)
        if not s or not re.fullmatch(r"a_[0-9a-f]{12}", aid):
            return Response(status_code=404)
        row = lab.store.one("SELECT status,uploader FROM art_assets WHERE id=?", (aid,))
        if not row or (row["status"] != "approved" and row["uploader"] != s["code_id"]):
            return Response(status_code=404)
        f = cfg.art_dir / row["status"] / f"{aid}.png"
        if row["status"] == "pending":
            f = cfg.art_dir / "pending" / f"{aid}.png"
        if not f.is_file():
            return Response(status_code=404)
        resp = FileResponse(f, media_type="image/png")
        resp.headers["Cache-Control"] = "private, no-store"
        return resp

    return app
