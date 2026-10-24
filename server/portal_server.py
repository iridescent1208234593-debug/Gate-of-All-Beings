# -*- coding: utf-8 -*-
"""统一入口（Phase 1/2）：按 Host + 路径分发。

- www / huiguan / oc：按 Host 复用各自 Handler。
- 统一壳与游戏模块（内路径）：
    /app/*                 -> server/app（壳 + modules）
    /shared/shared-ui/*    -> shared/shared-ui
    /management/*,/ecology/* -> 兼容 cards 内嵌的根绝对路径
    /app/modules/<name>/api/*  -> 反向代理到各游戏自己的 API 上游
- 未接入生产（cloudflared / 网站管家）前：
    PORT=8080 python server/portal_server.py
"""
import http.client
import http.server
import importlib.util
import os
import re
import select
import socket
import sys
import threading
import time
from urllib.parse import parse_qs, urlsplit
from pathlib import Path

PORT = int(os.environ.get("PORT", "8080"))
HOST = "127.0.0.1"
ENVIRONMENT = os.environ.get("IRIDESCENTLY_ENVIRONMENT", "production").strip().lower()
CODE_ROOT = Path(__file__).resolve().parents[1]
ROOT = Path(os.environ.get("IRIDESCENTLY_PROJECT_ROOT", CODE_ROOT)).resolve()


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, str(path))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


sys.path.insert(0, str(CODE_ROOT / "server"))
from base_static import BaseStaticHandler  # noqa: E402
from host_policy import FORWARDING_HEADERS, PRODUCTION_HOSTS, enforce_request, normalize_host  # noqa: E402

www = _load("portal_www", CODE_ROOT / "portal" / "www" / "server.py")
oc = _load("portal_oc", CODE_ROOT / "portal" / "oc" / "server.py")
huiguan = _load("portal_huiguan", CODE_ROOT / "portal" / "huiguan" / "server_huiguan.py")

APP_DIR = CODE_ROOT / "server" / "app"
MODULES_DIR = ROOT / "server" / "app" / "modules"
# Unhashed JS/CSS under modules/: 0 = always revalidate (default). Rollback to the old 4-hour cache:
# set IRIDESCENTLY_MODULE_CODE_MAX_AGE=14400 and restart portal (see server/app/README.md).
MODULE_CODE_MAX_AGE = max(0, int(os.environ.get("IRIDESCENTLY_MODULE_CODE_MAX_AGE", "0") or 0))
PROXY_PORTS = {"cards": 5174, "card-balance": 5178, "softie": 4173, "juling": 5177}

API_RE = re.compile(r"^/app/modules/([^/]+)/api/")


class StaticHandler(BaseStaticHandler):
    """按请求配置 root/strip 的静态处理类。"""
    protocol_version = "HTTP/1.1"


class RedirectHandler(www.Handler):
    protocol_version = "HTTP/1.1"

    def _redirect(self):
        self.send_response(308)
        self.send_header("Location", self.redirect_to)
        self.send_header("Content-Length", "0")
        self.end_headers()

    do_GET = do_HEAD = _redirect
    do_POST = do_PUT = do_PATCH = do_DELETE = _redirect

    def log_message(self, fmt, *args):
        print("[redirect] %s" % args[0], flush=True)


