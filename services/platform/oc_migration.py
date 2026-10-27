"""Offline migration primitives; no service import, no credentials or OC bodies in reports."""
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import uuid
from oc_store import (OCError, SqlSession, atomic_json, canonical, digest, fence,
                      initialize_schema, open_database, owner, owner_key, parse_owner, state, validate_record)


def _pairs(pairs):
    out = {}
    for key, value in pairs:
        if key in out: raise ValueError("duplicate_json_key")
        out[key] = value
    return out


def inventory(sources, conn):
    """Owner encoding is explicit legacy semantics, never inferred from matching uid/name."""
    combined, errors, sources_meta, ids = {}, [], [], set()
    for source_index, path in enumerate(sources):
        raw = Path(path).read_bytes()
        sources_meta.append({"sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw)})
        try:
            document = json.loads(raw, object_pairs_hook=_pairs, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
            if not isinstance(document, dict): raise ValueError()
        except (ValueError, UnicodeDecodeError):
            errors.append({"source": source_index, "reason": "invalid_or_duplicate_key_json"}); continue
        for owner_index, (key, records) in enumerate(document.items()):
            where = {"source": source_index, "owner_index": owner_index}
            try:
                ident = parse_owner(key)
                kind, uid = owner(ident)
                table, column = ("local_users", "uid") if kind == "local" else ("users", "user_id")
                account = conn.execute(f"SELECT {column} FROM {table} WHERE {column}=?", (uid,)).fetchone()
                if not account or str(account[0]) != uid:
                    raise OCError(400, "owner_account_missing")
                if key in combined: raise OCError(400, "duplicate_owner_source")
                if not isinstance(records, list): raise OCError(400, "invalid_owner_records")
            except OCError as error:
                errors.append({**where, "reason": error.code}); continue
            codes, accepted = set(), []
            for index, record in enumerate(records):
                try:
                    validate_record(record)
                    if "_oc_version" in record or "_oc_id" in record: raise OCError(400, "reserved_oc_metadata")
                    if record["code"] in codes: raise OCError(400, "duplicate_owner_code")
                    codes.add(record["code"])
                    value = record.get("id")
                    if value is not None and (isinstance(value, bool) or not isinstance(value, (str, int)) or not str(value)):
                        raise OCError(400, "invalid_existing_id")
                    oc_id = str(value) if value is not None else uuid.uuid5(uuid.NAMESPACE_URL, canonical([kind, uid, record["code"]])).hex
                    if oc_id in ids: raise OCError(400, "duplicate_global_id")
                    ids.add(oc_id); accepted.append((oc_id, record))
                except OCError as error:
                    errors.append({**where, "record_index": index, "reason": error.code})
            combined[key] = accepted
    payload = {key: [record for _, record in records] for key, records in combined.items()}
    # Legal (codes are unique per owner), but the public show page then resolves to the first owner.
    code_owners = {}
    for key, records in payload.items():
        for record in records: code_owners.setdefault(record["code"], set()).add(key)
    shared_codes = sum(len(keys) > 1 for keys in code_owners.values())
    report = {"valid": not errors, "sources": sources_meta, "owners": len(combined),
              "codes_shared_across_owners": shared_codes,
              "records": sum(len(x) for x in combined.values()), "content_hash": digest(payload), "errors": errors}
    return combined, payload, report


def migrate(sources, conn, apply=False):
    entries, payload, report = inventory(sources, conn)
    if not report["valid"] or not apply: return report
    initialize_schema(conn)
    session = SqlSession(conn)
    source_hash = digest(report["sources"])
    current = session.snapshot()
    if current and digest(current) != report["content_hash"]:
        # No overwrite/upsert: post-cutover edits, partial/other imports are never replaced.
        raise OCError(409, "sql_contents_differ_from_import")
    if not current:
        for position, (key, records) in enumerate(entries.items()):
            kind, uid = owner(parse_owner(key))
            conn.execute("INSERT INTO oc_owners VALUES (?,?,?)", (kind, uid, position))
            for index, (oc_id, record) in enumerate(records):
                data = record["data"]
                created = record.get("created_at") or data.get("createdAt")
                updated = record.get("updated_at") or data.get("updatedAt") or created
                # Preserve usable legacy time strings verbatim; never fabricate an old date.
                created = created if isinstance(created, str) else None
                updated = updated if isinstance(updated, str) else None
                conn.execute("INSERT INTO oc_records VALUES (?,?,?,?,?,?,?,?,?,?)",
                             (oc_id, kind, uid, record["code"], str(data.get("name") or ""), canonical(record),
                              created, updated, 1, index))
    if digest(session.snapshot()) != report["content_hash"] or not metadata_valid(conn):
        raise OCError(409, "migration_content_verification_failed")
    conn.execute("INSERT OR IGNORE INTO oc_migrations VALUES (?,?,?,?)",
                 (source_hash, report["content_hash"], report["records"], datetime.now(timezone.utc).isoformat()))
    report.update(applied=True, verified=True)
    return report


def metadata_valid(conn):
    owners = {(row[0], row[1]) for row in conn.execute("SELECT owner_kind,owner_uid FROM oc_owners")}
    for row in conn.execute("SELECT * FROM oc_records"):
        record = json.loads(row["record_json"])
        if ((row["owner_kind"], row["owner_uid"]) not in owners or row["code"] != record.get("code")
                or row["name"] != str(record.get("data", {}).get("name") or "")
                or (record.get("id") is not None and row["id"] != str(record["id"]))):
            return False
    return True


def verify(sources, conn):
    _, _, report = inventory(sources, conn)
    if report["valid"]:
        report["integrity_ok"] = [row[0] for row in conn.execute("PRAGMA integrity_check")] == ["ok"]
        report["verified"] = (digest(SqlSession(conn).snapshot()) == report["content_hash"]
                              and conn.execute("SELECT count(*) FROM oc_records").fetchone()[0] == report["records"]
                              and metadata_valid(conn) and report["integrity_ok"])
    return report


def export_snapshot(conn, output):
    """Exclusive new output only. Includes SQL-side creates/updates/deletes, not stale JSON."""
    payload = SqlSession(conn).snapshot()
    raw = json.dumps(payload, ensure_ascii=False, allow_nan=False, indent=2).encode()
    with __import__("os").fdopen(__import__("os").open(output, __import__("os").O_WRONLY | __import__("os").O_CREAT | __import__("os").O_EXCL, 0o600), "wb") as stream:
        stream.write(raw); stream.flush()
        __import__('os').fsync(stream.fileno())
    if digest(json.loads(Path(output).read_text(encoding="utf-8"))) != digest(payload):
        raise OCError(409, "export_verification_failed")
    if not metadata_valid(conn): raise OCError(409, "sql_metadata_verification_failed")
    # Kept with the rollback artifact, never sent to application clients or logs.
    metadata = [dict(row) for row in conn.execute("SELECT id,owner_kind,owner_uid,code,created_at,updated_at,version,position FROM oc_records")]
    report = {"verified": True, "content_hash": digest(payload), "records": sum(map(len, payload.values())),
              "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    manifest = str(output) + ".manifest.json"
    with __import__("os").fdopen(__import__("os").open(manifest, __import__("os").O_WRONLY | __import__("os").O_CREAT | __import__("os").O_EXCL, 0o600), "w", encoding="utf-8") as stream:
        json.dump({**report, "oc_metadata": metadata}, stream, indent=2)
    return report
