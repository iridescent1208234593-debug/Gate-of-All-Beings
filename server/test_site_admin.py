"""Main-site admin is a complete (kind, uid) site-owner account, verified server-side.

Run from the project root: python -m unittest server.test_site_admin
Uses a temporary data root and a test-only SSO secret; the real users.db is never opened.
"""
import importlib.util
import json
import os
import sqlite3
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMP = tempfile.TemporaryDirectory(prefix="site-admin-", ignore_cleanup_errors=True)
sys.path.insert(0, str(ROOT / "server"))
from testing_storage import configure
from storage_paths import assets_root
DATA = configure(TEMP.name)
(DATA / "huiguan").mkdir(parents=True, exist_ok=True)
(DATA / "homepage" / "config").mkdir(parents=True, exist_ok=True)
os.environ["IRIDESCENTLY_PROJECT_ROOT"] = str(ROOT)
os.environ["HX_SSO_SECRET"] = "test-only-site-admin-secret"

conn = sqlite3.connect(DATA / "huiguan" / "users.db")
conn.executescript("""
CREATE TABLE local_users (uid INTEGER PRIMARY KEY, username TEXT, role TEXT, status TEXT);
CREATE TABLE user_flags (kind TEXT, uid TEXT, status TEXT, role TEXT, PRIMARY KEY (kind, uid));
INSERT INTO local_users VALUES (7, 'iridescent', 'admin', 'active'), (8, 'eight', 'executor', 'active'),
                               (218, 'other-admin', 'admin', 'active'), (9, 'banned-seven', 'admin', 'banned');
INSERT INTO user_flags VALUES ('usso', '1', 'active', 'admin');
""")
conn.commit()
conn.close()

sys.path.insert(0, str(ROOT / "server"))
import hx_sso  # noqa: E402
import site_admin  # noqa: E402

spec = importlib.util.spec_from_file_location("portal_www_under_test", ROOT / "portal" / "www" / "server.py")
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
        self.assertFalse(site_admin.is_site_owner({"kind": "local", "uid": "218"}))
        self.assertFalse(site_admin.is_site_owner({"kind": "usso", "uid": "1"}))
        self.assertFalse(site_admin.is_site_owner({"kind": "local", "uid": "8"}))

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

    def test_missing_account_store_denies(self):
        with tempfile.TemporaryDirectory() as empty:
            self.assertFalse(site_admin.is_site_owner({"kind": "local", "uid": "7"}, empty))


class EndpointTest(unittest.TestCase):
    def test_sso_user_reports_admin_from_server_check(self):
        with Server() as server:
            for kind, uid, expected in (("usso", "7", True), ("local", "7", True), ("local", "218", False),
                                        ("usso", "1", False), ("admin", "7", False)):
                status, body = server.request("/api/sso-user", token(kind, uid))
                self.assertEqual(status, 200)
                self.assertEqual(body["admin"], expected, (kind, uid))

    def test_admin_write_endpoint_gates_on_owner(self):
        invalid = {"items": "not-a-list"}  # passes the gate only if admin, then fails validation
        with Server() as server:
            self.assertEqual(server.request("/api/admin/links", token("local", "7"), invalid)[0], 400)
            self.assertEqual(server.request("/api/admin/links", token("usso", "7"), invalid)[0], 400)
            for kind, uid in (("local", "218"), ("usso", "1"), ("admin", "7"), ("local", "8")):
                self.assertEqual(server.request("/api/admin/links", token(kind, uid), invalid)[0], 403, (kind, uid))
            self.assertEqual(server.request("/api/admin/links", None, invalid)[0], 403)
            forged = token("local", "8").rsplit(".", 1)[0] + "." + "0" * 64
            self.assertEqual(server.request("/api/admin/links", forged, invalid)[0], 403)


if __name__ == "__main__":
    unittest.main()
