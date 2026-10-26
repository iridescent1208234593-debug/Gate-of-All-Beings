"""Create or verify a self-contained local data/assets backup; no remote access.

Stop local runtime first for a correlated database/filesystem snapshot. Cache and
releases are reproducible and excluded. A same-volume snapshot is not offsite.
"""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "platform"))
from storage_paths import storage_layout, backup_root, require_ready


def sha(file):
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def verify(directory):
    directory = directory.resolve(strict=True)
    record = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    if record.get("complete") is not True:
        raise RuntimeError("backup is incomplete")
    for name, value in record["files"].items():
        file = (directory / name).resolve()
        if not file.is_relative_to(directory) or sha(file) != value["sha256"]:
            raise RuntimeError("backup hash verification failed: " + name)
        if value.get("sqlite"):
            with closing(sqlite3.connect(file.as_uri() + "?mode=ro", uri=True)) as db:
                if list(db.execute("PRAGMA integrity_check")) != [("ok",)]:
                    raise RuntimeError("backup SQLite integrity failure: " + name)
    return record


def snapshot():
    require_ready()
    layout = storage_layout()
    target = backup_root() / "snapshots" / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    target.mkdir(parents=True)
    record = {"schema": 1, "complete": False, "created_at": datetime.now(timezone.utc).isoformat(), "files": {}}
    for kind in ("data", "assets"):
        for original in sorted(layout[kind].rglob("*")):
            if original.is_symlink() or (hasattr(original, "is_junction") and original.is_junction()):
                raise ValueError("backups refuse symbolic links")
            if not original.is_file() or original.name.endswith(("-wal", "-shm")):
                continue
            name = (Path(kind) / original.relative_to(layout[kind])).as_posix()
            output = target / name
            output.parent.mkdir(parents=True, exist_ok=True)
            is_db = original.suffix in {".db", ".sqlite", ".sqlite3"}
            if is_db:
                with closing(sqlite3.connect(original.as_uri() + "?mode=ro", uri=True, timeout=30)) as reader:
                    with closing(sqlite3.connect(output)) as writer:
                        reader.backup(writer)
                os.chmod(output, original.stat().st_mode & 0o777)
            else:
                before = sha(original)
                shutil.copy2(original, output)
                if before != sha(output) or before != sha(original):
                    raise RuntimeError("file changed while backing up: " + name)
            record["files"][name] = {"sha256": sha(output), "bytes": output.stat().st_size, "sqlite": is_db}
    record["complete"] = True
    (target / "manifest.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    verify(target)
    return target, record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("snapshot", "verify"))
    parser.add_argument("directory", type=Path, nargs="?")
    args = parser.parse_args()
    if args.command == "snapshot":
        if args.directory:
            parser.error("snapshot destination is selected by the external backup root")
        directory, record = snapshot()
    else:
        if not args.directory:
            parser.error("verify requires a snapshot directory")
        directory, record = args.directory, verify(args.directory)
    print(json.dumps({"directory": str(directory), "files": len(record["files"]),
                      "bytes": sum(v["bytes"] for v in record["files"].values()), "verified": True}))


if __name__ == "__main__":
    main()
