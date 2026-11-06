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
import re
import secrets
import time
from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse, Response
from PIL import Image

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
        self.auth = Auth(self.store, self.pepper, cfg.session_days)
        self.oc = OCCache(cfg.oc_dir, cfg.oc_cache_budget_bytes, cfg.oc_ttl_seconds)
        self.r4 = R4Bridge(cfg.r4_port, cfg.secrets, cfg.r4_enabled)
        self.hub = Hub(self.store, SPACES_FILE, self.oc, self.r4, config_mod.VERSION)
        self.hub.oc_limits = {"max_bytes": cfg.oc_max_bytes, "max_side": cfg.oc_max_side,
                              "display_side": cfg.oc_display_side}
        self.client_version = self._client_version()
        self.tasks: list[asyncio.Task] = []
        self.ws_handshake_rejects = 0

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

    @app.middleware("http")
    async def host_guard(request: Request, call_next):
        if not lab.host_ok(request.headers):
            return JSONResponse({"error": "unknown_host"}, status_code=421)
        resp = await call_next(request)
        if lab.secure(request.headers):
            resp.headers["Strict-Transport-Security"] = "max-age=31536000"
        return resp

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
        lab.auth.logout(request.cookies.get(SESSION_COOKIE))
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

    @app.get("/play")
    async def play_redirect():
        return RedirectResponse("/play/", status_code=301)

    @app.get("/play/{path:path}")
    async def play(path: str, request: Request):
        if not session_of(request):
            return RedirectResponse("/", status_code=303)
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
        if not reason and len(lab.hub.conns) >= cfg.max_players:
            reason = "full"
        if reason:
            lab.ws_handshake_rejects += 1
            lab.store.security("ws_rejected", ip_hint=lab.ip_hint(ws.client.host if ws.client else None, headers),
                               reason=reason)
            await ws.close(code=4401 if reason == "session" else 4403)
            return
        await ws.accept()
        token = ws.cookies.get(SESSION_COOKIE)
        conn = await lab.hub.attach(ws, session, token, lab.ip_hint(ws.client.host if ws.client else None, headers))
        writer = asyncio.create_task(lab.hub.writer(conn))
        try:
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
            await lab.hub.detach(conn, "closed")
            writer.cancel()

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
