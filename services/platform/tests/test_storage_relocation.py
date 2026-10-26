"""Relocating migrated storage keeps every byte, rewrites absolute records and stays restorable."""
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

TOOLS = Path(__file__).resolve().parents[3] / "tools/runtime"


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, TOOLS / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


migration = load("storage_migrate", "storage-migrate.py")
relocation = load("relocate_storage", "relocate-storage.py")


class RelocationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.source = self.root / "source"
        subprocess.run(["git", "init", "--quiet", str(self.source)], check=True)
        self.env = patch.dict(os.environ, {"IRIDESCENTLY_STORAGE_ROOT": str(self.root / "old"),
                                          "IRIDESCENTLY_ENVIRONMENT": "test"})
        self.env.start()
        self.addCleanup(self.env.stop)
        for name in ("DATA", "ASSETS", "CACHE", "RELEASE", "BACKUP"):
            os.environ.pop(f"IRIDESCENTLY_{name}_ROOT", None)
        database = self.source / "portal/huiguan/users.db"
        database.parent.mkdir(parents=True)
        with sqlite3.connect(database) as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("CREATE TABLE accounts (id INTEGER PRIMARY KEY, value TEXT)")
            db.execute("INSERT INTO accounts VALUES (1, 'committed account')")
        db.close()
        upload = self.source / "portal/huiguan/assets/uploads/original.bin"
        upload.parent.mkdir(parents=True)
        upload.write_bytes(b"private original upload")
        self.manifest_path = storage_paths.backup_root() / "migration/manifest.json"
        manifest = migration.plan(self.source)
        migration.apply(manifest, self.manifest_path)
        migration.detach(manifest, self.manifest_path)

    def test_relocation_rewrites_records_and_keeps_history(self):
        target = self.root / "new"
        self.assertEqual(relocation.plan(target)["running_services"], [])
        result = relocation.apply(target)
        self.assertEqual(result["method"], "rename")
        self.assertFalse((self.root / "old/test").exists())
        self.assertEqual(Path(os.environ["IRIDESCENTLY_STORAGE_ROOT"]), target)
        marker = storage_paths.require_ready("huiguan")
        self.assertEqual(marker["roots"], {k: str(v) for k, v in storage_paths.storage_layout().items()})
        self.assertEqual(marker["legacy_asset_roots"], [str(self.source / "assets")])
        self.assertEqual(len(marker["relocations"]), 1)
        manifest = json.loads(Path(marker["manifest"]).read_text(encoding="utf-8"))
        self.assertTrue(Path(marker["manifest"]).is_relative_to(target))
        self.assertEqual(manifest["source"], str(self.source))
        recovered = [entry["recovery"] for entry in manifest["files"] if entry.get("recovery")]
        self.assertTrue(recovered and all(Path(item).is_relative_to(target) and Path(item).is_file() for item in recovered))
        # The migration contract still holds against the relocated records, including restore.
        self.assertTrue(migration.verify(manifest, check_source=False))
        migration.restore_source(manifest)
        self.assertEqual((self.source / "portal/huiguan/assets/uploads/original.bin").read_bytes(), b"private original upload")
        before = Path(marker["manifest"]).parent.parent / "relocations"
        self.assertTrue(any(before.rglob("marker.before.json")))

    def test_refuses_existing_target_overrides_and_overlap(self):
        (self.root / "new/test").mkdir(parents=True)
        with self.assertRaises(FileExistsError):
            relocation.apply(self.root / "new")
        with self.assertRaises(ValueError):
            relocation.apply(self.root / "old/test/nested")
        with patch.dict(os.environ, {"IRIDESCENTLY_CACHE_ROOT": str(self.root / "cache")}):
            with self.assertRaises(ValueError):
                relocation.apply(self.root / "elsewhere")
        storage_paths.require_ready("huiguan")  # nothing moved

    def test_unready_storage_is_not_moved(self):
        (storage_paths.data_root() / storage_paths.MARKER).unlink()
        with self.assertRaises(RuntimeError):
            relocation.apply(self.root / "new")
        self.assertTrue((self.root / "old/test/data/huiguan/users.db").is_file())


if __name__ == "__main__":
    unittest.main()
