"""Small SQLite-backed metadata registry for files under a managed asset root.

The registry does not move files or expose an HTTP endpoint. Callers must enforce
account/module policy through the supplied authorization callback before resolving
non-public assets.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import mimetypes
from pathlib import Path
import sqlite3
import uuid
from contextlib import closing
from storage_paths import asset_registry_path, asset_storage_roots


SCHEMA_VERSION = 1
SCOPES = {"public", "unlisted", "private"}


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _text(value, field, limit=500, required=False):
    if not isinstance(value, str) or len(value) > limit or "\x00" in value:
        raise ValueError(f"invalid {field}")
    result = value.strip()
    if required and not result:
        raise ValueError(f"{field} is required")
    return result


class AssetRegistry:
    def __init__(self, database=None, storage_roots=None):
        self.database = Path(database or asset_registry_path())
        roots = storage_roots or asset_storage_roots()
        self.storage_roots = {key: Path(value).resolve() for key, value in roots.items()}
        self.database.parent.mkdir(parents=True, exist_ok=True)
        with closing(self._connect()) as db, db:
            if db.execute("SELECT 1 FROM sqlite_master WHERE name='registry_meta'").fetchone():
                row = db.execute("SELECT value FROM registry_meta WHERE key='schema_version'").fetchone()
                if row and int(row[0]) > SCHEMA_VERSION:
                    raise RuntimeError("asset registry schema is newer than this code")
            db.executescript("""
                CREATE TABLE IF NOT EXISTS registry_meta (
                    key TEXT PRIMARY KEY, value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS asset_versions (
                    asset_id TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    module TEXT NOT NULL,
                    asset_type TEXT NOT NULL,
                    storage_class TEXT NOT NULL,
                    storage_key TEXT NOT NULL,
                    sha256 TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    mime_type TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    source TEXT NOT NULL DEFAULT '',
                    author TEXT NOT NULL DEFAULT '',
                    license TEXT NOT NULL DEFAULT '',
                    content_id TEXT NOT NULL DEFAULT '',
                    access_scope TEXT NOT NULL CHECK(access_scope IN ('public','unlisted','private')),
                    preview_of TEXT NOT NULL DEFAULT '',
                    PRIMARY KEY(asset_id, version)
                );
                CREATE INDEX IF NOT EXISTS asset_versions_sha256 ON asset_versions(sha256);
                CREATE INDEX IF NOT EXISTS asset_versions_content ON asset_versions(module, content_id);
                CREATE TABLE IF NOT EXISTS asset_references (
                    asset_id TEXT NOT NULL,
                    reference_type TEXT NOT NULL,
                    reference_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY(asset_id, reference_type, reference_id)
                );
            """)
            row = db.execute("SELECT value FROM registry_meta WHERE key='schema_version'").fetchone()
            if row and int(row[0]) > SCHEMA_VERSION:
                raise RuntimeError("asset registry schema is newer than this code")
            db.execute(
                "INSERT INTO registry_meta(key,value) VALUES('schema_version',?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (str(SCHEMA_VERSION),),
            )

    def _connect(self):
        db = sqlite3.connect(self.database, timeout=10)
        try:
            db.row_factory = sqlite3.Row
            db.execute("PRAGMA busy_timeout=10000")
        except Exception:
            db.close()
            raise
        return db

    def register_file(self, path, *, module, asset_type, storage_class="source", access_scope="private",
                      source="", author="", license="", content_id="",
                      asset_id=None, preview_of="", mime_type=None):
        file_path = Path(path).resolve(strict=True)
        if storage_class not in self.storage_roots:
            raise ValueError("unknown asset storage class")
        root = self.storage_roots[storage_class]
        try:
            storage_key = file_path.relative_to(root).as_posix()
        except ValueError as error:
            raise ValueError("asset must be inside the configured asset root") from error
        if not file_path.is_file():
            raise ValueError("asset must be a regular file")
        if access_scope not in SCOPES:
            raise ValueError("invalid access scope")
        module = _text(module, "module", 80, required=True)
        asset_type = _text(asset_type, "asset_type", 80, required=True)
        source = _text(source, "source")
        author = _text(author, "author")
        license = _text(license, "license", 120)
        content_id = _text(content_id, "content_id", 160)
        preview_of = _text(preview_of, "preview_of", 80)
        before = file_path.stat()
        digest = hashlib.sha256()
        with file_path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        after = file_path.stat()
        if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise RuntimeError(f"asset changed while hashing: {storage_key}")
        detected_mime = _text(mime_type or mimetypes.guess_type(file_path.name)[0] or "application/octet-stream",
                              "mime_type", 160, required=True)
        asset_id = _text(asset_id or uuid.uuid4().hex, "asset_id", 80, required=True)
        now = _now()
        with closing(self._connect()) as db, db:
            # Serialize version allocation and insertion, including independent processes.
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT * FROM asset_versions WHERE asset_id=? ORDER BY version DESC LIMIT 1", (asset_id,)).fetchone()
            metadata = (module, asset_type, storage_class, storage_key, digest.hexdigest(), after.st_size,
                        detected_mime, source, author, license, content_id, access_scope, preview_of)
            fields = ("module", "asset_type", "storage_class", "storage_key", "sha256", "size_bytes",
                      "mime_type", "source", "author", "license", "content_id", "access_scope", "preview_of")
            if row and tuple(row[field] for field in fields) == metadata:
                return dict(row)
            if row and (row["module"], row["storage_class"]) != (module, storage_class):
                raise ValueError("an asset ID cannot change its module or storage class")
            if preview_of and db.execute("SELECT 1 FROM asset_versions WHERE asset_id=?", (preview_of,)).fetchone() is None:
                raise KeyError(preview_of)
            version = int(row["version"]) + 1 if row else 1
            db.execute("""INSERT INTO asset_versions (
                asset_id,version,module,asset_type,storage_class,storage_key,sha256,size_bytes,mime_type,
                created_at,updated_at,source,author,license,content_id,access_scope,preview_of
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (
                asset_id, version, *metadata[:7], row["created_at"] if row else now, now, *metadata[7:],
            ))
        return self.get_record(asset_id, version)

    def get_record(self, asset_id, version=None):
        with closing(self._connect()) as db, db:
            if version is None:
                row = db.execute("""SELECT * FROM asset_versions
                    WHERE asset_id=? ORDER BY version DESC LIMIT 1""", (asset_id,)).fetchone()
            else:
                row = db.execute("SELECT * FROM asset_versions WHERE asset_id=? AND version=?", (asset_id, version)).fetchone()
        return dict(row) if row else None

    def resolve_path(self, asset_id, *, authorize=None):
        record = self.get_record(asset_id)
        if record is None:
            raise KeyError(asset_id)
        if record["access_scope"] != "public" and (authorize is None or not authorize(record)):
            raise PermissionError("asset access denied")
        root = self.storage_roots.get(record["storage_class"])
        if root is None:
            raise RuntimeError("asset storage class is not configured")
        target = (root / record["storage_key"]).resolve()
        try:
            target.relative_to(root)
        except ValueError as error:
            raise ValueError("registered asset path escapes the asset root") from error
        if not target.is_file():
            raise FileNotFoundError(record["storage_key"])
        return target

    def import_tree(self, storage_class, *, module, asset_type="original", access_scope="private",
                    source="", author="", license=""):
        """Index existing files without copying them or changing their authorization.

        Stable IDs and unchanged-record detection make interrupted imports resumable.
        Versions record metadata history; the registry does not preserve old file bytes.
        """
        if storage_class not in self.storage_roots:
            raise ValueError("unknown asset storage class")
        root = self.storage_roots[storage_class]
        if not root.is_dir():
            raise FileNotFoundError(root)
        records = []
        for file_path in sorted(root.rglob("*")):
            if file_path.is_symlink():
                raise ValueError(f"asset import rejects symbolic links: {file_path}")
            if not file_path.is_file():
                continue
            if file_path.resolve() == self.database.resolve():
                raise ValueError("registry database must be outside the imported asset tree")
            key = file_path.relative_to(root).as_posix()
            asset_id = uuid.uuid5(uuid.NAMESPACE_URL, f"iridescently:{storage_class}:{module}:{key}").hex
            records.append(self.register_file(
                file_path, module=module, asset_type=asset_type, storage_class=storage_class,
                access_scope=access_scope, source=source, author=author, license=license, asset_id=asset_id,
            ))
        return records

    def add_reference(self, asset_id, reference_type, reference_id):
        if self.get_record(asset_id) is None:
            raise KeyError(asset_id)
        values = (_text(reference_type, "reference_type", 80, required=True),
                  _text(reference_id, "reference_id", 160, required=True))
        with closing(self._connect()) as db, db:
            db.execute("""INSERT OR IGNORE INTO asset_references
                (asset_id,reference_type,reference_id,created_at) VALUES (?,?,?,?)""",
                       (asset_id, *values, _now()))

    def list_references(self, asset_id):
        with closing(self._connect()) as db, db:
            return [dict(row) for row in db.execute(
                "SELECT * FROM asset_references WHERE asset_id=? ORDER BY reference_type,reference_id", (asset_id,)
            )]


def main():
    parser = argparse.ArgumentParser(description="Index existing original/managed assets; never moves or deletes files.")
    parser.add_argument("command", choices=["import"])
    parser.add_argument("root", type=Path)
    parser.add_argument("--database", type=Path, required=True)
    parser.add_argument("--storage-class", choices=["source", "managed", "cache"], default="managed")
    parser.add_argument("--module", required=True)
    parser.add_argument("--asset-type", default="original")
    parser.add_argument("--access-scope", choices=sorted(SCOPES), default="private")
    parser.add_argument("--source", default="local migration; rights not inferred")
    parser.add_argument("--author", default="")
    parser.add_argument("--license", default="")
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    for target in (args.database, args.manifest):
        if target.resolve().is_relative_to(args.root.resolve()):
            parser.error("registry database and import manifest must be outside the imported asset tree")
    registry = AssetRegistry(args.database, {args.storage_class: args.root})
    records = registry.import_tree(args.storage_class, module=args.module, asset_type=args.asset_type,
                                   access_scope=args.access_scope, source=args.source,
                                   author=args.author, license=args.license)
    manifest = {"schema": 1, "createdAt": _now(), "storageClass": args.storage_class,
                "fileCount": len(records), "sizeBytes": sum(record["size_bytes"] for record in records),
                "assets": records}
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.manifest.with_name(args.manifest.name + ".tmp")
    temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(args.manifest)
    print(json.dumps({key: value for key, value in manifest.items() if key != "assets"}))


if __name__ == "__main__":
    main()
