"""Count malformed USSO keys in an explicitly supplied, offline SQLite backup."""

import argparse
from contextlib import closing
import json
from pathlib import Path
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "platform"))
from usso_uid_contract import parse_usso_uid_contract

# Fixed identifiers from the account, session, save, and OC contracts.
REFERENCES = {
    "user_flags": ("kind", "uid"),
    "sessions_db": ("kind", "uid"),
    "game_saves": ("kind", "uid"),
    "oc_owners": ("owner_kind", "owner_uid"),
}


def audit_snapshot(snapshot, contract):
    snapshot = snapshot.resolve(strict=True)
    # 不可变读取依赖独立、完整的备份。旁边有日志文件时无法保证统计覆盖已提交记录。
    if not snapshot.is_file() or any(
        Path(str(snapshot) + suffix).exists() for suffix in ("-wal", "-shm", "-journal")
    ):
        raise ValueError("需要完整的离线 SQLite 备份文件，备份旁不能有日志文件。")

    with closing(sqlite3.connect(snapshot.as_uri() + "?mode=ro&immutable=1", uri=True)) as conn:
        tables = {name for (name,) in conn.execute("SELECT name FROM sqlite_schema WHERE type='table'")}
        totals = {"total": 0, "invalid_format": 0}
        for (uid,) in conn.execute("SELECT user_id FROM users"):
            totals["total"] += 1
            totals["invalid_format"] += not contract.matches_stored_uid(uid)

        references = {}
        for table, (kind, uid) in REFERENCES.items():
            if table not in tables:
                references[table] = None
                continue
            counts = {"total": 0, "invalid_format": 0, "without_account_row": 0}
            query = f"""
                SELECT r.{uid}, EXISTS (SELECT 1 FROM users u WHERE u.user_id = r.{uid})
                FROM {table} r WHERE r.{kind} = 'usso'
            """
            for value, has_account in conn.execute(query):
                counts["total"] += 1
                counts["invalid_format"] += not contract.matches_stored_uid(value)
                counts["without_account_row"] += not has_account
            references[table] = counts

    return {"accounts": totals, "references": references}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("snapshot", type=Path, help="authorized offline users.db backup")
    parser.add_argument("contract", type=Path, help="verified UID contract JSON file")
    args = parser.parse_args()
    try:
        contract = parse_usso_uid_contract(args.contract.read_text(encoding="utf-8"))
        if contract is None:
            print("身份规则文件格式无效。", file=sys.stderr)
            return 1
        print(json.dumps(audit_snapshot(args.snapshot, contract), ensure_ascii=True, indent=2))
        return 0
    except ValueError as error:
        print(str(error), file=sys.stderr)
    except (OSError, sqlite3.Error):
        print("无法读取完整的离线账号备份与身份规则。", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
