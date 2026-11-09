"""Backups and the local launcher only touch disposable storage and refuse unverifiable input."""
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from testing_storage import configure
import storage_paths

ROOT = Path(__file__).resolve().parents[3]
RUNTIME_TOOLS = ROOT / "tools" / "runtime"


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, RUNTIME_TOOLS / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class StorageBackup(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="backup-tool-")
        self.addCleanup(self.temp.cleanup)
        self.env = patch.dict(os.environ)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.data = configure(self.temp.name)
        self.backup = load("backup_storage", "backup-storage.py")
        database = self.data / "huiguan/users.db"
        with sqlite3.connect(database) as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT)")
            db.execute("INSERT INTO accounts VALUES (1, 'fixture')")
        db.close()
        upload = storage_paths.managed_asset_dir("huiguan", "uploads") / "original.bin"
        upload.parent.mkdir(parents=True)
        upload.write_bytes(b"fixture original")
        (storage_paths.cache_dir("huiguan", "thumbs")).mkdir(parents=True)
        (storage_paths.cache_dir("huiguan", "thumbs") / "derived.webp").write_bytes(b"derived")

    def test_snapshot_holds_data_and_originals_but_not_cache(self):
        directory, record = self.backup.snapshot()
        self.assertTrue(directory.is_relative_to(storage_paths.backup_root()))
        self.assertIn("data/huiguan/users.db", record["files"])
        self.assertIn("assets/managed/huiguan/uploads/original.bin", record["files"])
        self.assertFalse(any(name.startswith("cache/") for name in record["files"]))
        with sqlite3.connect((directory / "data/huiguan/users.db").as_uri() + "?mode=ro", uri=True) as db:
            self.assertEqual(db.execute("SELECT name FROM accounts").fetchall(), [("fixture",)])
        db.close()
        self.assertTrue(self.backup.verify(directory)["complete"])
        (directory / "assets/managed/huiguan/uploads/original.bin").write_bytes(b"tampered")
        with self.assertRaises(RuntimeError):
            self.backup.verify(directory)

    def test_snapshot_refuses_unready_storage(self):
        (self.data / storage_paths.MARKER).unlink()
        with self.assertRaises(RuntimeError):
            self.backup.snapshot()
        self.assertFalse((storage_paths.backup_root() / "snapshots").exists())


class LocalRuntime(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="local-runtime-")
        self.addCleanup(self.temp.cleanup)
        self.env = patch.dict(os.environ)
        self.env.start()
        self.addCleanup(self.env.stop)
        self.data = configure(self.temp.name)
        self.runtime = load("local_runtime", "local-runtime.py")
        self.channels = storage_paths.release_root() / "channels"
        self.channels.mkdir(parents=True)

    def channel(self, **values):
        record = {"schema": 1, "environment": "test", "current": "20261025T000000000Z-0123456789ab-0123456789ab",
                  "site": "store/20261025T000000000Z-0123456789ab-0123456789ab/site", "sourceHead": "0" * 40,
                  "manifestSha256": "0" * 64, **values}
        (self.channels / "test.json").write_text(json.dumps(record), encoding="utf-8")

    def test_launch_requires_ready_storage_and_a_verified_release(self):
        (self.data / storage_paths.MARKER).unlink()
        with self.assertRaises(RuntimeError):
            self.runtime.launch_plan()
        storage_paths.initialize_storage()
        with self.assertRaises(OSError):
            self.runtime.launch_plan()
        for values in ({"current": "../../outside"}, {"environment": "production"},
                       {"site": "../outside/site"}):
            with self.subTest(values=values):
                self.channel(**values)
                with self.assertRaises(ValueError):
                    self.runtime.selected_release()
        self.channel()
        with self.assertRaises(subprocess.CalledProcessError):
            # The release named by the channel does not exist, so hash verification fails.
            self.runtime.selected_release()

    def test_a_sealed_release_is_selected_and_tampering_is_refused(self):
        seal = """
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const { candidateRoot, recordCandidate } = await import('./tools/release/release-artifacts.mjs');
const { sealRelease } = await import('./tools/release/publish-release.mjs');
for (const [name, file] of [['site', 'services/platform/portal_server.py'], ['modules', 'cards/index.html'], ['homepage', 'index.html']]) {
  mkdirSync(path.dirname(path.join(candidateRoot, name, file)), { recursive: true });
  writeFileSync(path.join(candidateRoot, name, file), name);
  await recordCandidate(name, { buildCommand: 'fixture' });
}
console.log(JSON.stringify(await sealRelease({ allowDirty: true })));
"""
        result = subprocess.run(["node", "--input-type=module", "-e", seal], cwd=ROOT,
                                capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(result.returncode, 0, result.stderr)
        channel = json.loads(result.stdout.strip().splitlines()[-1])
        site, selected = self.runtime.selected_release()
        self.assertEqual(selected["current"], channel["current"])
        self.assertEqual(site, (storage_paths.release_root() / channel["site"]).resolve())
        self.assertTrue(site.is_relative_to(storage_paths.release_root()))
        (site / "services/platform/portal_server.py").write_text("tampered", encoding="utf-8")
        with self.assertRaises(subprocess.CalledProcessError):
            self.runtime.selected_release()

    def test_secret_files_cannot_override_storage_selection(self):
        secrets = self.data / "secrets/server.env"
        secrets.write_text("# comment\nHX_SSO_SECRET='fixture'\nIRIDESCENTLY_STORAGE_ROOT=C:/elsewhere\n"
                           "lower=x\nIRIDESCENTLY_ENVIRONMENT=production\n", encoding="utf-8")
        self.assertEqual(self.runtime._secrets(secrets), {"HX_SSO_SECRET": "fixture"})

    def test_process_bookkeeping_is_cache_not_persistent_data(self):
        self.assertTrue(self.runtime._state_file().is_relative_to(storage_paths.cache_root()))
        self.assertEqual(self.runtime.stop(), {"stopped": True})
        self.assertFalse(any(self.data.rglob("local-runtime.json")))

    def test_port_validation_and_status_use_saved_port(self):
        for port in (0, 65536, 5174, 5178, 5177, 4173):
            with self.subTest(port=port), self.assertRaises(ValueError):
                self.runtime.start(port)
        self.runtime._save({"portal_port": 18080, "services": {}})
        plan = {"release": "test", "sourceHead": "test", "site": "test", "services": {}}
        with patch.object(self.runtime, "launch_plan", return_value=plan) as launch:
            self.runtime.status()
            launch.assert_called_once_with(18080)
        self.runtime._save({"services": {}})
        with patch.object(self.runtime, "launch_plan", return_value=plan) as launch:
            self.runtime.status()
            launch.assert_called_once_with(8080)

    def test_smoke_port_preserves_old_defaults(self):
        smoke_path = ROOT / "tools/checks/local-smoke.py"
        import importlib.util
        spec = importlib.util.spec_from_file_location("local_smoke", smoke_path)
        smoke = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(smoke)
        state = Path(self.temp.name) / "state.json"
        self.assertEqual(smoke.select_port(None, None), 8080)
        state.write_text('{"services": {}}', encoding="utf-8")
        self.assertEqual(smoke.select_port(None, state), 8080)
        state.write_text('{"portal_port": 18080}', encoding="utf-8")
        self.assertEqual(smoke.select_port(None, state), 18080)
        self.assertEqual(smoke.select_port(19090, state), 19090)


if __name__ == "__main__":
    unittest.main()
