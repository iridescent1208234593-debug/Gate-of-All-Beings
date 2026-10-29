"""
主站（各批准根域的 apex / www）— 纯静态站点 + 跨站 SSO 读取 + 管理员内容编辑接口
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
import mimetypes
import sqlite3
from pathlib import Path
from urllib.parse import urlparse

PORT = 8088
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))
RUNTIME_DIR = STATIC_DIR
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "services", "platform"))
import hx_sso
from site_domains import (PRODUCTION_HOSTS, service_name, site_url, request_host,
                          request_origin_allowed, cors_headers)
from base_static import BaseStaticHandler
# 管理员：完整 (kind, uid) 站长账户 + 账户库状态复核，见 services/platform/site_admin.py
from site_admin import is_site_owner, is_admin as _is_any_admin, is_original_viewer
import gallery_interactions
from storage_paths import data_root, homepage_data_dir, require_ready

# 需要写权限的接口 -> 目标文件名
EDIT_TARGETS = {
    "/api/admin/links": "links.json",
    "/api/admin/thanks": "thanks.json",
}

# 主域根路径跳转到会馆；节气画廊在 /gallery.html
MAIN_HOSTS = {host for host in PRODUCTION_HOSTS if service_name(host) in ("main", "www")}

SITE_STATUS_TARGETS = {
    service: site_url(service, "/") for service in ("huiguan", "zszm", "oc")
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
    require_ready()
    path = _site_config_path(name, for_write=True)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        shutil.copy2(path, path + ".bak")
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def _site_config_path(name, for_write=False):
    return str(homepage_data_dir() / "config" / name)


class Handler(BaseStaticHandler):
    protocol_version = "HTTP/1.1"
    _static_dir = STATIC_DIR

    def translate_path(self, path):
        decoded = urllib.parse.unquote(urllib.parse.urlparse(path).path)
        if decoded in ("/", "/index.html", "/gallery.html", "/links.json", "/thanks.json") or decoded.startswith("/assets/homepage/"):
            # 节气画廊的构建产物仍是 index.html；主域根路径改跳会馆后由 /gallery.html 提供
            name = "index.html" if decoded in ("/", "/gallery.html") else decoded.lstrip("/")
            target = os.path.abspath(_site_config_path(name) if name in ("links.json", "thanks.json") else os.path.join(RUNTIME_DIR, name))
            base = os.path.dirname(target) if name in ("links.json", "thanks.json") else RUNTIME_DIR
            if os.path.commonpath((os.path.abspath(base), target)) == os.path.abspath(base):
                return target
            return os.path.join(STATIC_DIR, "__missing__")
        return super().translate_path(path)

    def _is_api_path(self):
        return self.path.split("?")[0] in (
            "/api/sso-user", "/api/site-status", "/api/gallery/state",
            "/api/gallery/action", "/api/gallery/comment", "/api/gallery/comment/delete", "/api/gallery/comments", "/api/gallery/original",
        )

    # ---- 通用 JSON 响应 ----
    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _can_view_original(self, user):
        """原图只有站长与会馆管理员可见（不限制具体成员）。"""
        if not user or not user.get("uid") or not user.get("kind"):
            return False
        kind, uid = str(user["kind"]), str(user["uid"])
        try:
            return bool(is_original_viewer(kind, uid))
        except Exception:
            return False

    def _is_admin(self, user):
        if not user or not user.get("uid") or not user.get("kind"):
            return False
        return _is_any_admin(str(user["kind"]), str(user["uid"]))


    def _email_verified(self, user):
        """是否已绑定并验证邮箱；用于互动功能的门槛。"""
        if not user or not user.get("uid") or not user.get("kind"):
            return False
        kind, uid = str(user["kind"]), str(user["uid"])
        try:
            from storage_paths import data_root, huiguan_data_dir
            db_path = huiguan_data_dir(data_root()) / "users.db"
            if not db_path.exists():
                return True  # 没有账户库时不阻断
            conn = sqlite3.connect(f"file:{db_path.as_posix()}?mode=ro", uri=True, timeout=5)
            try:
                # 账号是否真实存在于账户库；不存在的身份（如伪造/历史映射）
                # 无法验证邮箱，按放行处理，避免把整类用户挡在互动之外。
                if kind == "local":
                    exists = conn.execute(
                        "SELECT 1 FROM local_users WHERE CAST(uid AS TEXT)=?", (uid,)).fetchone()
                else:
                    exists = conn.execute(
                        "SELECT 1 FROM users WHERE CAST(user_id AS TEXT)=?", (uid,)).fetchone()
                if not exists:
                    return True
                row = conn.execute(
                    "SELECT verified_at FROM account_emails WHERE kind=? AND CAST(uid AS TEXT)=?",
                    (kind, uid)).fetchone()
                return bool(row and row[0])
            finally:
                conn.close()
        except Exception:
            return True  # 查询异常时不阻断（宁可放行也不误伤）

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
        host = (self.headers.get("Host") or "").split(":", 1)[0].lower()
        if path in ("/", "/index.html") and host in MAIN_HOSTS:
            # 302 而非 308：首页去向以后可能再调整，不让浏览器永久记住
            self.send_response(302)
            self.send_header("Location", site_url("huiguan", "/", request_host(self)))
            self.send_header("Content-Length", "0")
            self.end_headers()
            return True
        if path in redirects:
            self.send_response(308)
            self.send_header("Location", redirects[path])
            self.send_header("Content-Length", "0")
            self.end_headers()
            return True
        return False

    def do_HEAD(self):
        if self._legacy_redirect():
            return
        path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        if path.startswith("/assets/homepage/gallery-files/"):
            self.send_error(404)
            return
        if path == "/api/gallery/original":
            self._send_gallery_original(head=True)
            return
        super().do_HEAD()

    def do_GET(self):
        if self._legacy_redirect():
            return
        path = self.path.split("?")[0]
        if path == "/api/gallery/state":
            image = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get("image", [""])[0]
            if gallery_interactions.find_original(self._gallery_root(), RUNTIME_DIR, image) is None:
                self._json(404, {"error": "图片不存在"})
                return
            with gallery_interactions.session(data_root()) as db:
                self._json(200, gallery_interactions.snapshot(db, image, hx_sso.read_cookie(self.headers)))
            return
        if path == "/api/gallery/comments":
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            image = query.get("image", [""])[0]
            if gallery_interactions.find_original(self._gallery_root(), RUNTIME_DIR, image) is None:
                self._json(404, {"error": "图片不存在"})
                return
            try:
                offset = int(query.get("offset", ["0"])[0])
                if not 0 <= offset <= 100000:
                    raise ValueError
            except ValueError:
                self._json(400, {"error": "评论位置无效"})
                return
            with gallery_interactions.session(data_root()) as db:
                self._json(200, {"comments": gallery_interactions.comments_page(db, image, offset),
                                 "total": gallery_interactions.comment_count(db, image)})
            return
        if path == "/api/gallery/original":
            self._send_gallery_original()
            return
        decoded_path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
        if decoded_path.startswith("/assets/homepage/gallery-files/"):
            self.send_error(404)
            return
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
        if path == "/api/gallery/comment/delete":
            self._delete_gallery_comment()
            return
        if path in ("/api/gallery/action", "/api/gallery/comment"):
            self._post_gallery_interaction(path)
            return
        if path not in EDIT_TARGETS:
            self._json(404, {"error": "接口不存在"})
            return

        # 同源校验：带 Origin/Referer 时必须是本站域名
        origin = self.headers.get("Origin") or self.headers.get("Referer") or ""
        if not request_origin_allowed(self):
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

    def _gallery_root(self):
        return data_root()

    def _send_gallery_original(self, head=False):
        fetch_site = (self.headers.get("Sec-Fetch-Site") or "").lower()
        origin = self.headers.get("Origin") or self.headers.get("Referer") or ""
        if fetch_site == "cross-site" or not request_origin_allowed(self):
            if head:
                self.send_response(403)
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", "0")
                self.end_headers()
            else:
                self._json(403, {"error": "原图请求来源不被允许"})
            return
        user = hx_sso.read_cookie(self.headers)
        if not self._can_view_original(user):
            if head:
                self.send_response(403)
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            self._json(403, {"error": "原图仅限站长登录后查看"})
            return
        image = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get("image", [""])[0]
        target = gallery_interactions.find_original(self._gallery_root(), RUNTIME_DIR, image)
        if target is None:
            if head:
                self.send_response(404)
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
            self._json(404, {"error": "原图暂不可用"})
            return
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(target.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(target.stat().st_size))
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        for name, value in cors_headers(self):
            self.send_header(name, value)
        self.send_header("Vary", "Origin")
        self.end_headers()
        if not head:
            with target.open("rb") as stream:
                shutil.copyfileobj(stream, self.wfile)

    def _delete_gallery_comment(self):
        if not request_origin_allowed(self):
            self._json(403, {"error": "来源不被允许"})
            return
        user = hx_sso.read_cookie(self.headers)
        if not user or not user.get("uid") or not user.get("kind"):
            self._json(401, {"error": "登录后即可操作"})
            return
        payload = self._read_json()
        if not isinstance(payload, dict):
            return
        image = payload.get("image")
        if not gallery_interactions.valid_image_name(image):
            self._json(400, {"error": "图片地址无效"})
            return
        identity = (str(user["kind"]), str(user["uid"]))
        admin = self._is_admin(user)
        try:
            with gallery_interactions.session(self._gallery_root()) as db:
                if admin:
                    removed = db.execute("DELETE FROM gallery_comments WHERE image=?", (image,)).rowcount
                else:
                    removed = db.execute(
                        "DELETE FROM gallery_comments WHERE kind=? AND uid=? AND image=?",
                        (*identity, image)).rowcount
            self._json(200, {"ok": True, "removed": removed})
        except sqlite3.Error:
            self._json(500, {"error": "删除暂时不可用"})

    def _post_gallery_interaction(self, path):
        origin = self.headers.get("Origin") or self.headers.get("Referer") or ""
        if not request_origin_allowed(self):
            self._json(403, {"error": "来源不被允许"})
            return
        user = hx_sso.read_cookie(self.headers)
        if not user or not user.get("uid") or not user.get("kind"):
            self._json(401, {"error": "登录后即可参与互动"})
            return
        payload = self._read_json()
        if payload is None:
            return
        image = payload.get("image") if isinstance(payload, dict) else None
        if not gallery_interactions.valid_image_name(image):
            self._json(400, {"error": "图片地址无效"})
            return
        root = self._gallery_root()
        if gallery_interactions.find_original(root, RUNTIME_DIR, image) is None:
            self._json(404, {"error": "图片不存在"})
            return
        identity = (str(user["kind"]), str(user["uid"]))
        if not self._email_verified(user):
            self._json(403, {"error": "请先在「账户」页验证邮箱，验证后即可点赞与留言",
                             "need_email_verified": True})
            return
        try:
            with gallery_interactions.session(root) as db:
                db.execute("BEGIN IMMEDIATE")
                if path == "/api/gallery/action":
                    action = payload.get("action")
                    request_id = payload.get("request_id")
                    if action not in ("like", "love") or not isinstance(request_id, str) or not request_id.strip() or len(request_id) > 80:
                        self._json(400, {"error": "互动内容无效"})
                        return
                    # 点赞限额：每账号每图 1 赞，最多 5 张图
                    if action == "like":
                        done = db.execute(
                            "SELECT 1 FROM gallery_actions WHERE kind=? AND uid=? AND image=? AND action='like'",
                            (*identity, image)).fetchone()
                        if done:
                            self._json(409, {"error": "这张图你已经点过赞了"})
                            return
                        used = db.execute(
                            "SELECT COUNT(DISTINCT image) FROM gallery_actions WHERE kind=? AND uid=? AND action='like'",
                            identity).fetchone()[0]
                        if used >= 5:
                            self._json(403, {"error": "每人最多给 5 张贺图点赞（已用 5 次）"})
                            return
                    db.execute("INSERT OR IGNORE INTO gallery_actions(kind,uid,image,action,request_id) VALUES(?,?,?,?,?)",
                               (*identity, image, action, request_id))
                else:
                    comment = payload.get("comment")
                    if not isinstance(comment, str):
                        self._json(400, {"error": "评论内容无效"})
                        return
                    comment = comment.strip()
                    if not comment or len(comment) > 25:
                        self._json(400, {"error": "评论需为 1 至 25 个字"})
                        return
                    existing = db.execute("SELECT 1 FROM gallery_comments WHERE kind=? AND uid=? AND image=?",
                                         (*identity, image)).fetchone()
                    if existing:
                        self._json(409, {"error": "这张图你已经留过言了"})
                        return
                    liked = db.execute(
                        "SELECT 1 FROM gallery_actions WHERE kind=? AND uid=? AND image=? AND action='like'",
                        (*identity, image)).fetchone()
                    if not liked and not self._is_admin(user):
                        self._json(403, {"error": "先给这张图点个赞，再来留言吧"})
                        return
                    # 每账号 / 每 IP 60 分钟各限 1 条；删除评论不重置计时
                    ip = (self.headers.get("X-Real-IP") or self.headers.get("CF-Connecting-IP")
                          or (self.client_address[0] if self.client_address else ""))[:64]
                    db.execute("""CREATE TABLE IF NOT EXISTS gallery_comment_attempts (
                        kind TEXT NOT NULL DEFAULT '', uid TEXT NOT NULL DEFAULT '',
                        ip TEXT NOT NULL DEFAULT '', created_at REAL NOT NULL)""")
                    now_ts = time.time()
                    recent_uid = db.execute(
                        "SELECT 1 FROM gallery_comment_attempts WHERE kind=? AND uid=? AND created_at > ?",
                        (*identity, now_ts - 3600)).fetchone()
                    recent_ip = db.execute(
                        "SELECT 1 FROM gallery_comment_attempts WHERE ip=? AND created_at > ?",
                        (ip, now_ts - 3600)).fetchone()
                    if recent_uid or recent_ip:
                        self._json(429, {"error": "每人每 IP 每 60 分钟只能发一条留言"})
                        return
                    db.execute("INSERT INTO gallery_comments(kind,uid,name,image,comment) VALUES(?,?,?,?,?)",
                               (*identity, str(user.get("name", "访客"))[:40], image, comment))
                    db.execute("INSERT INTO gallery_comment_attempts(kind,uid,ip,created_at) VALUES(?,?,?,?)",
                               (*identity, ip, time.time()))
                result = gallery_interactions.snapshot(db, image, user)
            self._json(200, result)
        except sqlite3.IntegrityError:
            self._json(409, {"error": "留言已提交，每位用户只能留一条"})
        except sqlite3.Error:
            self._json(500, {"error": "图廊互动暂时不可用"})

    def log_message(self, fmt, *args):
        print(f"[www-8088] {args[0]}", flush=True)


if __name__ == "__main__":
    print(f"iridescently 主站服务启动: http://localhost:{PORT}")
    http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
