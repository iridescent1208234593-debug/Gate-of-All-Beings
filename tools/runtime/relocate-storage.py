"""Move one environment's external storage to a new storage root. Local only.

The readiness marker and the migration manifest record absolute roots, so a plain
directory move leaves every service refusing to start. This tool inventories every
file (size + sha256) and every SQLite database (integrity), moves the environment
directory (rename on the same volume, copy + verify across volumes), re-inventories,
and only then rewrites the absolute roots and recovery paths. `source` and
`legacy_asset_roots` describe history and are kept. Pre-relocation copies of both
records and the inventory are kept under <backups>/relocations/<timestamp>/.

    plan  --to <new storage root>   read-only; prints what would change
    apply --to <new storage root>   requires stopped local services
"""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "services" / "platform"))
import storage_paths
from storage_paths import MARKER, ROOT_VARIABLES

RECORDS = "relocations"


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def inventory(directory):
    """Size and sha256 of every regular file except earlier relocation records; links are refused.

    Nothing is opened as a database here: a read-only SQLite connection can still rewrite a
    WAL index (-shm), which would make the before/after comparison meaningless.
    """
    files = {}
    for current, subdirectories, names in os.walk(directory):
        base = Path(current)
        for name in subdirectories:
            child = base / name
            if child.is_symlink() or (hasattr(child, "is_junction") and child.is_junction()):
                raise ValueError(f"relocation refuses links: {child}")
        if base.relative_to(directory).parts[:2] == ("backups", RECORDS):
            subdirectories[:] = []
            continue
        for name in names:
            child = base / name
            if child.is_symlink():
                raise ValueError(f"relocation refuses links: {child}")
            files[child.relative_to(directory).as_posix()] = [child.stat().st_size, digest(child)]
    return dict(sorted(files.items()))


def check_databases(directory):
    """integrity_check of every live database, run only after the bytes were verified."""
    results = {}
    for file in sorted((directory / "data").rglob("*")):
        if file.is_file() and file.suffix in {".db", ".sqlite", ".sqlite3"}:
            with closing(sqlite3.connect(file.resolve().as_uri() + "?mode=ro", uri=True, timeout=30)) as db:
                results[file.relative_to(directory).as_posix()] = [row[0] for row in db.execute("PRAGMA integrity_check")]
    bad = {name: result for name, result in results.items() if result != ["ok"]}
    if bad:
        raise RuntimeError(f"SQLite integrity failure after relocation; records not rewritten: {bad}")
    return sorted(results)


def _layout_for(storage_root):
    previous = os.environ.get("IRIDESCENTLY_STORAGE_ROOT")
    os.environ["IRIDESCENTLY_STORAGE_ROOT"] = str(storage_root)
    try:
        return storage_paths.storage_layout()
    finally:
        if previous is None:
            os.environ.pop("IRIDESCENTLY_STORAGE_ROOT", None)
        else:
            os.environ["IRIDESCENTLY_STORAGE_ROOT"] = previous


def _services_running(layout):
    state = layout["cache"] / "runtime" / "local-runtime.json"
    if not state.is_file():
        return []
    spec = importlib.util.spec_from_file_location("local_runtime", ROOT / "tools/runtime/local-runtime.py")
    runtime = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runtime)
    records = json.loads(state.read_text(encoding="utf-8")).get("services", {})
    return [name for name, record in records.items() if runtime._alive(record)]


def _rebase(value, old, new):
    path = Path(value)
    return str(new / path.relative_to(old)) if path.is_relative_to(old) else value


def prepare(target_root):
    for variable in ROOT_VARIABLES.values():
        if os.environ.get(f"IRIDESCENTLY_{variable}_ROOT", "").strip():
            raise ValueError("relocation moves the standard <root>/<environment> layout; unset per-root overrides")
    environment = storage_paths.environment()
    old_root = storage_paths.storage_root()
    new_root = storage_paths._absolute(str(target_root))
    old_layout = storage_paths.storage_layout()
    new_layout = _layout_for(new_root)  # also rejects overlap with source checkouts
    old_dir, new_dir = old_root / environment, new_root / environment
    if old_dir == new_dir or new_dir.is_relative_to(old_dir) or old_dir.is_relative_to(new_dir):
        raise ValueError("new storage overlaps the current storage")
    return environment, old_layout, new_layout, old_dir, new_dir


