"""Offline OC cutover. Default import is dry-run. Never deletes/renames source JSON.

Production writes require both explicit flags; this tool never stops/restarts or deploys services.
Older binaries cannot honor the fence: operators MUST stop them before freeze/import.
"""
import argparse
from contextlib import closing
import json
import hashlib
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "platform"))
from storage_paths import environment, huiguan_data_dir, require_ready
from oc_store import OCError, SqlSession, atomic_json, digest, fence, open_database, state, require_safe_wal
from oc_migration import migrate, verify, export_snapshot


def run(args):
    require_ready("huiguan")
    directory = huiguan_data_dir()
    database = directory / "users.db"
    sources = args.source or [directory / "characters.json"]
    write = args.command in {"freeze", "activate-sql", "activate-json", "resume-json", "export"} or (args.command == "import" and args.apply)
    if write and not args.confirm_stopped:
        raise OCError(400, "maintenance_confirmation_required")
    if write and environment() == "production" and not args.allow_production:
        raise OCError(403, "production_requires_separate_explicit_authorization")
    with fence(directory, exclusive=write):
        current = state(directory)
        if args.command == "status": return {"backend": current["backend"], "environment": environment()}
        if args.command == "freeze":
            file = directory / "characters.json"
            previous = current.get("previous", current["backend"])
            original = current.get("json_sha256") if current["backend"] == "frozen" else (hashlib.sha256(file.read_bytes()).hexdigest() if file.exists() else None)
            atomic_json(directory / "characters-storage-state.json", {"schema": 1, "backend": "frozen", "previous": previous, "json_sha256": original})
            return {"backend": "frozen"}
        if write and current["backend"] != "frozen": raise OCError(409, "freeze_required")
        if args.command == "resume-json":
            file = directory / "characters.json"
            actual = hashlib.sha256(file.read_bytes()).hexdigest() if file.exists() else None
            if current.get("previous") != "json" or actual != current.get("json_sha256"):
                raise OCError(409, "unchanged_frozen_json_required")
            atomic_json(directory / "characters-storage-state.json", {"schema": 1, "backend": "json"})
            return {"backend": "json", "source_unchanged": True}
        # Read-only commands must not create a DB or schema.
        conn = open_database(database) if write else __import__('sqlite3').connect(database.resolve().as_uri() + "?mode=ro", uri=True)
        conn.row_factory = __import__('sqlite3').Row
        try:
            conn.execute("BEGIN IMMEDIATE" if write else "BEGIN")
            if args.command == "import":
                if args.apply and current.get("previous") != "json": raise OCError(409, "import_requires_frozen_json")
                report = migrate(sources, conn, apply=args.apply)
            elif args.command == "verify": report = verify(sources, conn)
            elif args.command == "export":
                if not args.output: raise OCError(400, "new_export_output_required")
                if current.get("previous") != "sqlite": raise OCError(409, "export_requires_frozen_sqlite")
                report = export_snapshot(conn, args.output)
            else:
                # Activation requires exact semantic equality, including new/changed/deleted records.
                # Actual JSON at the service path must match SQL; auxiliary sources are not sufficient.
                report = verify([directory / "characters.json"], conn)
                if not report.get("verified"): raise OCError(409, "activation_verification_failed")
                backend = "sqlite" if args.command == "activate-sql" else "json"
                if backend == "sqlite": require_safe_wal(conn)
                if backend == "sqlite" and current.get("previous") != "json": raise OCError(409, "invalid_activation_direction")
                if backend == "json" and current.get("previous") != "sqlite": raise OCError(409, "invalid_activation_direction")
                atomic_json(directory / "characters-storage-state.json", {"schema": 1, "backend": backend, "verified_hash": report["content_hash"]})
                report["backend"] = backend
            conn.commit()
            return report
        except Exception:
            conn.rollback(); raise
        finally: conn.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("status", "freeze", "import", "verify", "export", "activate-sql", "activate-json", "resume-json"))
    parser.add_argument("--source", type=Path, action="append", help="repeat for every disjoint legacy JSON source")
    parser.add_argument("--dry-run", action="store_true", help="default for import")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--confirm-stopped", action="store_true", help="operator confirms ALL old/new writers and jobs are stopped")
    parser.add_argument("--allow-production", action="store_true", help="use ONLY after owner's separate authorization")
    args = parser.parse_args()
    if args.apply and args.dry_run: parser.error("--apply conflicts with --dry-run")
    try:
        report = run(args)
        print(json.dumps(report, ensure_ascii=False))
        return 0 if report.get("valid", True) and report.get("verified", True) else 1
    except (OCError, OSError, ValueError, RuntimeError, __import__('sqlite3').Error) as error:
        # No raw SQL error, path, owner, content, token or credential in output.
        print(json.dumps({"ok": False, "error": error.code if isinstance(error, OCError) else "oc_storage_operation_failed"}))
        return 1


if __name__ == "__main__": sys.exit(main())
