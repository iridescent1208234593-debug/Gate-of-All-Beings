import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path
import sqlite3
import subprocess
import sys
import json

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # services/platform
from asset_registry import AssetRegistry


class AssetRegistryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "assets"
        self.root.mkdir()
        self.db = Path(self.temp.name) / "data" / "registry.sqlite3"
        (self.root / "portrait.png").write_bytes(b"test image bytes")
        self.registry = AssetRegistry(self.db, {"managed": self.root})

    def tearDown(self):
        self.temp.cleanup()

    def test_register_hash_metadata_and_reference(self):
        record = self.registry.register_file(
            self.root / "portrait.png", module="huiguan", asset_type="avatar", storage_class="managed",
            source="user upload", author="account:demo", license="user-owned",
            content_id="character-1", access_scope="private",
        )
        self.assertEqual(record["storage_key"], "portrait.png")
        self.assertEqual(record["size_bytes"], len(b"test image bytes"))
        self.assertEqual(len(record["sha256"]), 64)
        self.assertEqual(record["version"], 1)
        with self.assertRaises(PermissionError):
            self.registry.resolve_path(record["asset_id"])
        self.assertEqual(self.registry.resolve_path(record["asset_id"], authorize=lambda _: True).name, "portrait.png")
        self.registry.add_reference(record["asset_id"], "character", "character-1")
        self.assertEqual(self.registry.list_references(record["asset_id"])[0]["reference_id"], "character-1")

    def test_new_version_keeps_history_and_current_is_latest(self):
        first = self.registry.register_file(self.root / "portrait.png", module="huiguan", asset_type="avatar", storage_class="managed")
        (self.root / "portrait.png").write_bytes(b"updated bytes")
        latest = self.registry.register_file(self.root / "portrait.png", module="huiguan", asset_type="avatar", storage_class="managed",
                                             asset_id=first["asset_id"])
        self.assertEqual(latest["version"], 2)
        self.assertNotEqual(first["sha256"], latest["sha256"])

    def test_outside_files_are_rejected(self):
        outside = Path(self.temp.name) / "outside.bin"
        outside.write_bytes(b"no")
        with self.assertRaises(ValueError):
            self.registry.register_file(outside, module="test", asset_type="blob", storage_class="managed")

    def test_import_is_resumable_and_preserves_versions(self):
        original = self.registry.import_tree("managed", module="huiguan", source="user upload")
        repeated = self.registry.import_tree("managed", module="huiguan", source="user upload")
        self.assertEqual(original, repeated)
        (self.root / "portrait.png").write_bytes(b"updated bytes")
        changed = self.registry.import_tree("managed", module="huiguan", source="user upload")[0]
        self.assertEqual(changed["asset_id"], original[0]["asset_id"])
        self.assertEqual(changed["version"], 2)
        self.assertEqual(self.registry.get_record(changed["asset_id"], 1), original[0])

    def test_tampered_storage_key_cannot_escape_root(self):
        record = self.registry.import_tree("managed", module="huiguan")[0]
        outside = Path(self.temp.name) / "outside.bin"
        outside.write_bytes(b"no")
        with closing(sqlite3.connect(self.db)) as db, db:
            db.execute("UPDATE asset_versions SET storage_key='../outside.bin', access_scope='public'")
        with self.assertRaises(ValueError):
            self.registry.resolve_path(record["asset_id"])

    def test_concurrent_imports_are_idempotent(self):
        def run(_):
            return self.registry.import_tree("managed", module="huiguan")[0]
        with ThreadPoolExecutor(max_workers=4) as executor:
            records = list(executor.map(run, range(8)))
        self.assertTrue(all(record["version"] == 1 for record in records))
        self.assertEqual(len({record["asset_id"] for record in records}), 1)

    def test_preview_requires_known_original_and_explicit_authorization(self):
        original = self.registry.import_tree("managed", module="huiguan")[0]
        with self.assertRaises(KeyError):
            self.registry.register_file(self.root / "portrait.png", module="huiguan", asset_type="preview",
                                        storage_class="managed", preview_of="unknown")
        preview = self.registry.register_file(self.root / "portrait.png", module="huiguan", asset_type="preview",
                                              storage_class="managed", preview_of=original["asset_id"],
                                              access_scope="unlisted")
        with self.assertRaises(PermissionError):
            self.registry.resolve_path(preview["asset_id"], authorize=lambda _: False)
        self.assertEqual(preview["preview_of"], original["asset_id"])

    def test_cli_import_writes_verifiable_manifest_and_closes_database(self):
        manifest = Path(self.temp.name) / "manifest.json"
        result = subprocess.run([
            sys.executable, str(Path(__file__).resolve().parents[1] / "asset_registry.py"), "import", str(self.root),
            "--database", str(self.db), "--module", "huiguan", "--manifest", str(manifest),
        ], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(manifest.read_text(encoding="utf-8"))
        self.assertEqual(data["fileCount"], 1)
        self.assertEqual(data["assets"][0]["access_scope"], "private")
        # This rename fails on Windows if a SQLite connection is still open.
        renamed = self.db.with_suffix(".renamed")
        self.db.rename(renamed)
        renamed.rename(self.db)


if __name__ == "__main__":
    unittest.main()
