"""Minimal verified-email flow check using a temporary SQLite database."""
import json
import sqlite3
import tempfile
import threading
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "services" / "platform"))
from account_email import handle_email, init_schema


class Handler:
    headers = {"Content-Type": "application/json"}

    def __init__(self, body=None, uid="1", ip="127.0.0.1", authenticated=True):
        self.body = json.dumps(body or {}).encode()
        self.uid = uid
        self.ip = ip
        self.authenticated = authenticated
        self.response = None

    def _json(self, status, body, **kwargs):
        self.response = (status, body)
        return self.response

    def _read_json(self):
        return json.loads(self.body)

    def _get_session(self):
        return {"kind": "local", "uid": self.uid} if self.authenticated else None

    def _client_ip(self):
        return self.ip


with tempfile.TemporaryDirectory() as directory:
    db_path = Path(directory) / "accounts.sqlite"

    def db():
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn

    conn = db()
    try:
        init_schema(conn)
        conn.commit()
    finally:
        conn.close()
    sent = []
    api = {
        "db": db,
        "DB_LOCK": threading.Lock(),
        "read_session": lambda session: session,
        "resolve_identity": lambda kind, uid: {"kind": kind, "uid": uid},
        "send_email": lambda email, token: sent.append((email, token)),
    }
    send = Handler({"email": "User@Example.com"})
    assert handle_email(send, "send", api) == (200, {"ok": True, "message": "验证链接已发送，30 分钟内有效"})
    assert sent and sent[0][0] == "User@Example.com"
    # 非 ASCII 地址必须在校验阶段被拒，否则 smtplib 会因缺少 SMTPUTF8 抛错、发信被静默跳过
    non_ascii = Handler({"email": "西木@qq.com"})
    assert handle_email(non_ascii, "send", api)[0] == 400
    non_ascii_domain = Handler({"email": "someone@西木.com"})
    assert handle_email(non_ascii_domain, "send", api)[0] == 400
    unauthenticated_send = Handler({"email": "other@example.com"}, authenticated=False)
    assert handle_email(unauthenticated_send, "send", api)[0] == 401
    verify = Handler({"token": sent[0][1]}, authenticated=False)
    assert handle_email(verify, "verify", api)[0] == 200
    status = Handler()
    assert handle_email(status, "status", api)[1] == {"ok": True, "email": "User@Example.com", "verified": True, "pending": False}
    replay = Handler({"token": sent[0][1]})
    assert handle_email(replay, "verify", api)[0] == 400
    duplicate = Handler({"email": "user@example.com"}, uid="2", ip="127.0.0.2")
    assert handle_email(duplicate, "send", api)[0] == 409
print("verified email bind, status, and one-time token: PASS")
