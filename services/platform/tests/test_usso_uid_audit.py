"""Offline snapshot audit tests. Every identifier and database is synthetic."""

from contextlib import closing
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest


TOOL = Path(__file__).resolve().parents[3] / "tools" / "checks" / "audit-usso-uids.py"


class AuditUssoUidsTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.snapshot = self.root / "offline with spaces.db"
        self.rule = self.root / "contract.json"
        self.rule.write_text(json.dumps({
            "field": "id", "value_type": "integer", "pattern": "[0-9]{1,10}",
        }), encoding="utf-8")
        with closing(sqlite3.connect(self.snapshot)) as conn, conn:
            conn.executescript("""
                CREATE TABLE users (user_id TEXT PRIMARY KEY);
                CREATE TABLE sessions_db (kind TEXT, uid TEXT);
                CREATE TABLE user_flags (kind TEXT, uid TEXT);
            """)
            conn.executemany("INSERT INTO users VALUES (?)", [("7",), ("19",), ("007",), ("legacy name",), ("",)])
            conn.executemany("INSERT INTO sessions_db VALUES (?,?)", [
                ("usso", "007"), ("usso", "111"), ("local", "legacy name"),
            ])
            conn.executemany("INSERT INTO user_flags VALUES (?,?)", [
                ("usso", "legacy name"), ("local", "009"),
            ])

    def audit(self):
        return subprocess.run(
            [sys.executable, "-B", "-X", "utf8", str(TOOL), str(self.snapshot), str(self.rule)],
            capture_output=True, encoding="utf-8", timeout=10,
        )

    def test_counts_only_and_keeps_snapshot_bytes(self):
        before = self.snapshot.read_bytes()
        files = set(self.root.iterdir())
        result = self.audit()
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["accounts"], {"total": 5, "invalid_format": 3})
        self.assertEqual(report["references"]["sessions_db"], {
            "total": 2, "invalid_format": 1, "without_account_row": 1,
        })
        self.assertEqual(report["references"]["user_flags"], {
            "total": 1, "invalid_format": 1, "without_account_row": 0,
        })
        self.assertIsNone(report["references"]["oc_owners"])
        for value in ("007", "legacy name", "111"):
            self.assertNotIn(value, result.stdout + result.stderr)
        self.assertEqual(self.snapshot.read_bytes(), before)
        self.assertEqual(set(self.root.iterdir()), files)

    def test_counts_save_and_oc_references_in_an_actual_sqlite_backup(self):
        backup = self.root / "copied snapshot.db"
        with closing(sqlite3.connect(self.snapshot)) as source, source:
            source.executescript("""
                CREATE TABLE game_saves (kind TEXT, uid TEXT);
                CREATE TABLE oc_owners (owner_kind TEXT, owner_uid TEXT);
            """)
            source.executemany("INSERT INTO game_saves VALUES (?,?)", [
                ("usso", "7"), ("usso", "007"), ("usso", "171"), ("local", "171"),
            ])
            source.executemany("INSERT INTO oc_owners VALUES (?,?)", [
                ("usso", "19"), ("usso", "legacy name"), ("usso", "721"), ("local", "legacy name"),
            ])
        with closing(sqlite3.connect(self.snapshot)) as source, closing(sqlite3.connect(backup)) as destination:
            source.backup(destination)
        original = self.snapshot.read_bytes()
        self.snapshot = backup
        before = backup.read_bytes()
        result = self.audit()
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        for table in ("game_saves", "oc_owners"):
            self.assertEqual(report["references"][table], {
                "total": 3, "invalid_format": 1, "without_account_row": 1,
            })
        self.assertEqual(backup.read_bytes(), before)
        self.assertEqual((self.root / "offline with spaces.db").read_bytes(), original)

    def test_audit_applies_the_supplied_contract_without_normalizing_keys(self):
        before = self.snapshot.read_bytes()
        integer = self.audit()
        self.assertEqual(integer.returncode, 0, integer.stderr)
        self.rule.write_text(
            '{"field":"sub","value_type":"string","pattern":"[0-9]{1,10}"}', encoding="utf-8",
        )
        string = self.audit()
        self.assertEqual(string.returncode, 0, string.stderr)
        self.assertEqual(json.loads(integer.stdout)["accounts"], {"total": 5, "invalid_format": 3})
        self.assertEqual(json.loads(string.stdout)["accounts"], {"total": 5, "invalid_format": 2})
        self.assertEqual(json.loads(string.stdout)["references"]["sessions_db"], {
            "total": 2, "invalid_format": 0, "without_account_row": 1,
        })
        self.assertEqual(self.snapshot.read_bytes(), before)

    def test_refuses_backup_with_sidecar(self):
        for suffix in ("-wal", "-shm", "-journal"):
            with self.subTest(suffix=suffix):
                sidecar = Path(str(self.snapshot) + suffix)
                sidecar.write_bytes(b"test-only sidecar")
                try:
                    result = self.audit()
                    self.assertEqual(result.returncode, 1)
                    self.assertEqual(result.stdout, "")
                    self.assertIn("备份旁不能有日志文件", result.stderr)
                finally:
                    sidecar.unlink()

    def test_refuses_invalid_contract_or_snapshot(self):
        self.rule.write_text("{}", encoding="utf-8")
        result = self.audit()
        self.assertEqual(result.returncode, 1)
        self.assertIn("规则文件格式无效", result.stderr)
        self.rule.write_text('{"field":"id","value_type":"string","pattern":"[0-9]+"}', encoding="utf-8")
        self.snapshot.write_bytes(b"test fixture without the required schema")
        result = self.audit()
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, "")
        self.assertIn("无法读取完整的离线账号备份", result.stderr)


if __name__ == "__main__":
    unittest.main()
