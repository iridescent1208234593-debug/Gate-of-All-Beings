"""SQL-mode HTTP regression with real local login/session cookies and temporary storage only."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from io import BytesIO
import base64
import json
import os
from pathlib import Path
import sqlite3
import sys
import tempfile
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[3]
TEMP = tempfile.TemporaryDirectory(prefix='oc-api-test-')
sys.path.insert(0, str(ROOT / 'services/platform'))
sys.path.insert(0, str(ROOT / 'apps/huiguan'))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from testing_storage import configure
DATA = configure(TEMP.name)
os.environ['HX_SSO_SECRET'] = 'oc-test-only-secret'
os.environ['IRIDESCENTLY_OC_BACKEND'] = 'json'
import server_huiguan as app
from oc_store import atomic_json, open_database, digest
from test_fan_owner_edit import Client, sheet
atomic_json(Path(app.RUNTIME_DIR) / 'characters-storage-state.json', {'schema':1,'backend':'sqlite'})
os.environ['IRIDESCENTLY_OC_BACKEND'] = 'sqlite'


class Quiet(app.Handler):
    def log_message(self, *_): pass


class API(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Quiet)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True); cls.thread.start()
        cls.base = 'http://127.0.0.1:' + str(cls.server.server_port)
        cls.a, cls.b = Client(cls.base), Client(cls.base)
        for client, name in [(cls.a,'oc_owner'),(cls.b,'oc_other')]:
            assert client.call('/api/register', {'username':name,'password':'test-only-password-123','nickname':name})[0] == 200

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join(); TEMP.cleanup()

    def save(self, client, code, version=0, **extra):
        body = sheet(code, '角色'+code, '原始内容'); body.update(version=version, **extra)
        return client.call('/api/save-character', body)

    def test_duplicate_public_code_keeps_first_owner_in_sql_mode(self):
        code = 'review-shared-sql'
        self.assertEqual(self.save(self.a, code, html='<html><head></head><body>FIRST OWNER</body></html>')[0], 200)
        self.assertEqual(self.save(self.b, code, html='<html><head></head><body>SECOND OWNER</body></html>')[0], 200)
        with urllib.request.urlopen(self.base + '/api/get-character?code=' + code) as response:
            content = response.read().decode()
            self.assertIn('FIRST OWNER', content)
            self.assertNotIn('SECOND OWNER', content)

    def test_duplicate_public_code_keeps_json_owner_order(self):
        from unittest.mock import patch
        file = Path(app.DATA_FILE)
        previous = file.read_bytes() if file.exists() else None
        try:
            # Deliberately reverse lexical UID order; legacy resolution follows file order.
            atomic_json(file, {'local:2':[{'code':'review-shared-json','data':{},'html':'<html>FIRST IN JSON</html>'}],
                               'local:1':[{'code':'review-shared-json','data':{},'html':'<html>SECOND IN JSON</html>'}]})
            atomic_json(Path(app.RUNTIME_DIR)/'characters-storage-state.json', {'schema':1,'backend':'json'})
            with patch.dict(os.environ, {'IRIDESCENTLY_OC_BACKEND':'json'}):
                with urllib.request.urlopen(self.base + '/api/get-character?code=review-shared-json') as response:
                    self.assertIn('FIRST IN JSON', response.read().decode())
        finally:
            atomic_json(Path(app.RUNTIME_DIR)/'characters-storage-state.json', {'schema':1,'backend':'sqlite'})
            if previous is None: file.unlink(missing_ok=True)
            else: file.write_bytes(previous)

    def test_admin_delete_uses_listed_revision_and_rejects_stale_delete(self):
        admin = Client(self.base)
        self.assertEqual(admin.call('/api/register', {'username':'review_admin','password':'test-only-password-123','nickname':'review_admin'})[0],200)
        with closing(open_database(app.USER_DB)) as db:
            db.execute("UPDATE local_users SET role='admin' WHERE username='review_admin'"); db.commit()
        self.assertEqual(self.save(self.a,'review-admin-delete')[0],200)
        status, listing = admin.call('/api/admin/characters')
        self.assertEqual(status,200)
        entry = next(row for row in listing['characters'] if row['code']=='review-admin-delete')
        self.assertEqual(entry['version'],1)
        self.assertEqual(self.save(self.a,'review-admin-delete',1)[0],200)
        payload={'key':entry['owner'],'code':entry['code'],'version':entry['version']}
        self.assertEqual(admin.call('/api/admin/delete-character',payload)[0],409)
        self.assertEqual(self.a.call('/api/oc?code=review-admin-delete')[1]['character']['_oc_version'],2)
        payload['version']=2
        self.assertEqual(admin.call('/api/admin/delete-character',payload)[0],200)
        self.assertEqual(self.a.call('/api/oc?code=review-admin-delete')[0],404)

    def test_a_points_failure_rolls_back_new_record_too(self):
        with closing(open_database(app.USER_DB)) as db:
            db.execute("CREATE TRIGGER fail_oc_points BEFORE INSERT ON account_point_events WHEN NEW.ref='sheet:points-failure' BEGIN SELECT RAISE(ABORT,'synthetic'); END");db.commit()
        self.assertEqual(self.save(self.a,'points-failure')[0],409)
        self.assertEqual(self.a.call('/api/oc?code=points-failure')[0],404)
        with closing(open_database(app.USER_DB)) as db:
            db.execute('DROP TRIGGER fail_oc_points');db.commit()
        self.assertEqual(self.save(self.a,'points-failure')[0],200)

    def test_owner_cannot_get_edit_delete_other_id_or_forge_owner(self):
        _, first = self.save(self.a,'owner-isolation')
        oc = first['character']
        self.assertEqual(self.b.call('/api/oc?id='+oc['_oc_id'])[0], 404)
        self.assertEqual(self.b.call('/api/delete-character', {'code':'owner-isolation','version':1,'owner_kind':'local','owner_uid':'1'})[0],404)
        # Codes are owner-local in the existing API. Same code creates one's OWN OC.
        _, own = self.save(self.b,'owner-isolation',owner_uid='1',owner_kind='local')
        self.assertNotEqual(own['character']['_oc_id'],oc['_oc_id'])
        self.assertEqual(self.a.call('/api/oc?id='+oc['_oc_id'])[1]['character']['_oc_version'],1)

    def test_crud_versions_bulk_and_multiple_owned_ocs(self):
        _, first = self.save(self.a,'crud-one')
        self.assertEqual(self.save(self.a,'crud-one',None)[0],428)
        self.assertEqual(self.save(self.a,'crud-one',1)[1]['version'],2)
        self.assertEqual(self.save(self.a,'crud-one',1)[0],409)
        self.save(self.a,'crud-two')
        _, current = self.a.call('/api/get-characters')
        self.assertEqual(current['storage_backend'],'sqlite')
        versions = {x['code']:x['_oc_version'] for x in current['characters']}
        incoming = [x['data'] for x in current['characters'] if x['code'] != 'crud-two']
        status, result = self.a.call('/api/save-all-characters',{'characters':incoming,'versions':versions})
        self.assertEqual(status,200)
        self.assertNotIn('crud-two',[x['code'] for x in result['characters']])
        self.assertEqual(self.a.call('/api/save-all-characters',{'characters':incoming,'versions':versions})[0],409)
        version = next(x['_oc_version'] for x in result['characters'] if x['code']=='crud-one')
        self.assertEqual(self.a.call('/api/delete-character',{'code':'crud-one','version':version})[0],200)
        self.assertEqual(self.a.call('/api/oc?code=crud-one')[0],404)

    def test_two_users_parallel_saves_and_same_record_conflict(self):
        with ThreadPoolExecutor(12) as pool:
            results=list(pool.map(lambda i:self.save(self.a if i%2 else self.b, 'parallel-'+str(i))[0],range(24)))
        self.assertEqual(results,[200]*24)
        self.save(self.a,'race')
        with ThreadPoolExecutor(2) as pool: statuses=list(pool.map(lambda _:self.save(self.a,'race',1)[0],range(2)))
        self.assertEqual(sorted(statuses),[200,409])
        _, own = self.a.call('/api/get-characters')
        self.assertEqual(len([x for x in own['characters'] if x['code'].startswith('parallel-')]),12)

    def test_gallery_rename_sync_rollback_and_public_html(self):
        self.save(self.a,'gallery-1')
        self.assertEqual(self.a.call('/api/fan/publish',{'character_codes':['gallery-1']})[0],200)
        body=sheet('gallery-2','新名字','新故事');body.update(previous_code='gallery-1',version=1)
        status,result=self.a.call('/api/save-character',body)
        self.assertEqual(status,200);self.assertEqual(result['version'],2)
        self.assertEqual(self.a.call('/api/oc?code=gallery-1')[0],404)
        rows=self.a.call('/api/fan/my')[1].get('characters',[])
        # Validate the existing gallery projection directly as well as its public API.
        with closing(open_database(app.USER_DB)) as db:
            row=db.execute("SELECT name,story FROM fan_characters WHERE code='gallery-2'").fetchone()
            self.assertEqual(tuple(row),('新名字','新故事'))
            db.execute("CREATE TRIGGER fail_oc_projection BEFORE UPDATE ON fan_characters WHEN NEW.code='gallery-2' BEGIN SELECT RAISE(ABORT,'synthetic test'); END");db.commit()
        self.assertEqual(self.save(self.a,'gallery-2',2)[0],409)
        self.assertEqual(self.a.call('/api/oc?code=gallery-2')[1]['character']['_oc_version'],2)
        with closing(open_database(app.USER_DB)) as db:db.execute('DROP TRIGGER fail_oc_projection');db.commit()
        with urllib.request.urlopen(self.base+'/api/get-character?code=gallery-2') as response:
            self.assertIn('新故事',response.read().decode())

    def test_poster_and_oc_colors_are_one_transaction(self):
        from PIL import Image
        output=BytesIO();Image.new('RGB',(2,2),'green').save(output,format='PNG')
        self.save(self.a,'poster-bound')
        poster={'title':'测试海报','char_code':'poster-bound','primary_color':'#123456','accent_color':'#abcdef',
                'character_version':1,'image':'data:image/png;base64,'+base64.b64encode(output.getvalue()).decode()}
        status,result=self.a.call('/api/posters/save',poster)
        self.assertEqual(status,200);self.assertEqual(result['character']['_oc_version'],2)
        with closing(open_database(app.USER_DB)) as db:before=db.execute('SELECT count(*) FROM posters').fetchone()[0]
        self.assertEqual(self.a.call('/api/posters/save',poster)[0],409)
        with closing(open_database(app.USER_DB)) as db:self.assertEqual(db.execute('SELECT count(*) FROM posters').fetchone()[0],before)
        self.assertEqual(self.b.call('/api/posters/save',poster)[0],400)

    def test_candidate_and_repair_consumers_keep_existing_shapes(self):
        self.save(self.a,'candidate')
        self.assertIn('candidate',[x['id'] for x in self.a.call('/api/user/ocs')[1]['ocs']])
        # A stored html_ref is already a working showcase, not a broken entry.
        self.assertNotIn('candidate',[x['code'] for x in self.a.call('/api/my-broken-characters')[1]['characters']])
        self.assertEqual(self.a.call('/api/fan/check-suggest')[0],200)

    def test_cards_gate_reads_same_sql_authority_and_fails_closed_when_frozen(self):
        import importlib.util
        from unittest.mock import patch
        self.save(self.a,'gate-shared')
        with closing(open_database(app.USER_DB)) as db:
            uid = str(db.execute("SELECT uid FROM local_users WHERE username='oc_owner'").fetchone()[0])
        spec=importlib.util.spec_from_file_location('oc_test_cards',ROOT/'apps/cards/server.py')
        cards=importlib.util.module_from_spec(spec);spec.loader.exec_module(cards)
        trusted={'kind':'local','uid':uid,'nickname':'synthetic','account_avatar_url':''}
        with patch.object(cards,'_shared_user',return_value=trusted):
            class QuietCards(cards.OAuthHandler):
                def log_message(self,*_):pass
            server=ThreadingHTTPServer(('127.0.0.1',0),QuietCards)
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            try:
                with urllib.request.urlopen('http://127.0.0.1:'+str(server.server_port)+'/api/gate/ocs') as response:
                    self.assertIn('gate-shared',[x['id'] for x in json.load(response)['ocs']])
                atomic_json(Path(app.RUNTIME_DIR)/'characters-storage-state.json',{'schema':1,'backend':'frozen','previous':'sqlite'})
                with self.assertRaises(__import__('urllib.error').error.HTTPError) as error:
                    urllib.request.urlopen('http://127.0.0.1:'+str(server.server_port)+'/api/gate/ocs')
                self.assertEqual(error.exception.code,503)
            finally:
                atomic_json(Path(app.RUNTIME_DIR)/'characters-storage-state.json',{'schema':1,'backend':'sqlite'})
                server.shutdown();server.server_close();thread.join()


if __name__ == '__main__':unittest.main()
