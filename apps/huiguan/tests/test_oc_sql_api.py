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
import scraping_observer

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "services" / "platform"))
from legal_consent import CURRENT_VERSION as LEGAL_VERSION  # noqa: E402
atomic_json(Path(app.RUNTIME_DIR) / 'characters-storage-state.json', {'schema':1,'backend':'sqlite'})
os.environ['IRIDESCENTLY_OC_BACKEND'] = 'sqlite'


class Server(ThreadingHTTPServer):
    # The default backlog of 5 resets some simultaneous connections opened by the
    # concurrency regressions below; production portal_server uses a larger backlog.
    request_queue_size = 1024


class Quiet(app.Handler):
    def log_message(self, *_): pass


class API(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = Server(('127.0.0.1', 0), Quiet)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True); cls.thread.start()
        cls.base = 'http://127.0.0.1:' + str(cls.server.server_port)
        cls.a, cls.b = Client(cls.base), Client(cls.base)
        for client, name in [(cls.a,'oc_owner'),(cls.b,'oc_other')]:
            assert client.call('/api/register', {"legal_version": LEGAL_VERSION, 'username':name,'password':'test-only-password-123','nickname':name,'email':name+'@example.com'})[0] == 200

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join()
        # The observe logger holds its file open; Windows cannot remove the temp tree until it closes.
        logger = scraping_observer._logger
        if logger:
            for handler in list(logger.handlers):
                logger.removeHandler(handler); handler.close()
            scraping_observer._logger = None
        TEMP.cleanup()

    def setUp(self):
        # Functional saves here are not about throttling; each test starts with a fresh save budget.
        with app.RATE_LOCK:
            for key in [k for k in app.RATE if k.startswith('oc-save:')]: app.RATE.pop(key)
            app.OC_STORAGE.clear()

    def save(self, client, code, version=0, **extra):
        body = sheet(code, '角色'+code, '原始内容'); body.update(version=version, **extra)
        return client.call('/api/save-character', body)

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

    def test_duplicate_create_and_stale_edit_are_rejected_without_overwrite(self):
        self.assertEqual(self.save(self.a, 'duplicate')[0], 200)
        stale = sheet('duplicate', '角色duplicate', 'stale-create'); stale['version'] = 0
        self.assertEqual(self.a.call('/api/save-character', stale)[0], 409)
        records = [x for x in self.a.call('/api/get-characters')[1]['characters'] if x['code'] == 'duplicate']
        self.assertEqual([(x['_oc_version'], x['data']['story']) for x in records], [(1, '原始内容')])
        winner = sheet('duplicate', '角色duplicate', 'winning-edit'); winner['version'] = 1
        self.assertEqual(self.a.call('/api/save-character', winner)[0], 200)
        stale = sheet('duplicate', '角色duplicate', 'stale-edit'); stale['version'] = 1
        self.assertEqual(self.a.call('/api/save-character', stale)[0], 409)
        records = [x for x in self.a.call('/api/get-characters')[1]['characters'] if x['code'] == 'duplicate']
        self.assertEqual([(x['_oc_version'], x['data']['story']) for x in records], [(2, 'winning-edit')])

    def test_parallel_duplicate_creates_leave_one_record(self):
        def save(index):
            body = sheet('duplicate-race', '角色duplicate-race', 'writer-' + str(index)); body['version'] = 0
            return self.a.call('/api/save-character', body)[0]
        with ThreadPoolExecutor(8) as pool: statuses = list(pool.map(save, range(8)))
        self.assertEqual((statuses.count(200), statuses.count(409)), (1, 7))
        records = [x for x in self.a.call('/api/get-characters')[1]['characters'] if x['code'] == 'duplicate-race']
        self.assertEqual([(x['_oc_version'], x['data']['story']) for x in records],
                         [(1, 'writer-' + str(statuses.index(200)))])

    def test_concurrent_saves_keep_same_code_separate_across_owners(self):
        jobs = [(self.a, 'owner-race'), (self.b, 'owner-race')]
        jobs += [(self.a, 'a-' + str(index)) for index in range(5)]
        jobs += [(self.b, 'b-' + str(index)) for index in range(5)]
        def save(job):
            client, code = job
            body = sheet(code, '角色' + code, 'story-' + code); body['version'] = 0
            return client.call('/api/save-character', body)[0]
        with ThreadPoolExecutor(len(jobs)) as pool: self.assertEqual(list(pool.map(save, jobs)), [200] * len(jobs))
        for client, prefix in ((self.a, 'a-'), (self.b, 'b-')):
            records = [x for x in client.call('/api/get-characters')[1]['characters']
                       if x['code'] == 'owner-race' or x['code'].startswith(prefix)]
            self.assertEqual(sorted(x['code'] for x in records),
                             sorted(['owner-race'] + [prefix + str(index) for index in range(5)]))
        shared_a = next(x for x in self.a.call('/api/get-characters')[1]['characters'] if x['code'] == 'owner-race')
        shared_b = next(x for x in self.b.call('/api/get-characters')[1]['characters'] if x['code'] == 'owner-race')
        self.assertNotEqual(shared_a['_oc_id'], shared_b['_oc_id'])

    def test_bulk_replace_and_single_edit_conflict_atomically(self):
        self.assertEqual(self.save(self.a, 'bulk-race')[0], 200)
        def bulk():
            body = sheet('bulk-race', '角色bulk-race', 'bulk-writer')['data']
            return self.a.call('/api/save-all-characters', {'characters': [body], 'versions': {'bulk-race': 1}})[0]
        def single():
            body = sheet('bulk-race', '角色bulk-race', 'single-writer'); body['version'] = 1
            return self.a.call('/api/save-character', body)[0]
        with ThreadPoolExecutor(2) as pool:
            statuses = [future.result() for future in [pool.submit(bulk), pool.submit(single)]]
        self.assertEqual(sorted(statuses), [200, 409])
        records = [x for x in self.a.call('/api/get-characters')[1]['characters'] if x['code'] == 'bulk-race']
        self.assertEqual([(x['_oc_version'], x['data']['story']) for x in records],
                         [(2, ('bulk-writer', 'single-writer')[statuses.index(200)])])

    def test_connection_failure_returns_503_and_recovers(self):
        from unittest.mock import patch
        with patch.object(app.oc_store, 'open_database', side_effect=sqlite3.OperationalError('synthetic failure detail')):
            status, body = self.save(self.a, 'connection-down')
            self.assertEqual((status, body.get('error'), body.get('code')),
                             (503, 'oc_database_unavailable', 'oc_database_unavailable'))
            self.assertIn('保留编辑内容', body['message'])
            self.assertNotIn('synthetic', json.dumps(body))
            self.assertEqual(self.a.call('/api/get-characters'), (503, {'error': 'oc_database_unavailable'}))
        self.assertEqual(self.save(self.a, 'connection-down')[0], 200)

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

    def test_code_shared_by_two_owners_still_serves_a_public_page(self):
        for client, story in ((self.a, '甲的故事'), (self.b, '乙的故事')):
            body = sheet('shared-public', '同号角色', story); body.update(version=0)
            self.assertEqual(client.call('/api/save-character', body)[0], 200)
        pages = []
        for _ in range(2):
            with urllib.request.urlopen(self.base + '/api/get-character?code=shared-public') as response:
                self.assertEqual(response.status, 200); pages.append(response.read().decode())
        # The owner that registered first wins, as with the legacy JSON scan, and it is stable
        # (apart from the per-response script nonce).
        import re
        self.assertEqual(*[re.sub(r"nonce[-=\"']*[A-Za-z0-9_-]{16,}", 'nonce', page) for page in pages])
        with closing(open_database(app.USER_DB)) as db:
            first = db.execute("""SELECT o.owner_uid FROM oc_owners o JOIN oc_records r USING(owner_kind, owner_uid)
                WHERE r.code='shared-public' ORDER BY o.position LIMIT 1""").fetchone()[0]
            owner_a = str(db.execute("SELECT uid FROM local_users WHERE username='oc_owner'").fetchone()[0])
        self.assertIn('甲的故事' if first == owner_a else '乙的故事', pages[0])

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
