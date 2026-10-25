"""Account-owned cloud saves keyed by (kind, uid, scope).

Replaces the legacy portal/huiguan/game_saves.json store, whose records were keyed
by a bare uid shared between local and USSO accounts. The JSON file is only read
(once per content hash) and never written, so it stays a rollback source; see
docs/game-save-ownership.md for the resolution rules and rollback procedure.

CLI (run from the project root; IRIDESCENTLY_STORAGE_ROOT and IRIDESCENTLY_ENVIRONMENT select isolated data):
  python server/game_saves.py plan              # show how legacy keys resolve, no writes
  python server/game_saves.py import            # import legacy JSON (idempotent)
  python server/game_saves.py status            # row counts and quarantined records
  python server/game_saves.py export --out FILE # write legacy-format JSON for rollback
"""
import argparse
from storage_paths import data_root, huiguan_data_dir, require_ready
import hashlib
import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path


KINDS = ("local", "usso")
DEFAULT_SCOPE = "management"
# Each scope is an independent save slot of one product. Add new games here; the
# HTTP API maps "no scope" to DEFAULT_SCOPE for existing management clients.
SCOPES = ("management", "softie")
MAX_STATE_BYTES = 8 * 1024 * 1024
LEGACY_MIGRATION = "legacy-json-v1"


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _instant(value):
    """Parse an ISO timestamp for ordering; unparsable or naive values sort first."""
    try:
        parsed = datetime.fromisoformat(str(value))
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)
    return parsed if parsed.tzinfo else datetime.min.replace(tzinfo=timezone.utc)


def init_schema(conn):
    conn.execute("""CREATE TABLE IF NOT EXISTS game_saves (
        kind TEXT NOT NULL,
        uid TEXT NOT NULL,
        scope TEXT NOT NULL,
        state_json TEXT NOT NULL,
        saved_at TEXT NOT NULL,
        user_name TEXT NOT NULL DEFAULT '',
        origin TEXT NOT NULL DEFAULT 'api',
        PRIMARY KEY (kind, uid, scope)
    )""")
    # Every legacy record is kept here with how it was resolved; unresolved ones
    # (no matching account, or an ambiguous bare uid) are served to nobody.
    conn.execute("""CREATE TABLE IF NOT EXISTS game_save_legacy (
        legacy_key TEXT NOT NULL,
        scope TEXT NOT NULL,
        state_json TEXT NOT NULL,
        saved_at TEXT NOT NULL DEFAULT '',
        user_name TEXT NOT NULL DEFAULT '',
        resolved_kind TEXT,
        resolved_uid TEXT,
        resolution TEXT NOT NULL,
        source_sha256 TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        PRIMARY KEY (legacy_key, scope, source_sha256)
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS game_save_migrations (
        name TEXT NOT NULL,
        source_sha256 TEXT NOT NULL,
        applied_at TEXT NOT NULL,
        summary_json TEXT NOT NULL,
        PRIMARY KEY (name, source_sha256)
    )""")


def normalize_scope(scope):
    value = DEFAULT_SCOPE if scope in (None, "") else scope
    return value if value in SCOPES else None


def _owner(kind, uid):
    uid = str(uid or "")
    if kind not in KINDS or not uid:
        raise ValueError("invalid save owner")
    return kind, uid


def get_save(conn, kind, uid, scope):
    kind, uid = _owner(kind, uid)
    row = conn.execute("SELECT state_json, saved_at FROM game_saves WHERE kind=? AND uid=? AND scope=?",
                       (kind, uid, scope)).fetchone()
    if not row:
        return None
    return {"state": json.loads(row[0]), "savedAt": row[1]}


def put_save(conn, kind, uid, scope, state, user_name="", saved_at=None, origin="api"):
    kind, uid = _owner(kind, uid)
    if scope not in SCOPES:
        raise ValueError("invalid save scope")
    encoded = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
    if len(encoded.encode("utf-8")) > MAX_STATE_BYTES:
        raise ValueError("save too large")
    saved_at = saved_at or _now()
    conn.execute("""INSERT INTO game_saves (kind, uid, scope, state_json, saved_at, user_name, origin)
        VALUES (?,?,?,?,?,?,?) ON CONFLICT(kind, uid, scope) DO UPDATE SET
        state_json=excluded.state_json, saved_at=excluded.saved_at,
        user_name=excluded.user_name, origin=excluded.origin""",
                 (kind, uid, scope, encoded, saved_at, str(user_name or "")[:80], origin))
    return saved_at