def plan(target_root):
    environment, old_layout, new_layout, old_dir, new_dir = prepare(target_root)
    marker = storage_paths.require_ready()
    manifest = Path(marker["manifest"]) if marker.get("manifest") else None
    return {"environment": environment, "from": str(old_dir), "to": str(new_dir),
            "target_exists": new_dir.exists(), "same_volume": _same_volume(old_dir, new_dir),
            "roots": {key: [str(old_layout[key]), str(new_layout[key])] for key in old_layout},
            "manifest": [str(manifest), _rebase(str(manifest), old_dir, new_dir)] if manifest else None,
            "running_services": _services_running(old_layout)}


def _same_volume(old_dir, new_dir):
    parent = new_dir.parent
    while not parent.exists():
        parent = parent.parent
    return os.stat(old_dir).st_dev == os.stat(parent).st_dev


def apply(target_root):
    environment, old_layout, new_layout, old_dir, new_dir = prepare(target_root)
    marker = storage_paths.require_ready()
    if new_dir.exists():
        raise FileExistsError(f"refusing to merge into existing storage: {new_dir}")
    running = _services_running(old_layout)
    if running:
        raise RuntimeError(f"stop local services first: {', '.join(running)}")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    before = inventory(old_dir)
    manifest_path = Path(marker["manifest"]) if marker.get("manifest") else None
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path else None
    record_dir = old_layout["backups"] / RECORDS / stamp
    write_json(record_dir / "marker.before.json", marker)
    if manifest is not None:
        write_json(record_dir / "manifest.before.json", manifest)
    write_json(record_dir / "inventory.json", before)

    same_volume = _same_volume(old_dir, new_dir)
    new_dir.parent.mkdir(parents=True, exist_ok=True)
    if same_volume:
        os.replace(old_dir, new_dir)  # one rename; fails without partial effect if files are held open
    else:
        shutil.copytree(old_dir, new_dir, copy_function=shutil.copy2)
    after = inventory(new_dir)
    if after != before:
        missing = sorted(set(before) - set(after))
        changed = sorted(k for k in before if k in after and after[k] != before[k])
        undo = f" Inspect, then move {new_dir} back to {old_dir}." if same_volume else ""
        raise RuntimeError(f"relocated bytes differ (missing {missing[:5]}, changed {changed[:5]}); records not rewritten.{undo}")
    databases = check_databases(new_dir)

    relocation = {"from": str(old_dir), "to": str(new_dir), "at": datetime.now(timezone.utc).isoformat(),
                  "files": len(after), "bytes": sum(v[0] for v in after.values()),
                  "databases": len(databases), "method": "rename" if same_volume else "copy"}
    if manifest is not None:
        manifest["roots"] = {key: str(value) for key, value in new_layout.items()}
        for entry in manifest.get("files", []):
            if entry.get("recovery"):
                entry["recovery"] = _rebase(entry["recovery"], old_dir, new_dir)
        manifest.setdefault("relocations", []).append(relocation)
        manifest_path = Path(_rebase(str(manifest_path), old_dir, new_dir))
        write_json(manifest_path, manifest)
    marker = {**marker, "roots": {key: str(value) for key, value in new_layout.items()},
              "manifest": str(manifest_path) if manifest_path else None,
              "relocations": [*marker.get("relocations", []), relocation]}
    write_json(new_layout["data"] / MARKER, marker)
    write_json(new_layout["backups"] / RECORDS / stamp / "relocation.json", relocation)

    os.environ["IRIDESCENTLY_STORAGE_ROOT"] = str(new_dir.parent)
    storage_paths.require_ready()
    if manifest is not None:
        for entry in manifest.get("files", []):
            if entry.get("recovery") and not Path(entry["recovery"]).is_file():
                raise RuntimeError(f"recovery original missing after relocation: {entry['recovery']}")
    return {**relocation, "manifest": str(manifest_path) if manifest_path else None,
            "source_retained": not same_volume}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=("plan", "apply"))
    parser.add_argument("--to", type=Path, required=True, help="new storage root (parent of the environment directories)")
    args = parser.parse_args()
    result = plan(args.to) if args.command == "plan" else apply(args.to)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
