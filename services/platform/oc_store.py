"""Owner-scoped OC storage. SQL is opt-in; legacy JSON remains authoritative by default.

Only this module accesses OC tables/files. A storage fence prevents cooperating old/new
adapters from writing across a cutover. Stop older binaries that predate this fence.
"""
from contextlib import contextmanager, closing
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import threading
import time
import uuid


class OCError(Exception):
    def __init__(self, status, code):
        self.status, self.code = status, code
        super().__init__(code)


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def owner(ident):
    kind, uid = ident.get("kind"), str(ident.get("uid") or "")
    if kind not in {"local", "usso"} or not uid or ":" in uid or uid.strip() != uid:
        raise OCError(400, "invalid_oc_owner")
    return kind, uid


def owner_key(ident):
    kind, uid = owner(ident)
    return "local:" + uid if kind == "local" else uid


def parse_owner(key):
    if not isinstance(key, str):
        raise OCError(400, "invalid_oc_owner")
    ident = {"kind": "local" if key.startswith("local:") else "usso",
             "uid": key[6:] if key.startswith("local:") else key}
    owner(ident)
    return ident


def clean_record(record):
    out = deepcopy(record)
    out.pop("_oc_version", None)
    out.pop("_oc_id", None)
    return out


def validate_record(record):
    if (not isinstance(record, dict) or not isinstance(record.get("code"), str)
            or not record["code"].strip() or record["code"].strip() != record["code"]
            or not isinstance(record.get("data"), dict)):
        raise OCError(400, "invalid_oc_record")
    try:
        canonical(record)
    except (TypeError, ValueError):
        raise OCError(400, "invalid_oc_json") from None


def initialize_schema(conn):
    # Execute individually: executescript would implicitly commit an outer transaction.
    for statement in (
        """CREATE TABLE IF NOT EXISTS oc_records (
            id TEXT PRIMARY KEY, owner_kind TEXT NOT NULL CHECK(owner_kind IN ('local','usso')),
            owner_uid TEXT NOT NULL CHECK(length(owner_uid)>0), code TEXT NOT NULL CHECK(length(code)>0),
            name TEXT NOT NULL, record_json TEXT NOT NULL CHECK(json_valid(record_json)),
            created_at TEXT, updated_at TEXT, version INTEGER NOT NULL CHECK(version>0),
            position INTEGER NOT NULL, UNIQUE(owner_kind, owner_uid, code))""",
        "CREATE INDEX IF NOT EXISTS oc_records_owner ON oc_records(owner_kind, owner_uid, position)",
        "CREATE INDEX IF NOT EXISTS oc_records_code ON oc_records(code)",
        """CREATE TABLE IF NOT EXISTS oc_owners (
            owner_kind TEXT NOT NULL, owner_uid TEXT NOT NULL, position INTEGER NOT NULL,
            PRIMARY KEY(owner_kind, owner_uid))""",
        """CREATE TABLE IF NOT EXISTS oc_code_revisions (
            owner_kind TEXT NOT NULL, owner_uid TEXT NOT NULL, code TEXT NOT NULL, version INTEGER NOT NULL,
            PRIMARY KEY(owner_kind,owner_uid,code))""",
        """CREATE TABLE IF NOT EXISTS oc_migrations (
            source_hash TEXT PRIMARY KEY, content_hash TEXT NOT NULL, record_count INTEGER NOT NULL,
            imported_at TEXT NOT NULL)""",
    ):
        conn.execute(statement)


def open_database(path):
    """Existing environment DB only; never silently create a missing SQL authority."""
    conn = sqlite3.connect(Path(path).resolve().as_uri() + "?mode=rw", uri=True, timeout=10)
    try:
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout=10000")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA synchronous=FULL")
        return conn
    except Exception:
        conn.close()
        raise


_LOCKS = {}
_LOCKS_GUARD = threading.Lock()


@contextmanager
def fence(directory, exclusive=True):
    """Per-thread + interprocess fence, including cutovers. Never stored in source."""
    path = str(Path(directory).resolve() / "characters-storage.lock")
    with _LOCKS_GUARD:
        lock = _LOCKS.setdefault(path, threading.RLock())
    with lock, open(path, "a+b") as stream:
        if sys.platform == "win32":
            import msvcrt
            stream.seek(0)
            if not stream.read(1):
                stream.write(b"0"); stream.flush()
            stream.seek(0)
            msvcrt.locking(stream.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl
            fcntl.flock(stream, fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH)
        try:
            yield
        finally:
            if sys.platform == "win32":
                stream.seek(0); msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream, fcntl.LOCK_UN)