class ProxyHandler(http.server.BaseHTTPRequestHandler):
    """把 /app/modules/<name>/api/* 转发到该游戏自己的 API 上游。"""
    protocol_version = "HTTP/1.1"
    upstream_port = 0
    strip = ""

    def send_error(self, code, message=None, explain=None):
        from access_recovery import send_recovery
        if not send_recovery(self, code):
            super().send_error(code, message, explain)

    def _proxy(self, method):
        path = self.path
        if self.strip and path.startswith(self.strip):
            path = path[len(self.strip):] or "/"
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            self.close_connection = True
            self.send_error(400, "invalid content length")
            return
        if length < 0 or length > 8 * 1024 * 1024:
            self.close_connection = True
            self.send_error(413 if length > 0 else 400, "request body exceeds 8 MiB")
            return
        body = self.rfile.read(length) if length else None
        headers = {k: v for k, v in self.headers.items()
                   if k.lower() not in ("host", "connection", "content-length") and k.lower() not in FORWARDING_HEADERS}
        # Replace, never forward client-supplied proxy identity headers.
        headers["X-Forwarded-Host"] = normalize_host(self.headers.get("Host", "")) or ""
        headers["X-Forwarded-Proto"] = "https" if self.headers.get("X-Forwarded-Proto") == "https" else "http"
        if body is not None:
            headers["Content-Length"] = str(len(body))
        conn = None
        try:
            conn = http.client.HTTPConnection("127.0.0.1", self.upstream_port, timeout=30)
            conn.request(method, path, body=body, headers=headers)
            resp = conn.getresponse()
            data = resp.read()
        except OSError as e:
            self.send_error(502, "upstream unavailable: %s" % e)
            return
        finally:
            if conn is not None:
                conn.close()
        self.send_response(resp.status)
        for k, v in resp.getheaders():
            if k.lower() in ("transfer-encoding", "connection", "content-length"):
                continue
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if method != "HEAD":
            self.wfile.write(data)

    do_GET = do_POST = do_PUT = do_DELETE = do_PATCH = do_HEAD = \
        lambda self: self._proxy(self.command)

    def log_message(self, fmt, *args):
        print("[proxy:%s] %s" % (self.upstream_port, args[0]), flush=True)


class WebSocketProxyHandler(ProxyHandler):
    """Relay the softie Upgrade stream; websocket framing remains in the standard ws library."""

    def do_GET(self):
        if self.headers.get("Upgrade", "").lower() != "websocket" or "upgrade" not in self.headers.get("Connection", "").lower():
            self.send_error(426, "websocket upgrade required")
            return
        self.close_connection = True
        upstream = None
        upgraded = False
        try:
            upstream = socket.create_connection(("127.0.0.1", self.upstream_port), timeout=5)
            headers = {k: v for k, v in self.headers.items()
                       if k.lower() != "host" and k.lower() not in FORWARDING_HEADERS}
            headers["Host"] = f"127.0.0.1:{self.upstream_port}"
            headers["X-Forwarded-Host"] = normalize_host(self.headers.get("Host", "")) or ""
            headers["X-Forwarded-Proto"] = "https" if self.headers.get("X-Forwarded-Proto") == "https" else "http"
            path = self.path[len(self.strip):] if self.strip and self.path.startswith(self.strip + "/") else self.path
            head = f"GET {path} HTTP/1.1\r\n" + "".join(f"{k}: {v}\r\n" for k, v in headers.items()) + "\r\n"
            upstream.sendall(head.encode("iso-8859-1"))
            # Unbuffered HTTP head leaves every following websocket byte in the socket.
            with upstream.makefile("rb", buffering=0) as reader:
                status = reader.readline(8192)
                parts = status.split()
                code = int(parts[1]) if len(parts) > 1 else 502
                lines = [status]
                size = len(status)
                while True:
                    line = reader.readline(8192)
                    size += len(line)
                    if not line or size > 32768:
                        raise OSError("invalid upstream handshake")
                    lines.append(line)
                    if line == b"\r\n":
                        break
            if code != 101:
                self.send_error(code, "room connection rejected")
                return
            self.wfile.write(b"".join(lines))
            self.wfile.flush()
            upgraded = True
            self.connection.settimeout(30)
            upstream.settimeout(30)
            while True:
                readable, _, _ = select.select([self.connection, upstream], [], [], 90)
                if not readable:
                    break
                for source in readable:
                    chunk = source.recv(65536)
                    if not chunk:
                        return
                    target = upstream if source is self.connection else self.connection
                    target.sendall(chunk)
        except (OSError, ValueError):
            if not upgraded:
                self.send_error(502, "room upstream unavailable")
        finally:
            if upstream is not None:
                upstream.close()


