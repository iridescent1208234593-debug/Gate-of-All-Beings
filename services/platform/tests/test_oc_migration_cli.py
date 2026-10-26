"""Exercise the actual offline CLI against an isolated synthetic runtime, including rollback."""
from contextlib import closing
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'services/platform'))
from testing_storage import configure
from oc_store import initialize_schema, atomic_json


class CLI(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='oc-cli-')
        self.data=configure(self.temp.name)/'huiguan'
        with closing(sqlite3.connect(self.data/'users.db')) as db:
            db.execute('CREATE TABLE local_users(uid TEXT PRIMARY KEY)');db.execute("INSERT INTO local_users VALUES ('7')")
            db.execute('CREATE TABLE users(user_id TEXT PRIMARY KEY)');db.execute("INSERT INTO users VALUES ('7')")
            initialize_schema(db);db.commit()
        self.original={'local:7':[{'code':'A','id':'original','data':{'name':'演练','custom':{'nested':[1,None,True]}}}]}
        atomic_json(self.data/'characters.json',self.original)
        self.env=dict(os.environ)

    def tearDown(self):self.temp.cleanup()

    def cli(self,*args,env=None):
        result=subprocess.run([sys.executable,str(ROOT/'tools/runtime/oc-storage.py'),*args],env=env or self.env,capture_output=True,text=True)
        self.assertFalse(result.stderr,result.stderr)
        return result.returncode,json.loads(result.stdout)

    def test_dry_run_freeze_import_idempotence_cutover_and_rollback_reconciliation(self):
        before=(self.data/'characters.json').read_bytes()
        self.assertEqual(self.cli('import','--dry-run')[0],0)
        with closing(sqlite3.connect(self.data/'users.db')) as db:self.assertEqual(db.execute('SELECT count(*) FROM oc_records').fetchone()[0],0)
        self.assertEqual(self.cli('import','--apply')[1]['error'],'maintenance_confirmation_required')
        self.assertEqual(self.cli('freeze','--confirm-stopped')[0],0)
        self.assertEqual(self.cli('import','--apply','--confirm-stopped')[1]['records'],1)
        self.assertEqual(self.cli('import','--apply','--confirm-stopped')[1]['records'],1)
        self.assertEqual(self.cli('verify')[1]['verified'],True)
        self.assertEqual(self.cli('activate-sql','--confirm-stopped')[1]['backend'],'sqlite')
        self.assertEqual((self.data/'characters.json').read_bytes(),before)
        # Simulate post-cutover SQL writes through the same DAO used by HTTP.
        from oc_store import Store,open_database
        store=Store(self.data,lambda:open_database(self.data/'users.db'),'sqlite')
        with store.transaction(write=True) as tx:
            tx.delete({'kind':'local','uid':'7'},'A',1)
            tx.save({'kind':'usso','uid':'7'},{'code':'B','data':{'name':'切换后新增'}},0)
        self.cli('freeze','--confirm-stopped')
        self.assertEqual(self.cli('activate-json','--confirm-stopped')[0],1) # stale original must NOT activate
        output=self.data/'rollback-export.json'
        self.assertEqual(self.cli('export','--output',str(output),'--confirm-stopped')[1]['verified'],True)
        recovered=json.loads(output.read_text())
        self.assertEqual(recovered,{'local:7':[],'7':[{'code':'B','data':{'name':'切换后新增'}}]})
        # Fixture-only equivalent of the separately authorized operator promotion.
        atomic_json(self.data/'characters.json',recovered)
        self.assertEqual(self.cli('activate-json','--confirm-stopped')[1]['backend'],'json')
        self.assertTrue((output.with_name(output.name+'.manifest.json')).exists())

    def test_bad_owner_reports_no_user_content_and_never_partially_imports(self):
        atomic_json(self.data/'characters.json',{'local:404':[{'code':'PII','data':{'name':'PRIVATE NAME'}}]})
        _,report=self.cli('import','--dry-run')
        self.assertFalse(report['valid']);self.assertEqual(report['errors'][0]['reason'],'owner_account_missing')
        self.assertNotIn('PRIVATE',json.dumps(report));self.assertNotIn('404',json.dumps(report))

    def test_repeat_source_is_rejected_and_read_only_commands_do_not_create_missing_db(self):
        source=str(self.data/'characters.json')
        self.assertFalse(self.cli('import','--source',source,'--source',source)[1]['valid'])
        (self.data/'users.db').unlink()
        self.assertEqual(self.cli('import','--dry-run')[0],1)
        self.assertFalse((self.data/'users.db').exists())

    def test_failed_import_can_resume_only_unchanged_legacy_truth(self):
        self.assertEqual(self.cli('freeze','--confirm-stopped')[0],0)
        self.assertEqual(self.cli('resume-json','--confirm-stopped')[1]['backend'],'json')
        self.cli('freeze','--confirm-stopped')
        atomic_json(self.data/'characters.json',{})
        self.assertEqual(self.cli('resume-json','--confirm-stopped')[0],1)

    def test_existing_backup_tool_captures_sql_oc_tables_and_restores(self):
        self.cli('freeze','--confirm-stopped');self.cli('import','--apply','--confirm-stopped')
        command=[sys.executable,str(ROOT/'tools/runtime/backup-storage.py')]
        snapshot=subprocess.run(command+['snapshot'],env=self.env,capture_output=True,text=True,check=True)
        directory=Path(json.loads(snapshot.stdout)['directory'])
        subprocess.run(command+['verify',str(directory)],env=self.env,capture_output=True,text=True,check=True)
        source=directory/'data/huiguan/users.db'
        from oc_store import SqlSession,open_database,digest
        with closing(open_database(source)) as reader, closing(sqlite3.connect(Path(self.temp.name)/'restored.db')) as restored:
            reader.backup(restored);restored.row_factory=sqlite3.Row
            self.assertEqual(digest(SqlSession(restored).snapshot()),digest(self.original))
            self.assertEqual(restored.execute('PRAGMA integrity_check').fetchone()[0],'ok')


if __name__=='__main__':unittest.main()
