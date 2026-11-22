"""Test-code and session authentication.

* Codes are random (~80 bits) and stored only as HMAC-SHA256(pepper, normalized code).
* Sessions are random 256-bit tokens, stored only as SHA-256 digests, valid 7 days.
* Failed attempts are rate-limited per client address with a short lockout.
* A code is never an admin credential: admin uses a separate password on a loopback-only console.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import subprocess
import time
from collections import defaultdict, deque
from pathlib import Path

from .store import Store

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"   # no 0/O/1/I/L
SESSION_COOKIE = "zszm_lab_session"
ADMIN_COOKIE = "zszm_lab_admin"


def restrict_file(path: Path) -> None:
    """Owner + SYSTEM only, like the workspace secrets folder."""
    if os.name == "nt":
        user = os.environ.get("USERDOMAIN", "") + "\\" + os.environ.get("USERNAME", "")
        subprocess.run(["icacls", str(path), "/inheritance:r", "/grant:r", f"{user}:F", "*S-1-5-18:F"],
                       capture_output=True, creationflags=0x08000000)


def load_pepper(secrets_dir: Path) -> bytes:
    secrets_dir.mkdir(parents=True, exist_ok=True)
    f = secrets_dir / "pepper.key"
    if not f.exists():
        f.write_bytes(secrets.token_bytes(32))
        restrict_file(f)
    data = f.read_bytes()
    if len(data) != 32:
        raise RuntimeError("lab pepper must be 32 bytes")
    return data


def normalize(code: str) -> str:
    return "".join(ch for ch in code.upper() if ch in ALPHABET)


def new_code() -> str:
    body = "".join(secrets.choice(ALPHABET) for _ in range(16))
    return "ZSZM-" + "-".join(body[i:i + 4] for i in range(0, 16, 4))


class RateLimiter:
    """5 failures within 10 minutes lock an address for 15 minutes; a global brake slows floods."""

    def __init__(self, max_failures=5, window=600, lockout=900, global_per_minute=60):
        self.max_failures, self.window, self.lockout = max_failures, window, lockout
        self.global_per_minute = global_per_minute
        self.failures: dict[str, deque] = defaultdict(deque)
        self.locked_until: dict[str, float] = {}
        self.global_failures: deque = deque()

    def locked(self, key: str, now: float | None = None) -> float:
        now = now or time.time()
        until = self.locked_until.get(key, 0)
        if until > now:
            return until - now
        while self.global_failures and self.global_failures[0] < now - 60:
            self.global_failures.popleft()
        if len(self.global_failures) >= self.global_per_minute:
            return 60.0
        return 0.0

    def fail(self, key: str, now: float | None = None) -> bool:
        now = now or time.time()
        q = self.failures[key]
        q.append(now)
        self.global_failures.append(now)
        while q and q[0] < now - self.window:
            q.popleft()
        if len(q) >= self.max_failures:
            self.locked_until[key] = now + self.lockout
            q.clear()
            return True
        return False

    def success(self, key: str) -> None:
        self.failures.pop(key, None)


class Auth:
    def __init__(self, store: Store, pepper: bytes, session_days: int = 7):
        self.store, self.pepper = store, pepper
        self.session_seconds = session_days * 86400
        self.limiter = RateLimiter()
        self.protect_linked_codes = False

    def code_digest(self, code: str) -> str:
        return hmac.new(self.pepper, normalize(code).encode(), hashlib.sha256).hexdigest()

    @staticmethod
    def token_digest(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    # --- codes -----------------------------------------------------------------------
    def create_code(self, label: str = "", role: str = "player", actor: str = "admin") -> tuple[str, str]:
        if role not in ("player", "monitor", "art"):
            raise ValueError("bad role")
        code = new_code()
        cid = "c_" + secrets.token_hex(5)
        self.store.exec("INSERT INTO codes(id,digest,label,role,created_at) VALUES(?,?,?,?,?)",
                        (cid, self.code_digest(code), label[:60], role, time.time()))
        self.store.audit(actor, "code.create", cid, label=label[:60], role=role)
        return cid, code

    def set_status(self, cid: str, status: str, actor: str = "admin") -> int:
        if status not in ("active", "disabled", "revoked"):
            raise ValueError("bad status")
        row = self.store.one("SELECT status FROM codes WHERE id=?", (cid,))
        if not row:
            raise KeyError(cid)
        if row["status"] == "revoked" and status != "revoked":
            raise ValueError("revoked codes cannot be re-enabled")
        self.store.exec("UPDATE codes SET status=? WHERE id=?", (status, cid))
        removed = 0
        if status != "active":
            removed = self.store.exec("DELETE FROM sessions WHERE code_id=?", (cid,)).rowcount
        self.store.audit(actor, "code." + status, cid, sessions_removed=removed)
        self.store.security("code_" + status, code_id=cid, sessions_removed=removed)
        return removed

    # --- login / sessions ------------------------------------------------------------
    def account_owns_code(self, code_id: str) -> bool:
        return self.protect_linked_codes and self.store.one(
            "SELECT 1 FROM account_links WHERE code_id=?", (code_id,)) is not None

    def login(self, code: str, ip_key: str) -> tuple[str | None, str, float]:
        """Returns (session_token|None, reason, retry_after)."""
        wait = self.limiter.locked(ip_key)
        if wait:
            self.store.security("login_locked", ip_hint=ip_key)
            return None, "locked", wait
        norm = normalize(code)
        row = None
        if 16 <= len(norm) <= 24:
            row = self.store.one("SELECT * FROM codes WHERE digest=?", (self.code_digest(code),))
        if not row or row["status"] != "active" or self.account_owns_code(row["id"]):
            locked = self.limiter.fail(ip_key)
            self.store.security("login_failed", ip_hint=ip_key, code_id=row["id"] if row else None,
                                reason="inactive" if row else "unknown", locked=locked)
            return None, "invalid", self.limiter.lockout if locked else 0
        self.limiter.success(ip_key)
        token = secrets.token_urlsafe(32)
        now = time.time()
        with self.store.tx() as s:
            if self.account_owns_code(row["id"]):
                return None, "invalid", 0
            s.db.execute("INSERT INTO sessions VALUES(?,?,?,?,?)",
                         (self.token_digest(token), row["id"], now, now + self.session_seconds, now))
            s.db.execute("UPDATE codes SET last_used_at=?, last_ip_hint=?, use_count=use_count+1 WHERE id=?",
                         (now, ip_key, row["id"]))
        self.store.security("login_ok", ip_hint=ip_key, code_id=row["id"])
        return token, "ok", 0

    def session(self, token: str | None) -> dict | None:
        if not token or len(token) > 100:
            return None
        row = self.store.one(
            "SELECT s.digest, s.expires_at, c.id AS code_id, c.role, c.status, c.label FROM sessions s "
            "JOIN codes c ON c.id=s.code_id WHERE s.digest=?", (self.token_digest(token),))
        if not row:
            return None
        now = time.time()
        if (row["status"] != "active" or row["expires_at"] < now or
                (self.account_owns_code(row["code_id"]) and not self.store.one(
                    "SELECT 1 FROM account_sessions WHERE digest=?", (row["digest"],)))):
            self.store.exec("DELETE FROM sessions WHERE digest=?", (row["digest"],))
            return None
        self.store.exec("UPDATE sessions SET last_seen_at=? WHERE digest=?", (now, row["digest"]))
        return dict(row)

    def logout(self, token: str | None) -> None:
        if token:
            self.store.exec("DELETE FROM sessions WHERE digest=?", (self.token_digest(token),))

    def purge_expired(self) -> int:
        return self.store.exec("DELETE FROM sessions WHERE expires_at<?", (time.time(),)).rowcount


# --- admin password (separate, stronger credential) --------------------------------
def set_admin_password(secrets_dir: Path, password: str) -> None:
    if len(password) < 12:
        raise ValueError("admin password must be at least 12 characters")
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2 ** 15, r=8, p=1, maxmem=64 * 1024 * 1024)
    f = secrets_dir / "admin.json"
    f.write_text(json.dumps({"scheme": "scrypt-n15-r8-p1", "salt": salt.hex(), "hash": digest.hex()}))
    restrict_file(f)


def check_admin_password(secrets_dir: Path, password: str) -> bool:
    f = secrets_dir / "admin.json"
    if not f.exists():
        return False
    data = json.loads(f.read_text())
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(data["salt"]), n=2 ** 15, r=8, p=1,
                            maxmem=64 * 1024 * 1024)
    return hmac.compare_digest(digest.hex(), data["hash"])
