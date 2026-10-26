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
from contextlib import closing

# Code and imports come from this checkout, independently of persistent storage.
CODE_ROOT = str(__import__("pathlib").Path(__file__).resolve().parents[2])
sys.path.insert(0, os.path.join(CODE_ROOT, "services", "platform"))
from base_static import BaseStaticHandler
from site_domains import oauth_callback
from storage_paths import project_root as resolve_project_root, data_root, cards_data_dir, huiguan_data_dir, require_ready
import hx_sso
from account_profile import open_db as open_profile_db, get_profile, resolve_sso_identity, set_gate_identity, set_gate_identities, valid_asset_url, asset_public_url, store_avatar_image as normalize_avatar_image, store_source_image

PROJECT_ROOT = str(resolve_project_root())
DATA_ROOT = data_root()

# ========== 配置 ==========
CLIENT_ID = "client_1ab6604db009b647"
CLIENT_SECRET = os.environ.get("ZSZM_CLIENT_SECRET", "")
REDIRECT_URI = oauth_callback("zszm")
SSO_BASE = "https://sso.umrc.cn"
SCOPES = "openid basic email profile"
# ===========================================

SESSION_TIMEOUT = 3600
COOKIE_SECURE = os.environ.get("IRIDESCENTLY_ENVIRONMENT", "production").strip().lower() != "development"
HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "5174"))

USER_DB = str(cards_data_dir(DATA_ROOT) / "users.db")
UPDATE_FEEDBACK_DB = str(cards_data_dir(DATA_ROOT) / "update-feedback.sqlite3")
HUIGUAN_CHARACTERS = str(huiguan_data_dir(DATA_ROOT) / "characters.json")

def init_user_db():
    require_ready()
    os.makedirs(os.path.dirname(USER_DB), exist_ok=True)
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

