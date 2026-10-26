"""Synthetic capacity sample, not a production capacity promise: 5000 owners, 10000 OCs."""
from concurrent.futures import ProcessPoolExecutor
from contextlib import closing
import json
import os
from unittest.mock import patch
from pathlib import Path
import sqlite3
import sys
import tempfile
import time
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from oc_store import Store,atomic_json,canonical,initialize_schema,open_database


def save_one(args):
    directory,index=args
    started=time.monotonic()
    store=Store(directory,lambda:open_database(Path(directory)/'users.db'),'sqlite')
    ident={'kind':'local','uid':str(index+1)}
    with store.transaction(write=True) as tx:
        tx.save(ident,{'code':'a','data':{'name':'synthetic','nested':{'text':'x'*8192},'changed':True}},1)
    return (time.monotonic()-started)*1000


class Load(unittest.TestCase):
    def test_5000_owners_and_200_parallel_independent_updates(self):
        with patch.dict(os.environ,{'IRIDESCENTLY_ENVIRONMENT':'test'}), tempfile.TemporaryDirectory(prefix='oc-load-test-') as directory:
            root=Path(directory);payload=canonical({'code':'a','data':{'name':'synthetic','nested':{'text':'x'*8192}}})
            with closing(sqlite3.connect(root/'users.db')) as db:
                db.execute('PRAGMA journal_mode=WAL');initialize_schema(db)
                db.execute('CREATE TABLE local_users(uid TEXT PRIMARY KEY)');db.execute('CREATE TABLE users(user_id TEXT PRIMARY KEY)')
                db.executemany('INSERT INTO local_users VALUES (?)',[(str(i),) for i in range(1,5001)])
                db.executemany('INSERT INTO oc_owners VALUES (?,?,?)',[('local',str(i),i) for i in range(1,5001)])
                db.executemany('INSERT INTO oc_records VALUES (?,?,?,?,?,?,?,?,?,?)',
                               [(str(i)+'-'+code,'local',str(i),code,'synthetic',payload if code=='a' else canonical({'code':code,'data':{'name':'synthetic'}}),None,None,1,position)
                                for i in range(1,5001) for position,code in enumerate(['a','b'])]);db.commit()
            atomic_json(root/'characters-storage-state.json',{'schema':1,'backend':'sqlite'})
            started=time.monotonic()
            with ProcessPoolExecutor(4) as pool:timings=list(pool.map(save_one,[(directory,i) for i in range(200)]))
            duration=time.monotonic()-started
            with closing(open_database(root/'users.db')) as db:
                self.assertEqual(db.execute('SELECT count(*) FROM oc_records').fetchone()[0],10000)
                self.assertEqual(db.execute('SELECT count(*) FROM oc_records WHERE version=2').fetchone()[0],200)
                self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0],'ok')
            timings.sort()
            print(json.dumps({'synthetic_owners':5000,'ocs':10000,'processes':4,'saves':200,'seconds':round(duration,3),
                              'write_ms_p50':round(timings[99],2),'write_ms_p95':round(timings[189],2),'write_ms_max':round(timings[-1],2)}))


if __name__=='__main__':unittest.main()
