"""Verified-email account recovery for local Huiguan accounts."""
import hashlib
import secrets
import time

from account_email import EMAIL_RE, send_recovery_email
from site_domains import request_origin_allowed, site_url, request_host


def init_schema(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS account_email_recovery (
        uid INTEGER PRIMARY KEY, email_norm TEXT NOT NULL, token_hash TEXT NOT NULL,
        expires_at REAL NOT NULL, created_at REAL NOT NULL)""")


def _json_body(handler, reply):
    if handler.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
        reply(415, {"error": "请使用账户页面提交"})
        return None
    body = handler._read_json()
    if body is None:
        return None
    if not isinstance(body, dict) or any(not isinstance(value, str) for value in body.values()):
        reply(400, {"error": "输入格式不正确"})
        return None
    if any(len(value) > 256 for value in body.values()):
        reply(400, {"error": "输入内容过长"})
        return None
    return body


def _origin_allowed(handler):
    return request_origin_allowed(handler)


def handle_recovery(handler, action, api):
    reply = handler._json
    if not _origin_allowed(handler):
        return reply(403, {"error": "请从会馆账户页面操作"})
    if action not in ("send", "reset"):
        return reply(404, {"error": "未知操作"})
    body = _json_body(handler, reply)
    if body is None:
        return

    if action == "send":
        email = body.get("email", "").strip()
        if len(email) > 254 or not EMAIL_RE.fullmatch(email):
            return reply(400, {"error": "请输入有效邮箱地址"})
        email_norm = email.casefold()
        now = time.time()
        buckets = ("recovery:email:" + email_norm, "recovery:ip:" + handler._client_ip())
        token = secrets.token_urlsafe(32)
        with api["DB_LOCK"]:
            conn = api["db"]()
            try:
                conn.execute("BEGIN IMMEDIATE")
                conn.execute("DELETE FROM account_email_attempts WHERE at<?", (now - 3600,))
                # 邮箱维度从严：60 秒冷却 + 每小时 5 次
                email_too_soon = conn.execute("SELECT count(*) FROM account_email_attempts WHERE bucket=? AND at>?", (buckets[0], now - 60)).fetchone()[0] > 0
                email_hourly = conn.execute("SELECT count(*) FROM account_email_attempts WHERE bucket=?", (buckets[0],)).fetchone()[0] >= 5
                # IP 维度放宽：2 秒防抖 + 每小时 30 次
                ip_too_soon = conn.execute("SELECT count(*) FROM account_email_attempts WHERE bucket=? AND at>?", (buckets[1], now - 2)).fetchone()[0] > 0
                ip_hourly = conn.execute("SELECT count(*) FROM account_email_attempts WHERE bucket=?", (buckets[1],)).fetchone()[0] >= 30
                too_soon = email_too_soon or ip_too_soon
                hourly = email_hourly or ip_hourly
                if too_soon or hourly:
                    conn.rollback()
                    return reply(429, {"error": "操作过于频繁，请稍后再试"})
                conn.executemany("INSERT INTO account_email_attempts VALUES (?,?)", [(key, now) for key in buckets])
                user = conn.execute(
                    """SELECT u.uid, u.username FROM account_emails e
                       JOIN local_users u ON u.uid=CAST(e.uid AS INTEGER)
                       WHERE e.kind='local' AND e.email_norm=? AND u.status='active'""",
                    (email_norm,),
                ).fetchone()
                if not user:
                    user = conn.execute(
                        """SELECT u.user_id AS uid, u.nickname AS username FROM account_emails e
                           JOIN users u ON u.user_id=CAST(e.uid AS TEXT)
                           WHERE e.kind='usso' AND e.email_norm=?""",
                        (email_norm,),
                    ).fetchone()
                if user:
                    conn.execute(
                        "INSERT OR REPLACE INTO account_email_recovery VALUES (?,?,?,?,?)",
                        (user["uid"], email_norm, hashlib.sha256(token.encode()).hexdigest(), now + 1800, now),
                    )
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

        if user:
            try:
                if api.get("send_recovery_email"):
                    api["send_recovery_email"](email, token, user["username"])
                else:
                    send_recovery_email(email, token, user["username"],
                                        site_url("huiguan", "/security.html?mode=recover", request_host(handler)))
            except Exception:
                with api["DB_LOCK"]:
                    conn = api["db"]()
                    conn.execute(
                        "DELETE FROM account_email_recovery WHERE uid=? AND token_hash=?",
                        (user["uid"], hashlib.sha256(token.encode()).hexdigest()),
                    )
                    conn.commit()
                    conn.close()
                # Keep account existence private; details stay in server logs only.
                print("[account-recovery] email delivery failed")
        return reply(200, {"ok": True, "message": "如果该邮箱已验证绑定到站内账号，找回邮件将发送到该邮箱；请检查收件箱和垃圾邮件。"})

    token = body.get("token", "")
    password = body.get("new_password", "")
    if not 32 <= len(token) <= 128:
        return reply(400, {"error": "找回链接无效或已过期"})
    if not 12 <= len(password) <= 128 or password != body.get("confirm_password", ""):
        return reply(400, {"error": "请确认两次密码一致，且长度为 12–128 位"})
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    conn = api["db"]()
    try:
        challenge = conn.execute(
            "SELECT uid,email_norm FROM account_email_recovery WHERE token_hash=? AND expires_at>?",
            (token_hash, time.time()),
        ).fetchone()
        if not challenge:
            return reply(400, {"error": "找回链接无效或已过期"})
        own = conn.execute(
            "SELECT kind FROM account_emails WHERE CAST(uid AS TEXT)=CAST(? AS TEXT) AND email_norm=?",
            (challenge["uid"], challenge["email_norm"]),
        ).fetchone()
        owner_kind = (own["kind"] if own else "local")
        if owner_kind == "usso":
            user = conn.execute(
                "SELECT u.user_id AS uid, p.pass_hash AS pass_hash FROM users u "
                "LEFT JOIN usso_passwords p ON p.user_id=u.user_id WHERE u.user_id=CAST(? AS TEXT)",
                (challenge["uid"],),
            ).fetchone()
        else:
            user = conn.execute(
                """SELECT u.uid, u.pass_hash FROM local_users u
                   JOIN account_emails e ON e.kind='local' AND CAST(e.uid AS INTEGER)=u.uid
                   WHERE u.uid=? AND u.status='active' AND e.email_norm=?""",
                (challenge["uid"], challenge["email_norm"]),
            ).fetchone()
    finally:
        conn.close()
    if not user:
        return reply(400, {"error": "找回链接无效或已过期"})
    password_hash = api["hash_password"](password)
    with api["DB_LOCK"]:
        conn = api["db"]()
        try:
            conn.execute("BEGIN IMMEDIATE")
            if owner_kind == "usso":
                current = conn.execute(
                    "SELECT pass_hash FROM usso_passwords WHERE user_id=CAST(? AS TEXT)",
                    (challenge["uid"],),
                ).fetchone()
            else:
                current = conn.execute(
                    """SELECT u.pass_hash FROM local_users u
                       JOIN account_emails e ON e.kind='local' AND CAST(e.uid AS INTEGER)=u.uid
                       WHERE u.uid=? AND u.status='active' AND e.email_norm=?""",
                    (challenge["uid"], challenge["email_norm"]),
                ).fetchone()
            fresh = conn.execute(
                "SELECT 1 FROM account_email_recovery WHERE uid=? AND email_norm=? AND token_hash=? AND expires_at>?",
                (challenge["uid"], challenge["email_norm"], token_hash, time.time()),
            ).fetchone()
            if not current or current["pass_hash"] != user["pass_hash"] or not fresh:
                conn.rollback()
                return reply(400, {"error": "找回链接无效或已过期"})
            stamp = time.strftime("%Y-%m-%dT%H:%M:%S%z")
            if owner_kind == "usso":
                conn.execute(
                    "INSERT INTO usso_passwords(user_id, pass_hash, created_at, updated_at) VALUES(?,?,?,?) "
                    "ON CONFLICT(user_id) DO UPDATE SET pass_hash=excluded.pass_hash, updated_at=excluded.updated_at",
                    (str(challenge["uid"]), password_hash, stamp, stamp))
                conn.execute("DELETE FROM sessions_db WHERE kind='usso' AND uid=?", (str(challenge["uid"]),))
            else:
                conn.execute("UPDATE local_users SET pass_hash=? WHERE uid=?", (password_hash, challenge["uid"]))
                conn.execute("DELETE FROM sessions_db WHERE kind='local' AND uid=?", (str(challenge["uid"]),))
            conn.execute("DELETE FROM account_email_recovery WHERE uid=?", (challenge["uid"],))
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    cookies = [
        handler._session_clear_cookie(),
        handler._sso_clear_cookie(),
    ]
    return reply(200, {"ok": True, "message": "密码已重置，请使用新密码登录。"}, cookie=cookies)
