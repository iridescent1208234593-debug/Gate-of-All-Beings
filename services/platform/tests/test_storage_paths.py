import json
import os
from pathlib import Path
import subprocess
import shutil
import tempfile
import unittest
from unittest.mock import patch
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # services/platform
import storage_paths as paths
NODE = shutil.which("node")
SYSTEM_ENV = {k: v for k, v in os.environ.items() if k.upper() in {
    "SYSTEMROOT", "WINDIR", "PATH", "PATHEXT", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "COMSPEC"}}


class StoragePathsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.env = {**SYSTEM_ENV, "IRIDESCENTLY_STORAGE_ROOT": self.temp.name, "IRIDESCENTLY_ENVIRONMENT": "test"}
        self.patch = patch.dict(os.environ, self.env, clear=True)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def test_environment_isolation_and_no_source_fallback(self):
        layout = paths.storage_layout()
        self.assertEqual(layout["data"], Path(self.temp.name) / "test/data")
        self.assertEqual(paths.huiguan_data_dir(), layout["data"] / "huiguan")
        self.assertEqual(paths.cards_data_dir(), layout["data"] / "cards")
        self.assertEqual(paths.juling_data_dir(), layout["data"] / "juling")
        self.assertEqual(paths.homepage_data_dir(), layout["data"] / "homepage")
        self.assertEqual(paths.managed_asset_dir("huiguan", "uploads"), layout["assets"] / "managed/huiguan/uploads")
        self.assertEqual(paths.source_asset_dir("worldview", "images"), layout["assets"] / "source/worldview/images")
        self.assertEqual(paths.cache_dir("huiguan", "previews"), layout["cache"] / "huiguan/previews")
        for mode in ("production", "staging", "development"):
            with patch.dict(os.environ, {"IRIDESCENTLY_ENVIRONMENT": mode}):
                self.assertNotEqual(paths.data_root(), layout["data"])
                with self.assertRaises(RuntimeError):
                    paths.require_ready()

    def test_fail_closed_marker_and_environment_binding(self):
        with self.assertRaises(RuntimeError):
            paths.require_ready()
        paths.initialize_storage()
        self.assertEqual(paths.require_ready("huiguan")["state"], "ready")
        with patch.dict(os.environ, {"IRIDESCENTLY_DATA_ROOT": str(Path(self.temp.name) / "changed")}):
            with self.assertRaises(RuntimeError):
                paths.require_ready()
        with patch.dict(os.environ, {"IRIDESCENTLY_ENVIRONMENT": "production"}):
            with self.assertRaises(ValueError):
                paths.initialize_storage()

    def test_rejects_source_overlap_relative_and_cross_environment_markers(self):
        for variable, value in (("IRIDESCENTLY_DATA_ROOT", str(paths.project_root() / "data")),
                                ("IRIDESCENTLY_STORAGE_ROOT", "."),
                                ("IRIDESCENTLY_CACHE_ROOT", str(paths.data_root() / "cache"))):
            with self.subTest(variable=variable), patch.dict(os.environ, {variable: value}):
                with self.assertRaises(ValueError):
                    paths.storage_layout()
        with patch.dict(os.environ, {"IRIDESCENTLY_STORAGE_ROOT": ""}):
            with self.assertRaises(ValueError):
                paths.storage_layout()
        paths.initialize_storage()
        marker = paths.data_root() / paths.MARKER
        obj = json.loads(marker.read_text())
        obj["environment"] = "production"
        marker.write_text(json.dumps(obj))
        with self.assertRaises(RuntimeError):
            paths.require_ready()

    def test_python_node_paths_readiness_and_traversal_parity(self):
        paths.initialize_storage()
        helper = Path(paths.__file__).with_name("runtime-paths.cjs")
        code = "const p=require(process.argv[1]);p.requireReady('huiguan');console.log(JSON.stringify(p.layout));"
        result = subprocess.run([NODE, "-e", code, str(helper)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), {k: str(v) for k, v in paths.storage_layout().items()})
        for part in ("../private", "..\\private", "/absolute", "C:relative", "C:\\absolute", "", ".", "a//b", "a/../b"):
            with self.subTest(part=part):
                with self.assertRaises(ValueError):
                    paths.cache_dir(part)
                result = subprocess.run([NODE, "-e", "require(process.argv[1]).dataPath(process.argv[2])", str(helper), part], capture_output=True)
                self.assertNotEqual(result.returncode, 0)

    def test_immutable_code_can_live_in_release_store(self):
        site = paths.release_root() / "store/version/site"
        with patch.dict(os.environ, {"IRIDESCENTLY_PROJECT_ROOT": str(site)}):
            self.assertEqual(paths.storage_layout()["releases"], Path(self.temp.name) / "test/releases")


if __name__ == "__main__":
    unittest.main()
