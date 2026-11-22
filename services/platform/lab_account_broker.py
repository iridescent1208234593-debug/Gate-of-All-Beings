"""LAB-specific account approval. Main-site cookies and real account IDs stay on the site."""
from contextlib import contextmanager, nullcontext as _noop
from html import escape
from datetime import datetime
from hashlib import sha256
import base64
import hmac
import json
import re
import secrets
import time
from urllib.parse import parse_qs, urlsplit

PREFIX = "/api/lab-auth/"
AUDIENCE = "huiguan-lab-v1"
REQUEST_TTL = 300
CODE_TTL = 45
GRANT_TTL = 3600
MAX_BODY = 2048
OPAQUE = re.compile(r"[A-Za-z0-9_-]{43}")
VERIFIER = re.compile(r"[A-Za-z0-9._~-]{43,128}")
MATCH = re.compile(r"[0-9]{6}")


def init_schema(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS lab_auth_access (
        kind TEXT NOT NULL, uid TEXT NOT NULL, sub TEXT NOT NULL UNIQUE,
        enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0, 1)),
        PRIMARY KEY(kind, uid))""")
    conn.execute("""CREATE TABLE IF NOT EXISTS lab_auth_requests (
        request_id TEXT PRIMARY KEY, state_hash TEXT NOT NULL, challenge TEXT NOT NULL,
        match_hash TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
        failures INTEGER NOT NULL DEFAULT 0, last_poll INTEGER,
        status TEXT NOT NULL DEFAULT 'pending', sub TEXT, code_expires_at INTEGER,
        session_rowid INTEGER, session_mac TEXT)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS lab_auth_grants (
        grant_hash TEXT PRIMARY KEY, sub TEXT NOT NULL, expires_at INTEGER NOT NULL,
        session_rowid INTEGER NOT NULL, session_mac TEXT NOT NULL)""")
    conn.execute("CREATE INDEX IF NOT EXISTS lab_auth_grant_sub ON lab_auth_grants(sub)")
    conn.execute("CREATE INDEX IF NOT EXISTS lab_auth_request_time ON lab_auth_requests(created_at)")


def set_access(conn, kind, uid, enabled):
    """Caller must authenticate and audit admin action, validate Account, commit transaction."""
    if kind not in ("local", "usso") or not uid or type(enabled) is not bool:
        raise ValueError("invalid entitlement")
    conn.execute(
        """INSERT INTO lab_auth_access(kind, uid, sub, enabled) VALUES (?, ?, ?, ?)
           ON CONFLICT(kind, uid) DO UPDATE SET enabled=excluded.enabled""",
        (kind, str(uid), secrets.token_urlsafe(32), int(enabled)),
    )
    if not enabled:
        invalidate_account(conn, kind, uid)


def get_access(conn, kind, uid):
    row = conn.execute("SELECT enabled FROM lab_auth_access WHERE kind=? AND uid=?",
                       (kind, str(uid))).fetchone()
    return bool(row and row[0])


def invalidate_account(conn, kind, uid):
    """Use on ban, deletion, password resets and explicit account-wide session revocation."""
    selector = "SELECT sub FROM lab_auth_access WHERE kind=? AND uid=?"
    params = (kind, str(uid))
    conn.execute(f"DELETE FROM lab_auth_grants WHERE sub IN ({selector})", params)
    conn.execute(f"""UPDATE lab_auth_requests SET status='revoked'
                     WHERE sub IN ({selector}) AND status='approved'""", params)


def _hex(value):
    return sha256(value.encode("ascii")).hexdigest()


def _equal(a, b):
    return hmac.compare_digest(a.encode("ascii", errors="ignore"),
                               b.encode("ascii", errors="ignore")) and a.isascii() and b.isascii()


class LabAccountBroker:
    def __init__(self, db, lock, resolve_identity, service_bearer, origin, session_audience,
                 consent_accepted, now=time.time):
        self.db = db
        self.lock = lock
        self.resolve_identity = resolve_identity
        self.bearer = service_bearer if isinstance(service_bearer, str) else ""
        self.origin = origin
        self.session_audience = session_audience
        self.consent_accepted = consent_accepted
        self.now = now
        uri = urlsplit(origin or "")
        self.enabled = bool(
            bool(re.fullmatch(r"[A-Za-z0-9_.~-]{32,512}", self.bearer))
            and bool(session_audience)
            and uri.scheme == "https" and uri.hostname and origin == "https://" + uri.netloc
            and not uri.username and not uri.password
        )

    def _mac(self, scope, *values):
        msg = "\0".join((AUDIENCE, scope, *values)).encode("utf-8")
        digest = hmac.digest(self.bearer.encode("ascii"), msg, "sha256")
        return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")

    @contextmanager
    def _transaction(self, write=True):
        with self.lock if write else _noop():
            conn = self.db()
            try:
                conn.execute("BEGIN IMMEDIATE" if write else "BEGIN")
                yield conn
                conn.commit()
            except BaseException:
                conn.rollback()
                raise
            finally:
                conn.close()

    @staticmethod
    def _matches(body, name, pattern=OPAQUE):
        value = body.get(name)
        return isinstance(value, str) and bool(pattern.fullmatch(value))

    def api(self, action, body):
        """Internal server dispatch after exact route and service auth validation."""
        now = int(self.now())
        if action == "start":
            if not self._matches(body, "challenge"):
                return 400, {"error": "invalid_request"}
            request_id, state = (secrets.token_urlsafe(32) for _ in range(2))
            match_code = f"{secrets.randbelow(1000000):06d}"
            with self._transaction() as conn:
                if conn.execute("SELECT count(*) FROM lab_auth_requests WHERE created_at>?",
                                (now - 60,)).fetchone()[0] >= 120:
                    return 429, {"error": "start_limit"}
                conn.execute("DELETE FROM lab_auth_requests WHERE expires_at<=?", (now,))
                conn.execute("DELETE FROM lab_auth_grants WHERE expires_at<=?", (now,))
                conn.execute(
                    """INSERT INTO lab_auth_requests(request_id,state_hash,challenge,match_hash,
                                                      created_at,expires_at) VALUES(?,?,?,?,?,?)""",
                    (request_id, _hex(state), body["challenge"],
                     self._mac("match", request_id, match_code), now, now + REQUEST_TTL),
                )
            return 200, {"request_id": request_id, "state": state, "match_code": match_code,
                         "expires_in": REQUEST_TTL, "approval_path": PREFIX + "approve?request_id=" + request_id}
        if action in ("poll", "redeem"):
            if not all(self._matches(body, key) for key in ("request_id", "state")):
                return 400, {"error": "invalid_request"}
            rid = body["request_id"]
            with self._transaction() as conn:
                row = conn.execute("SELECT * FROM lab_auth_requests WHERE request_id=?", (rid,)).fetchone()
                if not row or not _equal(row["state_hash"], _hex(body["state"])):
                    return 400, {"error": "invalid_request"}
                if row["expires_at"] <= now or (
                    row["status"] == "approved" and row["code_expires_at"] <= now
                ):
                    return 410, {"error": "expired"}
                if action == "poll":
                    if row["last_poll"] is not None and now - row["last_poll"] < 2:
                        return 429, {"error": "slow_down"}
                    conn.execute("UPDATE lab_auth_requests SET last_poll=? WHERE request_id=?", (now, rid))
                    if row["status"] == "approved":
                        return 200, {"status": "approved", "code": self._mac("code", rid),
                                     "expires_in": row["code_expires_at"] - now}
                    return 200, {"status": "pending" if row["status"] == "pending" else "denied"}
                if (row["status"] != "approved" or not self._matches(body, "verifier", VERIFIER)
                    or not self._matches(body, "code")
                    or not _equal(body["code"], self._mac("code", rid))):
                    return 400, {"error": "invalid_grant"}
                challenge = base64.urlsafe_b64encode(
                    sha256(body["verifier"].encode("ascii")).digest()).decode("ascii").rstrip("=")
                if not _equal(row["challenge"], challenge):
                    return 400, {"error": "invalid_grant"}
                access = conn.execute("SELECT * FROM lab_auth_access WHERE sub=? AND enabled=1",
                                      (row["sub"],)).fetchone()
                session_expiry = self._bound_session(conn, row, access, now) if access else 0
                if not session_expiry:
                    return 400, {"error": "invalid_grant"}
                grant = secrets.token_urlsafe(32)
                conn.execute("UPDATE lab_auth_requests SET status='redeemed' WHERE request_id=?", (rid,))
                expires = min(now + GRANT_TTL, session_expiry)
                conn.execute("INSERT INTO lab_auth_grants VALUES(?,?,?,?,?)",
                             (_hex(grant), row["sub"], expires, row["session_rowid"], row["session_mac"]))
                return 200, {"sub": row["sub"], "grant": grant, "expires_in": expires - now}
        if action in ("introspect", "revoke"):
            if not all(self._matches(body, name) for name in ("sub", "grant")):
                return 400, {"error": "invalid_request"}
            params = (body["sub"], _hex(body["grant"]))
            with self._transaction(write=action == "revoke") as conn:
                if action == "revoke":
                    conn.execute("DELETE FROM lab_auth_grants WHERE sub=? AND grant_hash=?", params)
                    return 200, {"revoked": True}
                row = conn.execute(
                    """SELECT a.kind,a.uid,g.expires_at,g.session_rowid,g.session_mac FROM lab_auth_grants g
                       JOIN lab_auth_access a ON a.sub=g.sub
                       WHERE g.sub=? AND g.grant_hash=? AND a.enabled=1""", params).fetchone()
                session_expiry = self._bound_session(conn, row, row, now) if row else 0
                expires = min(row["expires_at"], session_expiry) if row else 0
                if expires <= now:
                    return 200, {"active": False}
                return 200, {"active": True, "expires_in": expires - now}
        return 404, {"error": "not_found"}

    def _active_identity(self, conn, row):
        kind, uid = row["kind"], str(row["uid"])
        if kind == "usso" and not conn.execute("SELECT 1 FROM users WHERE user_id=?", (uid,)).fetchone():
            return False
        ident = self.resolve_identity(kind, uid)
        return bool(ident and ident["kind"] == kind and str(ident["uid"]) == uid
                    and self.consent_accepted(conn, kind, uid))

    def _session_expiry(self, row, owner, now):
        if (not row or row["audience"] != self.session_audience or row["kind"] != owner["kind"]
                or row["uid"] != str(owner["uid"])):
            return 0
        try:
            dt = datetime.fromisoformat(row["expires_at"])
            expiry = int(dt.timestamp()) if dt.tzinfo else 0
            return expiry if expiry > now else 0
        except (TypeError, ValueError, OverflowError, OSError):
            return 0

    def _bound_session(self, conn, credential, owner, now):
        row = conn.execute("SELECT * FROM sessions_db WHERE rowid=?",
                           (credential["session_rowid"],)).fetchone()
        expiry = self._session_expiry(row, owner, now)
        if (not expiry or not _equal(self._mac("session", row["sid"]), credential["session_mac"])
                or not self._active_identity(conn, owner)):
            return 0
        return expiry

    def confirm(self, ident, sid, form):
        request_id = form.get("request_id", "")
        match_code = form.get("match_code", "")
        csrf = form.get("csrf", "")
        decision = form.get("decision")
        if (not ident or not sid or not OPAQUE.fullmatch(request_id) or not OPAQUE.fullmatch(csrf)
                or not _equal(csrf, self._mac("csrf", request_id, sid))
                or not MATCH.fullmatch(match_code) or decision not in ("approve", "deny")):
            return 403
        now = int(self.now())
        with self._transaction() as conn:
            row = conn.execute(
                """SELECT * FROM lab_auth_requests WHERE request_id=? AND status='pending'
                   AND expires_at>? AND failures<5""", (request_id, now)).fetchone()
            if not row:
                return 410
            access = conn.execute("SELECT sub FROM lab_auth_access WHERE kind=? AND uid=? AND enabled=1",
                                  (ident["kind"], str(ident["uid"]))).fetchone()
            session = conn.execute("SELECT rowid AS session_rowid,* FROM sessions_db WHERE sid=?",
                                   (sid,)).fetchone()
            if not access or not self._session_expiry(session, ident, now) or not self._active_identity(conn, ident):
                return 403
            if not _equal(self._mac("match", request_id, match_code), row["match_hash"]):
                conn.execute("UPDATE lab_auth_requests SET failures=failures+1 WHERE request_id=?",
                             (request_id,))
                return 403
            conn.execute("""UPDATE lab_auth_requests SET status=?,sub=?,code_expires_at=?,
                            session_rowid=?,session_mac=? WHERE request_id=?""",
                         ("approved" if decision == "approve" else "denied",
                          access["sub"], min(now + CODE_TTL, row["expires_at"]),
                          session["session_rowid"], self._mac("session", sid), request_id))
            return 200

    @staticmethod
    def _headers(handler, name):
        headers = handler.headers
        if hasattr(headers, "get_all"):
            return headers.get_all(name, [])
        value = headers.get(name)
        return [] if value is None else [value]

    def _response(self, handler, status, payload, *, html=False):
        data = (payload if html else json.dumps(payload, separators=(",", ":"))).encode("utf-8")
        handler.send_response(status)
        handler.send_header("Content-Type", ("text/html" if html else "application/json") + "; charset=utf-8")
        handler.send_header("Content-Length", str(len(data)))
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("Referrer-Policy", "no-referrer")
        if status >= 400 and getattr(handler, "command", None) == "POST":
            # Auth/validation can reject before reading the body. Do not parse its bytes as a new request.
            handler.close_connection = True
            handler.send_header("Connection", "close")
        handler.send_header("X-Content-Type-Options", "nosniff")
        if html:
            handler.send_header("Content-Security-Policy",
                                "default-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'")
        handler.end_headers()
        handler.wfile.write(data)
        return True

    def _page(self, handler, status, body):
        return self._response(handler, status,
            '<!DOCTYPE html><html lang="zh"><meta charset="utf-8"><meta name="viewport" '
            'content="width=device-width"><title>西木会馆 · LAB</title><h1>西木会馆 · LAB 登录</h1>' + body,
            html=True)

    def _read(self, handler, content_type):
        types = self._headers(handler, "Content-Type")
        lengths = self._headers(handler, "Content-Length")
        if (len(types) != 1 or types[0].split(";", 1)[0].strip().lower() != content_type
                or len(lengths) != 1 or self._headers(handler, "Transfer-Encoding")
                or not re.fullmatch(r"[0-9]{1,4}", lengths[0])):
            raise ValueError("bad body headers")
        size = int(lengths[0])
        if not 0 < size <= MAX_BODY:
            raise ValueError("invalid body size")
        body = handler.rfile.read(size)
        if len(body) != size:
            raise ValueError("incomplete body")
        return body.decode("utf-8")

    def handle(self, handler, method, path):
        """Route hook: pass exact physical /api/lab-auth/... path, not SPA aliases."""
        if not path.startswith(PREFIX):
            return False
        if not self.enabled:
            return self._response(handler, 503, {"error": "lab_account_disabled"})
        action = path[len(PREFIX):]
        if action == "approve" and method in ("GET", "POST"):
            # Browser approvals require the same origin that owns the account cookie.
            if method == "POST" and self._headers(handler, "Origin") != [self.origin]:
                return self._page(handler, 403, "<p>请求来源不符。请从游戏重新打开。</p>")
            sid = handler._get_session()
            ident = handler._require_ident_optional() if sid else None
            if not ident:
                return self._page(handler, 401, '<p>请先在同一浏览器'
                                  '<a href="/account.html" target="_blank" rel="noopener noreferrer">登录西木会馆</a>，'
                                  '再回到此页刷新。</p>')
            if method == "GET":
                try:
                    query = parse_qs(urlsplit(handler.path).query, max_num_fields=2)
                    values = query.get("request_id", [])
                    rid = values[0] if len(values) == 1 else ""
                except ValueError:
                    rid = ""
                if not OPAQUE.fullmatch(rid):
                    return self._page(handler, 400, "<p>请求无效。请从游戏重新打开。</p>")
                with self._transaction(write=False) as conn:
                    found = conn.execute(
                        "SELECT 1 FROM lab_auth_requests WHERE request_id=? AND status='pending' AND expires_at>? AND failures<5",
                        (rid, int(self.now()))).fetchone()
                if not found:
                    return self._page(handler, 410, "<p>请求已结束。请从游戏重新发起登录。</p>")
                return self._page(handler, 200,
                    f'<p>当前会馆账户：{escape(ident.get("nickname") or ident.get("username") or "已登录")}</p>'
                    '<p>只有你刚在自己的游戏里发起登录时才继续。请输入游戏屏幕显示的六位配对码。'
                    '不要使用别人发给你的配对码。</p>'
                    '<p>会馆与游戏分别保存数据。验证通过后，LAB 只会取得专用身份标识和短时访问授权，'
                    '不会收到会馆密码、邮箱或登录凭据。注册和共创身份不等于测试资格。</p>'
                    '<p>普通登录不会自动绑定或合并旧存档。有旧进度时，请在游戏内从明确的旧档绑定入口发起。</p>'
                    f'<form method="post" action="{PREFIX}approve">'
                    f'<input type="hidden" name="request_id" value="{rid}">'
                    f'<input type="hidden" name="csrf" value="{self._mac("csrf", rid, sid)}">'
                    '<label>六位配对码 <input name="match_code" inputmode="numeric" maxlength="6" '
                    'pattern="[0-9]{6}" autocomplete="off" required></label> '
                    '<button name="decision" value="approve">授权这次登录</button> '
                    '<button name="decision" value="deny">拒绝</button></form>')
            try:
                fields = parse_qs(self._read(handler, "application/x-www-form-urlencoded"),
                                  max_num_fields=4, keep_blank_values=True)
                if len(fields) != 4 or any(len(v) != 1 for v in fields.values()):
                    raise ValueError("invalid form")
                status = self.confirm(ident, sid, {k: v[0] for k, v in fields.items()})
            except ValueError:
                status = 400
            message = "已处理，请返回游戏。" if status == 200 else "未授权。请核对账户权限、配对码，或从游戏重新发起。"
            return self._page(handler, status, "<p>" + message + "</p>")
        if method != "POST" or action not in {"start", "poll", "redeem", "introspect", "revoke"}:
            return self._response(handler, 404, {"error": "not_found"})
        auth = self._headers(handler, "Authorization")
        if len(auth) != 1 or not _equal(auth[0], "Bearer " + self.bearer):
            return self._response(handler, 401, {"error": "service_auth_required"})
        try:
            body = json.loads(self._read(handler, "application/json"))
            if not isinstance(body, dict):
                raise ValueError("invalid object")
        except ValueError:
            return self._response(handler, 400, {"error": "invalid_request"})
        result, payload = self.api(action, body)
        return self._response(handler, result, payload)
