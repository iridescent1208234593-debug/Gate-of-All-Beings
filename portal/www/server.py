"""
iridescently.xyz 主站 — 纯静态站点 + 跨站 SSO 读取 + 管理员内容编辑接口
基于 base_static 公共模块，自带静态防护 + 安全头 + 错误静默 + 缓存。
启动: python server.py
"""

import http.server
import json
import os
import shutil
import sys
import concurrent.futures
import threading
import time
import urllib.error
import urllib.request
import urllib.parse
from urllib.parse import urlparse

PORT = 8088
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))
RUNTIME_DIR = os.path.join(os.environ.get("IRIDESCENTLY_PROJECT_ROOT", os.path.dirname(os.path.dirname(STATIC_DIR))), "portal", "www")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "server"))
import hx_sso
from base_static import BaseStaticHandler
# 管理员：完整 (kind, uid) 站长账户 + 账户库状态复核，见 server/site_admin.py
from site_admin import is_site_owner

# 允许发起写操作的来源主机（域名后缀命中 .iridescently.xyz 亦放行）
ALLOWED_HOSTS = {"iridescently.xyz", "localhost", "127.0.0.1"}

# 需要写权限的接口 -> 目标文件名
EDIT_TARGETS = {
    "/api/admin/links": "links.json",
    "/api/admin/thanks": "thanks.json",
}

SITE_STATUS_TARGETS = {
    "huiguan": "https://huiguan.iridescently.xyz/",
    "zszm": "https://zszm.iridescently.xyz/",
    "oc": "https://oc.iridescently.xyz/",
}
_SITE_STATUS_LOCK = threading.Lock()
_SITE_STATUS_CACHE = {"expires": 0, "sites": {}}


def _probe_site(url):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Range": "bytes=0-0",
        },
    )
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(request, timeout=3) as response:
            return 200 <= response.status < 400
    except urllib.error.HTTPError as error:
        return 200 <= error.code < 400
    except (OSError, urllib.error.URLError, TimeoutError):
        return False


def _site_status():
    now = time.monotonic()
    with _SITE_STATUS_LOCK:
        if _SITE_STATUS_CACHE["expires"] > now:
            return _SITE_STATUS_CACHE["sites"]
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(SITE_STATUS_TARGETS)) as pool:
            sites = dict(zip(SITE_STATUS_TARGETS, pool.map(_probe_site, SITE_STATUS_TARGETS.values())))
        # The domain responds today, but this project has not been added to the released site group.
        sites["psyche"] = "unpublished"
        _SITE_STATUS_CACHE.update(expires=now + 45, sites=sites)
        return sites


def _text(v, limit):
    return str(v if v is not None else "").strip()[:limit]


def _clean_links(payload):
    """校验并清洗友链数据 -> list"""
    items = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        raise ValueError("items 必须是数组")
    if len(items) > 200:
        raise ValueError("友链数量超过上限 200 条")
    out = []
    for it in items:
        if not isinstance(it, dict):
            raise ValueError("每个友链条目必须是对象")
        name = _text(it.get("name"), 80)
        url = _text(it.get("url"), 500)
        avatar = _text(it.get("avatar"), 500)
        desc = _text(it.get("desc"), 200)
        if not name or not url:
            raise ValueError("站名与网址不能为空")
        if not (url.startswith("http://") or url.startswith("https://")):
            raise ValueError("网址必须以 http:// 或 https:// 开头")
        if avatar and not (avatar.startswith("http://") or avatar.startswith("https://") or avatar.startswith("/")):
            raise ValueError("头像需为 http(s) 链接或站内路径")
        out.append({"name": name, "url": url, "avatar": avatar, "desc": desc})
    return out


def _clean_thanks(payload):
    """校验并清洗鸣谢数据 -> {"sections": [...]}"""
    sections = payload.get("sections") if isinstance(payload, dict) else None
    if not isinstance(sections, list):
        raise ValueError("sections 必须是数组")
    if len(sections) > 20:
        raise ValueError("分类数量超过上限 20 个")
    out = []
    for sec in sections:
        if not isinstance(sec, dict):
            raise ValueError("每个分类必须是对象")
        title = _text(sec.get("title"), 40)
        if not title:
            raise ValueError("分类标题不能为空")
        items = sec.get("items")
        if not isinstance(items, list):
            raise ValueError("分类下的条目必须是数组")
        if len(items) > 100:
            raise ValueError("单个分类条目超过上限 100 条")
        rows = []
        for it in items:
            if not isinstance(it, dict):
                raise ValueError("鸣谢条目必须是对象")
            name = _text(it.get("name"), 80)
            if not name:
                raise ValueError("鸣谢条目名称不能为空")
            rows.append({
                "icon": _text(it.get("icon"), 8),
                "name": name,
                "role": _text(it.get("role"), 300),
            })
        out.append({"title": title, "items": rows})
    return {"sections": out}


