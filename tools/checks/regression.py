"""Run regression modules in separate processes with disposable external storage."""
import argparse
import ast
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "services" / "platform"))
from storage_paths import initialize_storage


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--full", action="store_true", help="also run frontend, type, HTTP and mock-browser checks")
    parser.add_argument("--report", type=Path)
    parser.add_argument("--modules", type=Path, help="built modules candidate for the all-roots portal routing check")
    args = parser.parse_args()
    results = []
    with tempfile.TemporaryDirectory(prefix="iridescently-batch6-checks-") as temporary:
        env = {k: v for k, v in os.environ.items() if not k.startswith("IRIDESCENTLY_")}
        env.update(IRIDESCENTLY_STORAGE_ROOT=temporary, IRIDESCENTLY_ENVIRONMENT="test",
                   IRIDESCENTLY_PROJECT_ROOT=str(ROOT), PYTHONUTF8="1", PYTHONDONTWRITEBYTECODE="1",
                   HX_SSO_SECRET="batch6-disposable-test-secret", USSO_CLIENT_SECRET="mock-secret", ZSZM_CLIENT_SECRET="mock-secret")
        os.environ.update({k: v for k, v in env.items() if k.startswith("IRIDESCENTLY_")})
        for name in ("DATA", "ASSETS", "CACHE", "RELEASE", "BACKUP"):
            os.environ.pop(f"IRIDESCENTLY_{name}_ROOT", None)
        initialize_storage()

        def run(name, command, extra=None):
            print(f"\n[{name}]", flush=True)
            started = time.monotonic()
            result = subprocess.run(command, cwd=ROOT, env={**env, **(extra or {})})
            results.append({"check": name, "passed": result.returncode == 0,
                            "seconds": round(time.monotonic() - started, 2)})

        # Separate processes avoid modules leaking import caches/environment fixtures.
        for directory in (ROOT / "services/platform/tests", ROOT / "apps/huiguan/tests", ROOT / "apps/cards/tests"):
            for file in sorted(directory.glob("test_*.py")):
                run(str(file.relative_to(ROOT)), [sys.executable, "-X", "utf8", str(file)])
        node = shutil.which("node")
        run("release boundary and hash contracts", [node, "tools/release/test-release-artifacts.mjs"])
        publisher_check = ROOT / "tools/release/test-publish-release.mjs"
        if publisher_check.exists():
            run("immutable seal and rollback", [node, str(publisher_check)])
        if args.full:
            npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
            commands = [
                ("Cards frontend", [npm, "test", "--prefix", "apps/cards"]),
                ("Cards backend", [npm, "run", "test:backend", "--prefix", "apps/cards"]),
                ("Cards game types", [npm, "run", "check:game", "--prefix", "apps/cards"]),
                ("World Map", [npm, "run", "check:world-map"]),
            ]
            for module in ("management", "ecology", "softie"):
                commands.append((module, [npm, "test", "--prefix", "apps/" + module]))
            commands.extend([
                ("OAuth return allowlist", [npm, "run", "test:huiguan-auth-next"]),
                ("OAuth mock browser", [npm, "run", "test:oauth-mock"]),
            ])
            for name, command in commands:
                run(name, command)
            if args.modules:
                modules = str(args.modules.resolve(strict=True))
                run("Built modules contain no unreviewed own-domain URLs",
                    [sys.executable, "-X", "utf8", "tools/domains/check-domain-hardcodes.py", modules])
                run("Portal routing on every approved root", [sys.executable, "-X", "utf8", "services/platform/tests/verify_portal.py"],
                    {"IRIDESCENTLY_MODULES_ROOT": modules})
            else:
                results.append({"check": "Portal routing on every approved root", "passed": False, "seconds": 0,
                                "skipped": "pass --modules with a built modules candidate"})
        # Parse all changed/untracked Python without putting pyc files in source.
        changed = subprocess.check_output(["git", "diff", "--name-only", "HEAD"], cwd=ROOT).decode().splitlines()
        changed += subprocess.check_output(["git", "ls-files", "--others", "--exclude-standard"], cwd=ROOT).decode().splitlines()
        for relative in changed:
            file = ROOT / relative
            if file.suffix == ".py" and file.is_file():
                ast.parse(file.read_text(encoding="utf-8-sig"), filename=relative)
        report = {"source_head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT).decode().strip(),
                  "checks": results, "passed": all(item["passed"] for item in results)}
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2), flush=True)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
