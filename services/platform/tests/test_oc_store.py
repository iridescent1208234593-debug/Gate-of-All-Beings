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

    def test_concurrent_duplicate_create_keeps_one_record(self):
        # Two tabs (or a retried request) both send the create version 0 for the same code.
        # Exactly one insert may win; the other is a conflict and must not refresh the record.
        def save(index):
            try:
                with self.store.transaction(write=True) as tx: tx.save(A, record("duplicate", writer=index), 0)
                return 200
            except OCError as error: return error.status
        with ThreadPoolExecutor(8) as pool: statuses = list(pool.map(save, range(8)))
        self.assertEqual((statuses.count(200), statuses.count(409)), (1, 7))
        records = self.store.list(A)
        self.assertEqual([x["code"] for x in records], ["duplicate"])
        self.assertEqual((records[0]["_oc_version"], records[0]["writer"]), (1, statuses.index(200)))
        # A late retry carrying the stale create version is still rejected.
        with self.assertRaises(OCError) as error:
            with self.store.transaction(write=True) as tx: tx.save(A, record("duplicate", writer=99), 0)
        self.assertEqual(error.exception.status, 409)
        self.assertEqual(self.store.get(A, "duplicate")["writer"], statuses.index(200))

    def test_stale_edit_never_overwrites_the_winning_content(self):
        self.create(A, "C")
        def save(index):
            try:
                with self.store.transaction(write=True) as tx: tx.save(A, record("C", writer=index), 1)
                return 200
            except OCError as error: return error.status
        with ThreadPoolExecutor(6) as pool: statuses = list(pool.map(save, range(6)))
        self.assertEqual((statuses.count(200), statuses.count(409)), (1, 5))
        current = self.store.get(A, "C")
        self.assertEqual((current["_oc_version"], current["writer"]), (2, statuses.index(200)))
        with self.assertRaises(OCError) as error:
            with self.store.transaction(write=True) as tx: tx.save(A, record("C", writer=99), 1)
        self.assertEqual(error.exception.status, 409)
        self.assertEqual(self.store.get(A, "C")["writer"], statuses.index(200))

    def test_same_code_under_two_owners_stays_two_records(self):
        jobs = [(A, "shared"), (B, "shared")]
        jobs += [(A, "a-" + str(index)) for index in range(6)]
        jobs += [(B, "b-" + str(index)) for index in range(6)]
        def save(job):
            ident, code = job
            with self.store.transaction(write=True) as tx: tx.save(ident, record(code), 0)
            return 200
        with ThreadPoolExecutor(len(jobs)) as pool: self.assertEqual(list(pool.map(save, jobs)), [200] * len(jobs))
        self.assertEqual(sorted(x["code"] for x in self.store.list(A)),
                         sorted(["shared"] + ["a-" + str(index) for index in range(6)]))
        self.assertEqual(sorted(x["code"] for x in self.store.list(B)),
                         sorted(["shared"] + ["b-" + str(index) for index in range(6)]))
        self.assertNotEqual(self.store.get(A, "shared")["_oc_id"], self.store.get(B, "shared")["_oc_id"])

    def test_interrupted_connection_rolls_back_and_recovers(self):
        self.create(A, "C")
        def factory(): return open_database(self.path)
        store = Store(self.root, factory, "sqlite")
        with self.assertRaises(OCError) as error:
            with store.transaction(write=True) as tx:
                tx.save(A, record("C", writer="uncommitted"), 1)
                tx.save(A, record("partial"), 0)
                tx.conn.close()  # simulate the connection dropping before commit
        self.assertEqual((error.exception.status, error.exception.code), (503, "oc_database_unavailable"))
        self.assertEqual(self.store.get(A, "C")["_oc_version"], 1)
        self.assertIsNone(self.store.get(A, "partial"))
        with self.store.transaction(write=True) as tx:
            saved, created = tx.save(A, record("C", writer="recovered"), 1)
        self.assertEqual((created, saved["_oc_version"]), (False, 2))
        self.assertEqual(self.store.get(A, "C")["writer"], "recovered")

    def test_connection_open_failure_is_503_and_recovers(self):
        attempts = []
        def factory():
            attempts.append(1)
            if len(attempts) == 1: raise sqlite3.OperationalError("synthetic open failure")
            return open_database(self.path)
        store = Store(self.root, factory, "sqlite")
        with self.assertRaises(OCError) as error: store.list(A)
        self.assertEqual((error.exception.status, error.exception.code), (503, "oc_database_unavailable"))
        with store.transaction(write=True) as tx:
            saved, _ = tx.save(A, record("after-open-failure"), 0)
        self.assertEqual(saved["code"], "after-open-failure")

    def test_failed_bulk_replace_rolls_back_deletes_and_updates(self):
        self.create(A, "C"); self.create(A, "D")
        with self.assertRaises(OCError) as error:
            with self.store.transaction(write=True) as tx:
                tx.replace(A, [record("C", changed=True)], {"C": 1, "D": 1})
                raise sqlite3.OperationalError("synthetic mid-bulk failure")
        self.assertEqual(error.exception.status, 503)
        self.assertEqual(sorted((x["code"], x["_oc_version"]) for x in self.store.list(A)),
                         [("C", 1), ("D", 1)])
        self.assertNotIn("changed", self.store.get(A, "C"))
        self.assertIsNotNone(self.store.get(A, "D"))

    def test_store_entry_points_all_use_the_transaction_boundary(self):
        from contextlib import contextmanager
        original, calls = self.store.transaction, []
        @contextmanager
        def spy(*args, **kwargs):
            calls.append(bool(kwargs.get("write")))
            with original(*args, **kwargs) as session: yield session
        self.store.transaction = spy
        self.addCleanup(setattr, self.store, "transaction", original)
        self.store.snapshot(); self.store.list(A); self.store.get(A, "C")
        self.store.public_records("C"); self.store.admin_rows()
        self.assertEqual(calls, [False] * 5)

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

    def test_unpatched_wal_is_blocked_when_environment_is_unset(self):
        # An old-layout host may never export the variable; only explicit development/test may skip.
        from unittest.mock import patch
        environment = {k: v for k, v in os.environ.items() if k != 'IRIDESCENTLY_ENVIRONMENT'}
        with patch.dict(os.environ, environment, clear=True), patch.object(sqlite3,'sqlite_version_info',(3,50,4)):
            with self.assertRaises(OCError) as error: self.store.list(A)
            self.assertEqual(error.exception.code,'oc_sqlite_wal_patch_required')
        with patch.dict(os.environ, {'IRIDESCENTLY_ENVIRONMENT':'test'}), patch.object(sqlite3,'sqlite_version_info',(3,50,4)):
            self.assertEqual(self.store.list(A), [])

    def test_code_shared_by_owners_resolves_to_the_same_public_record_as_json(self):
        original = {"7": [record("shared", html="<html>usso</html>")],
                    "local:7": [record("shared", html="<html>local</html>")]}
        source = self.root / "characters.json"; atomic_json(source, original)
        json_store = Store(self.root, lambda: open_database(self.path), "json")
        atomic_json(self.root / "characters-storage-state.json", {"schema": 1, "backend": "json"})
        legacy = [x["html"] for x in json_store.public_records("shared")]
        with closing(open_database(self.path)) as db:
            report = migrate([source], db)
            self.assertEqual(report["codes_shared_across_owners"], 1)
            db.execute('BEGIN IMMEDIATE'); migrate([source], db, True); db.commit()
        atomic_json(self.root / "characters-storage-state.json", {"schema": 1, "backend": "sqlite"})
        self.assertEqual([x["html"] for x in self.store.public_records("shared")], legacy)
        self.assertEqual(legacy[0], "<html>usso</html>")


if __name__ == '__main__': unittest.main()
