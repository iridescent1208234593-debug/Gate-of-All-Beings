"""Verified email binding for the first-party account database."""
import hashlib
import re
import secrets
import smtplib
import ssl
import time
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from site_domains import site_url, request_host, request_origin_allowed
from storage_paths import secrets_dir


EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def init_schema(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS account_emails (
        kind TEXT NOT NULL, uid TEXT NOT NULL, email TEXT NOT NULL,
        email_norm TEXT NOT NULL UNIQUE, verified_at TEXT NOT NULL,
        PRIMARY KEY (kind, uid))""")
    conn.execute("""CREATE TABLE IF NOT EXISTS account_email_challenges (
        kind TEXT NOT NULL, uid TEXT NOT NULL, email TEXT NOT NULL,
        email_norm TEXT NOT NULL, token_hash TEXT NOT NULL,
        expires_at REAL NOT NULL, created_at REAL NOT NULL,
        PRIMARY KEY (kind, uid))""")
    conn.execute("CREATE TABLE IF NOT EXISTS account_email_attempts (bucket TEXT NOT NULL, at REAL NOT NULL)")
    conn.execute("CREATE INDEX IF NOT EXISTS account_email_attempts_bucket ON account_email_attempts(bucket, at)")


def _mail_setting():
    import os

    config = {}
    env_file = secrets_dir() / "server.env"
    try:
        for line in env_file.read_text(encoding="utf-8").splitlines():
            key, separator, value = line.strip().partition("=")
            if separator and key.startswith("ACCOUNT_EMAIL_"):
                config[key] = value.strip().strip("\"'")
    except OSError:
        pass
    def setting(name, default=""):
        return os.environ.get(name, config.get(name, default))

    return setting


def _send_message(email, subject, content):
    setting = _mail_setting()

    host = setting("ACCOUNT_EMAIL_SMTP_HOST").strip()
    username = setting("ACCOUNT_EMAIL_SMTP_USER").strip()
    password = setting("ACCOUNT_EMAIL_SMTP_PASSWORD")
    sender = setting("ACCOUNT_EMAIL_FROM", username).strip()
    if not all((host, username, password, sender)):
        raise RuntimeError("email service is not configured")
    try:
        port = int(setting("ACCOUNT_EMAIL_SMTP_PORT", "465"))
    except ValueError as exc:
        raise RuntimeError("invalid SMTP port") from exc
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = email
    message.set_content(content)
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(host, port, timeout=10, context=context) as smtp:
        smtp.login(username, password)
        smtp.send_message(message)


def _send_email(email, token, base_url=None):
    setting = _mail_setting()
    base = base_url or setting("ACCOUNT_EMAIL_BASE_URL", site_url("huiguan", "/account.html")).strip()
    link = f"{base}#verify-email={token}"
    _send_message(email, "验证你的西木会馆邮箱", f"请打开以下链接验证邮箱（30 分钟内有效）：\n\n{link}\n\n如果不是你本人操作，请忽略此邮件。")


def send_recovery_email(email, token, username, base_url=None):
    setting = _mail_setting()
    base = base_url or setting("ACCOUNT_EMAIL_RECOVERY_URL", site_url("huiguan", "/security.html?mode=recover")).strip()
    link = f"{base}#email-recovery={token}"
    content = (
        f"你的西木会馆账号名是：{username}\n\n"
        f"如需重置密码，请打开以下链接（30 分钟内有效且只能使用一次）：\n\n{link}\n\n"
        "如果不是你本人操作，请忽略此邮件。"
    )
    _send_message(email, "西木会馆账号找回", content)


def handle_email(handler, action, api):
    reply = handler._json
    if not request_origin_allowed(handler):
        return reply(403, {"error": "请从会馆账户页面操作"})
    if action == "status":
        session = api["read_session"](handler._get_session())
        ident = api["resolve_identity"](session["kind"], session["uid"]) if session else None
        if not ident:
            return reply(401, {"error": "请先登录"})
        conn = api["db"]()
        row = conn.execute("SELECT email, verified_at FROM account_emails WHERE kind=? AND uid=?", (ident["kind"], ident["uid"])).fetchone()
        pending = conn.execute("SELECT 1 FROM account_email_challenges WHERE kind=? AND uid=? AND expires_at>?", (ident["kind"], ident["uid"], time.time())).fetchone()
        conn.close()
        return reply(200, {"ok": True, "email": row["email"] if row else "", "verified": bool(row), "pending": bool(pending)})
    if action not in ("send", "verify"):
        return reply(404, {"error": "未知操作"})
    if handler.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
        return reply(415, {"error": "请使用账户页面提交"})
    body = handler._read_json()
    if body is None:
        return
    if not isinstance(body, dict) or any(not isinstance(value, str) for value in body.values()):
        return reply(400, {"error": "输入格式不正确"})
    if action == "send":
        session = api["read_session"](handler._get_session())
        ident = api["resolve_identity"](session["kind"], session["uid"]) if session else None
        if not ident:
            return reply(401, {"error": "登录已失效，请重新登录"})
        kind, uid = ident["kind"], str(ident["uid"])
        email = body.get("email", "").strip()
        normalized = email.casefold()
        if len(email) > 254 or not EMAIL_RE.fullmatch(email):
            return reply(400, {"error": "请输入有效邮箱地址"})
        now = time.time()
        buckets = [f"user:{kind}:{uid}", f"ip:{handler._client_ip()}"]
        with api["DB_LOCK"]:
            conn = api["db"]()
            conn.execute("BEGIN IMMEDIATE")
            conn.execute("DELETE FROM account_email_attempts WHERE at<?", (now - 3600,))
            too_soon = any(conn.execute("SELECT count(*) FROM account_email_attempts WHERE bucket=? AND at>?", (bucket, now - 60)).fetchone()[0] for bucket in buckets)
            user_hourly = conn.execute("SELECT count(*) FROM account_email_attempts WHERE bucket=?", (buckets[0],)).fetchone()[0] >= 5
            ip_hourly = conn.execute("SELECT count(*) FROM account_email_attempts WHERE bucket=?", (buckets[1],)).fetchone()[0] >= 5
            owner = conn.execute("SELECT kind,uid FROM account_emails WHERE email_norm=?", (normalized,)).fetchone()
            if too_soon or user_hourly or ip_hourly:
                conn.rollback(); conn.close()
                return reply(429, {"error": "操作过于频繁，请稍后再试"})
            if owner and (owner["kind"], owner["uid"]) != (kind, uid):
                conn.rollback(); conn.close()
                return reply(409, {"error": "该邮箱已绑定其他账户"})
            conn.executemany("INSERT INTO account_email_attempts VALUES (?,?)", [(bucket, now) for bucket in buckets])
            token = secrets.token_urlsafe(32)
            conn.execute("INSERT OR REPLACE INTO account_email_challenges VALUES (?,?,?,?,?,?,?)", (kind, uid, email, normalized, hashlib.sha256(token.encode()).hexdigest(), now + 1800, now))
            conn.commit(); conn.close()
        try:
            if api.get("send_email"):
                api["send_email"](email, token)
            else:
                _send_email(email, token, site_url("huiguan", "/account.html", request_host(handler)))
        except Exception:
            with api["DB_LOCK"]:
                conn = api["db"]()
                conn.execute("DELETE FROM account_email_challenges WHERE kind=? AND uid=? AND token_hash=?", (kind, uid, hashlib.sha256(token.encode()).hexdigest()))
                conn.commit(); conn.close()
            return reply(503, {"error": "验证邮件暂时无法发送，请稍后再试或联系管理员配置发信服务"})
        return reply(200, {"ok": True, "message": "验证链接已发送，30 分钟内有效"})

    token = body.get("token", "")
    if len(token) < 32 or len(token) > 128:
        return reply(400, {"error": "验证链接无效或已过期"})
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with api["DB_LOCK"]:
        conn = api["db"]()
        try:
            conn.execute("BEGIN IMMEDIATE")
            # The one-time link is scoped to the account that requested it; the
            # mailbox token itself is sufficient proof when the user opens it.
            challenge = conn.execute("SELECT * FROM account_email_challenges WHERE token_hash=? AND expires_at>?", (token_hash, time.time())).fetchone()
            if not challenge:
                conn.rollback()
                return reply(400, {"error": "验证链接无效或已过期"})
            if not api["resolve_identity"](challenge["kind"], challenge["uid"]):
                conn.execute("DELETE FROM account_email_challenges WHERE kind=? AND uid=?", (challenge["kind"], challenge["uid"]))
                conn.commit()
                return reply(400, {"error": "对应账户已不可用，请重新登录后发送验证邮件"})
            owner = conn.execute("SELECT kind,uid FROM account_emails WHERE email_norm=?", (challenge["email_norm"],)).fetchone()
            if owner and (owner["kind"], owner["uid"]) != (challenge["kind"], challenge["uid"]):
                conn.rollback()
                return reply(409, {"error": "该邮箱已绑定其他账户"})
            verified_at = datetime.now(timezone.utc).isoformat()
            conn.execute("INSERT INTO account_emails VALUES (?,?,?,?,?) ON CONFLICT(kind,uid) DO UPDATE SET email=excluded.email,email_norm=excluded.email_norm,verified_at=excluded.verified_at", (challenge["kind"], challenge["uid"], challenge["email"], challenge["email_norm"], verified_at))
            conn.execute("DELETE FROM account_email_challenges WHERE kind=? AND uid=?", (challenge["kind"], challenge["uid"]))
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    return reply(200, {"ok": True, "email": challenge["email"], "message": "邮箱验证成功"})
