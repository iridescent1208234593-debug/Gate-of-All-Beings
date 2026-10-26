"""西木会馆站群 · 公共静态文件 Handler 基类
- 静态文件白名单防护（.py / .db / .log / .git 等不可下载）
- 统一安全响应头
- 静态资源缓存
- ConnectionResetError 静默处理
用法：子类继承 BaseStaticHandler，设置 _static_dir 即可。
"""

import http.server
import os
import re
from urllib.parse import unquote
from site_domains import SITE_DOMAIN, csp_policy, request_host, request_root, service_name

# 禁止直接下载的敏感后缀
BLOCKED_SUFFIXES = (".py", ".db", ".db-shm", ".db-wal", ".log", ".sqlite", ".sqlite3", ".json.bak", ".bak", ".pem", ".key", ".pfx", ".p12")
# 禁止直接下载的精确文件名
BLOCKED_NAMES = {"characters.json", "game_saves.json"}
# 禁止访问的目录名（含所有 . 开头的隐藏目录）
BLOCKED_DIRS = {".git", "__pycache__", ".vscode", ".idea", "backup", "store", "node_modules", "gallery-engine"}

# 安全响应头（所有请求统一附加）
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Strict-Transport-Security": "max-age=86400",
}

# 静态资源缓存（按后缀 -> max-age 秒数）
CACHE_MAX_AGE = {
    ".js": 3600, ".css": 3600,
    ".png": 86400, ".jpg": 86400, ".jpeg": 86400,
    ".gif": 86400, ".webp": 86400, ".avif": 86400, ".svg": 86400, ".ico": 86400,
    ".woff": 604800, ".woff2": 604800, ".mp4": 604800,
    ".ttf": 604800, ".otf": 604800, ".webm": 604800, ".ogg": 604800, ".wasm": 604800,
}
# The 8-char hash segment must contain a digit, uppercase letter or underscore: a plain lowercase word of
# 8 letters ("site-language.js") is a mutable file name, not a content hash, and must not become immutable.
HASHED_ASSET = re.compile(r"/assets/[^/]+-(?=[A-Za-z0-9_-]{0,7}[0-9A-Z_])[A-Za-z0-9_-]{8}\.(?:js|css|ttf|otf|woff2?|png|jpe?g|webp|svg|gif|mp4)$")


def static_allowed(path):
    """检查路径是否允许对外提供。"""
    parts = [p.lower() for p in unquote(path).replace("\\", "/").split("/") if p]
    for p in parts:
        if p in BLOCKED_DIRS or p.startswith("."):
            return False
    name = parts[-1] if parts else ""
    if name in BLOCKED_NAMES:
        return False
    if ".bak" in name:
        return False
    if name.endswith(BLOCKED_SUFFIXES):
        return False
    return True


