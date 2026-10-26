"""Synthetic OC tests: ownership, OCC, threads/processes, rollback and migration fidelity."""
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from contextlib import closing
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from oc_store import Store, OCError, SqlSession, atomic_json, digest, initialize_schema, open_database
from oc_migration import migrate, verify, export_snapshot

A = {"kind": "local", "uid": "7"}
B = {"kind": "usso", "uid": "7"}


def record(code, **extra):
    return {"code": code, "data": {"code": code, "name": "测试角色", "custom": {"a": [1, None, False, {"unicode": "雪🐈"}]}}, **extra}


def process_save(args):
    directory, index = args
    store = Store(directory, lambda: open_database(Path(directory) / "users.db"), "sqlite")
    with store.transaction(write=True) as tx:
        tx.save(A if index % 2 else B, record("P" + str(index)), 0)
    return index


class StoreTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name)
        self.path = self.root / "users.db"
        with closing(sqlite3.connect(self.path)) as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("CREATE TABLE local_users(uid TEXT PRIMARY KEY)")
            db.execute("CREATE TABLE users(user_id TEXT PRIMARY KEY)")
            db.execute("INSERT INTO local_users VALUES ('7')")
            db.execute("INSERT INTO users VALUES ('7')")
            initialize_schema(db); db.commit()
        atomic_json(self.root / "characters-storage-state.json", {"schema": 1, "backend": "sqlite"})
        self.store = Store(self.root, lambda: open_database(self.path), "sqlite")

    def tearDown(self): self.temp.cleanup()

    def create(self, ident=A, code="C"):
        with self.store.transaction(write=True) as tx: return tx.save(ident, record(code), 0)[0]

    def test_crud_owner_kind_and_stable_id_on_rename(self):
        first = self.create(); self.create(A, "D"); self.create(B, "C")
        self.assertEqual(len(self.store.list(A)), 2)
        self.assertIsNone(self.store.get(B, oc_id=first['_oc_id']))
        self.assertNotEqual(self.store.get(B, "C")['_oc_id'], first['_oc_id'])
        with self.store.transaction(write=True) as tx:
            updated, _ = tx.save(A, record("Renamed"), 1, "C")
        self.assertEqual((updated['_oc_id'], updated['_oc_version']), (first['_oc_id'], 2))
        with self.assertRaises(OCError) as error:
            with self.store.transaction(write=True) as tx: tx.delete(A, "Renamed", 1)
        self.assertEqual(error.exception.status, 409)
        with self.store.transaction(write=True) as tx: tx.delete(A, "Renamed", 2)
        self.assertIsNone(self.store.get(A, "Renamed"))
        self.assertIsNotNone(self.store.get(B, "C"))

    def test_same_version_concurrent_edits_exactly_one_wins(self):
        self.create()
        def save(index):
            try:
                with self.store.transaction(write=True) as tx: tx.save(A, record("C", changed=index), 1)
                return 200
            except OCError as error: return error.status
        with ThreadPoolExecutor(12) as pool: statuses = list(pool.map(save, range(24)))
        self.assertEqual(statuses.count(200), 1)
        self.assertEqual(statuses.count(409), 23)
        self.assertEqual(self.store.get(A, "C")['_oc_version'], 2)

    def test_different_process_writers_do_not_drop_any_oc(self):
        with ProcessPoolExecutor(4) as pool: self.assertEqual(len(list(pool.map(process_save, [(str(self.root), i) for i in range(24)]))), 24)
        self.assertEqual(len(self.store.list(A)) + len(self.store.list(B)), 24)

    def test_missing_version_and_bulk_stale_snapshot_are_rejected(self):
        self.create()
        with self.assertRaises(OCError) as error:
            with self.store.transaction(write=True) as tx: tx.save(A, record("C"))
        self.assertEqual(error.exception.status, 428)
        self.create(A, "new-in-other-tab")
        with self.assertRaises(OCError) as error:
            with self.store.transaction(write=True) as tx: tx.replace(A, [record("C")], {"C": 1})
        self.assertEqual(error.exception.status, 409)
        self.assertEqual(len(self.store.list(A)), 2)

    def test_db_exception_rolls_back_entire_transaction_and_recovers(self):
        self.create()
        with self.assertRaises(OCError) as error:
            with self.store.transaction(write=True) as tx:
                tx.save(A, record("C", changed=True), 1)
                tx.save(A, record("half-created"), 0)
                raise sqlite3.OperationalError("sensitive synthetic failure detail")
        self.assertEqual((error.exception.status, str(error.exception)), (503, "oc_database_unavailable"))
        self.assertEqual(self.store.get(A, "C")['_oc_version'], 1)
        self.assertIsNone(self.store.get(A, "half-created"))
        with self.store.transaction(write=True) as tx: tx.save(A, record("C"), 1)

    def test_constraints_rollback_previous_changes(self):
        self.create(); self.create(A, "D")
        with self.assertRaises(OCError):
            with self.store.transaction(write=True) as tx:
                tx.save(A, record("C", changed=True), 1)
                tx.save(A, record("C"), 1, "D")
        self.assertEqual(self.store.get(A, "C")['_oc_version'], 1)
        self.assertEqual(self.store.get(A, "D")['_oc_version'], 1)

    def test_fence_blocks_old_backend_and_frozen_sql(self):
        legacy = Store(self.root, lambda: open_database(self.path), "json")
        with self.assertRaises(OCError):
            with legacy.transaction(write=True): pass
        atomic_json(self.root / "characters-storage-state.json", {"schema": 1, "backend": "frozen", "previous": "sqlite"})
        with self.assertRaises(OCError): self.store.list(A)

    def test_json_adapter_serializes_and_never_writes_sql_oc_table(self):
        atomic_json(self.root / "characters-storage-state.json", {"schema": 1, "backend": "json"})
        legacy = Store(self.root, lambda: open_database(self.path), "json")
        def save(index):
            with legacy.transaction(write=True) as tx: tx.save(A, record(str(index)))
        with ThreadPoolExecutor(12) as pool: list(pool.map(save, range(24)))
        self.assertEqual(len(legacy.list(A)), 24)
        with closing(open_database(self.path)) as db:
            self.assertEqual(db.execute("SELECT count(*) FROM oc_records").fetchone()[0], 0)

    def test_migration_full_payload_ids_owner_timestamps_and_idempotence(self):
        original = {"local:7": [record("same", id="original-stable-id", unknown={"future": [1, 2]})],
                    "7": [record("same", html="<html>测试</html>")]}
        original["local:7"][0]["data"]["createdAt"] = "2026/8/6 19:15:43"
        source = self.root / "characters.json"; atomic_json(source, original)
        before = source.read_bytes()
        with closing(open_database(self.path)) as db:
            dry = migrate([source], db)
            self.assertTrue(dry['valid']); self.assertEqual(db.execute('SELECT count(*) FROM oc_records').fetchone()[0], 0)
            db.execute('BEGIN IMMEDIATE'); first = migrate([source], db, True); db.commit()
            db.execute('BEGIN IMMEDIATE'); again = migrate([source], db, True); db.commit()
            self.assertEqual((first['records'], again['records']), (2, 2))
            self.assertTrue(verify([source], db)['verified'])
            self.assertEqual(digest(SqlSession(db).snapshot()), digest(original))
            row = db.execute("SELECT id,created_at FROM oc_records WHERE owner_kind='local'").fetchone()
            self.assertEqual(tuple(row), ('original-stable-id', '2026/8/6 19:15:43'))
        self.assertEqual(source.read_bytes(), before)

    def test_invalid_owner_duplicate_and_duplicate_json_keys_fail_closed(self):
        source = self.root / 'source.json'
        for value in ({'local:404': [record('C')]}, {'local:7': [record('C'),record('C')]}, {'bad:7': [record('C')]}):
            atomic_json(source, value)
            with closing(open_database(self.path)) as db:
                result = migrate([source], db, True)
                self.assertFalse(result['valid']); self.assertEqual(db.execute('SELECT count(*) FROM oc_records').fetchone()[0], 0)
                self.assertNotIn('测试角色', json.dumps(result))
        source.write_text('{"local:7": [], "local:7": []}')
        with closing(open_database(self.path)) as db: self.assertFalse(migrate([source], db)['valid'])

    def test_export_rollback_contains_post_cutover_creates_edits_and_deletes(self):
        self.create(A, 'C'); self.create(A, 'deleted')
        with self.store.transaction(write=True) as tx:
            tx.save(A, record('C', unknown='new value'), 1)
            tx.delete(A, 'deleted', 1)
            tx.save(B, record('post-cutover-new'), 0)
        with closing(open_database(self.path)) as db:
            report = export_snapshot(db, self.root / 'rollback-new.json')
            exported = json.loads((self.root / 'rollback-new.json').read_text())
            self.assertTrue(report['verified'])
            self.assertEqual(exported['local:7'][0]['unknown'], 'new value')
            self.assertEqual([x['code'] for x in exported['7']], ['post-cutover-new'])
            self.assertNotIn('deleted', [x['code'] for x in exported['local:7']])
            with self.assertRaises(FileExistsError): export_snapshot(db, self.root / 'rollback-new.json')

    def test_migration_does_not_overwrite_post_cutover_sql_changes(self):
        source = self.root / 'source.json'; atomic_json(source, {'local:7': [record('C')]})
        with closing(open_database(self.path)) as db:
            migrate([source], db, True); db.commit()
        with self.store.transaction(write=True) as tx: tx.save(A, record('C', changed=True), 1)
        with closing(open_database(self.path)) as db:
            with self.assertRaises(OCError): migrate([source], db, True)
        self.assertEqual(self.store.get(A,'C')['_oc_version'], 2)

    def test_owner_deleted_after_auth_cannot_resurrect_an_orphan_oc(self):
        with closing(open_database(self.path)) as db:
            db.execute("DELETE FROM local_users WHERE uid='7'"); db.commit()
        with self.assertRaises(OCError) as error:
            with self.store.transaction(write=True) as tx: tx.save(A, record("orphan"), 0)
        self.assertEqual(error.exception.status, 403)
        self.assertIsNone(self.store.get(A, "orphan"))

    def test_delete_recreate_and_rename_code_never_accept_old_revision(self):
        original=self.create(A,"reused")
        with self.store.transaction(write=True) as tx: tx.delete(A,"reused",1)
        recreated=self.create(A,"reused")
        self.assertGreater(recreated['_oc_version'],original['_oc_version'])
        with self.assertRaises(OCError) as error:
            with self.store.transaction(write=True) as tx: tx.save(A,record("reused"),1)
        self.assertEqual(error.exception.status,409)
        self.create(A,"other")
        with self.store.transaction(write=True) as tx: tx.delete(A,"reused",recreated['_oc_version'])
        with self.store.transaction(write=True) as tx: renamed,_=tx.save(A,record("reused"),1,"other")
        self.assertGreater(renamed['_oc_version'],recreated['_oc_version'])

    def test_unpatched_wal_is_blocked_in_production(self):
        from unittest.mock import patch
        with patch.dict(os.environ, {'IRIDESCENTLY_ENVIRONMENT':'production'}), patch.object(sqlite3,'sqlite_version_info',(3,50,4)):
            with self.assertRaises(OCError) as error: self.store.list(A)
            self.assertEqual(error.exception.code,'oc_sqlite_wal_patch_required')


if __name__ == '__main__': unittest.main()
