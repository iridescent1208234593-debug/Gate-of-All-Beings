"""Run the LAB Godot client tests headless (issue #232).

Every `apps/huiguan-lab/client/tests/*.gd` that `extends SceneTree` is a test; other scripts there
are helpers preloaded by tests. The project is imported once first so a clean checkout has its
`.godot/imported` resources. Godot does not always exit non-zero on a GDScript error, so a test
also fails when its output reports one.

    python tools/checks/lab-godot-client.py --godot /path/to/Godot_v4.7.2-stable
    GODOT=/path/to/godot python tools/checks/lab-godot-client.py
"""
import argparse
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
CLIENT = ROOT / "apps" / "huiguan-lab" / "client"
ERROR_MARKERS = ("SCRIPT ERROR", "Parse Error", "Failed to load script")


def tests() -> list[Path]:
    found = []
    for path in sorted((CLIENT / "tests").glob("*.gd")):
        lines = [l.strip() for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
        if lines and lines[0] == "extends SceneTree":
            found.append(path)
    return found


def run(godot: str, args: list[str], timeout: int) -> tuple[int, str]:
    try:
        done = subprocess.run([godot, "--headless", "--path", str(CLIENT), *args],
                              capture_output=True, text=True, encoding="utf-8", errors="replace",
                              timeout=timeout)
    except subprocess.TimeoutExpired as error:
        out = (error.stdout or b"").decode("utf-8", "replace") if isinstance(error.stdout, bytes) else (error.stdout or "")
        return 124, out + f"\n(timed out after {timeout}s)"
    return done.returncode, done.stdout + done.stderr


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--godot", default=os.environ.get("GODOT", "godot"))
    parser.add_argument("--timeout", type=int, default=180, help="seconds per test")
    opts = parser.parse_args()

    code, out = run(opts.godot, ["--import"], 600)
    if code != 0:
        print(out)
        print(f"FAIL import (exit {code})")
        return 1

    found = tests()
    if not found:
        print("FAIL no Godot client tests found")
        return 1
    failed = []
    for path in found:
        name = path.relative_to(CLIENT).as_posix()
        code, out = run(opts.godot, ["--script", f"res://{name}"], opts.timeout)
        errors = [m for m in ERROR_MARKERS if m in out]
        ok = code == 0 and not errors
        print(f"{'PASS' if ok else 'FAIL'} {name} (exit {code})")
        if not ok:
            print(out.rstrip())
            failed.append(name)
    print(f"\n{len(found) - len(failed)}/{len(found)} Godot client tests passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
