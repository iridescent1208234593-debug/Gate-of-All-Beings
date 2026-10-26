"""Cloud saves are owned by (kind, uid, scope); legacy bare-uid JSON is imported once.

Runs against a temporary project root: IRIDESCENTLY_PROJECT_ROOT is set before the
会馆 module is imported, so the real portal/huiguan/users.db is never opened.
"""
import hashlib
import importlib
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

ROOT = Path(__file__).resolve().parents[3]
TEMP = tempfile.TemporaryDirectory(prefix="game-save-scope-", ignore_cleanup_errors=True)
sys.path.insert(0, str(ROOT / "services" / "platform"))
from testing_storage import configure
from storage_paths import assets_root
DATA = configure(TEMP.name)
RUNTIME = DATA / "huiguan"
RUNTIME.mkdir(parents=True, exist_ok=True)

LEGACY = {
    # Collides: local uid 7 and USSO uid 7 both exist; userName matches the local username.
    "7": {"savedAt": "2026-10-02T22:33:57+01:00", "userName": "iridescent", "state": {"management": "local-7"}},
    # Only a local account owns 181.
    "181": {"savedAt": "2026-10-03T14:34:16+01:00", "userName": "WYH", "state": {"management": "local-181"},
            "games": {"softie": {"savedAt": "2026-10-03T14:35:00+01:00", "state": {"skin": "bud"}}}},
    # Collides with no usable name evidence.
    "9": {"savedAt": "2026-10-01T10:00:00+01:00", "userName": "", "state": {"management": "unknown"}},
    # No account at all.
    "404": {"savedAt": "2026-10-01T10:00:00+01:00", "userName": "x", "state": {"management": "orphan"}},
}
os.environ["IRIDESCENTLY_PROJECT_ROOT"] = str(ROOT)
sys.path.insert(0, str(ROOT / "services" / "platform"))
sys.path.insert(0, str(ROOT))
# 会馆模块在 import 期就会执行 init_user_db()（见 server_huiguan.py 模块尾部），
# 且 USER_DB 在 import 时从环境变量解析。若同进程的其他测试（字母序更前的
# test_gallery_interactions）已用它自己的临时根目录导入过该模块，模块缓存会让
# 下面的 import 拿到旧实例，建表落进别人的临时目录。弹出缓存强制重导入。
sys.modules.pop("portal.huiguan.server_huiguan", None)
# Importing the 会馆 module creates the real schema in the empty temporary users.db.
huiguan = importlib.import_module("portal.huiguan.server_huiguan")
import game_saves  # noqa: E402  (same module instance the server uses)

conn = sqlite3.connect(RUNTIME / "users.db")
conn.executescript("""
INSERT INTO local_users (uid, username, nickname, pass_hash, status) VALUES
    (7, 'iridescent', '', 'x', 'active'), (9, 'nine', '', 'x', 'active'), (181, 'WYH', '', 'x', 'active');
INSERT INTO users (user_id, nickname) VALUES ('7', '佳霖'), ('9', '怀夕');
""")
(RUNTIME / "game_saves.json").write_text(json.dumps(LEGACY), encoding="utf-8")
# Same entry point init_user_db() uses at start-up.
game_saves.import_legacy(conn, RUNTIME / "game_saves.json")
conn.commit()
conn.close()


def legacy_sha():
    return hashlib.sha256((RUNTIME / "game_saves.json").read_bytes()).hexdigest()


