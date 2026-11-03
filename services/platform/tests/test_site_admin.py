"""Main-site admin is a complete (kind, uid) site-owner account, verified server-side.

Run from the project root: python -m unittest server.test_site_admin
Uses a temporary data root and a test-only SSO secret; the real users.db is never opened.
"""
import importlib.util
import json
import os
import sqlite3
import shutil
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TEMP = tempfile.TemporaryDirectory(prefix="site-admin-", ignore_cleanup_errors=True)
sys.path.insert(0, str(ROOT / "services" / "platform"))
from testing_storage import configure
from storage_paths import assets_root
DATA = configure(TEMP.name)
(DATA / "huiguan").mkdir(parents=True, exist_ok=True)
(DATA / "homepage" / "config").mkdir(parents=True, exist_ok=True)
os.environ["IRIDESCENTLY_PROJECT_ROOT"] = str(ROOT)
os.environ["HX_SSO_SECRET"] = "test-only-site-admin-secret"

conn = sqlite3.connect(DATA / "huiguan" / "users.db")
conn.executescript("""
CREATE TABLE local_users (uid INTEGER PRIMARY KEY, username TEXT, role TEXT, status TEXT, created_at TEXT);
CREATE TABLE users (user_id TEXT PRIMARY KEY, nickname TEXT, first_login TEXT);
CREATE TABLE user_flags (kind TEXT, uid TEXT, status TEXT, role TEXT, PRIMARY KEY (kind, uid));
INSERT INTO local_users VALUES (1, 'bailan', 'executor', 'active', '2025-03-01T10:00:00+08:00'),
                               (7, 'iridescent', 'admin', 'active', '2025-03-02T10:00:00+08:00'),
                               (8, 'eight', 'executor', 'active', '2025-03-03T10:00:00+08:00'),
                               (218, 'other-admin', 'admin', 'active', '2026-01-01T10:00:00+08:00'),
                               (9, 'banned-seven', 'admin', 'banned', '2025-03-04T10:00:00+08:00');
INSERT INTO users VALUES ('1', 'bailan', '2025-02-01T10:00:00+08:00'), ('7', 'iridescent', '2025-02-02T10:00:00+08:00'),
                         ('9', 'nine', '2025-02-03T10:00:00+08:00');
INSERT INTO user_flags VALUES ('usso', '1', 'active', 'admin');
""")
conn.commit()
conn.close()

sys.path.insert(0, str(ROOT / "services" / "platform"))
import hx_sso  # noqa: E402
import site_admin  # noqa: E402

spec = importlib.util.spec_from_file_location("portal_www_under_test", ROOT / "apps" / "www" / "server.py")
www = importlib.util.module_from_spec(spec)
spec.loader.exec_module(www)


def token(kind, uid):
    return hx_sso.make_token(uid, kind, "tester")


class Server:
    def __enter__(self):
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), www.Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"
        return self

    def __exit__(self, *exc):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def request(self, path, cookie=None, body=None):
        headers = {"Content-Type": "application/json"}
        if cookie:
            headers["Cookie"] = f"{hx_sso.COOKIE_NAME}={cookie}"
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(self.base + path, data=data, headers=headers,
                                         method="POST" if data is not None else "GET")
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)


