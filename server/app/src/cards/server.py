"""众生之门 - OAuth 代理 + SSO 登录
使用方式: python server.py
"""

import http.server
import json
import os
import secrets
import sqlite3
import ssl
import sys
import time
import urllib.parse
import urllib.request
import http.cookies
import base64
from email import policy
from email.parser import BytesParser
from datetime import datetime, timezone

PROJECT_ROOT = os.environ.get("IRIDESCENTLY_PROJECT_ROOT", str(__import__("pathlib").Path(__file__).resolve().parents[4]))
sys.path.insert(0, os.path.join(PROJECT_ROOT, "server"))
sys.path.insert(0, PROJECT_ROOT)
from base_static import BaseStaticHandler
import hx_sso
from account_profile import open_db as open_profile_db, get_profile, resolve_sso_identity, set_gate_identity, valid_asset_url, asset_public_url, store_avatar_image as normalize_avatar_image, store_source_image

# ========== 配置 ==========
CLIENT_ID = "client_1ab6604db009b647"
CLIENT_SECRET = os.environ.get("ZSZM_CLIENT_SECRET", "")
REDIRECT_URI = "https://zszm.iridescently.xyz/api/callback"
SSO_BASE = "https://sso.umrc.cn"
SCOPES = "openid basic email profile"
# ===========================================

SESSION_TIMEOUT = 3600
COOKIE_SECURE = os.environ.get("IRIDESCENTLY_ENVIRONMENT", "production").strip().lower() != "development"
HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "5174"))

USER_DB = os.path.join(os.environ.get("IRIDESCENTLY_PROJECT_ROOT", str(__import__("pathlib").Path(__file__).resolve().parents[4])), "server", "app", "src", "cards", "users.db")
HUIGUAN_CHARACTERS = os.path.join(PROJECT_ROOT, "portal", "huiguan", "characters.json")

