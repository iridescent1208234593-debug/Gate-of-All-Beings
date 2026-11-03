"""Server-side site-owner check for the main site's admin endpoints.

An admin is a complete (kind, uid) account listed in SITE_OWNER_ACCOUNTS whose
account is still usable in the 会馆 account store. Bare uids and token-supplied
roles or kinds are never trusted: the signed hx_sso token only proves which
account is calling, and the account store decides whether it is still active.

A uid alone is not a principal: local uids come from AUTOINCREMENT in whatever
users.db is mounted, so a fresh or rebuilt store hands uid 1 and 7 to the first
public registrants, and a deleted USSO row is recreated on the next login. Each
owner entry is therefore pinned to the account row that existed when the entry
was written: the row must exist and its creation time (local_users.created_at,
users.first_login for USSO) must be no later than the entry's cutoff. A restore
or migration that keeps uid and creation time keeps the owner; anything that
recreates the row (new store, delete then re-register, re-created USSO row)
does not. Re-pinning an owner after such an event is a reviewed code change.

is_site_owner() stays separate from 会馆 roles. Since 2026-10-27, is_admin() (used by the
main-site admin endpoints) also accepts an active 会馆 admin (local_users.role / user_flags).
"""
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from storage_paths import data_root, huiguan_data_dir


# The site owner's accounts: (kind, uid) -> latest acceptable creation time of that account row.
# Add entries here; never compare a bare uid. The cutoff is the moment the entry was added, so
# an account created afterwards under the same uid can never match.
_ADDED_2026_10_27 = "2026-10-27T17:22:20+08:00"   # c79b4df; earlier entries were already live
SITE_OWNER_ACCOUNTS = {
    ("usso", "7"): _ADDED_2026_10_27, ("local", "7"): _ADDED_2026_10_27,   # iridescent 站长
    ("usso", "1"): _ADDED_2026_10_27, ("local", "1"): _ADDED_2026_10_27,   # 摆烂人生（USSO 主账号）
}


def _parse_time(value):
    """Aware datetime from a stored ISO timestamp; None when missing, naive or malformed."""
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.strip())
    except ValueError:
        return None
    return parsed if parsed.tzinfo is not None else None


def _users_db(project_root=None):
    root = Path(project_root) if project_root is not None else data_root()
    return huiguan_data_dir(root) / "users.db"


def account_usable(kind, uid, project_root=None, created_not_after=None):
    """True when the account exists and is not disabled; read-only.

    With created_not_after, the account row must also carry a creation time no later than it,
    so a row recreated under the same uid (fresh store, re-registration, re-login) is rejected.
    """
    cutoff = _parse_time(created_not_after) if created_not_after is not None else None
    if created_not_after is not None and cutoff is None:
        return False
    database = _users_db(project_root)
    if not database.exists():
        return False
    try:
        conn = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True, timeout=5)
    except sqlite3.Error:
        return False
    try:
        if kind == "local":
            column = "created_at" if cutoff else "NULL"
            row = conn.execute(
                f"SELECT status, {column} FROM local_users WHERE CAST(uid AS TEXT)=?", (uid,)
            ).fetchone()
            if not row or row[0] != "active":
                return False
            return cutoff is None or _created_in_time(row[1], cutoff)
        if kind == "usso":
            # USSO accounts are created on first login; only an explicit ban disables them.
            try:
                flag = conn.execute("SELECT status FROM user_flags WHERE kind='usso' AND uid=?", (uid,)).fetchone()
            except sqlite3.OperationalError:
                flag = None
            if flag and flag[0] == "banned":
                return False
            if cutoff is None:
                return True
            row = conn.execute("SELECT first_login FROM users WHERE user_id=?", (uid,)).fetchone()
            return bool(row) and _created_in_time(row[0], cutoff)
        return False
    except sqlite3.Error:
        return False
    finally:
        conn.close()


def _created_in_time(value, cutoff):
    created = _parse_time(value)
    return created is not None and created <= cutoff


def is_site_owner(token_payload, project_root=None):
    """Decide main-site admin from a verified hx_sso payload."""
    if not isinstance(token_payload, dict):
        return False
    kind, uid = token_payload.get("kind"), str(token_payload.get("uid") or "")
    if not isinstance(kind, str):
        return False
    cutoff = SITE_OWNER_ACCOUNTS.get((kind, uid))
    if cutoff is None:
        return False
    return account_usable(kind, uid, project_root, created_not_after=cutoff)


def is_huiguan_admin(kind, uid, project_root=None):
    """会馆角色为 admin（local_users.role 或 user_flags.role）的账号也算管理员。"""
    database = _users_db(project_root)
    if not database.exists():
        return False
    try:
        conn = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True, timeout=5)
    except sqlite3.Error:
        return False
    try:
        if kind == "local":
            row = conn.execute(
                "SELECT role FROM local_users WHERE CAST(uid AS TEXT)=? AND status='active'", (uid,)
            ).fetchone()
            if row and str(row[0]).lower() == "admin":
                return True
        try:
            row = conn.execute(
                "SELECT role FROM user_flags WHERE kind=? AND CAST(uid AS TEXT)=?", (kind, uid)
            ).fetchone()
            if row and str(row[0]).lower() == "admin":
                return True
        except sqlite3.OperationalError:
            pass
        return False
    finally:
        conn.close()


def is_admin(kind, uid, project_root=None):
    """站长，或会馆管理员，都视为管理员。

    is_site_owner 接受的是已验签的 hx_sso payload（dict），不是 (kind, uid)；
    这里按同样语义构造最小 payload 再判断，避免签名字段错位。
    """
    payload = {"kind": kind, "uid": str(uid)}
    try:
        if is_site_owner(payload, project_root):
            return True
    except TypeError:
        try:
            if is_site_owner(payload):
                return True
        except Exception:
            pass
    except Exception:
        pass
    return is_huiguan_admin(kind, uid, project_root)