class SiteOwnerTest(unittest.TestCase):
    def test_owner_accounts_stay_admin(self):
        # Existing practice: the owner edits the main site with either account.
        self.assertTrue(site_admin.is_site_owner({"kind": "usso", "uid": "7"}))
        self.assertTrue(site_admin.is_site_owner({"kind": "local", "uid": "7"}))

    def test_bare_uid_and_untrusted_kinds_are_rejected(self):
        for payload in ({"uid": "7"}, {"kind": "admin", "uid": "7"}, {"kind": "admin", "uid": "1"},
                        {"kind": "LOCAL", "uid": "7"}, {"kind": "local", "uid": "07"}, {"kind": "usso", "uid": ""},
                        None, "7"):
            self.assertFalse(site_admin.is_site_owner(payload), payload)

    def test_other_huiguan_admins_do_not_gain_main_site_rights(self):
        # 站长名单只有 usso/local 的 uid 7（iridescent）与 uid 1（摆烂人生）。
        # 其他会馆管理员不因会馆角色获得主站管理权。
        self.assertFalse(site_admin.is_site_owner({"kind": "local", "uid": "218"}))
        self.assertFalse(site_admin.is_site_owner({"kind": "local", "uid": "8"}))
        self.assertFalse(site_admin.is_site_owner({"kind": "usso", "uid": "9"}))

    def test_disabled_owner_account_loses_admin(self):
        db = DATA / "huiguan" / "users.db"
        conn = sqlite3.connect(db)
        try:
            conn.execute("UPDATE local_users SET status='banned' WHERE uid=7")
            conn.execute("INSERT INTO user_flags VALUES ('usso', '7', 'banned', 'executor')")
            conn.commit()
            self.assertFalse(site_admin.is_site_owner({"kind": "local", "uid": "7"}))
            self.assertFalse(site_admin.is_site_owner({"kind": "usso", "uid": "7"}))
        finally:
            conn.execute("UPDATE local_users SET status='active' WHERE uid=7")
            conn.execute("DELETE FROM user_flags WHERE kind='usso' AND uid='7'")
            conn.commit()
            conn.close()

    def test_owner_survives_restore_that_keeps_rows(self):
        # A backup restore / migration copies uid and creation time unchanged: owner rights stay.
        with tempfile.TemporaryDirectory() as restored:
            target = Path(restored) / "huiguan"
            target.mkdir()
            shutil.copy(DATA / "huiguan" / "users.db", target / "users.db")
            for kind, uid in (("local", "7"), ("usso", "7"), ("local", "1"), ("usso", "1")):
                self.assertTrue(site_admin.is_site_owner({"kind": kind, "uid": uid}, restored), (kind, uid))

    def test_missing_account_store_denies(self):
        with tempfile.TemporaryDirectory() as empty:
            self.assertFalse(site_admin.is_site_owner({"kind": "local", "uid": "7"}, empty))


# The live schema from apps/huiguan/server_huiguan.py (init_db), without unrelated columns.
LIVE_SCHEMA = """
CREATE TABLE users (user_id TEXT PRIMARY KEY, nickname TEXT, email TEXT, picture TEXT,
                    first_login TEXT, last_login TEXT);
CREATE TABLE local_users (uid INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL COLLATE NOCASE,
                          pass_hash TEXT NOT NULL, nickname TEXT DEFAULT '', email TEXT DEFAULT '',
                          picture TEXT DEFAULT '', role TEXT DEFAULT 'user', status TEXT DEFAULT 'active',
                          created_at TEXT, last_login TEXT);
CREATE TABLE user_flags (kind TEXT NOT NULL, uid TEXT NOT NULL, status TEXT DEFAULT 'active',
                         role TEXT DEFAULT 'user', PRIMARY KEY (kind, uid));
"""


def _now():
    # Same format as server_huiguan.now_iso().
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


