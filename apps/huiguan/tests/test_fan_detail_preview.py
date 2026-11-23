from contextlib import closing
from http.client import HTTPResponse
from io import BytesIO
import os
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlencode


class MemorySocket:
    def __init__(self, request):
        self.request = request
        self.response = bytearray()

    def makefile(self, *_):
        return BytesIO(self.request)

    def sendall(self, data):
        self.response.extend(data)


def test_owner_and_reviewer_previews_do_not_use_public_code_lookup(tmp_path, monkeypatch):
    for key in list(os.environ):
        if key.startswith(('IRIDESCENTLY_', 'LAB_', 'USSO_', 'HX_', 'TURNSTILE_')):
            monkeypatch.delenv(key)
    monkeypatch.setenv('IRIDESCENTLY_STORAGE_ROOT', str(tmp_path / 'fixture'))
    monkeypatch.setenv('IRIDESCENTLY_ENVIRONMENT', 'test')
    root = Path(__file__).resolve().parents[3]
    monkeypatch.syspath_prepend(str(root / 'services/platform'))
    monkeypatch.syspath_prepend(str(root / 'apps/huiguan'))
    from storage_paths import initialize_storage
    initialize_storage()
    import server_huiguan as site

    def request(path, actor=None):
        cookie = f'Cookie: session={sessions[actor]}\r\n' if actor else ''
        wire = f'GET {path} HTTP/1.1\r\nHost: huiguan.iridescently.cn\r\nConnection: close\r\n{cookie}\r\n'
        client = MemorySocket(wire.encode())
        site.Handler(client, ('127.0.0.1', 10001), SimpleNamespace(server_name='fixture', server_port=80))
        response = HTTPResponse(MemorySocket(bytes(client.response)))
        response.begin()
        with closing(response):
            return response.status, response.getheader('Cache-Control'), response.read().decode()

    with closing(site.db()) as conn, conn:
        ids = {}
        for actor, role in [('other', 'executor'), ('owner', 'executor'), ('reviewer', 'admin'), ('visitor', 'executor')]:
            ids[actor] = str(conn.execute('INSERT INTO local_users(username,nickname,pass_hash,role) VALUES(?,?,?,?)',
                                         (actor, actor, 'fixture', role)).lastrowid)
            site.legal_consent.record(conn, 'local', ids[actor])
        cursor = conn.execute("INSERT INTO fan_characters(user_kind,user_uid,name,code,type,story,is_public,review_status) "
                              "VALUES('local',?,'Review submission','shared-code','妖精','QUEUED_TEXT',1,'pending')", (ids['owner'],))
        fan_id = cursor.lastrowid
        row = conn.execute('SELECT * FROM fan_characters WHERE id=?', (fan_id,)).fetchone()
        version = site.fan_review_version(row)
    sessions = {actor: site.create_session('local', uid, 'iridescently.cn') for actor, uid in ids.items()}
    with site.character_store().transaction(write=True) as store:
        for actor, text in [('other', 'OTHER_SHEET'), ('owner', 'OWNER_SHEET')]:
            store.save({'kind': 'local', 'uid': ids[actor]}, {'code': 'shared-code',
                       'data': {'code': 'shared-code', 'name': actor},
                       'html': f'<html><body><p>{text}</p></body></html>'}, 0)

    public = '/api/huiguan/get-character?code=shared-code'
    assert 'OTHER_SHEET' in request(public)[2]
    code, cache, content = request(public + '&owned=1', 'owner')
    assert code == 200 and {'private', 'no-store'} <= {v.strip() for v in cache.split(',')}
    assert 'OWNER_SHEET' in content and 'OTHER_SHEET' not in content
    assert request(public + '&owned=1')[0] == 401
    assert request(public + '&owned=1', 'visitor')[0] == 404

    review = '/api/huiguan/fan/review/preview?' + urlencode({'id': fan_id, 'version': version})
    code, cache, content = request(review, 'reviewer')
    assert code == 200 and {'private', 'no-store'} <= {v.strip() for v in cache.split(',')}
    assert 'QUEUED_TEXT' in content and 'OWNER_SHEET' not in content
    assert request(review)[0] == 401
    assert request(review, 'owner')[0] == 403
    assert '仅显示提交时保留的字段' in content
    import json
    from html import escape

    def versioned(id_, revision):
        return '/api/huiguan/fan/review/preview?' + urlencode({'id': id_, 'version': revision})

    def current_version(id_):
        with closing(site.db()) as conn:
            return site.fan_review_version(conn.execute('SELECT * FROM fan_characters WHERE id=?',(id_,)).fetchone())

    match = dict(name='Review submission', code='shared-code', type='妖精', story='QUEUED_TEXT',
                 age='OWNER_AGE<42>', height='OWNER_HEIGHT', customDetails={'fire':'Custom lore'},
                 private_email='NEVER_RENDER_EMAIL', is_elder='NEVER_RENDER_ROLE')
    owner_ident = {'kind':'local','uid':ids['owner']}
    with site.character_store().transaction(write=True) as store:
        store.save({'kind':'local','uid':ids['other']}, {'code':'shared-code','data':dict(match, age='OTHER_AGE')})
        store.save(owner_ident, {'code':'shared-code','data':match})
        site.sync_fan_characters(store.conn, owner_ident, 'shared-code', match)
    new_version = current_version(fan_id)
    assert request(review, 'reviewer')[0] == 409
    new_url = versioned(fan_id,new_version)
    status, cache, page = request(new_url,'reviewer')
    assert status == 200 and 'no-store' in cache
    assert escape(match['age']) in page and 'OWNER_HEIGHT' in page and 'Custom lore' in page
    for hidden in ('OTHER_AGE','OWNER_SHEET','NEVER_RENDER_EMAIL','NEVER_RENDER_ROLE'):
        assert hidden not in page
    match['age'] = 'OWNER_AGE_NEW'
    with site.character_store().transaction(write=True) as store:
        store.save(owner_ident, {'code':'shared-code','data':match})
        site.sync_fan_characters(store.conn, owner_ident, 'shared-code', match)
    assert request(new_url,'reviewer')[0] == 409
    newest = versioned(fan_id,current_version(fan_id))
    assert 'OWNER_AGE_NEW' in request(newest,'reviewer')[2]
    listing = json.loads(request('/api/huiguan/fan/list?view=text')[2])
    assert listing['total'] == 0
    with closing(site.db()) as conn, conn:
        conn.execute("UPDATE fan_characters SET review_status='approved' WHERE id=?", (fan_id,))
    listing = json.loads(request('/api/huiguan/fan/list?view=text')[2])
    assert listing['total'] == 1 and 'age' not in listing['characters'][0]
    assert request(newest,'reviewer')[0] == 404
    with closing(site.db()) as conn, conn:
        conn.execute("UPDATE fan_characters SET review_status='pending', updated_at=NULL WHERE id=?", (fan_id,))
    review = versioned(fan_id,current_version(fan_id))

    with closing(site.db()) as conn, conn:
        conn.execute("UPDATE fan_characters SET story='Changed' WHERE id=?", (fan_id,))
    assert request(review, 'reviewer')[0] == 409
    with closing(site.db()) as conn, conn:
        conn.execute("UPDATE fan_characters SET is_public=0 WHERE id=?", (fan_id,))
    assert request(review, 'reviewer')[0] == 404


if __name__ == "__main__":
    import sys
    import tempfile
    from unittest.mock import patch

    class StandaloneEnvironment:
        def setenv(self, key, value):
            os.environ[key] = value

        def delenv(self, key):
            os.environ.pop(key)

        def syspath_prepend(self, path):
            sys.path.insert(0, path)

    with tempfile.TemporaryDirectory(prefix="fan-review-detail-fixture-") as tmp, patch.dict(os.environ):
        test_owner_and_reviewer_previews_do_not_use_public_code_lookup(Path(tmp), StandaloneEnvironment())
    print("PASS exact owner, existing fields, stale age-only edit, permissions and public projection")