class PublicStatusHandler(BaseStaticHandler):
    def do_GET(self):
        body = b'{"node":"hk-stable","portal":"ready"}'
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    do_HEAD = do_GET


class ProgressHandler(BaseStaticHandler):
    """/api/progress/*: account points, daily tasks and leaderboards (server/account_progress.py)."""

    def _serve(self):
        import account_progress
        account_progress.handle(self, self.command, self.path, str(ROOT))

    do_GET = do_HEAD = do_POST = _serve


def route(host, path):
    """-> (处理类, 配置 dict)。"""
    h = (host or "").split(":")[0].lower()
    p = (path or "").split("?")[0]
    if p == '/__server/status':
        return PublicStatusHandler, {}
    # Same-origin on every host, so each game (zszm, spirit, huiguan, main site) can reach it.
    if p.startswith('/api/progress/'):
        return ProgressHandler, {}
    if p.startswith('/shared/'):
        return StaticHandler, {"root": str(CODE_ROOT / "shared"), "strip": "/shared"}
    if h == "huiguan.iridescently.xyz" or h.endswith(".huiguan.iridescently.xyz"):
        return huiguan.Handler, {}
    if h == "oc.iridescently.xyz" or h.endswith(".oc.iridescently.xyz"):
        return oc.Handler, {}
    legacy_destinations = {
        "game.iridescently.xyz": "https://zszm.iridescently.xyz/#home",
        "lingjing.iridescently.xyz": "https://zszm.iridescently.xyz/#management",
        "juling.iridescently.xyz": "https://zszm.iridescently.xyz/app/shell/m/juling",
    }
    if h in legacy_destinations:
        if h == "juling.iridescently.xyz" and p.startswith("/api/"):
            return ProxyHandler, {"port": PROXY_PORTS["juling"], "strip": ""}
        return RedirectHandler, {"location": legacy_destinations[h]}
    if p == "/management" or p.startswith("/management/"):
        if "embed" in parse_qs(urlsplit(path or "").query):
            return StaticHandler, {"root": str(MODULES_DIR / "management"), "strip": "/management"}
        return RedirectHandler, {"location": "https://zszm.iridescently.xyz/#management"}
    if h == "zszm.iridescently.xyz" and (p == "/api/card-balance" or p.startswith("/api/card-balance/")):
        return ProxyHandler, {"port": PROXY_PORTS["card-balance"], "strip": ""}
    if p == "/app/modules/softie/api/spirit-room/ws":
        return WebSocketProxyHandler, {"port": PROXY_PORTS["softie"], "strip": "/app/modules/softie"}
    m = API_RE.match(p)
    if m and m.group(1) in PROXY_PORTS:
        name = m.group(1)
        if name == "cards" and p.startswith("/app/modules/cards/api/card-balance"):
            return ProxyHandler, {"port": PROXY_PORTS["card-balance"], "strip": "/app/modules/cards"}
        return ProxyHandler, {"port": PROXY_PORTS[name], "strip": "/app/modules/" + name}
    if h == "spirit.iridescently.xyz":
        if p == "/api/sso-user":
            return www.Handler, {}
        return StaticHandler, {
            "root": str(MODULES_DIR / "softie"),
            "strip": "/app/modules/softie",
            "spa": "/index.html",
        }
    if p == "/app/shell" or p.startswith("/app/shell/"):
        return StaticHandler, {"root": str(APP_DIR), "strip": "/app", "spa": "/shell/index.html"}
    if p == "/app/portal.json":
        return StaticHandler, {"root": str(APP_DIR), "strip": "/app"}
    if p == "/app/modules" or p.startswith("/app/modules/"):
        return StaticHandler, {"root": str(MODULES_DIR), "strip": "/app/modules"}
    # Embedded modules and shared resources must win before the Cards SPA fallback.
    if p.startswith("/shared/"):
        return StaticHandler, {"root": str(CODE_ROOT / "shared"), "strip": "/shared"}
    # The shooter lives in the main site's static tree, not the Cards SPA.
    if p == "/playtest/shengsheng-shoot" or p.startswith("/playtest/shengsheng-shoot/"):
        return www.Handler, {}
    if p == "/ecology" or p.startswith("/ecology/"):
        return StaticHandler, {"root": str(MODULES_DIR / "ecology"), "strip": "/ecology"}
    if h == "zszm.iridescently.xyz":
        if p == "/api/sso-user":
            return www.Handler, {}
        if p.startswith("/api/"):
            return ProxyHandler, {"port": PROXY_PORTS["cards"], "strip": ""}
        return StaticHandler, {"root": str(MODULES_DIR / "cards"), "spa": "/index.html"}
    return www.Handler, {}


