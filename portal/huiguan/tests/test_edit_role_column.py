"""A brand-new users.db gets the edit_role column (default 'none'), matching the production schema."""

import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
INIT_TWICE = "import sys; sys.path.insert(0, sys.argv[1]); sys.path.insert(0, str(__import__('pathlib').Path(sys.argv[1]).parents[1] / 'server')); from storage_paths import initialize_storage; initialize_storage(); import server_huiguan as s; s.init_user_db(); s.init_user_db(); print(s.USER_DB)"


class EditRoleColumnTest(unittest.TestCase):
    def test_fresh_db_has_edit_role_and_init_is_repeatable(self):
        root = tempfile.mkdtemp(prefix="edit-role-")
        try:
            (Path(root) / "portal" / "huiguan").mkdir(parents=True)
            env = {**os.environ, "IRIDESCENTLY_STORAGE_ROOT": root, "IRIDESCENTLY_ENVIRONMENT": "test", "PYTHONIOENCODING": "utf-8"}
            for key in ("DATA", "ASSETS", "CACHE", "RELEASE", "BACKUP", "PROJECT"):
                env.pop(f"IRIDESCENTLY_{key}_ROOT", None)
            out = subprocess.run([sys.executable, "-c", INIT_TWICE, str(HERE)], env=env, capture_output=True, text=True, check=True)
            db_path = out.stdout.strip().splitlines()[-1]
            self.assertTrue(db_path.startswith(root), db_path)
            conn = sqlite3.connect(db_path)
            try:
                for table in ("local_users", "user_flags"):
                    cols = {r[1]: r[4] for r in conn.execute(f"PRAGMA table_info({table})")}
                    self.assertEqual(cols.get("edit_role"), "'none'", table)
                conn.execute("INSERT INTO local_users (username, pass_hash) VALUES ('fresh', 'x')")
                self.assertEqual(conn.execute("SELECT edit_role FROM local_users WHERE username='fresh'").fetchone()[0], "none")
            finally:
                conn.close()
        finally:
            shutil.rmtree(root, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
