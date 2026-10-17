"""西木会馆站群 · 公共静态文件 Handler 基类
- 静态文件白名单防护（.py / .db / .log / .git 等不可下载）
- 统一安全响应头
- 静态资源缓存
- ConnectionResetError 静默处理
用法：子类继承 BaseStaticHandler，设置 _static_dir 即可。
"""

import http.server
import os
from urllib.parse import unquote

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
    "Content-Security-Policy-Report-Only": "; ".join((
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://static.cloudflareinsights.com https://*.iridescently.xyz",
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://*.iridescently.xyz",
        "img-src 'self' data: blob: https://*.iridescently.xyz",
        "font-src 'self' data: https://cdn.jsdelivr.net https://*.iridescently.xyz",
        "connect-src 'self' https://*.iridescently.xyz wss://*.iridescently.xyz https://static.cloudflareinsights.com",
        "media-src 'self' data: blob: https://*.iridescently.xyz",
        "frame-src 'self' https://*.iridescently.xyz",
        "worker-src 'self' blob:",
    )),
}

# 静态资源缓存（按后缀 -> max-age 秒数）
CACHE_MAX_AGE = {
    ".js": 3600, ".css": 3600,
    ".png": 86400, ".jpg": 86400, ".jpeg": 86400,
    ".gif": 86400, ".webp": 86400, ".svg": 86400, ".ico": 86400,
    ".woff": 604800, ".woff2": 604800, ".mp4": 604800,
}


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
    """带安全头 + 静态防护 + 错误静默的通用 Handler 基类。"""
    _static_dir = None  # 子类覆写

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
        # 安全头
        for k, v in SECURITY_HEADERS.items():
            super().send_header(k, v)
        # 扫描已缓冲的 headers，找 Content-Type
        ct = ""
        if hasattr(self, "_headers_buffer"):
            for h in self._headers_buffer:
                if isinstance(h, bytes) and h.lower().startswith(b"content-type"):
                    ct = h.decode("utf-8", errors="replace").lower()
                    break
        if "text/html" in ct:
            super().send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            super().send_header("Pragma", "no-cache")
            super().send_header("Expires", "0")
        else:
            ext = os.path.splitext(self.path.split("?")[0])[1].lower()
            if ("image/" in ct or ext in (".woff", ".woff2", ".ttf", ".otf")) and not any(
                header.lower().startswith(b"access-control-allow-origin:") for header in self._headers_buffer
            ):
                # Public media remains exportable from the opaque showcase sandbox.
                super().send_header("Access-Control-Allow-Origin", "*")
            max_age = CACHE_MAX_AGE.get(ext)
            if max_age:
                super().send_header("Cache-Control", f"public, max-age={max_age}")
        self._observe_public_response()
        super().end_headers()

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
            pass

    def log_message(self, fmt, *args):
        msg = str(args[0]) if args else ""
        if "ConnectionResetError" in msg or "BrokenPipeError" in msg:
            return
        super().log_message(fmt, *args)
