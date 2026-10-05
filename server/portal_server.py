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
from pathlib import Path

PORT = int(os.environ.get("PORT", "8080"))
ROOT = Path(__file__).resolve().parents[1]


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, str(path))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


sys.path.insert(0, str(ROOT / "server"))
from base_static import BaseStaticHandler  # noqa: E402

www = _load("portal_www", ROOT / "portal" / "www" / "server.py")
oc = _load("portal_oc", ROOT / "portal" / "oc" / "server.py")
huiguan = _load("portal_huiguan", ROOT / "portal" / "huiguan" / "server_huiguan.py")

APP_DIR = ROOT / "server" / "app"
MODULES_DIR = APP_DIR / "modules"
PROXY_PORTS = {"cards": 5174, "softie": 4173, "juling": 5177}

API_RE = re.compile(r"^/app/modules/([^/]+)/api/")


class StaticHandler(BaseStaticHandler):
    """按请求配置 root/strip 的静态处理类。"""
    protocol_version = "HTTP/1.1"


class ProxyHandler(http.server.BaseHTTPRequestHandler):
    """把 /app/modules/<name>/api/* 转发到该游戏自己的 API 上游。"""
    protocol_version = "HTTP/1.1"
    upstream_port = 0
    strip = ""

    def _proxy(self, method):
        path = self.path
        if self.strip and path.startswith(self.strip):
            path = path[len(self.strip):] or "/"
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        headers = {k: v for k, v in self.headers.items()
                   if k.lower() not in ("host", "connection", "content-length", "x-forwarded-host", "x-forwarded-proto")}
        # Replace, never forward client-supplied proxy identity headers.
        headers["X-Forwarded-Host"] = self.headers.get("Host", "")
        headers["X-Forwarded-Proto"] = "https" if self.headers.get("X-Forwarded-Proto") == "https" else "http"
        if body is not None:
            headers["Content-Length"] = str(len(body))
        try:
            conn = http.client.HTTPConnection("127.0.0.1", self.upstream_port, timeout=30)
            conn.request(method, path, body=body, headers=headers)
            resp = conn.getresponse()
            data = resp.read()
        except OSError as e:
            self.send_error(502, "upstream unavailable: %s" % e)
            return
        self.send_response(resp.status)
        for k, v in resp.getheaders():
            if k.lower() in ("transfer-encoding", "connection", "content-length"):
                continue
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if method != "HEAD":
            self.wfile.write(data)
        conn.close()

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
                       if k.lower() not in ("host", "x-forwarded-host", "x-forwarded-proto")}
            headers["Host"] = f"127.0.0.1:{self.upstream_port}"
            headers["X-Forwarded-Host"] = self.headers.get("Host", "")
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


def route(host, path):
    """-> (处理类, 配置 dict)。"""
    h = (host or "").split(":")[0].lower()
    if h == "huiguan.iridescently.xyz" or h.endswith(".huiguan.iridescently.xyz"):
        return huiguan.Handler, {}
    if h == "oc.iridescently.xyz" or h.endswith(".oc.iridescently.xyz"):
        return oc.Handler, {}
    p = (path or "").split("?")[0]
    if p == "/app/modules/softie/api/spirit-room/ws":
        return WebSocketProxyHandler, {"port": PROXY_PORTS["softie"], "strip": "/app/modules/softie"}
    m = API_RE.match(p)
    if m and m.group(1) in PROXY_PORTS:
        name = m.group(1)
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
    if p == "/app" or p.startswith("/app/"):
        return StaticHandler, {"root": str(APP_DIR), "strip": "/app"}
    if p.startswith("/shared/"):
        return StaticHandler, {"root": str(ROOT / "shared"), "strip": "/shared"}
    if p == "/management" or p.startswith("/management/"):
        return StaticHandler, {"root": str(MODULES_DIR / "management"), "strip": "/management"}
    if p == "/ecology" or p.startswith("/ecology/"):
        return StaticHandler, {"root": str(MODULES_DIR / "ecology"), "strip": "/ecology"}
    return www.Handler, {}


class Dispatcher(www.Handler):
    """先按主站建实例，解析请求头后按 Host/路径切到目标处理类。"""

    def handle_one_request(self):
        # 处理完后把类恢复为 Dispatcher，保证 keep-alive 的下一个请求仍走本处分发
        try:
            super().handle_one_request()
        finally:
            self.__class__ = Dispatcher

    def parse_request(self):
        ok = super().parse_request()
        if not ok:
            return ok
        target, cfg = route(self.headers.get("Host"), self.path or "")
        if target is not type(self):
            self.__class__ = target
        if issubclass(target, BaseStaticHandler):
            root = cfg.get("root") or getattr(target, "_static_dir", None)
            if root:
                self._static_dir = root
                self.directory = root
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
        return ok


if __name__ == "__main__":
    print(f"portal 统一入口启动: http://localhost:{PORT}", flush=True)
    http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Dispatcher).serve_forever()