def init_user_db():
    conn = sqlite3.connect(USER_DB)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            nickname TEXT,
            email TEXT,
            picture TEXT,
            first_login TEXT,
            last_login TEXT
        )
    """)
    conn.commit()
    conn.close()

def upsert_user(user_id, nickname, email, picture):
    conn = sqlite3.connect(USER_DB)
    now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    conn.execute("""
        INSERT INTO users (user_id, nickname, email, picture, first_login, last_login)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            nickname=excluded.nickname,
            email=excluded.email,
            picture=excluded.picture,
            last_login=excluded.last_login
    """, (user_id, nickname, email, picture, now, now))
    conn.commit()
    conn.close()

def get_user(user_id):
    conn = sqlite3.connect(USER_DB)
    conn.row_factory = sqlite3.Row
    row = conn.execute("SELECT * FROM users WHERE user_id=?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

init_user_db()


class Session:
    def __init__(self, user_id, nickname, email, picture, access_token, refresh_token, expires_at):
        self.user_id = user_id
        self.nickname = nickname
        self.email = email
        self.picture = picture
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.expires_at = expires_at


sessions: dict[str, Session] = {}
state_map: dict[str, str] = {}


def _set_cookie(handler, name, value, path="/", max_age=None):
    cookie = http.cookies.SimpleCookie()
    cookie[name] = value
    cookie[name]["path"] = path
    cookie[name]["httponly"] = True
    cookie[name]["samesite"] = "Lax"
    if COOKIE_SECURE:
        cookie[name]["secure"] = True
    if max_age is not None:
        cookie[name]["max-age"] = max_age
    handler.send_header("Set-Cookie", cookie[name].OutputString())


def _get_cookie(handler, name):
    cookie_header = handler.headers.get("Cookie", "")
    cookies = http.cookies.SimpleCookie(cookie_header)
    return cookies.get(name)


def _get_session(handler):
    sid = _get_cookie(handler, "zszm_sid")
    if sid is None:
        return None, None
    s = sessions.get(sid.value)
    if s is None:
        return None, None
    if s.expires_at < time.time():
        del sessions[sid.value]
        return None, None
    return sid.value, s


def _shared_user(handler):
    payload = hx_sso.read_cookie(handler.headers)
    return resolve_sso_identity(payload, PROJECT_ROOT) if payload else None


def _owned_ocs(user):
    try:
        with open(HUIGUAN_CHARACTERS, "r", encoding="utf-8") as source:
            data = json.load(source)
    except (OSError, ValueError):
        return []
    key = f"local:{user['uid']}" if user["kind"] == "local" else user["uid"]
    result = []
    for record in data.get(key, [])[:100]:
        card = record.get("data") if isinstance(record, dict) else None
        if not isinstance(card, dict):
            continue
        images = card.get("images") if isinstance(card.get("images"), list) else [card.get("image", "")]
        candidates = []
        for source in images[:20]:
            if isinstance(source, str) and source.startswith("data:image/"):
                try:
                    head, encoded = source.split(",", 1)
                    mime = head[5:].split(";", 1)[0]
                    asset = store_source_image(base64.b64decode(encoded, validate=True), mime, PROJECT_ROOT)
                    source = asset
                except (ValueError, TypeError):
                    continue
            if isinstance(source, str) and valid_asset_url(source):
                candidates.append(source)
        result.append({
            "id": str(card.get("code") or record.get("code") or ""),
            "name": str(card.get("name") or "")[:80],
            "species_type": str(card.get("species_type") or "")[:40],
            "species_detail": str(card.get("species_detail") or "")[:100],
            "avatar_asset_id": str(card.get("avatar_asset_id") or ""),
            "images": candidates,
        })
    return result


def _avatar_form(handler):
    content_type = handler.headers.get("Content-Type", "")
    try:
        length = int(handler.headers.get("Content-Length", "0"))
        if length <= 0 or length > 8 * 1024 * 1024 + 320 * 1024:
            raise ValueError("头像图片需小于 8 MiB")
        raw = handler.rfile.read(length)
        if len(raw) != length:
            raise ValueError("上传内容不完整")
        message = BytesParser(policy=policy.default).parsebytes(b"Content-Type: " + content_type.encode("ascii") + b"\r\nMIME-Version: 1.0\r\n\r\n" + raw)
        if not message.is_multipart():
            raise ValueError("上传格式无效")
        fields = {}
        for part in message.iter_parts():
            name = part.get_param("name", header="content-disposition")
            if name not in ("metadata", "image") or name in fields or part.is_multipart():
                raise ValueError("上传字段无效")
            fields[name] = part
        if "metadata" not in fields:
            raise ValueError("缺少资料信息")
        text = fields["metadata"].get_payload(decode=True)
        if len(text) > 256 * 1024:
            raise ValueError("资料信息过大")
        identity = json.loads(text.decode("utf-8"))
        if not isinstance(identity, dict):
            raise ValueError("资料格式无效")
        image = None
        if "image" in fields:
            image = (fields["image"].get_payload(decode=True), fields["image"].get_content_type())
        return identity, image
    except (ValueError, TypeError, UnicodeError):
        return None, None


class OAuthHandler(BaseStaticHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        if path == "/api/login":
            self._json_resp(410, {"error": "众生之门旧登录入口已停用，请使用会馆账户登录"})

        elif path == "/api/callback":
            code = qs.get("code", [None])[0]
            state = qs.get("state", [None])[0]
            error = qs.get("error", [None])[0]

            if error:
                self._json_resp(400, {"error": f"授权被取消: {error}"})
                return

            if not code or not state or state not in state_map:
                self._json_resp(400, {"error": "无效的授权请求"})
                return

            token_data = urllib.parse.urlencode({
                "grant_type": "authorization_code",
                "code": code,
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "redirect_uri": REDIRECT_URI,
            }).encode()

            try:
                req = urllib.request.Request(
                    f"{SSO_BASE}/token.php",
                    data=token_data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )
                resp = urllib.request.urlopen(req, timeout=10)
                token_resp = json.loads(resp.read())
            except Exception as e:
                self._json_resp(500, {"error": f"Token 获取失败: {str(e)}"})
                return

            if token_resp.get("code") != 200:
                self._json_resp(400, {"error": token_resp.get("msg", "Token 获取失败")})
                return

            access_token = token_resp["access_token"]
            refresh_token = token_resp.get("refresh_token", "")

            try:
                req = urllib.request.Request(
                    f"{SSO_BASE}/userinfo.php",
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                resp = urllib.request.urlopen(req, timeout=10)
                userinfo = json.loads(resp.read())
            except Exception as e:
                self._json_resp(500, {"error": f"获取用户信息失败: {str(e)}"})
                return

            user_data = userinfo.get("data", userinfo)
            user_id = str(user_data.get("id", user_data.get("sub", "")))
            nickname = user_data.get("nickname", user_data.get("name", "未知用户"))
            email = user_data.get("email", "")
            picture = user_data.get("picture", user_data.get("avatar", ""))

            if user_id:
                upsert_user(user_id, nickname, email, picture)

            session_id = secrets.token_urlsafe(32)
            sessions[session_id] = Session(
                user_id=user_id,
                nickname=nickname,
                email=email,
                picture=picture,
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=time.time() + SESSION_TIMEOUT,
            )

            del state_map[state]

            self.send_response(302)
            _set_cookie(self, "zszm_sid", session_id, max_age=SESSION_TIMEOUT)
            self.send_header("Location", "/")
            self.end_headers()

        elif path == "/api/user":
            sid, session = _get_session(self)
            if session:
                self._json_resp(200, {
                    "logged_in": True,
                    "user_id": session.user_id,
                    "nickname": session.nickname,
                    "email": session.email,
                    "picture": session.picture,
                })
            else:
                self._json_resp(200, {"logged_in": False})

        elif path == "/api/sso-user":
            user = _shared_user(self)
            if not user:
                self._json_resp(200, {"logged_in": False})
            else:
                self._json_resp(200, {
                    "logged_in": True, "kind": user["kind"], "user_id": user["uid"],
                    "name": user["name"], "nickname": user["name"],
                    "picture": user["picture"],
                    "account_avatar_url": asset_public_url(user["account_avatar_url"]),
                    "is_admin": False,
                })

        elif path == "/api/gate/identity":
            user = _shared_user(self)
            profile = user["gate_identity"] if user else None
            if profile and profile.get("avatar_asset_id"):
                profile = {**profile, "avatar_url": asset_public_url(profile["avatar_asset_id"])}
            self._json_resp(200, {"logged_in": bool(user), "identity": profile,
                "owner": {"kind": user["kind"], "user_id": user["uid"]} if user else None,
                "account_avatar_url": asset_public_url(user["account_avatar_url"]) if user else ""})

        elif path == "/api/gate/ocs":
            user = _shared_user(self)
            if not user:
                self._json_resp(401, {"error": "请先登录会馆账户"})
            else:
                ocs = _owned_ocs(user)
                for oc in ocs:
                    oc["images"] = [asset_public_url(image) for image in oc["images"]]
                    if valid_asset_url(oc["avatar_asset_id"]):
                        oc["avatar_url"] = asset_public_url(oc["avatar_asset_id"])
                self._json_resp(200, {"ocs": ocs})

        elif path == "/api/logout":
            sid, session = _get_session(self)
            if sid and sid in sessions:
                del sessions[sid]
            self.send_response(302)
            _set_cookie(self, "zszm_sid", "", max_age=0)
            self.send_header("Location", "/")
            self.end_headers()

        else:
            return super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path != "/api/gate/identity":
            return self._json_resp(404, {"error": "接口不存在"})
        user = _shared_user(self)
        if not user:
            return self._json_resp(401, {"error": "登录已失效，请重新登录会馆账户"})
        if self.headers.get("Content-Type", "").lower().startswith("multipart/form-data"):
            identity, image = _avatar_form(self)
            if identity is None:
                return self._json_resp(400, {"error": "形象或头像上传格式无效"})
        else:
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length > 64 * 1024:
                    return self._json_resp(413, {"error": "形象资料过大"})
                identity = json.loads(self.rfile.read(length).decode("utf-8"))
                image = None
                if not isinstance(identity, dict):
                    raise ValueError("invalid profile")
            except (ValueError, UnicodeError):
                return self._json_resp(400, {"error": "形象资料格式无效"})
        # New clients bind an edit draft to the account that originally loaded it.
        # Older clients without the guard keep their existing authenticated behavior.
        expected_owner = identity.get("expected_owner")
        owner = {"kind": user["kind"], "user_id": user["uid"]}
        if expected_owner is not None and expected_owner != owner:
            return self._json_resp(409, {"error": "账户已切换，请重新确认玩家资料"})
        name = str(identity.get("display_name", "")).strip()
        species = str(identity.get("species_name", "")).strip()
        avatar = str(identity.get("avatar_asset_id", "")).strip()
        frame = str(identity.get("avatar_frame_id", "")).strip()
        source_oc = str(identity.get("source_oc_id", "")).strip()
        mode = str(identity.get("avatar_mode", "default")).strip()
        if not name or not species or len(name) > 60 or len(species) > 100 or len(frame) > 80 or mode not in ("default", "upload", "account", "oc"):
            return self._json_resp(400, {"error": "名称、种族或头像选项无效"})
        if image:
            try:
                avatar = normalize_avatar_image(*image, PROJECT_ROOT)
                mode = "upload"
            except ValueError as error:
                return self._json_resp(400, {"error": str(error)})
        if avatar and not valid_asset_url(avatar):
            return self._json_resp(400, {"error": "头像资源无效"})
        owned = _owned_ocs(user) if source_oc else []
        if source_oc and not any(oc["id"] == source_oc for oc in owned):
            return self._json_resp(403, {"error": "导入来源不属于当前账户"})
        gate_identity = {
            "schema_version": 1, "display_name": name, "species_name": species,
            "avatar_asset_id": avatar, "avatar_frame_id": frame,
            "avatar_mode": mode, "source_oc_id": source_oc,
        }
        conn = open_profile_db(PROJECT_ROOT)
        try:
            set_gate_identity(conn, user["kind"], user["uid"], gate_identity, datetime.now(timezone.utc).isoformat())
            conn.commit()
        finally:
            conn.close()
        self._json_resp(200, {"ok": True, "owner": owner, "identity": {**gate_identity, "avatar_url": asset_public_url(avatar)}})

    def _json_resp(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(f"[5174] {args[0]}", flush=True)


if __name__ == "__main__":
    server = http.server.HTTPServer((HOST, PORT), OAuthHandler)
    print(f"众生之门 OAuth 代理已启动: http://127.0.0.1:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nOAuth 代理已关闭", flush=True)
