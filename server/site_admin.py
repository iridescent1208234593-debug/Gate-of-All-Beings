"""Server-side site-owner check for the main site's admin endpoints.

An admin is a complete (kind, uid) account listed in SITE_OWNER_ACCOUNTS whose
account is still usable in the 会馆 account store. Bare uids and token-supplied
roles or kinds are never trusted: the signed hx_sso token only proves which
account is calling, and the account store decides whether it is still active.

This is deliberately separate from 会馆 roles (local_users.role / user_flags):
being a 会馆 admin does not grant main-site editing, matching existing practice.
"""
import os
import sqlite3
from pathlib import Path
from storage_paths import data_root, huiguan_data_dir


# The site owner's two accounts. Add entries here; never compare a bare uid.
SITE_OWNER_ACCOUNTS = frozenset({("usso", "7"), ("local", "7")})


def _users_db(project_root=None):
    root = Path(project_root) if project_root is not None else data_root()
    return huiguan_data_dir(root) / "users.db"


def account_usable(kind, uid, project_root=None):
    """True when the account exists and is not disabled; read-only."""
    database = _users_db(project_root)
    if not database.exists():
        return False
    try:
        conn = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True, timeout=5)
    except sqlite3.Error:
        return False
    try:
        if kind == "local":
            row = conn.execute("SELECT status FROM local_users WHERE CAST(uid AS TEXT)=?", (uid,)).fetchone()
            return bool(row) and row[0] == "active"
        if kind == "usso":
            # USSO accounts are created on first login; only an explicit ban disables them.
            try:
                flag = conn.execute("SELECT status FROM user_flags WHERE kind='usso' AND uid=?", (uid,)).fetchone()
            except sqlite3.OperationalError:
                flag = None
            return not (flag and flag[0] == "banned")
        return False
    except sqlite3.Error:
        return False
    finally:
        conn.close()


def is_site_owner(token_payload, project_root=None):
    """Decide main-site admin from a verified hx_sso payload."""
    if not isinstance(token_payload, dict):
        return False
    kind, uid = token_payload.get("kind"), str(token_payload.get("uid") or "")
    if (kind, uid) not in SITE_OWNER_ACCOUNTS:
        return False
    return account_usable(kind, uid, project_root)
