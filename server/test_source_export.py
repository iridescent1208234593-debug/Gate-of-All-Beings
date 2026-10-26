"""Committed source exports exclude runtime data and use external releases."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class SourceExportTests(unittest.TestCase):
    def test_export_is_commit_based_and_excludes_runtime_and_secrets(self):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            source = base / "source"
            source.mkdir()
            files = {
                "server/app.py": "print('committed')\n",
                "portal/page.html": "<p>committed</p>",
                "packages/example.js": "export default 1;",
                "server/users.db": "private database",
                "server/registry.sqlite3": "private registry",
                "portal/.env": "SECRET=private",
                "portal/huiguan/assets/uploads/private.png": "private original",
                "portal/huiguan/characters.json": "private characters",
            }
            for name, content in files.items():
                target = source / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(content, encoding="utf-8")
            def git(*args):
                return subprocess.run(["git", *args], cwd=source, check=True, capture_output=True)
            git("init")
            git("add", ".")
            git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "fixture")
            (source / "server/app.py").write_text("print('uncommitted')\n", encoding="utf-8")
            environment = {key: value for key, value in os.environ.items() if not key.startswith("IRIDESCENTLY_")}
            environment.update(IRIDESCENTLY_PROJECT_ROOT=str(source), IRIDESCENTLY_ENVIRONMENT="test",
                               IRIDESCENTLY_STORAGE_ROOT=str(base / "storage"), PYTHONDONTWRITEBYTECODE="1")
            exporter = Path(__file__).resolve().parents[1] / "scripts" / "build-site.py"
            result = subprocess.run([sys.executable, str(exporter)], cwd=source, env=environment,
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            candidates = list((base / "storage").rglob("candidate/site"))
            self.assertEqual(len(candidates), 1)
            target = candidates[0]
            self.assertEqual((target / "server/app.py").read_text(), "print('committed')\n")
            self.assertEqual(sorted(path.relative_to(target).as_posix() for path in target.rglob("*") if path.is_file()),
                             ["packages/example.js", "portal/page.html", "server/app.py"])
            self.assertFalse((source / ".releases").exists())


if __name__ == "__main__":
    unittest.main()