def state(directory):
    file = Path(directory) / "characters-storage-state.json"
    if not file.exists():
        return {"schema": 1, "backend": "json"}
    try: value = json.loads(file.read_text(encoding="utf-8"))
    except (OSError, ValueError): raise OCError(503, "invalid_oc_storage_state") from None
    if not isinstance(value, dict) or value.get("schema") != 1 or value.get("backend") not in {"json", "sqlite", "frozen"}:
        raise OCError(503, "invalid_oc_storage_state")
    return value


def atomic_json(path, data):
    temporary = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    try:
        with os.fdopen(os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w", encoding="utf-8") as stream:
            json.dump(data, stream, ensure_ascii=False, allow_nan=False, indent=2)
            stream.flush(); os.fsync(stream.fileno())
        os.replace(temporary, path)
        if hasattr(os, "O_DIRECTORY"):
            descriptor = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
            try: os.fsync(descriptor)
            finally: os.close(descriptor)
    finally:
        temporary.unlink(missing_ok=True)


def require_safe_wal(conn):
    # Official WAL-reset fix: https://sqlite.org/wal.html#walreset
    version = sqlite3.sqlite_version_info
    patched = (version >= (3, 51, 3) or (3, 50, 7) <= version < (3, 51, 0)
               or (3, 44, 6) <= version < (3, 45, 0))
    # Unset counts as deployed: an old-layout host may never export IRIDESCENTLY_ENVIRONMENT.
    if (os.environ.get("IRIDESCENTLY_ENVIRONMENT", "").strip() not in {"development", "test"}
            and not patched and conn.execute("PRAGMA journal_mode").fetchone()[0].lower() == "wal"):
        raise OCError(503, "oc_sqlite_wal_patch_required")


class Store:
    def __init__(self, directory, connection_factory, backend="json"):
        if backend not in {"json", "sqlite"}:
            raise ValueError("IRIDESCENTLY_OC_BACKEND must be json or sqlite")
        self.directory, self.connect, self.backend = Path(directory), connection_factory, backend
        self.file = self.directory / "characters.json"

    @contextmanager
    def transaction(self, write=False, conn=None):
        # Shared OS fence keeps cutover exclusive; SQLite handles interprocess writers.
        with fence(self.directory, exclusive=(self.backend == "json" and write)):
            if state(self.directory)["backend"] != self.backend:
                raise OCError(503, "oc_storage_frozen_or_backend_mismatch")
            connection, owned = conn, conn is None
            try:
                if connection is None and (self.backend == "sqlite" or write):
                    connection = self.connect()
                if self.backend == "sqlite": require_safe_wal(connection)
                if connection is not None and owned:
                    connection.execute("BEGIN IMMEDIATE" if write else "BEGIN")
                if self.backend == "json":
                    data = json.loads(self.file.read_text(encoding="utf-8")) if self.file.exists() else {}
                    session = JsonSession(data, connection)
                else:
                    session = SqlSession(connection)
                yield session
                if self.backend == "json" and write and session.dirty:
                    atomic_json(self.file, session.data)
                if connection is not None and owned:
                    connection.commit()
            except sqlite3.IntegrityError:
                if connection is not None and owned: connection.rollback()
                raise OCError(409, "oc_constraint_conflict") from None
            except sqlite3.Error:
                if connection is not None and owned: connection.rollback()
                raise OCError(503, "oc_database_unavailable") from None
            except (OSError, ValueError, TypeError):
                if connection is not None and owned: connection.rollback()
                raise OCError(503, "oc_storage_unavailable") from None
            except Exception:
                if connection is not None and owned: connection.rollback()
                raise
            finally:
                if connection is not None and owned: connection.close()

    def snapshot(self):
        with self.transaction() as session:
            return session.snapshot()

    def list(self, ident):
        with self.transaction() as session:
            return session.list(ident)

    def get(self, ident, code=None, oc_id=None):
        with self.transaction() as session:
            return session.get(ident, code, oc_id)

    def public_records(self, code):
        with self.transaction() as session:
            if self.backend == "sqlite":
                # Same order as the legacy JSON scan (owner bucket, then record) so a code shared by
                # several owners keeps resolving to the record it resolved to before cutover.
                rows = session.conn.execute("""SELECT r.* FROM oc_records r JOIN oc_owners o
                    ON o.owner_kind=r.owner_kind AND o.owner_uid=r.owner_uid
                    WHERE r.code=? ORDER BY o.position, o.owner_kind, o.owner_uid, r.position, r.id""", (code,))
                return [record for record in map(session.record, rows) if record.get("html") or record.get("html_ref")]
            return [record for records in session.data.values() for record in records
                    if record.get("code") == code and (record.get("html") or record.get("html_ref"))]

    def admin_rows(self):
        with self.transaction() as session:
            if self.backend == "sqlite":
                rows = session.conn.execute("""SELECT owner_kind,owner_uid,code,name,version,
                    json_extract(record_json,'$.data.species_type') AS species,
                    (COALESCE(json_extract(record_json,'$.html'),'') != '' OR COALESCE(json_extract(record_json,'$.html_ref'),'') != '') AS has_show
                    FROM oc_records ORDER BY owner_kind,owner_uid,position""")
                return [{"owner": owner_key({"kind":row["owner_kind"],"uid":row["owner_uid"]}),
                         "code":row["code"],"name":row["name"] or row["code"],"species":row["species"] or "",
                         "has_show":bool(row["has_show"]),"version":row["version"]} for row in rows]
            return [{"owner":key,"code":record["code"],"name":record["data"].get("name") or record["code"],
                     "species":record["data"].get("species_type", ""),"has_show":bool(record.get("html") or record.get("html_ref")),
                     "version":None} for key,records in session.data.items() for record in records]


class JsonSession:
    """Compatibility adapter: one fenced read-modify-replace, no SQL OC dual-write."""
    def __init__(self, data, conn):
        if not isinstance(data,dict): raise OCError(503, "invalid_oc_json")
        self.data, self.conn, self.dirty = data, conn, False

    def snapshot(self): return deepcopy(self.data)
    def list(self, ident): return deepcopy(self.data.get(owner_key(ident), []))

    def get(self, ident, code=None, oc_id=None):
        return next((x for x in self.list(ident) if x.get("code") == code), None)

    def save(self, ident, record, expected=None, previous_code=None):
        validate_record(record)
        key, records = owner_key(ident), self.list(ident)
        before = next((x for x in records if x.get("code") == (previous_code or record["code"])), None)
        if previous_code and previous_code != record["code"] and any(x["code"] == record["code"] for x in records):
            raise OCError(409, "oc_code_conflict")
        saved = {**(before or {}), **clean_record(record)}
        if record.get("html_ref"): saved.pop("html", None)
        if before: records[records.index(before)] = saved
        else: records.insert(0, saved)
        self.data[key], self.dirty = records, True
        return deepcopy(saved), before is None

    def replace(self, ident, records, versions=None):
        if len({x.get("code") for x in records}) != len(records): raise OCError(400, "duplicate_oc_code")
        for record in records: validate_record(record)
        old = {x["code"]: x for x in self.list(ident)}
        self.data[owner_key(ident)] = [{**old.get(x["code"], {}), **clean_record(x)} for x in records]
        self.dirty = True
        return self.list(ident)

    def delete(self, ident, code, expected=None):
        records = self.list(ident)
        self.data[owner_key(ident)] = [x for x in records if x.get("code") != code]
        self.dirty = True
        return len(records) - len(self.data[owner_key(ident)])

    def delete_owner(self, ident):
        self.data.pop(owner_key(ident), None); self.dirty = True


class SqlSession:
    def __init__(self, conn): self.conn = conn

    @staticmethod
    def record(row):
        if row is None: return None
        out = json.loads(row["record_json"])
        out.update(_oc_version=row["version"], _oc_id=row["id"])
        return out

    def list(self, ident):
        return [self.record(row) for row in self.conn.execute(
            "SELECT * FROM oc_records WHERE owner_kind=? AND owner_uid=? ORDER BY position, id", owner(ident))]

    def get(self, ident, code=None, oc_id=None):
        field, value = ("id", oc_id) if oc_id is not None else ("code", code)
        return self.record(self.conn.execute(
            f"SELECT * FROM oc_records WHERE owner_kind=? AND owner_uid=? AND {field}=?", (*owner(ident), value)).fetchone())

    def snapshot(self):
        out = {owner_key({"kind":row["owner_kind"],"uid":row["owner_uid"]}): []
               for row in self.conn.execute("SELECT * FROM oc_owners ORDER BY position,owner_kind,owner_uid")}
        for row in self.conn.execute("SELECT owner_kind,owner_uid,record_json FROM oc_records ORDER BY owner_kind,owner_uid,position,id"):
            key = owner_key({"kind":row["owner_kind"],"uid":row["owner_uid"]})
            if key not in out: raise OCError(503, "invalid_oc_owner_index")
            out[key].append(json.loads(row["record_json"]))
        return out

    @staticmethod
    def require_version(expected, current):
        if expected is None:
            raise OCError(428, "oc_version_required")
        if not isinstance(expected, int) or isinstance(expected, bool) or expected < 0: raise OCError(400, "invalid_oc_version")
        if expected != current: raise OCError(409, "oc_version_conflict")

    def save(self, ident, record, expected=None, previous_code=None):
        validate_record(record)
        kind, uid = owner(ident)
        table, field = ("local_users", "uid") if kind == "local" else ("users", "user_id")
        if not self.conn.execute(f"SELECT 1 FROM {table} WHERE {field}=?", (uid,)).fetchone():
            raise OCError(403, "oc_owner_unavailable")
        if expected is not None and (not isinstance(expected,int) or isinstance(expected,bool) or expected<0):
            raise OCError(400, "invalid_oc_version")
        before = self.get(ident, previous_code or record["code"])
        if before:
            self.require_version(expected, before["_oc_version"])
        elif previous_code or expected not in (None, 0):
            raise OCError(409, "oc_version_conflict")
        last = self.conn.execute("SELECT version FROM oc_code_revisions WHERE owner_kind=? AND owner_uid=? AND code=?",
                                 (kind, uid, record["code"])).fetchone()
        revision = max(before["_oc_version"] if before else 0, last[0] if last else 0) + 1
        now = datetime.now(timezone.utc).isoformat()
        saved = {**clean_record(before or {}), **clean_record(record)}
        if record.get("html_ref"): saved.pop("html", None)
        if before and saved.get("id") is not None and str(saved["id"]) != before["_oc_id"]:
            raise OCError(400, "immutable_oc_id")
        name = str(saved["data"].get("name") or "")
        if before:
            changed = self.conn.execute(
                """UPDATE oc_records SET code=?, name=?, record_json=?, updated_at=?, version=?
                WHERE id=? AND owner_kind=? AND owner_uid=? AND version=?""",
                (record["code"], name, canonical(saved), now, revision, before["_oc_id"], kind, uid, expected))
            if changed.rowcount != 1: raise OCError(409, "oc_version_conflict")
        else:
            self.conn.execute("INSERT OR IGNORE INTO oc_owners VALUES (?,?,?)", (kind, uid, time.time_ns()))
            self.conn.execute("INSERT INTO oc_records VALUES (?,?,?,?,?,?,?,?,?,?)",
                              (str(saved.get("id")) if saved.get("id") is not None else uuid.uuid4().hex, kind, uid, record["code"], name, canonical(saved),
                               now, now, revision, -time.time_ns()))
        if before and before["code"] != record["code"]:
            self._remember_revision(ident, before["code"], before["_oc_version"])
        self._remember_revision(ident, record["code"], revision)
        return self.get(ident, record["code"]), before is None

    def replace(self, ident, records, versions=None):
        old = self.list(ident)
        actual = {x["code"]: x["_oc_version"] for x in old}
        if not isinstance(versions, dict): raise OCError(428, "oc_versions_required")
        if any(not isinstance(v,int) or isinstance(v,bool) or v<1 for v in versions.values()): raise OCError(400, "invalid_oc_version")
        if versions != actual: raise OCError(409, "oc_version_conflict")
        if len({x.get("code") for x in records}) != len(records): raise OCError(400, "duplicate_oc_code")
        for record in records: validate_record(record)
        incoming = {x["code"] for x in records}
        for record in old:
            if record["code"] not in incoming: self.delete(ident, record["code"], record["_oc_version"])
        for index, record in enumerate(records):
            self.save(ident, record, actual.get(record["code"], 0))
            self.conn.execute("UPDATE oc_records SET position=? WHERE owner_kind=? AND owner_uid=? AND code=?",
                              (index, *owner(ident), record["code"]))
        return self.list(ident)

    def _remember_revision(self, ident, code, revision):
        self.conn.execute("""INSERT INTO oc_code_revisions VALUES (?,?,?,?)
            ON CONFLICT(owner_kind,owner_uid,code) DO UPDATE SET version=max(version,excluded.version)""",
            (*owner(ident), code, revision))

    def delete(self, ident, code, expected=None):
        current = self.get(ident, code)
        if not current: raise OCError(404, "oc_not_found")
        self.require_version(expected, current["_oc_version"])
        changed = self.conn.execute("DELETE FROM oc_records WHERE owner_kind=? AND owner_uid=? AND code=? AND version=?",
                                    (*owner(ident), code, expected))
        if changed.rowcount != 1: raise OCError(409, "oc_version_conflict")
        self._remember_revision(ident, code, current["_oc_version"])
        return changed.rowcount

    def delete_owner(self, ident):
        for record in self.list(ident): self._remember_revision(ident, record["code"], record["_oc_version"])
        self.conn.execute("DELETE FROM oc_records WHERE owner_kind=? AND owner_uid=?", owner(ident))
        self.conn.execute("DELETE FROM oc_owners WHERE owner_kind=? AND owner_uid=?", owner(ident))
