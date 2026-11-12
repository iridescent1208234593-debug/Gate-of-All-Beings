"""Verified-email recovery check using a temporary SQLite database."""
import json
import sqlite3
import sys
import tempfile
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "services" / "platform"))
from account_email import init_schema as init_email_schema
from account_recovery import handle_recovery, init_schema as init_recovery_schema


class Handler:
    headers = {"Content-Type": "application/json"}

    def __init__(self, body=None, ip="127.0.0.1"):
        self.body = json.dumps(body or {}).encode()
        self.ip = ip
        self.response = None

    def _json(self, status, body, **kwargs):
        self.response = (status, body)
        return self.response

    def _read_json(self):
        return json.loads(self.body)

    def _client_ip(self):
        return self.ip

    def _session_clear_cookie(self):
        return "sid=; Max-Age=0"

    def _sso_clear_cookie(self):
        return "hx_sso=; Max-Age=0"


with tempfile.TemporaryDirectory() as directory:
    db_path = Path(directory) / "accounts.sqlite"

    def db():
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn

    conn = db()
    try:
        init_email_schema(conn)
        init_recovery_schema(conn)
        conn.executescript("""
            CREATE TABLE users (user_id INTEGER PRIMARY KEY, nickname TEXT, email TEXT);
            CREATE TABLE local_users (uid INTEGER PRIMARY KEY, username TEXT, pass_hash TEXT, email TEXT, status TEXT);
            CREATE TABLE sessions_db (sid TEXT PRIMARY KEY, kind TEXT, uid TEXT);
            INSERT INTO local_users VALUES (1, 'test-user', 'old-hash', 'legacy@example.com', 'active');
            INSERT INTO sessions_db VALUES ('session-1', 'local', '1');
            INSERT INTO account_emails VALUES ('local', '1', 'User@Example.com', 'user@example.com', '2026-01-01T00:00:00+00:00');
        """)
        conn.commit()
    finally:
        conn.close()

    sent = []
    api = {
        "db": db,
        "DB_LOCK": threading.Lock(),
        "send_recovery_email": lambda email, token, username: sent.append((email, token, username)),
        "hash_password": lambda password: "new-hash:" + password,
    }
    found = Handler({"email": "User@Example.com"})
    result = handle_recovery(found, "send", api)
    assert result[0] == 200 and sent[0][0] == "User@Example.com" and sent[0][2] == "test-user"
    # 非 ASCII 地址在校验阶段即拒绝（SMTP 中继不支持 SMTPUTF8）
    assert handle_recovery(Handler({"email": "西木@qq.com"}, ip="127.0.0.9"), "send", api)[0] == 400

    unknown = Handler({"email": "unknown@example.com"}, ip="127.0.0.2")
    assert handle_recovery(unknown, "send", api) == result
    unverified = Handler({"email": "legacy@example.com"}, ip="127.0.0.3")
    assert handle_recovery(unverified, "send", api) == result
    assert len(sent) == 1

    token = sent[0][1]
    reset = Handler({"token": token, "new_password": "new-password", "confirm_password": "new-password"})
    assert handle_recovery(reset, "reset", api)[0] == 200
    conn = db()
    try:
        assert conn.execute("SELECT pass_hash FROM local_users WHERE uid=1").fetchone()[0] == "new-hash:new-password"
        assert conn.execute("SELECT count(*) FROM sessions_db").fetchone()[0] == 0
    finally:
        conn.close()
    replay = Handler({"token": token, "new_password": "another-pass", "confirm_password": "another-pass"})
    assert handle_recovery(replay, "reset", api)[0] == 400

print("verified-email recovery, non-enumerating response, session invalidation, and one-time token: PASS")