class BaseStaticHandler(http.server.SimpleHTTPRequestHandler):
    # None = default per-suffix caching; set per request by portal_server for /app/modules code.
    code_max_age = None
    """带安全头 + 静态防护 + 错误静默的通用 Handler 基类。"""
    _static_dir = None  # 子类覆写

    def _zszm_request(self):
        """The game entry on any approved root gets the hardened response profile."""
        return service_name(request_host(self) or "") == "zszm"

    def version_string(self):
        if self._zszm_request():
            return "Iridescently"
        return super().version_string()

    def send_error(self, code, message=None, explain=None):
        from access_recovery import send_recovery
        if not send_recovery(self, code):
            if self._zszm_request():
                # Do not reflect exception details or the Python default template.
                body = ("<!doctype html><html lang=zh-CN><meta charset=utf-8>"
                        "<title>众生之门</title><h1>" + str(code) +
                        "</h1><p>页面暂时不可用。</p><a href=\"/\">返回众生之门</a></html>").encode("utf-8")
                self.close_connection = True
                self.send_response(code)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                if self.command != "HEAD":
                    self.wfile.write(body)
                return
            super().send_error(code, message, explain)

    def __init__(self, *args, **kwargs):
        # 子类若在 super().__init__ 里显式传 directory，交由调用方值优先，
        # 避免与 _static_dir 重复传参导致 TypeError（原 bug）。
        kwargs.setdefault("directory", self._static_dir)
        super().__init__(*args, **kwargs)

    def _is_api_path(self):
        """子类覆写：当前 path 是 API 路由时返回 True，跳过静态防护。"""
        return False

    def _observe_public_response(self):
        try:
            from scraping_observer import observe
            observe(self)
        except Exception:
            # Observation must never alter the response path.
            pass

    # ---- 安全响应头 + 缓存策略（在 end_headers 时统一注入） ----
    def end_headers(self):
        request_path = getattr(self, "path", "").split("?", 1)[0]
        if not hasattr(self, "_headers_buffer"):
            self._headers_buffer = []
        headers_buffer = self._headers_buffer
        # 安全头
        for k, v in SECURITY_HEADERS.items():
            if k == "Strict-Transport-Security" and self._zszm_request():
                v = "max-age=2592000"
            super().send_header(k, v)
        try:
            root = request_root(self)
        except ValueError:
            root = SITE_DOMAIN
        super().send_header("Content-Security-Policy-Report-Only", csp_policy(root))
        if self._zszm_request():
            # First enforced phase does not restrict legacy inline game scripts.
            # The existing script/style policy remains Report-Only until real
            # browser violations for embedded modules have been reviewed.
            super().send_header("Content-Security-Policy", "base-uri 'self'; object-src 'none'")
        # 扫描已缓冲的 headers，找 Content-Type
        ct = ""
        for h in headers_buffer:
            if isinstance(h, bytes) and h.lower().startswith(b"content-type"):
                ct = h.decode("utf-8", errors="replace").lower()
                break
        if "text/html" in ct:
            super().send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            super().send_header("Pragma", "no-cache")
            super().send_header("Expires", "0")
        else:
            ext = os.path.splitext(request_path)[1].lower()
            if ("image/" in ct or ext in (".woff", ".woff2", ".ttf", ".otf")) and not any(
                header.lower().startswith((b"access-control-allow-origin:", b"cache-control: private"))
                for header in headers_buffer
            ):
                # Public media remains exportable from the opaque showcase sandbox (Origin: null);
                # never credentialed, and owner-only originals are excluded by their private policy.
                super().send_header("Access-Control-Allow-Origin", "*")
            max_age = CACHE_MAX_AGE.get(ext)
            # A handler that set its own policy (e.g. private owner-only originals) keeps it.
            own_policy = any(h.lower().startswith(b"cache-control:") for h in headers_buffer)
            if own_policy:
                pass
            elif self.code_max_age is not None and ext in (".js", ".mjs", ".css") and not HASHED_ASSET.search(request_path):
                # Unhashed game module code: browsers and the CDN must revalidate so a publish is visible at once.
                # code_max_age > 0 is the rollback switch (see apps/README.md).
                if self.code_max_age > 0:
                    super().send_header("Cache-Control", f"public, max-age={self.code_max_age}")
                else:
                    super().send_header("Cache-Control", "no-cache, max-age=0, must-revalidate")
            elif HASHED_ASSET.search(request_path):
                # Vite content-hashed file: the name changes whenever the bytes do.
                super().send_header("Cache-Control", "public, max-age=31536000, immutable")
            elif max_age:
                super().send_header("Cache-Control", f"public, max-age={max_age}")
        self._close_if_unframed(headers_buffer)
        self._observe_public_response()
        super().end_headers()

    def _close_if_unframed(self, headers_buffer):
        """HTTP/1.1 keeps the connection open, so a reply with neither Content-Length nor chunked
        encoding has no end: the client waits until the idle timeout. Such replies close instead."""
        lines = [h.lower() for h in headers_buffer if isinstance(h, bytes)]
        try:
            status = int(lines[0].split(b" ", 2)[1])
        except (IndexError, ValueError):
            return
        if status < 200 or status in (204, 304) or any(h.startswith((b"content-length:", b"transfer-encoding:")) for h in lines):
            return
        if not any(h.startswith(b"connection:") for h in lines):
            super().send_header("Connection", "close")
        self.close_connection = True

    # ---- 静态文件防护 ----
    def do_HEAD(self):
        path = self.path.split("?")[0]
        if not self._is_api_path() and not static_allowed(path):
            self.send_error(404)
            return
        super().do_HEAD()

    def list_directory(self, path):
        self.send_error(404, "Not Found")
        return None

    def do_GET(self):
        if not self._is_api_path():
            path = self.path.split("?")[0]
            if not static_allowed(path):
                self.send_error(404)
                return
        super().do_GET()

    # ---- 静默 ConnectionResetError / BrokenPipeError ----
    def handle_one_request(self):
        try:
            super().handle_one_request()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            self.close_connection = True

    def log_message(self, fmt, *args):
        msg = str(args[0]) if args else ""
        if "ConnectionResetError" in msg or "BrokenPipeError" in msg:
            return
        super().log_message(fmt, *args)