def init_update_feedback_db():
    os.makedirs(os.path.dirname(UPDATE_FEEDBACK_DB), exist_ok=True)
    with closing(sqlite3.connect(UPDATE_FEEDBACK_DB, timeout=10)) as conn, conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS update_feedback (
                voter_id TEXT PRIMARY KEY,
                vote TEXT NOT NULL CHECK (vote IN ('up', 'down'))
            )
        """)

def update_feedback(voter_id, vote):
    with closing(sqlite3.connect(UPDATE_FEEDBACK_DB, timeout=10)) as conn, conn:
        if vote is None:
            conn.execute("DELETE FROM update_feedback WHERE voter_id=?", (voter_id,))
        else:
            conn.execute("""
                INSERT INTO update_feedback (voter_id, vote) VALUES (?, ?)
                ON CONFLICT(voter_id) DO UPDATE SET vote=excluded.vote
            """, (voter_id, vote))
        row = conn.execute("""
            SELECT COALESCE(SUM(vote='up'), 0), COALESCE(SUM(vote='down'), 0)
            FROM update_feedback
        """).fetchone()
        current = conn.execute("SELECT vote FROM update_feedback WHERE voter_id=?", (voter_id,)).fetchone()
        return {"up": row[0], "down": row[1], "vote": current[0] if current else None}

def get_update_feedback(voter_id):
    with closing(sqlite3.connect(UPDATE_FEEDBACK_DB, timeout=10)) as conn, conn:
        row = conn.execute("""
            SELECT COALESCE(SUM(vote='up'), 0), COALESCE(SUM(vote='down'), 0)
            FROM update_feedback
        """).fetchone()
        current = conn.execute("SELECT vote FROM update_feedback WHERE voter_id=?", (voter_id,)).fetchone()
        return {"up": row[0], "down": row[1], "vote": current[0] if current else None}

def valid_feedback_voter_id(value):
    return (isinstance(value, str) and len(value) == 36 and
            all(value[index] == "-" if index in (8, 13, 18, 23) else value[index] in "0123456789abcdef" for index in range(36)))

init_user_db()
init_update_feedback_db()


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
        sessions.pop(sid.value, None)  # another thread may have removed it already (threaded server)
        return None, None
    return sid.value, s


def _shared_user(handler):
    payload = hx_sso.read_cookie(handler.headers)
    return resolve_sso_identity(payload, DATA_ROOT) if payload else None


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
                    asset = store_source_image(base64.b64decode(encoded, validate=True), mime, DATA_ROOT)
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


GATE_ROSTER_LIMIT = 6
SPECIES_FIELDS = {"species_kind": 20, "species_family": 40, "species_sub": 40, "species_note": 120}


def _gate_roster(user):
    """Saved identities with ids; an account saved before rosters existed has just its active one."""
    roster = [item for item in (user.get("gate_identities") or []) if isinstance(item, dict) and item.get("id")]
    active = user.get("gate_identity")
    if not roster and isinstance(active, dict) and active.get("display_name"):
        roster = [{**active, "id": active.get("id") or "main"}]
    return roster[:GATE_ROSTER_LIMIT]


def _public_identity(identity):
    if not identity:
        return identity
    return {**identity, "avatar_url": asset_public_url(identity.get("avatar_asset_id", ""))} if identity.get("avatar_asset_id") else identity


def _write_roster(user, roster, active):
    conn = open_profile_db(DATA_ROOT)
    try:
        now = datetime.now(timezone.utc).isoformat()
        set_gate_identities(conn, user["kind"], user["uid"], roster, now)
        set_gate_identity(conn, user["kind"], user["uid"], active, now)
        conn.commit()
    finally:
        conn.close()


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

            # Single-use state, consumed atomically so concurrent callbacks cannot both pass or KeyError later.
            if not code or not state or state_map.pop(state, None) is None:
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

        elif path == "/api/update-feedback":
            voter_id = self.headers.get("X-Feedback-Voter", "")
            if not valid_feedback_voter_id(voter_id):
                self._json_resp(400, {"error": "投票编号无效"})
            else:
                self._json_resp(200, get_update_feedback(voter_id))

        elif path == "/api/gate/identity":
            user = _shared_user(self)
            profile = user["gate_identity"] if user else None
            roster = _gate_roster(user) if user else []
            if profile and not profile.get("id") and roster:
                profile = {**profile, "id": roster[0]["id"]}
            self._json_resp(200, {"logged_in": bool(user), "identity": _public_identity(profile),
                "identities": [_public_identity(item) for item in roster],
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
            if sid:
                sessions.pop(sid, None)
            self.send_response(302)
            _set_cookie(self, "zszm_sid", "", max_age=0)
            self.send_header("Location", "/")
            self.end_headers()

        else:
            return super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/update-feedback":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length <= 0 or length > 1024:
                    return self._json_resp(413, {"error": "投票请求无效"})
                body = json.loads(self.rfile.read(length).decode("utf-8"))
                voter_id = body.get("voter_id") if isinstance(body, dict) else None
                vote = body.get("vote") if isinstance(body, dict) else None
                if not valid_feedback_voter_id(voter_id):
                    return self._json_resp(400, {"error": "投票编号无效"})
                if vote not in ("up", "down", None):
                    return self._json_resp(400, {"error": "投票选项无效"})
            except (ValueError, UnicodeError):
                return self._json_resp(400, {"error": "投票请求格式无效"})
            return self._json_resp(200, update_feedback(voter_id, vote))

        if path not in ("/api/gate/identity", "/api/gate/identity/select", "/api/gate/identity/delete"):
            return self._json_resp(404, {"error": "接口不存在"})
        user = _shared_user(self)
        if not user:
            return self._json_resp(401, {"error": "登录已失效，请重新登录会馆账户"})
        if path != "/api/gate/identity":
            return self._roster_action(user, path.rsplit("/", 1)[1])
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
        identity_id = str(identity.get("id", "")).strip()
        species_fields = {key: str(identity.get(key, "")).strip() for key in SPECIES_FIELDS}
        if not name or not species or len(name) > 60 or len(species) > 100 or len(frame) > 80 or mode not in ("default", "upload", "account", "oc")                 or any(len(species_fields[key]) > limit for key, limit in SPECIES_FIELDS.items()) or len(identity_id) > 40:
            return self._json_resp(400, {"error": "名称、种族或头像选项无效"})
        roster = _gate_roster(user)
        if not identity_id and not identity.get("create") and roster:
            # Clients without rosters edit their one (active) identity in place.
            identity_id = (user.get("gate_identity") or {}).get("id") or roster[0]["id"]
        if identity_id and not any(item["id"] == identity_id for item in roster):
            return self._json_resp(404, {"error": "这个形象已不存在，请刷新后重试"})
        if not identity_id and len(roster) >= GATE_ROSTER_LIMIT:
            return self._json_resp(400, {"error": f"最多保存 {GATE_ROSTER_LIMIT} 个形象，请先删除一个"})
        if image:
            try:
                avatar = normalize_avatar_image(*image, DATA_ROOT)
                mode = "upload"
            except ValueError as error:
                return self._json_resp(400, {"error": str(error)})
        if avatar and not valid_asset_url(avatar):
            return self._json_resp(400, {"error": "头像资源无效"})
        owned = _owned_ocs(user) if source_oc else []
        if source_oc and not any(oc["id"] == source_oc for oc in owned):
            return self._json_resp(403, {"error": "导入来源不属于当前账户"})
        gate_identity = {
            "schema_version": 1, "id": identity_id or secrets.token_hex(6), "display_name": name, "species_name": species,
            **species_fields, "avatar_asset_id": avatar, "avatar_frame_id": frame,
            "avatar_mode": mode, "source_oc_id": source_oc,
        }
        if identity_id:
            roster = [gate_identity if item["id"] == identity_id else item for item in roster]
        else:
            roster = [*roster, gate_identity]
        _write_roster(user, roster, gate_identity)
        self._json_resp(200, {"ok": True, "owner": owner, "identity": _public_identity(gate_identity),
                              "identities": [_public_identity(item) for item in roster]})

    def _roster_action(self, user, action):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 4096:
                return self._json_resp(413, {"error": "请求过大"})
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(body, dict):
                raise ValueError("invalid body")
        except (ValueError, UnicodeError):
            return self._json_resp(400, {"error": "请求格式无效"})
        owner = {"kind": user["kind"], "user_id": user["uid"]}
        if body.get("expected_owner") is not None and body.get("expected_owner") != owner:
            return self._json_resp(409, {"error": "账户已切换，请重新确认玩家资料"})
        roster = _gate_roster(user)
        target = next((item for item in roster if item["id"] == str(body.get("id", ""))), None)
        if not target:
            return self._json_resp(404, {"error": "这个形象已不存在，请刷新后重试"})
        if action == "select":
            active = target
        else:
            current_id = (user.get("gate_identity") or {}).get("id") or "main"
            roster = [item for item in roster if item["id"] != target["id"]]
            active = next((item for item in roster if item["id"] == current_id), None) or (roster[0] if roster else None)
        _write_roster(user, roster, active)
        self._json_resp(200, {"ok": True, "owner": owner, "identity": _public_identity(active),
                              "identities": [_public_identity(item) for item in roster]})

    def _json_resp(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(f"[5174] {args[0]}", flush=True)


if __name__ == "__main__":
    class _Server(http.server.ThreadingHTTPServer):
        daemon_threads = True
        request_queue_size = 512

        def get_request(self):
            conn, addr = super().get_request()
            conn.settimeout(60)
            return conn, addr

    server = _Server((HOST, PORT), OAuthHandler)
    print(f"众生之门 OAuth 代理已启动: http://127.0.0.1:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nOAuth 代理已关闭", flush=True)
