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
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
from base_static import BaseStaticHandler

# ========== 配置 ==========
CLIENT_ID = "client_1ab6604db009b647"
CLIENT_SECRET = os.environ.get("ZSZM_CLIENT_SECRET", "")
REDIRECT_URI = "https://zszm.iridescently.xyz/api/callback"
SSO_BASE = "https://sso.umrc.cn"
SCOPES = "openid basic email profile"
# ===========================================

SESSION_TIMEOUT = 3600

USER_DB = os.path.join(os.environ.get("IRIDESCENTLY_PROJECT_ROOT", str(__import__("pathlib").Path(__file__).resolve().parents[4])), "server", "app", "src", "cards", "users.db")

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


class OAuthHandler(BaseStaticHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        if path == "/api/login":
            state = secrets.token_urlsafe(32)
            session_token = secrets.token_urlsafe(32)
            state_map[state] = session_token

            auth_url = (
                f"{SSO_BASE}/authorize.php?"
                f"response_type=code&"
                f"client_id={CLIENT_ID}&"
                f"redirect_uri={urllib.parse.quote(REDIRECT_URI)}&"
                f"scope={urllib.parse.quote(SCOPES)}&"
                f"state={state}"
            )
            self.send_response(302)
            self.send_header("Location", auth_url)
            self.end_headers()

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
            # 跨站统一登录态（与西木会馆主站契约一致），供共享导航 authBar 显示账户
            sid, session = _get_session(self)
            if session:
                self._json_resp(200, {
                    "logged_in": True,
                    "name": session.nickname,
                    "nickname": session.nickname,
                    "user_id": session.user_id,
                    "picture": session.picture,
                    "is_admin": False,
                })
            else:
                self._json_resp(200, {"logged_in": False})

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

    def _json_resp(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(f"[5174] {args[0]}", flush=True)


if __name__ == "__main__":
    PORT = 5174
    server = http.server.HTTPServer(("0.0.0.0", PORT), OAuthHandler)
    print(f"众生之门 OAuth 代理已启动: http://localhost:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nOAuth 代理已关闭", flush=True)