def _write_json(name, data):
    """原子写入，写前留 .bak 备份（.bak 不可被静态下载）"""
    path = os.path.join(RUNTIME_DIR, name)
    if os.path.exists(path):
        shutil.copy2(path, path + ".bak")
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


class Handler(BaseStaticHandler):
    protocol_version = "HTTP/1.1"
    _static_dir = STATIC_DIR

    def translate_path(self, path):
        decoded = urllib.parse.unquote(urllib.parse.urlparse(path).path)
        if decoded in ("/", "/index.html", "/links.json", "/thanks.json") or decoded.startswith("/assets/homepage/"):
            target = os.path.abspath(os.path.join(RUNTIME_DIR, decoded.lstrip("/") or "index.html"))
            if os.path.commonpath((os.path.abspath(RUNTIME_DIR), target)) == os.path.abspath(RUNTIME_DIR):
                return target
            return os.path.join(STATIC_DIR, "__missing__")
        return super().translate_path(path)

    def _is_api_path(self):
        return self.path.split("?")[0] in ("/api/sso-user", "/api/site-status")

    # ---- 通用 JSON 响应 ----
    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _is_admin(self, user):
        return is_site_owner(user)

    def _read_json(self):
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
        except (TypeError, ValueError):
            length = 0
        if length <= 0:
            self._json(400, {"error": "请求体为空"})
            return None
        if length > 1024 * 1024:
            self._json(413, {"error": "请求体过大"})
            return None
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            self._json(400, {"error": "JSON 解析失败"})
            return None

    def _legacy_redirect(self):
        path = self.path.split("?")[0]
        redirects = {
            "/links.html": "/connections.html#neighbors",
            "/thanks.html": "/connections.html#with-thanks",
        }
        if path in redirects:
            self.send_response(308)
            self.send_header("Location", redirects[path])
            self.send_header("Content-Length", "0")
            self.end_headers()
            return True
        return False

    def do_HEAD(self):
        if not self._legacy_redirect():
            super().do_HEAD()

    def do_GET(self):
        if self._legacy_redirect():
            return
        path = self.path.split("?")[0]
        if path == "/api/sso-user":
            u = hx_sso.read_cookie(self.headers)
            if u:
                body = {"logged_in": True, "name": u.get("name"), "uid": u.get("uid"),
                        "kind": u.get("kind"), "admin": self._is_admin(u)}
            else:
                body = {"logged_in": False, "admin": False}
            self._json(200, body)
            return
        if path == "/api/site-status":
            self._json(200, {"sites": _site_status()})
            return
        super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]
        if path not in EDIT_TARGETS:
            self._json(404, {"error": "接口不存在"})
            return

        # 同源校验：带 Origin/Referer 时必须是本站域名
        origin = self.headers.get("Origin") or self.headers.get("Referer") or ""
        if origin:
            host = (urlparse(origin).hostname or "").lower()
            if host not in ALLOWED_HOSTS and not host.endswith(".iridescently.xyz"):
                self._json(403, {"error": "来源不被允许"})
                return

        user = hx_sso.read_cookie(self.headers)
        if not self._is_admin(user):
            self._json(403, {"error": "需要管理员登录后再操作"})
            return

        payload = self._read_json()
        if payload is None:
            return

        try:
            if path == "/api/admin/links":
                data = _clean_links(payload)
                name = EDIT_TARGETS[path]
                count = len(data)
            else:
                data = _clean_thanks(payload)
                name = EDIT_TARGETS[path]
                count = len(data["sections"])
        except ValueError as e:
            self._json(400, {"error": str(e)})
            return

        try:
            _write_json(name, data)
        except Exception as e:
            self._json(500, {"error": "写入失败：%s" % e})
            return
        self._json(200, {"ok": True, "file": name, "count": count})

    def log_message(self, fmt, *args):
        print(f"[www-8088] {args[0]}", flush=True)


if __name__ == "__main__":
    print(f"iridescently 主站服务启动: http://localhost:{PORT}")
    http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