# ---------- legacy import ----------

def _legacy_slots(record):
    """Yield (scope, state, saved_at) for one legacy JSON record."""
    if not isinstance(record, dict):
        return
    if record.get("state"):
        yield DEFAULT_SCOPE, record["state"], str(record.get("savedAt") or "")
    games = record.get("games") if isinstance(record.get("games"), dict) else {}
    for scope, slot in games.items():
        if scope in SCOPES and isinstance(slot, dict) and slot.get("state"):
            yield scope, slot["state"], str(slot.get("savedAt") or record.get("savedAt") or "")


def resolve_legacy_owner(conn, key, user_name):
    """Map a legacy key to (kind, uid, reason); kind is None when unresolved."""
    key = str(key)
    for kind in KINDS:
        if key.startswith(kind + ":") and key[len(kind) + 1:]:
            return kind, key[len(kind) + 1:], "prefixed-key"
    local = conn.execute("SELECT username, nickname FROM local_users WHERE CAST(uid AS TEXT)=?", (key,)).fetchone()
    usso = conn.execute("SELECT nickname FROM users WHERE user_id=?", (key,)).fetchone()
    if local and not usso:
        return "local", key, "only-local-account"
    if usso and not local:
        return "usso", key, "only-usso-account"
    if not local and not usso:
        return None, None, "no-matching-account"
    # Both kinds own this number: decide only on positive evidence from the
    # display name the legacy writer stored next to the save.
    name = str(user_name or "").strip()
    local_names = {str(v).strip() for v in (local[0], local[1]) if v}
    usso_names = {str(usso[0]).strip()} if usso[0] else set()
    if name and name in local_names and name not in usso_names:
        return "local", key, "collision-resolved-by-local-name"
    if name and name in usso_names and name not in local_names:
        return "usso", key, "collision-resolved-by-usso-name"
    return None, None, "ambiguous-collision"


def plan_legacy(conn, data):
    plan = []
    for key, record in (data or {}).items():
        user_name = record.get("userName", "") if isinstance(record, dict) else ""
        kind, uid, reason = resolve_legacy_owner(conn, key, user_name)
        for scope, state, saved_at in _legacy_slots(record):
            plan.append({"legacy_key": str(key), "scope": scope, "kind": kind, "uid": uid,
                         "resolution": reason, "saved_at": saved_at, "user_name": user_name, "state": state})
    return plan


def _read_legacy(path):
    try:
        raw = Path(path).read_bytes()
    except FileNotFoundError:
        return None, None
    return hashlib.sha256(raw).hexdigest(), json.loads(raw.decode("utf-8") or "{}")


