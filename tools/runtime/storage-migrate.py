"""Local-only, copy/verify/detach migration. Never connects to an online service.

plan is read-only. apply uses SQLite backup, verifies bytes/logical dumps, then
creates readiness. detach retains original files outside source for rollback.

The source mappings describe the legacy in-tree layout (portal/, server/, assets/ of a
pre-2026-10-26 checkout) that runtime data is migrated *from*; they are not paths of this
repository's current layout.
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
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "platform"))
from storage_paths import storage_layout, environment, initialize_storage


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def sqlite_evidence(path):
    with closing(sqlite3.connect(Path(path).resolve().as_uri() + "?mode=ro", uri=True, timeout=30)) as db:
        db.execute("BEGIN")
        integrity = [row[0] for row in db.execute("PRAGMA integrity_check")]
        if integrity != ["ok"]:
            raise RuntimeError(f"SQLite integrity failure: {path}: {integrity}")
        counts = {}
        for (name,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"):
            quoted = '"' + name.replace('"', '""') + '"'
            counts[name] = db.execute("SELECT count(*) FROM " + quoted).fetchone()[0]
        sha = hashlib.sha256()
        for line in db.iterdump():
            sha.update(line.encode("utf-8") + b"\n")
        return {"integrity": "ok", "tables": counts, "logical_sha256": sha.hexdigest()}


def _files(path):
    if not path.exists():
        return []
    if path.is_symlink() or (hasattr(path, "is_junction") and path.is_junction()):
        raise ValueError(f"migration refuses links: {path}")
    if path.is_file():
        return [path]
    result = []
    for child in sorted(path.rglob("*")):
        if child.is_symlink() or (hasattr(child, "is_junction") and child.is_junction()):
            raise ValueError(f"migration refuses links: {child}")
        if child.is_file():
            result.append(child)
    return result


def plan(source):
    source = Path(source).resolve(strict=True)
    layout = storage_layout()
    mappings = [
        ("portal/huiguan/users.db", "data", "huiguan/users.db", True),
        ("portal/huiguan/characters.json", "data", "huiguan/characters.json", False),
        ("portal/huiguan/game_saves.json", "data", "huiguan/game_saves.json", False),
        ("server/app/src/cards/users.db", "data", "cards/users.db", True),
        ("server/app/src/cards/update-feedback.sqlite3", "data", "cards/update-feedback.sqlite3", True),
        ("server/app/src/cards/data/card-balance", "data", "cards/card-balance", False),
        ("server/app/src/juling/data", "data", "juling", False),
        ("data", "data", "homepage", False),
        ("portal/www/links.json", "data", "homepage/config/links.json", False),
        ("portal/www/thanks.json", "data", "homepage/config/thanks.json", False),
        ("assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db", "data", "worldview/worldview_luoxiaohei_v4.db", True),
        ("portal/huiguan/assets/uploads", "assets", "managed/huiguan/uploads", False),
        ("portal/huiguan/assets/store", "assets", "managed/huiguan/store", False),
        ("server/app/src/softie-webgpu/.local/spirit-settings.json", "data", "spirit/spirit-settings.json", False),
        ("portal/huiguan/assets/previews", "cache", "huiguan/previews", False),
        ("portal/huiguan/assets/thumbs", "cache", "huiguan/thumbs", False),
        ("portal/huiguan/logs", "cache", "logs/legacy-huiguan", False),
    ]
    for name, module in ((".env", "site"), ("server/.env.local", "server"), ("portal/huiguan/.env", "huiguan"), ("server/app/src/cards/.env", "cards"), ("server/app/src/juling/.env", "juling")):
        mappings.append((name, "data", "secrets/" + module + ".env", False))
    entries, seen = [], set()
    tracked = set(subprocess.check_output(["git", "ls-files", "-z"], cwd=source).decode("utf-8").split("\0"))

    def add(file, root_key, relative, is_db=None):
        relative_source = file.relative_to(source).as_posix()
        if relative_source in seen or file.name.endswith(("-wal", "-shm")):
            return
        seen.add(relative_source)
        destination = (layout[root_key] / relative).resolve()
        if not destination.is_relative_to(layout[root_key]) or destination.is_relative_to(source):
            raise ValueError("unsafe migration destination")
        info = {"source": relative_source, "root": root_key, "destination": destination.relative_to(layout[root_key]).as_posix(),
                "bytes": file.stat().st_size, "sha256": digest(file), "mode": file.stat().st_mode & 0o777,
                "tracked_source": relative_source in tracked,
                "sqlite": is_db if is_db is not None else file.suffix in {".db", ".sqlite", ".sqlite3"}}
        if info["sqlite"]:
            info["database"] = sqlite_evidence(file)
        entries.append(info)

    for old, root_key, new, is_db in mappings:
        old_root = source / old
        for file in _files(old_root):
            add(file, root_key, Path(new) / file.relative_to(old_root) if old_root.is_dir() else Path(new), True if is_db else None)
    for file in _files(source / "assets"):
        rel = file.relative_to(source / "assets")
        if rel.parts[:2] == ("罗小黑战记数据库", "db"):
            if file.relative_to(source).as_posix() not in seen:
                # Historical backup files are opaque recovery inputs, never live databases.
                if not file.name.endswith(("-wal", "-shm")):
                    add(file, "backups", Path("legacy-worldview") / rel, False)
        else:
            add(file, "assets", Path("source") / rel)
    # Imported opaque historical DB files are not active: do not demand new schemas.
    result = {"schema": 1, "created_at": datetime.now(timezone.utc).isoformat(), "source": str(source),
              "environment": environment(), "roots": {k: str(v) for k, v in layout.items()},
              "verified": False, "files": entries}
    return result


def _validate_manifest(manifest):
    if manifest.get("roots") != {k: str(v) for k, v in storage_layout().items()} or manifest.get("environment") != environment():
        raise ValueError("manifest does not match selected environment/storage")
    source = Path(manifest["source"]).resolve()
    pairs = []
    for entry in manifest["files"]:
        old = (source / entry["source"]).resolve()
        root = Path(manifest["roots"][entry["root"]]).resolve()
        new = (root / entry["destination"]).resolve()
        if not old.is_relative_to(source) or not new.is_relative_to(root) or new.is_relative_to(source):
            raise ValueError("manifest contains an escaping path")
        pairs.append((entry, old, new))
    return pairs


def _original(entry, old):
    """Where the pre-migration bytes live now: in source, or in recovery after detach."""
    return Path(entry["recovery"]) if entry.get("recovery") else old


def verify(manifest, *, check_source=True):
    for entry, old, new in _validate_manifest(manifest):
        original = _original(entry, old)
        if entry["sqlite"]:
            if sqlite_evidence(new) != entry["database"]:
                raise RuntimeError(f"migrated database differs: {entry['source']}")
            if check_source and sqlite_evidence(original) != entry["database"]:
                raise RuntimeError(f"source database changed during migration: {entry['source']}")
        elif (not new.is_file() or new.stat().st_size != entry["bytes"] or digest(new) != entry["sha256"]):
            raise RuntimeError(f"migrated file differs: {entry['source']}")
        if check_source and not entry["sqlite"] and (original.stat().st_size != entry["bytes"] or digest(original) != entry["sha256"]):
            raise RuntimeError(f"source changed during migration: {entry['source']}")
        entry["target_sha256"] = digest(new)
        entry["target_bytes"] = new.stat().st_size
        if not os.access(new, os.R_OK | os.W_OK):
            raise PermissionError(new)
    return True


def apply(manifest, manifest_path):
    if not Path(manifest_path).resolve().is_relative_to(storage_layout()["backups"]):
        raise ValueError("migration evidence and recovery originals must be under external backup root")
    for entry, old, new in _validate_manifest(manifest):
        if (entry["sqlite"] and sqlite_evidence(old) != entry["database"]) or (not entry["sqlite"] and digest(old) != entry["sha256"]):
            raise RuntimeError(f"source changed after inventory: {entry['source']}")
        new.parent.mkdir(parents=True, exist_ok=True)
        if new.exists():
            if entry["sqlite"] and sqlite_evidence(new) == entry["database"]:
                continue
            if not entry["sqlite"] and digest(new) == entry["sha256"]:
                continue
            raise FileExistsError(f"refusing to overwrite different target: {new}")
        temporary = new.with_suffix(new.suffix + ".migrating")
        if entry["sqlite"]:
            # sqlite backup includes committed WAL pages and closes both handles.
            with closing(sqlite3.connect(old.as_uri() + "?mode=ro", uri=True, timeout=30)) as reader:
                with closing(sqlite3.connect(temporary)) as writer:
                    reader.backup(writer)
            os.chmod(temporary, entry["mode"])
        else:
            shutil.copy2(old, temporary)
        temporary.replace(new)
    verify(manifest)
    manifest["verified"] = True
    manifest["verified_at"] = datetime.now(timezone.utc).isoformat()
    write_json(manifest_path, manifest)
    initialize_storage(migration_manifest=manifest_path, legacy_asset_roots=[str(Path(manifest["source"]) / "assets")])


def detach(manifest, manifest_path):
    if manifest.get("verified") is not True:
        raise ValueError("unverified migration cannot detach source")
    # Validate every byte before moving any original. Refuse to move tracked source.
    verify(manifest)
    source = Path(manifest["source"])
    recovery = Path(manifest_path).resolve().parent / "original-source"
    for entry, old, _ in _validate_manifest(manifest):
        if entry["tracked_source"]:
            continue
        if entry.get("recovery"):
            # Resuming an interrupted detach: this original already moved and was verified above.
            if old.exists():
                raise FileExistsError(f"source reappeared after detach: {old}")
            continue
        target = recovery / entry["source"]
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            raise FileExistsError(target)
        entry["recovery_sha256"] = digest(old)
        old.replace(target)
        entry["recovery"] = str(target)
        for suffix in ("-wal", "-shm") if entry["sqlite"] else ():
            sidecar = Path(str(old) + suffix)
            if sidecar.exists():
                sidecar.replace(Path(str(target) + suffix))
        write_json(manifest_path, manifest)
    manifest["source_detached"] = True
    write_json(manifest_path, manifest)


def restore_source(manifest):
    # Recovery is copy-only and refuses to overwrite any later local data.
    for entry, old, _ in _validate_manifest(manifest):
        if not entry.get("recovery"):
            continue
        recovery = Path(entry["recovery"])
        recovery_sha = entry.get("recovery_sha256", entry["sha256"])
        if digest(recovery) != recovery_sha:
            raise RuntimeError("recovery original has changed")
        if old.exists() and digest(old) != recovery_sha:
            raise FileExistsError(f"source contains later data: {old}")
    for entry, old, _ in _validate_manifest(manifest):
        if entry.get("recovery"):
            old.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(entry["recovery"], old)
            for suffix in ("-wal", "-shm") if entry["sqlite"] else ():
                sidecar = Path(entry["recovery"] + suffix)
                if sidecar.exists():
                    shutil.copy2(sidecar, Path(str(old) + suffix))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("plan", "apply", "verify", "detach", "restore-source"))
    parser.add_argument("--source", type=Path)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "plan":
        if not args.source:
            parser.error("plan requires --source")
        if args.manifest.exists():
            parser.error("refusing to overwrite an existing plan")
        manifest = plan(args.source)
        write_json(args.manifest, manifest)
    else:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        if args.command == "apply":
            apply(manifest, args.manifest)
        elif args.command == "verify":
            verify(manifest, check_source=not manifest.get("source_detached"))
        elif args.command == "detach":
            detach(manifest, args.manifest)
        else:
            restore_source(manifest)
    print(json.dumps({"command": args.command, "files": len(manifest["files"]), "bytes": sum(e["bytes"] for e in manifest["files"]),
                      "databases": sum(e["sqlite"] for e in manifest["files"]), "verified": manifest["verified"], "manifest": str(args.manifest)}))


if __name__ == "__main__":
    main()
