"""Exercise WAL snapshots, tamper rejection and reversible source detachment."""
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # services/platform
import storage_paths

SPEC = importlib.util.spec_from_file_location("storage_migrate", Path(__file__).resolve().parents[3] / "tools/runtime/storage-migrate.py")
migration = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(migration)


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        subprocess.run(["git", "init", "--quiet", str(self.source)], check=True)
        self.env = patch.dict(os.environ, {"IRIDESCENTLY_STORAGE_ROOT": str(self.root / "storage"),
                                          "IRIDESCENTLY_ENVIRONMENT": "test"})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.db = self.source / "portal/huiguan/users.db"
        self.db.parent.mkdir(parents=True)
        self.connection = sqlite3.connect(self.db)
        self.addCleanup(self.connection.close)
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("CREATE TABLE accounts (id INTEGER PRIMARY KEY, value TEXT)")
        self.connection.execute("INSERT INTO accounts VALUES (1,'WAL-only committed account')")
        self.connection.commit()
        self.upload = self.source / "portal/huiguan/assets/uploads/original.bin"
        self.upload.parent.mkdir(parents=True)
        self.upload.write_bytes(b"private original upload")
        self.manifest = migration.plan(self.source)
        self.path = storage_paths.backup_root() / "rehearsal/manifest.json"

    def test_wal_backup_is_logically_identical_and_resumable(self):
        migration.apply(self.manifest, self.path)
        target = storage_paths.data_root() / "huiguan/users.db"
        self.assertEqual(migration.sqlite_evidence(target), migration.sqlite_evidence(self.db))
        self.assertTrue(migration.verify(self.manifest))
        migration.apply(self.manifest, self.path)
        storage_paths.require_ready("huiguan")
        target.unlink()
        with self.assertRaises(RuntimeError):
            storage_paths.require_ready()

    def test_source_or_target_change_prevents_silent_replacement(self):
        self.upload.write_bytes(b"later edit")
        with self.assertRaises(RuntimeError):
            migration.apply(self.manifest, self.path)
        self.assertFalse((storage_paths.data_root() / storage_paths.MARKER).exists())

    def test_detach_and_restore_preserve_originals(self):
        self.connection.close()
        migration.apply(self.manifest, self.path)
        migration.detach(self.manifest, self.path)
        self.assertFalse(self.db.exists())
        self.assertFalse(self.upload.exists())
        self.assertTrue(migration.verify(self.manifest, check_source=False))
        migration.restore_source(self.manifest)
        self.assertEqual(self.upload.read_bytes(), b"private original upload")
        self.assertEqual(migration.sqlite_evidence(self.db)["tables"], {"accounts": 1})
        self.upload.write_bytes(b"new data after rollback")
        with self.assertRaises(FileExistsError):
            migration.restore_source(self.manifest)

    def test_interrupted_detach_resumes_from_recorded_progress(self):
        self.connection.close()
        migration.apply(self.manifest, self.path)
        record = migration.write_json
        writes = []

        def interrupt_after_first_move(path, value):
            record(path, value)
            writes.append(path)
            if len(writes) == 1:
                raise KeyboardInterrupt

        with patch.object(migration, "write_json", interrupt_after_first_move):
            with self.assertRaises(KeyboardInterrupt):
                migration.detach(self.manifest, self.path)
        resumed = json.loads(self.path.read_text(encoding="utf-8"))
        self.assertEqual(sum(bool(entry.get("recovery")) for entry in resumed["files"]), 1)
        migration.detach(resumed, self.path)
        resumed = json.loads(self.path.read_text(encoding="utf-8"))
        self.assertTrue(resumed["source_detached"])
        self.assertFalse(self.db.exists() or self.upload.exists())
        self.assertTrue(migration.verify(resumed))
        migration.restore_source(resumed)
        self.assertEqual(self.upload.read_bytes(), b"private original upload")

    def test_destination_tamper_blocks_detachment(self):
        migration.apply(self.manifest, self.path)
        (storage_paths.assets_root() / "managed/huiguan/uploads/original.bin").write_bytes(b"tampered")
        with self.assertRaises(RuntimeError):
            migration.detach(self.manifest, self.path)
        self.assertTrue(self.upload.exists())


if __name__ == "__main__":
    unittest.main()
