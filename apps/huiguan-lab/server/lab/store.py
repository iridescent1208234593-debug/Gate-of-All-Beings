"""SQLite persistence for the LAB gateway.

What lives here (server-shared world + security, never personal OC data):
  codes            test codes (HMAC digest only), status, role flags, last use
  sessions         7-day sessions (token digest only), bound to a code
  players          minimal player identity: nickname + last space/position
  spaces           public hall + private 灵质空间, owner, linked R4 branch
  space_acl        invites to private spaces
  world_objects    shared interaction results per space
  audit            admin operations
  security_events  auth failures, lockouts, revocations (never plaintext codes)
  art_assets       art-team test uploads awaiting review
  lab_tiles        ground tiles players place (dirt path), one per 1 m cell
"""
from __future__ import annotations

import json
import sqlite3
import threading
import time
from pathlib import Path

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS codes(
  id TEXT PRIMARY KEY, digest TEXT NOT NULL UNIQUE, label TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('player','monitor','art')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled','revoked')),
  created_at REAL NOT NULL, last_used_at REAL, last_ip_hint TEXT, use_count INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(
  digest TEXT PRIMARY KEY, code_id TEXT NOT NULL REFERENCES codes(id) ON DELETE CASCADE,
  created_at REAL NOT NULL, expires_at REAL NOT NULL, last_seen_at REAL NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_code ON sessions(code_id);
CREATE TABLE IF NOT EXISTS players(
  code_id TEXT PRIMARY KEY REFERENCES codes(id) ON DELETE CASCADE, pid TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL DEFAULT '', space TEXT NOT NULL DEFAULT 'hall',
  x REAL, z REAL, dir REAL NOT NULL DEFAULT 0, updated_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS spaces(
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('public','private')), title TEXT NOT NULL,
  owner_pid TEXT, template TEXT NOT NULL, r4_branch TEXT, r4_snapshot TEXT, created_at REAL NOT NULL,
  state TEXT NOT NULL DEFAULT '{}', paused INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS space_acl(
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE, pid TEXT NOT NULL,
  granted_at REAL NOT NULL, PRIMARY KEY(space_id, pid));
CREATE TABLE IF NOT EXISTS world_objects(
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE, object_id TEXT NOT NULL,
  state TEXT NOT NULL, updated_at REAL NOT NULL, PRIMARY KEY(space_id, object_id));
CREATE TABLE IF NOT EXISTS audit(
  id INTEGER PRIMARY KEY AUTOINCREMENT, at REAL NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS security_events(
  id INTEGER PRIMARY KEY AUTOINCREMENT, at REAL NOT NULL, kind TEXT NOT NULL, ip_hint TEXT NOT NULL DEFAULT '',
  code_id TEXT, detail TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS life_guide(
  pid TEXT PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('new','active','paused','completed','skipped','veteran')),
  seen TEXT NOT NULL DEFAULT '[]', updated_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS art_assets(
  id TEXT PRIMARY KEY, uploader TEXT NOT NULL, category TEXT NOT NULL, filename TEXT NOT NULL,
  mime TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, bytes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at REAL NOT NULL, reviewed_at REAL, reviewer TEXT);
CREATE TABLE IF NOT EXISTS lab_tiles(
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE, x INTEGER NOT NULL, z INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'dirt', placed_by TEXT NOT NULL, placed_at REAL NOT NULL, PRIMARY KEY(space_id, x, z));
CREATE TABLE IF NOT EXISTS garden_progress(pid TEXT PRIMARY KEY, phase INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS garden_inventory(
  pid TEXT PRIMARY KEY, seeds INTEGER NOT NULL DEFAULT 1 CHECK(seeds>=0), soil INTEGER NOT NULL DEFAULT 1 CHECK(soil>=0));
CREATE TABLE IF NOT EXISTS lab_entities(
  id TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  state TEXT NOT NULL, updated_at REAL NOT NULL);
"""


class Store:
    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.lock = threading.RLock()
        self.db = sqlite3.connect(str(path), check_same_thread=False, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)
        self.db.execute("PRAGMA synchronous=NORMAL")
        with self.lock:
            if not self.one("SELECT 1 FROM spaces WHERE id='hall'"):
                self.exec("INSERT INTO spaces(id,kind,title,owner_pid,template,created_at) VALUES('hall','public','西木会馆',NULL,'hall',?)",
                          (time.time(),))

    # --- primitives -----------------------------------------------------------------
    def exec(self, sql: str, args: tuple = ()) -> sqlite3.Cursor:
        with self.lock:
            return self.db.execute(sql, args)

    def one(self, sql: str, args: tuple = ()) -> sqlite3.Row | None:
        with self.lock:
            return self.db.execute(sql, args).fetchone()

    def all(self, sql: str, args: tuple = ()) -> list[sqlite3.Row]:
        with self.lock:
            return self.db.execute(sql, args).fetchall()

    def tx(self):
        store = self

        class _Tx:
            def __enter__(self):
                store.lock.acquire(); store.db.execute("BEGIN IMMEDIATE"); return store
            def __exit__(self, et, ev, tb):
                try:
                    store.db.execute("ROLLBACK" if et else "COMMIT")
                finally:
                    store.lock.release()
        return _Tx()

    # --- audit / security ------------------------------------------------------------
    def audit(self, actor: str, action: str, target: str = "", **detail) -> None:
        self.exec("INSERT INTO audit(at,actor,action,target,detail) VALUES(?,?,?,?,?)",
                  (time.time(), actor, action, target, json.dumps(detail, ensure_ascii=False)))

    def security(self, kind: str, ip_hint: str = "", code_id: str | None = None, **detail) -> None:
        self.exec("INSERT INTO security_events(at,kind,ip_hint,code_id,detail) VALUES(?,?,?,?,?)",
                  (time.time(), kind, ip_hint, code_id, json.dumps(detail, ensure_ascii=False)))

    def backup_to(self, target: Path) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        with self.lock:
            dst = sqlite3.connect(str(target))
            try:
                self.db.backup(dst)
            finally:
                dst.close()

    def close(self) -> None:
        with self.lock:
            self.db.close()