class UidReuseTest(unittest.TestCase):
    """M10: a uid that matches an owner entry is not enough; the account row must be the pinned one."""

    def store(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        (Path(directory.name) / "huiguan").mkdir()
        conn = sqlite3.connect(Path(directory.name) / "huiguan" / "users.db")
        conn.executescript(LIVE_SCHEMA)
        conn.commit()
        return directory.name, conn

    def register_local(self, conn, username):
        # The INSERT used by /api/register and /api/local/register.
        cur = conn.execute(
            "INSERT INTO local_users (username, pass_hash, nickname, role, status, created_at, last_login)"
            " VALUES (?,?,?,?,?,?,?)", (username, "x", "", "executor", "active", _now(), _now()))
        conn.commit()
        return str(cur.lastrowid)

    def test_first_registrants_of_a_fresh_store_are_not_owners(self):
        root, conn = self.store()
        uids = [self.register_local(conn, f"stranger{n}") for n in range(1, 9)]
        conn.close()
        self.assertIn("1", uids)
        self.assertIn("7", uids)
        self.assertFalse(site_admin.is_site_owner({"kind": "local", "uid": "1"}, root))
        self.assertFalse(site_admin.is_site_owner({"kind": "local", "uid": "7"}, root))
        self.assertFalse(site_admin.is_admin("local", "1", root))
        self.assertFalse(site_admin.is_admin("local", "7", root))

    def test_owner_name_does_not_help_a_new_registrant(self):
        root, conn = self.store()
        uid = self.register_local(conn, "iridescent")
        conn.close()
        self.assertEqual(uid, "1")
        self.assertFalse(site_admin.is_site_owner({"kind": "local", "uid": uid}, root))

    def test_deleted_owner_cannot_be_reused(self):
        # AUTOINCREMENT never hands a deleted uid out again; a deleted owner simply stops matching.
        root, conn = self.store()
        conn.execute("INSERT INTO local_users (uid, username, pass_hash, status, created_at)"
                     " VALUES (7, 'iridescent', 'x', 'active', '2025-03-02T10:00:00+08:00')")
        conn.commit()
        self.assertTrue(site_admin.is_site_owner({"kind": "local", "uid": "7"}, root))
        conn.execute("DELETE FROM local_users WHERE uid=7")
        conn.commit()
        new_uid = self.register_local(conn, "someone-else")
        conn.close()
        self.assertNotEqual(new_uid, "7")
        self.assertFalse(site_admin.is_site_owner({"kind": "local", "uid": "7"}, root))
        self.assertFalse(site_admin.is_site_owner({"kind": "local", "uid": new_uid}, root))

    def test_recreated_usso_row_is_not_owner(self):
        # Deleting a USSO account removes its users row and ban flag; the next login recreates it.
        root, conn = self.store()
        conn.execute("INSERT INTO users (user_id, nickname, first_login) VALUES ('7', 'new', ?)", (_now(),))
        conn.commit()
        conn.close()
        self.assertFalse(site_admin.is_site_owner({"kind": "usso", "uid": "7"}, root))

    def test_usso_owner_without_account_row_is_denied(self):
        root, conn = self.store()
        conn.close()
        self.assertFalse(site_admin.is_site_owner({"kind": "usso", "uid": "7"}, root))
        self.assertFalse(site_admin.is_site_owner({"kind": "usso", "uid": "1"}, root))

    def test_unusable_creation_time_is_denied(self):
        root, conn = self.store()
        for uid, created in ((1, None), (7, "")):
            conn.execute("INSERT INTO local_users (uid, username, pass_hash, status, created_at)"
                         " VALUES (?, ?, 'x', 'active', ?)", (uid, f"u{uid}", created))
        conn.execute("INSERT INTO users (user_id, first_login) VALUES ('1', 'not-a-date')")
        conn.execute("INSERT INTO users (user_id, first_login) VALUES ('7', '2025-02-02T10:00:00')")  # no offset
        conn.commit()
        conn.close()
        for kind, uid in (("local", "1"), ("local", "7"), ("usso", "1"), ("usso", "7")):
            self.assertFalse(site_admin.is_site_owner({"kind": kind, "uid": uid}, root), (kind, uid))

    def test_unhashable_kind_is_rejected(self):
        self.assertFalse(site_admin.is_site_owner({"kind": ["local"], "uid": "7"}))


class EndpointTest(unittest.TestCase):
    def test_sso_user_reports_admin_from_server_check(self):
        with Server() as server:
            # Since 2026-10-27 (live on HK) usso/local 1 are owner accounts too, and an active
            # 会馆 admin also counts as a main-site admin.
            for kind, uid, expected in (("usso", "7", True), ("local", "7", True), ("local", "218", True),
                                        ("usso", "1", True), ("admin", "7", False)):
                status, body = server.request("/api/sso-user", token(kind, uid))
                self.assertEqual(status, 200)
                self.assertEqual(body["admin"], expected, (kind, uid))

    def test_admin_write_endpoint_gates_on_owner(self):
        invalid = {"items": "not-a-list"}  # passes the gate only if admin, then fails validation
        with Server() as server:
            self.assertEqual(server.request("/api/admin/links", token("local", "7"), invalid)[0], 400)
            self.assertEqual(server.request("/api/admin/links", token("usso", "7"), invalid)[0], 400)
            for kind, uid in (("local", "218"), ("usso", "1")):
                self.assertEqual(server.request("/api/admin/links", token(kind, uid), invalid)[0], 400, (kind, uid))
            for kind, uid in (("admin", "7"), ("local", "8")):
                self.assertEqual(server.request("/api/admin/links", token(kind, uid), invalid)[0], 403, (kind, uid))
            self.assertEqual(server.request("/api/admin/links", None, invalid)[0], 403)
            forged = token("local", "8").rsplit(".", 1)[0] + "." + "0" * 64
            self.assertEqual(server.request("/api/admin/links", forged, invalid)[0], 403)


if __name__ == "__main__":
    unittest.main()