class Server:
    def __init__(self, ident):
        identity = dict(ident)

        class Handler(huiguan.Handler):
            def _require_ident(self):
                return dict(identity)

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *exc):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def load(self, scope=None):
        path = "/api/game/load" + (f"?scope={scope}" if scope else "")
        try:
            with urllib.request.urlopen(self.base + path) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)

    def save(self, state, scope=None):
        path = "/api/game/save" + (f"?scope={scope}" if scope else "")
        request = urllib.request.Request(self.base + path, data=json.dumps({"state": state}).encode(),
                                         headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(request) as response:
            return response.status, json.load(response)


LOCAL_7 = {"kind": "local", "uid": "7", "nickname": "", "username": "iridescent"}
USSO_7 = {"kind": "usso", "uid": "7", "nickname": "佳霖"}


class LegacyImportTest(unittest.TestCase):
    def db(self):
        return sqlite3.connect(RUNTIME / "users.db")

    def test_import_resolves_owners_and_quarantines_unknowns(self):
        rows = dict(((key, scope), (kind, reason)) for key, scope, kind, reason in self.db().execute(
            "SELECT legacy_key, scope, resolved_kind, resolution FROM game_save_legacy"))
        self.assertEqual(rows[("7", "management")], ("local", "collision-resolved-by-local-name"))
        self.assertEqual(rows[("181", "management")], ("local", "only-local-account"))
        self.assertEqual(rows[("181", "softie")], ("local", "only-local-account"))
        self.assertEqual(rows[("9", "management")], (None, "ambiguous-collision"))
        self.assertEqual(rows[("404", "management")], (None, "no-matching-account"))
        owners = set(self.db().execute("SELECT kind, uid, scope FROM game_saves WHERE origin='legacy-json'"))
        self.assertEqual(owners, {("local", "7", "management"), ("local", "181", "management"),
                                  ("local", "181", "softie")})

    def test_legacy_file_is_never_written_and_import_is_idempotent(self):
        before = legacy_sha()
        with Server(LOCAL_7) as server:
            server.save({"management": "new"})
        self.assertEqual(legacy_sha(), before)
        conn = self.db()
        result = game_saves.import_legacy(conn, RUNTIME / "game_saves.json")
        self.assertEqual(result["status"], "already-imported")
        self.assertEqual(conn.execute("SELECT COUNT(*) FROM game_save_migrations").fetchone()[0], 1)


class OwnershipTest(unittest.TestCase):
    def test_same_number_different_kind_never_share_a_save(self):
        with Server(USSO_7) as usso:
            status, _ = usso.load()
            self.assertEqual(status, 404, "USSO 7 must not see local 7's legacy save")
            usso.save({"management": "usso-7"})
        with Server(LOCAL_7) as local:
            status, body = local.load()
            self.assertEqual(status, 200)
            self.assertNotEqual(body["state"], {"management": "usso-7"})
        with Server(USSO_7) as usso:
            self.assertEqual(usso.load()[1]["state"], {"management": "usso-7"})

    def test_quarantined_records_are_served_to_nobody(self):
        for ident in ({"kind": "local", "uid": "9"}, {"kind": "usso", "uid": "9"}, {"kind": "local", "uid": "404"}):
            with Server(ident) as server:
                self.assertEqual(server.load()[0], 404, ident)

    def test_scopes_are_independent(self):
        ident = {"kind": "local", "uid": "500", "nickname": "灵主"}
        with Server(ident) as server:
            server.save({"management": "kept"})
            status, _ = server.load("softie")
            self.assertEqual(status, 404, "softie must not fall back to the management save")
            server.save({"skin": "bud", "size": 1.2}, "softie")
            self.assertEqual(server.load("softie")[1]["state"], {"skin": "bud", "size": 1.2})
            self.assertEqual(server.load()[1]["state"], {"management": "kept"})

    def test_unknown_scope_is_rejected(self):
        with Server({"kind": "local", "uid": "500"}) as server:
            self.assertEqual(server.load("cards")[0], 400)

    def test_softie_cors_preflight_still_allowed(self):
        with Server({"kind": "local", "uid": "500"}) as server:
            request = urllib.request.Request(f"{server.base}/api/game/save?scope=softie", method="OPTIONS",
                headers={"Origin": "http://127.0.0.1:4173", "Access-Control-Request-Method": "POST"})
            with urllib.request.urlopen(request) as response:
                self.assertEqual(response.headers["Access-Control-Allow-Origin"], "http://127.0.0.1:4173")


class RollbackExportTest(unittest.TestCase):
    def test_export_rebuilds_legacy_shape_and_reports_kind_conflicts(self):
        conn = sqlite3.connect(":memory:")
        game_saves.init_schema(conn)
        game_saves.put_save(conn, "local", "7", "management", {"v": "local"}, "iridescent", "2026-10-10T00:00:00+00:00")
        game_saves.put_save(conn, "usso", "7", "management", {"v": "usso"}, "佳霖", "2026-10-11T00:00:00+00:00")
        game_saves.put_save(conn, "local", "8", "softie", {"skin": "x"}, "eight", "2026-10-09T00:00:00+00:00")
        data, conflicts = game_saves.export_legacy(conn)
        self.assertEqual(data["7"]["state"], {"v": "usso"})
        self.assertEqual(conflicts, [{"uid": "7", "scope": "management", "kinds": ["local", "usso"], "kept": "usso"}])
        self.assertEqual(data["8"]["games"]["softie"]["state"], {"skin": "x"})

    def test_reimport_after_rollback_keeps_newer_account_saves(self):
        conn = sqlite3.connect(":memory:")
        conn.executescript("""CREATE TABLE local_users (uid INTEGER PRIMARY KEY, username TEXT, nickname TEXT);
            CREATE TABLE users (user_id TEXT PRIMARY KEY, nickname TEXT);
            INSERT INTO local_users VALUES (3, 'three', '');""")
        game_saves.init_schema(conn)
        game_saves.put_save(conn, "local", "3", "management", {"v": "new"}, "three", "2026-10-20T00:00:00+00:00")
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "game_saves.json"
            path.write_text(json.dumps({"3": {"savedAt": "2026-10-19T00:00:00+08:00", "state": {"v": "old"}}}))
            self.assertEqual(game_saves.import_legacy(conn, path)["kept-newer"], 1)
            self.assertEqual(game_saves.get_save(conn, "local", "3", "management")["state"], {"v": "new"})
            path.write_text(json.dumps({"3": {"savedAt": "2026-10-21T00:00:00+00:00", "state": {"v": "rolled-back"}}}))
            self.assertEqual(game_saves.import_legacy(conn, path)["imported"], 1)
            self.assertEqual(game_saves.get_save(conn, "local", "3", "management")["state"], {"v": "rolled-back"})

    def test_invalid_owner_is_rejected(self):
        conn = sqlite3.connect(":memory:")
        game_saves.init_schema(conn)
        for kind, uid in (("admin", "7"), ("local", ""), (None, "7")):
            with self.assertRaises(ValueError):
                game_saves.put_save(conn, kind, uid, "management", {"v": 1})


if __name__ == "__main__":
    try:
        unittest.main()
    finally:
        TEMP.cleanup()
