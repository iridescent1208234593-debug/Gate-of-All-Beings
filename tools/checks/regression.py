"""Run regression modules in separate processes with disposable external storage."""
import argparse
import ast
import json
import os
from pathlib import Path
import shutil
import shlex
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "services" / "platform"))
from storage_paths import initialize_storage


def run_check(results, name, command, *, cwd=ROOT, env=None):
    """Run one check and append a JSON-safe result without exposing its environment."""
    command = [str(part) for part in command]
    command_text = shlex.join(command)
    print(f"\n[{name}]", flush=True)
    print(f"  command: {command_text}", flush=True)
    print(f"  cwd: {Path(cwd).resolve()}", flush=True)
    started = time.monotonic()

    def elapsed():
        return round(time.monotonic() - started, 2)

    try:
        result = subprocess.run(command, cwd=cwd, env=env)
    except Exception as error:
        # A missing executable is a failed check, not a batch-level crash.
        results.append({"check": name, "passed": False, "status": "failed",
                        "seconds": elapsed(), "command": command,
                        "command_text": command_text,
                        "cwd": str(Path(cwd).resolve()),
                        "error": f"{type(error).__name__}: {error}",
                        "diagnostic": "检查工具或其依赖未安装；请先完成 CI/工作区依赖安装"})
        print(f"  result: FAIL ({type(error).__name__}: {error})", flush=True)
        return
    passed = result.returncode == 0
    item = {"check": name, "passed": passed, "status": "passed" if passed else "failed",
            "seconds": elapsed()}
    if not passed:
        item["command"] = command
        item["command_text"] = command_text
        item["cwd"] = str(Path(cwd).resolve())
        item["exit_code"] = result.returncode
        item["diagnostic"] = "检查进程已退出；查看上方同名模块的子进程输出，并可复制 command 重跑"
        print(f"  result: FAIL (exit code {result.returncode})", flush=True)
    else:
        print("  result: PASS", flush=True)
    results.append(item)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--full", action="store_true", help="also run frontend, type, HTTP and mock-browser checks")
    parser.add_argument("--report", type=Path,
                        help="write the machine-readable JSON summary to this file")
    parser.add_argument("--modules", type=Path, help="built modules candidate for the all-roots portal routing check")
    args = parser.parse_args()
    modules = None
    if args.modules:
        try:
            modules = args.modules.resolve(strict=True)
        except FileNotFoundError:
            parser.error(f"--modules path does not exist: {args.modules}")
        if not modules.is_dir():
            parser.error(f"--modules path is not a directory: {modules}")
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
            run_check(results, name, command, cwd=ROOT, env={**env, **(extra or {})})

        # The sealed-runtime test bundles Cards and Softie services with their own dependencies;
        # without them it fails with an esbuild resolve error that hides the real cause.
        missing = [p for p in ("node_modules", "apps/cards/node_modules", "apps/softie/node_modules", "apps/activation-core/node_modules")
                   if not (ROOT / p).is_dir()]
        if missing:
            print("\n[dependencies] missing: " + ", ".join(missing) + " -> install each (npm ci; pnpm install for activation-core; see docs/workspace.md)", flush=True)
            results.append({"check": "dependencies installed (" + ", ".join(missing) + ")",
                            "passed": False, "status": "failed", "seconds": 0,
                            "error": "missing: " + ", ".join(missing)})

        # Separate processes avoid modules leaking import caches/environment fixtures.
        for directory in (ROOT / "services/platform/tests", ROOT / "apps/huiguan/tests", ROOT / "apps/cards/tests"):
            for file in sorted(directory.glob("test_*.py")):
                run(str(file.relative_to(ROOT)), [sys.executable, "-X", "utf8", str(file)])
        node = shutil.which("node") or "node"
        run("release boundary and hash contracts", [node, "tools/release/test-release-artifacts.mjs"])
        publisher_check = ROOT / "tools/release/test-publish-release.mjs"
        if publisher_check.exists():
            run("immutable seal and rollback", [node, str(publisher_check)])
        run("Bilibili Toy package safety", [node, "--test", "tools/toy/test-toy-bundle.mjs"])
        # activation-core (pnpm install required): its `test` script runs the tsx suites and the
        # route/credential suites from the app directory, where its tsconfig path aliases resolve.
        npm_name = "npm.cmd" if os.name == "nt" else "npm"
        npm = shutil.which(npm_name) or npm_name
        run("activation-core", [npm, "test", "--prefix", "apps/activation-core"])
        if args.full:
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
                ("Gallery attribute escaping browser", [npm, "run", "test:huiguan-gallery-escape"]),
                ("Official gallery search and pagination browser", [node, "--test", "apps/huiguan/tests/official-gallery-browser.cjs"]),
            ])
            for name, command in commands:
                run(name, command)
            if modules:
                modules = str(modules)
                run("Built modules contain no unreviewed own-domain URLs",
                    [sys.executable, "-X", "utf8", "tools/domains/check-domain-hardcodes.py", modules])
                run("Portal routing on every approved root", [sys.executable, "-X", "utf8", "services/platform/tests/verify_portal.py"],
                    {"IRIDESCENTLY_MODULES_ROOT": modules})
            else:
                results.append({"check": "Portal routing on every approved root", "passed": False,
                                "status": "skipped", "seconds": 0,
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
