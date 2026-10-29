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
SITE_OWNER_ACCOUNTS = frozenset({
    ("usso", "7"), ("local", "7"),          # iridescent 站长
    ("usso", "1"), ("local", "1"),          # 摆烂人生（USSO 主账号）
})


def _users_db(project_root=None):
    root = Path(project_root) if project_root is not None else data_root()
    return huiguan_data_dir(root) / "users.db"


def _account_state(kind, uid, project_root=None):
    """返回 'absent' / 'active' / 'disabled' / 'nostore'，用于区分「查不到行」与「被停用」。"""
    database = _users_db(project_root)
    if not database.exists():
        return "nostore"
    try:
        conn = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True, timeout=5)
    except sqlite3.Error:
        return "nostore"
    try:
        if kind == "local":
            row = conn.execute(
                "SELECT status FROM local_users WHERE CAST(uid AS TEXT)=?", (uid,)
            ).fetchone()
            if not row:
                return "absent"
            return "active" if row[0] == "active" else "disabled"
        if kind == "usso":
            try:
                flag = conn.execute(
                    "SELECT status FROM user_flags WHERE kind='usso' AND uid=?", (uid,)
                ).fetchone()
            except sqlite3.OperationalError:
                flag = None
            return "disabled" if (flag and flag[0] == "banned") else "active"
        return "absent"
    except sqlite3.Error:
        return "nostore"
    finally:
        conn.close()


def account_usable(kind, uid, project_root=None):
    """True when the account exists and is not disabled; read-only."""
    return _account_state(kind, uid, project_root) == "active"


def is_site_owner(token_payload, project_root=None):
    """Decide main-site admin from a verified hx_sso payload."""
    if not isinstance(token_payload, dict):
        return False
    kind, uid = token_payload.get("kind"), str(token_payload.get("uid") or "")
    if (kind, uid) not in SITE_OWNER_ACCOUNTS:
        return False
    state = _account_state(kind, uid, project_root)
    # 账户库整体缺失 → 拒绝（无法确认账号状态）。
    # 库存在但缺该行 → 站长名单内、且 cookie 已验签的身份仍视为站长；
    # 存在但被停用 → 拒绝。
    if state == "nostore":
        return False
    return state in ("active", "absent")


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
    """只认站长名单：会馆管理员不因会馆角色获得主站管理权。

    原图查看等需要放宽的场景请用 is_original_viewer 另行判断。
    is_site_owner 接受已验签的 hx_sso payload（dict），不是 (kind, uid)。
    """
    payload = {"kind": kind, "uid": str(uid)}
    try:
        return bool(is_site_owner(payload, project_root))
    except TypeError:
        try:
            return bool(is_site_owner(payload))
        except Exception:
            return False
    except Exception:
        return False


def is_original_viewer(kind, uid, project_root=None):
    """原图可见性：站长，或会馆管理员。"""
    if is_admin(kind, uid, project_root):
        return True
    try:
        return bool(is_huiguan_admin(kind, uid, project_root))
    except Exception:
        return False