class Dispatcher(www.Handler):
    """先按主站建实例，解析请求头后按 Host/路径切到目标处理类。"""

    def handle_one_request(self):
        # 处理完后把类恢复为 Dispatcher，保证 keep-alive 的下一个请求仍走本处分发
        try:
            super().handle_one_request()
        finally:
            self.__class__ = Dispatcher
            # Defensive guard. Root cause of the earlier CPU spin (a swallowed ConnectionResetError that
            # left close_connection False, see test_connection_reset_loop.py) is fixed in base_static.py;
            # this stays as a safety net: a connection looping >100 times/s is closed and logged.
            now = time.monotonic()
            window = getattr(self, "_loop_window", None)
            if window is None or now - window[0] > 1.0:
                self._loop_window = window = [now, 0]
            window[1] += 1
            if window[1] > 100:
                raw = getattr(self, "raw_requestline", b"")
                print("[spin-guard] closing %s loops=%d/s last=%r close_connection_was=%s thread=%d fd=%s" % (
                    self.client_address, window[1], raw[:80], self.close_connection,
                    threading.get_ident(), getattr(self.request, "fileno", lambda: None)()), flush=True)
                self.close_connection = True

    def parse_request(self):
        ok = super().parse_request()
        if not ok:
            return ok
        if not enforce_request(self, PRODUCTION_HOSTS, ENVIRONMENT == "development"):
            return False
        host = normalize_host(self.headers.get("Host", "")) or ""
        target, cfg = route(host, self.path or "")
        if target is not type(self):
            self.__class__ = target
        if issubclass(target, BaseStaticHandler):
            root = cfg.get("root") or getattr(target, "_static_dir", None)
            if root:
                self._static_dir = root
                self.directory = root
                self.code_max_age = MODULE_CODE_MAX_AGE if str(root).startswith(str(MODULES_DIR)) else None
        strip = cfg.get("strip", "")
        if strip and (self.path == strip or self.path.startswith(strip + "/")):
            rest = self.path[len(strip):]
            self.path = rest if rest.startswith("/") else "/" + rest
        if cfg.get("spa"):
            last = self.path.rsplit("/", 1)[-1]
            if "." not in last:
                self.path = cfg["spa"]
        if issubclass(target, ProxyHandler):
            self.upstream_port = cfg["port"]
            self.strip = strip
        if issubclass(target, RedirectHandler):
            self.redirect_to = cfg["location"]
        return ok


if __name__ == "__main__":
    print(f"portal 统一入口启动: http://127.0.0.1:{PORT}", flush=True)
    class _Server(http.server.ThreadingHTTPServer):
        daemon_threads = True
        request_queue_size = 1024  # default backlog of 5 drops connections under a signup burst

        def get_request(self):
            # Idle keep-alive sockets (cloudflared holds many) otherwise pin one thread each forever.
            conn, addr = super().get_request()
            idle = float(os.environ.get("IRIDESCENTLY_IDLE_TIMEOUT", "30"))
            if idle > 0:
                conn.settimeout(idle)
            return conn, addr

    _Server((HOST, PORT), Dispatcher).serve_forever()