def import_legacy(conn, path):
    """Import the legacy JSON once per content hash. Never writes the JSON.

    An existing account-owned slot is only replaced when the legacy slot is
    strictly newer (by savedAt), so re-importing after a rollback cannot erase
    saves made through the new store.
    """
    sha, data = _read_legacy(path)
    if sha is None:
        return {"status": "no-legacy-file"}
    if conn.execute("SELECT 1 FROM game_save_migrations WHERE name=? AND source_sha256=?",
                    (LEGACY_MIGRATION, sha)).fetchone():
        return {"status": "already-imported", "source_sha256": sha}
    now, summary = _now(), {"imported": 0, "kept-newer": 0, "quarantined": 0}
    for item in plan_legacy(conn, data):
        encoded = json.dumps(item["state"], ensure_ascii=False, separators=(",", ":"))
        conn.execute("""INSERT OR REPLACE INTO game_save_legacy (legacy_key, scope, state_json, saved_at,
            user_name, resolved_kind, resolved_uid, resolution, source_sha256, imported_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
                     (item["legacy_key"], item["scope"], encoded, item["saved_at"], str(item["user_name"] or ""),
                      item["kind"], item["uid"], item["resolution"], sha, now))
        if item["kind"] is None:
            summary["quarantined"] += 1
            continue
        current = get_save(conn, item["kind"], item["uid"], item["scope"])
        if current and _instant(current["savedAt"]) >= _instant(item["saved_at"]):
            summary["kept-newer"] += 1
            continue
        put_save(conn, item["kind"], item["uid"], item["scope"], item["state"],
                 item["user_name"], item["saved_at"] or now, origin="legacy-json")
        summary["imported"] += 1
    conn.execute("INSERT INTO game_save_migrations (name, source_sha256, applied_at, summary_json) VALUES (?,?,?,?)",
                 (LEGACY_MIGRATION, sha, now, json.dumps(summary)))
    return {"status": "imported", "source_sha256": sha, **summary}


def export_legacy(conn):
    """Rebuild the legacy bare-uid JSON shape for rolling back to old code.

    The old format cannot hold two kinds under one number; such conflicts keep
    the newest slot and are reported so the operator can decide.
    """
    out, conflicts, owners = {}, [], {}
    rows = sorted(conn.execute("SELECT kind, uid, scope, state_json, saved_at, user_name FROM game_saves"),
                  key=lambda row: _instant(row[4]))
    for kind, uid, scope, state_json, saved_at, user_name in rows:
        previous = owners.setdefault((uid, scope), kind)
        if previous != kind:
            conflicts.append({"uid": uid, "scope": scope, "kinds": [previous, kind], "kept": kind})
            owners[(uid, scope)] = kind
        record = out.setdefault(uid, {})
        state = json.loads(state_json)
        if scope == DEFAULT_SCOPE:
            record.update({"state": state, "savedAt": saved_at, "userName": user_name})
        else:
            record.setdefault("games", {})[scope] = {"state": state, "savedAt": saved_at}
            record.setdefault("savedAt", saved_at)
            record.setdefault("userName", user_name)
    return out, conflicts


def _project_root():
    return data_root()


def _connect(root, readonly=False):
    if Path(root).resolve() == data_root():
        require_ready()
    database = huiguan_data_dir(root) / "users.db"
    if readonly:
        conn = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True, timeout=10)
    else:
        conn = sqlite3.connect(database, timeout=10)
        conn.execute("PRAGMA busy_timeout=10000")
        init_schema(conn)
    return conn


def main(argv=None):
    require_ready()
    parser = argparse.ArgumentParser(description="Account-owned cloud save maintenance")
    parser.add_argument("command", choices=("plan", "import", "status", "export"))
    parser.add_argument("--out", help="export destination (required for export)")
    args = parser.parse_args(argv)
    root = _project_root()
    legacy = huiguan_data_dir(root) / "game_saves.json"
    if args.command == "plan":
        conn = _connect(root, readonly=True)
        _, data = _read_legacy(legacy)
        for item in plan_legacy(conn, data or {}):
            owner = f"{item['kind']}:{item['uid']}" if item["kind"] else "QUARANTINE"
            print(f"{item['legacy_key']:>8} {item['scope']:<10} -> {owner:<14} {item['resolution']} "
                  f"(savedAt {item['saved_at'] or '-'})")
        return 0
    if args.command == "status":
        conn = _connect(root, readonly=True)
        try:
            for kind, scope, count in conn.execute(
                    "SELECT kind, scope, COUNT(*) FROM game_saves GROUP BY kind, scope ORDER BY kind, scope"):
                print(f"{kind:<6} {scope:<10} {count}")
            for key, scope, reason in conn.execute(
                    "SELECT legacy_key, scope, resolution FROM game_save_legacy WHERE resolved_kind IS NULL"):
                print(f"quarantined {key} {scope} {reason}")
            for name, sha, applied, summary in conn.execute("SELECT * FROM game_save_migrations"):
                print(f"migration {name} {sha[:12]} {applied} {summary}")
        except sqlite3.OperationalError:
            print("game_saves tables not created yet")
        return 0
    conn = _connect(root)
    try:
        if args.command == "import":
            print(json.dumps(import_legacy(conn, legacy), ensure_ascii=False))
            conn.commit()
            return 0
        if not args.out:
            parser.error("export needs --out")
        data, conflicts = export_legacy(conn)
        out = Path(args.out)
        if out.resolve() == legacy.resolve():
            parser.error("refusing to overwrite the legacy source; export elsewhere and swap it in deliberately")
        out.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        print(json.dumps({"records": len(data), "conflicts": conflicts}, ensure_ascii=False))
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
