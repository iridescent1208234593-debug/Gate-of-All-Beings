"""Run with Python: isolated asset update/rollback/conflict and preview routing checks."""
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import server_assets as a

def main():
    with tempfile.TemporaryDirectory() as temporary:
        root=Path(temporary);data=root/'data';data.mkdir();database=data/'library.db'
        media=data/a.LIBRARY/'images/test.png';media.parent.mkdir(parents=True);media.write_bytes(b'old-image')
        with a.connection(database) as db:
            db.executescript('CREATE TABLE characters(id INTEGER PRIMARY KEY,name TEXT,image_path TEXT);CREATE TABLE users(id INTEGER PRIMARY KEY,secret TEXT);')
            db.execute('INSERT INTO characters VALUES (1,?,?)',('before',str(data/'assets/罗小黑战记数据库/images/test.png')))
            db.execute('INSERT INTO users VALUES (1,?)',('untouched',))
        snapshot=a.export_library(database,data)
        assert 'users' not in snapshot['tables']
        workspace=root/'workspace';a.create_workspace(snapshot,workspace)
        with a.connection(workspace/'library.sqlite3') as db:db.execute('UPDATE characters SET name=? WHERE id=1',('after',))
        changed=workspace/'media'/a.LIBRARY/'images/test.png';changed.parent.mkdir(parents=True);changed.write_bytes(b'new-image')
        plan=a.plan_workspace(workspace)
        assert len(plan['rows'])==1 and len(plan['files'])==1
        history=root/'history'
        import hashlib
        thumb=data/'portal/huiguan/assets/thumbs'/(hashlib.md5((str(media)+str(media.stat().st_size)).encode()).hexdigest()+'.jpg')
        thumb.parent.mkdir(parents=True);thumb.write_bytes(b'cached-old-thumbnail')
        a.apply_plan(database,data,plan,workspace/'media',history,'v1')
        assert not thumb.exists(),'Same-size image replacement retained a stale thumbnail'
        with a.connection(database) as db:
            assert db.execute('SELECT name FROM characters').fetchone()[0]=='after'
            assert db.execute('SELECT secret FROM users').fetchone()[0]=='untouched'
            try:a.check_plan(db,data,plan,workspace/'media')
            except ValueError:pass
            else:raise AssertionError('Concurrent change was accepted')
        a.apply_plan(database,data,a.inverse(plan),history/'v1/before',history,'v2')
        assert media.read_bytes()==b'old-image'
        with a.connection(database) as db:
            assert db.execute('SELECT name FROM characters').fetchone()[0]=='before'
            try:a.check_plan(db,data,plan,workspace/'media',{'names':[],'sha256':[a.file_hash(changed)]})
            except ValueError:pass
            else:raise AssertionError('Blocked image was accepted')
            protected={**plan,'rows':[{**plan['rows'][0],'table':'users'}]}
            try:a.check_plan(db,data,protected,workspace/'media')
            except ValueError:pass
            else:raise AssertionError('Account modification was accepted')
        for path in ['../../secret.png','portal/huiguan/users.db',a.LIBRARY+'../../secret.png']:
            try:a.safe_media(data,path)
            except ValueError:pass
            else:raise AssertionError('Unsafe media path accepted')
        journal=history/'interrupted';(journal/'before'/a.LIBRARY/'images').mkdir(parents=True)
        (journal/'before'/a.LIBRARY/'images/test.png').write_bytes(b'old-image')
        (journal/'plan.json').write_text(json.dumps(plan));(journal/'pending').touch();media.write_bytes(b'partial-write')
        a.recover(database,data,history);assert media.read_bytes()==b'old-image'
    spec=importlib.util.spec_from_file_location('pc_preview',Path(__file__).with_name('pc-preview.py'));pc=importlib.util.module_from_spec(spec);spec.loader.exec_module(pc)
    assert pc.central_path('/app/modules/cards/api/user') and pc.central_path('/api/save') and pc.central_path('/assets/uploads/test.png')
    assert not pc.central_path('/app/modules/cards/assets/test.js')
    root,relative,_=pc.static_target('zszm.iridescently.xyz','/app/modules/cards/index.html')
    assert (root/relative)==pc.ROOT/'server/app/modules/cards/index.html'
    print('PASS: asset isolation, three-way conflicts, rollback, crash recovery, quarantine blocklist, path validation and preview routes')

if __name__=='__main__':main()
