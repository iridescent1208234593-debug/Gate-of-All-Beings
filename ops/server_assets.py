"""Reference-library patches: never transfer accounts, saves, or a replacement DB."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import time
from contextlib import contextmanager

@contextmanager
def connection(*args,**kwargs):
    db=sqlite3.connect(*args,**kwargs)
    try:
        with db:yield db
    finally:db.close()

TABLES = ('characters character_abilities character_abilities_ext character_relations character_relations_ext character_friends character_events locations organizations org_branches ability_systems ability_branches dual_skills timeline timeline_v2 articles meta character_images episodes lxz_episodes episode_characters images page_index page_summaries music staff series_works spirit_lifecycle spirit_lifecycle_images character_sources character_info shared_assets artifacts cultivation_realm character_stats character_id_map').split()
MEDIA = {'.png','.jpg','.jpeg','.gif','.webp','.avif','.svg','.ico','.mp4','.webm','.mp3','.ogg','.wav','.ttf','.woff','.woff2'}
LIBRARY = 'assets/罗小黑战记数据库/'
MATERIAL = 'assets/素材/'
GALLERY = 'asset-library/homepage-gallery/'
PATH_COLUMNS = {'image_path','file_path','path','img_path','source_file'}

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()

def file_hash(path):
    if not path.is_file(): return None
    with path.open('rb') as stream: return hashlib.file_digest(stream, 'sha256').hexdigest()

def write_json(path,value):
    temporary=path.with_suffix(path.suffix+'.tmp')
    temporary.write_text(json.dumps(value,ensure_ascii=False),encoding='utf-8');os.replace(temporary,path)

def portable(value):
    if not isinstance(value, str): return value
    text = value.replace('\\', '/')
    for prefix in ('/srv/iridescently/data/', 'E:/Projects/'):
        if text.lower().startswith(prefix.lower()): return text[len(prefix):]
    return value

def rows(db, table):
    db.row_factory = sqlite3.Row
    return [{key: portable(value) for key,value in dict(row).items()} for row in db.execute('SELECT * FROM "'+table+'"')]

def row_key(row, keys): return json.dumps([row[key] for key in keys], ensure_ascii=False)

def safe_media(data, name):
    rel = Path(name)
    if not name.startswith((LIBRARY, MATERIAL, GALLERY)) or '..' in rel.parts or rel.is_absolute() or '\\' in name or rel.suffix.lower() not in MEDIA:
        raise ValueError('不允许的资产文件路径：' + name)
    target = data / rel
    allowed=data.resolve()/next(prefix for prefix in (LIBRARY,MATERIAL,GALLERY) if name.startswith(prefix))
    if not target.resolve().is_relative_to(allowed): raise ValueError('Asset symlink escapes its library root')
    return target

def invalidate_thumbnail(data,path):
    if path.is_file():
        key=hashlib.md5((str(path)+str(path.stat().st_size)).encode('utf-8')).hexdigest()
        (data/'portal/huiguan/assets/thumbs'/(key+'.jpg')).unlink(missing_ok=True)

def export_library(database, data):
    result = {'format': 1, 'at': time.time(), 'tables': {}, 'media': {}}
    with connection(database) as db:
        db.execute('BEGIN')
        available = {x[0]:x[1] for x in db.execute("SELECT name,sql FROM sqlite_master WHERE type='table'")}
        for table in TABLES:
            if table not in available: continue
            info = db.execute('PRAGMA table_info("'+table+'")').fetchall()
            keys = [x[1] for x in sorted(info, key=lambda c:c[5]) if x[5]]
            if not keys: continue
            result['tables'][table] = {'sql': available[table], 'keys': keys, 'rows': rows(db, table)}
    for directory in [data/LIBRARY, data/MATERIAL, data/GALLERY]:
        if not directory.exists(): continue
        for path in directory.rglob('*'):
            if path.is_file() and path.suffix.lower() in MEDIA and not any(x.startswith('.') for x in path.relative_to(directory).parts):
                name = path.relative_to(data).as_posix()
                result['media'][name] = file_hash(safe_media(data, name))
    return result

def create_workspace(snapshot, workspace):
    workspace.mkdir(parents=True)
    (workspace/'media').mkdir()
    (workspace/'baseline.json').write_text(json.dumps(snapshot, ensure_ascii=False), encoding='utf-8')
    with connection(workspace/'library.sqlite3') as db:
        for table, spec in snapshot['tables'].items():
            db.execute(spec['sql'])
            for row in spec['rows']:
                columns = list(row)
                db.execute('INSERT INTO "'+table+'" ('+','.join('"'+c+'"' for c in columns)+') VALUES ('+','.join('?' for _ in columns)+')', list(row.values()))

def plan_workspace(workspace):
    base = json.loads((workspace/'baseline.json').read_text(encoding='utf-8'))
    plan = {'format': 1, 'rows': [], 'files': []}
    with connection('file:'+str((workspace/'library.sqlite3').resolve().as_posix())+'?mode=ro', uri=True) as db:
        for table, spec in base['tables'].items():
            before = {row_key(row, spec['keys']): row for row in spec['rows']}
            after = {row_key(row, spec['keys']): row for row in rows(db, table)}
            for key in sorted(before.keys() | after.keys()):
                if before.get(key) != after.get(key):
                    plan['rows'].append({'table': table, 'keys': spec['keys'], 'key': json.loads(key), 'before': before.get(key), 'after': after.get(key)})
    for path in (workspace/'media').rglob('*'):
        if path.is_file():
            name = path.relative_to(workspace/'media').as_posix()
            safe_media(workspace/'media', name)
            after = file_hash(path)
            if after != base['media'].get(name): plan['files'].append({'path': name, 'before': base['media'].get(name), 'after': after})
    return plan

def check_plan(db, data, plan, files, blocked=None):
    if plan.get('format') != 1 or len(plan['rows']) > 20000 or len(plan['files']) > 5000: raise ValueError('Invalid asset plan')
    blocked = blocked or {'names': [], 'sha256': []}
    for change in plan['rows']:
        table = change['table']
        if table not in TABLES: raise ValueError('Protected table: ' + table)
        info = db.execute('PRAGMA table_info("'+table+'")').fetchall()
        columns = {x[1] for x in info}
        keys = [x[1] for x in sorted(info,key=lambda x:x[5]) if x[5]]
        if change['keys'] != keys or len(change['key']) != len(keys): raise ValueError('Primary key mismatch')
        query = ' AND '.join('"'+key+'"=?' for key in keys)
        db.row_factory = sqlite3.Row
        live = db.execute('SELECT * FROM "'+table+'" WHERE '+query, change['key']).fetchone()
        current = {k:portable(v) for k,v in dict(live).items()} if live else None
        if current != change['before']: raise ValueError('线上资产已变化，请重新下载或合并：'+table+' '+str(change['key']))
        after = change['after']
        if after is not None:
            if set(after) != columns or [after[key] for key in keys] != change['key']: raise ValueError('Row/schema mismatch')
            for value in after.values():
                if isinstance(value,str) and Path(value.replace('\\','/')).name in blocked['names']: raise ValueError('隔离资产禁止重新发布')
            for column in PATH_COLUMNS & after.keys():
                value=after[column]
                if value and value != (change['before'] or {}).get(column):
                    text=portable(value)
                    if isinstance(text,str) and text.startswith(('https://','http://')):continue
                    if not isinstance(text,str) or not text.startswith((LIBRARY,MATERIAL,GALLERY)) or '..' in Path(text).parts or '\\' in text:
                        raise ValueError('新资产引用必须位于资产库目录：'+str(value))
    for change in plan['files']:
        target = safe_media(data, change['path'])
        if file_hash(target) != change['before']: raise ValueError('线上文件已变化：'+change['path'])
        if change['path'].startswith(GALLERY) and change['before'] and change['after'] and change['before']!=change['after']:
            raise ValueError('首页图库请使用新文件名，避免旧 CDN 缓存；不要原名替换')
        if change['after']:
            source = safe_media(files, change['path'])
            if file_hash(source) != change['after']: raise ValueError('Asset file checksum mismatch')
            if source.name in blocked['names'] or change['after'] in blocked['sha256']: raise ValueError('隔离图片禁止重新发布')
    return {'records': len(plan['rows']), 'files': len(plan['files']), 'plan_sha256': digest(plan)}

def apply_plan(database, data, plan, files, history, version, blocked=None):
    history.mkdir(parents=True,exist_ok=True)
    target = history/version
    if target.exists(): raise ValueError('Asset update already exists')
    target.mkdir(mode=0o700)
    # A journal plus a marker in the same SQLite transaction makes interrupted updates recoverable.
    with connection(database,timeout=30) as db:
        db.execute('CREATE TABLE IF NOT EXISTS iridescently_asset_updates (version TEXT PRIMARY KEY)')
        db.commit()
        db.execute('BEGIN IMMEDIATE')
        summary = check_plan(db,data,plan,files,blocked)
        prior_foreign_keys={tuple(row) for row in db.execute('PRAGMA foreign_key_check')}
        with connection(target/'worldview.backup.db') as backup:
            with connection(database,timeout=30) as reader: reader.backup(backup)
        (target/'plan.json').write_text(json.dumps(plan,ensure_ascii=False),encoding='utf-8')
        completed={'version':version,'at':time.time(),**summary}
        write_json(target/'summary.json',completed)
        for item in plan['files']:
            path = safe_media(data,item['path'])
            if path.exists():
                copy = target/'before'/item['path'];copy.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,copy)
        (target/'pending').touch()
        try:
            for item in plan['files']:
                path=safe_media(data,item['path']);path.parent.mkdir(parents=True,exist_ok=True)
                invalidate_thumbnail(data,path)
                if item['after']:
                    temporary=path.with_name(path.name+'.asset-next');shutil.copy2(files/item['path'],temporary);os.replace(temporary,path);os.utime(path,None)
                    if os.name!='nt':
                        import pwd
                        user=pwd.getpwnam('iridescently');os.chown(path,user.pw_uid,user.pw_gid)
                    invalidate_thumbnail(data,path)
                else: path.unlink()
            for item in plan['rows']:
                table=item['table'];where=' AND '.join('"'+key+'"=?' for key in item['keys'])
                if item['after'] is None: db.execute('DELETE FROM "'+table+'" WHERE '+where,item['key'])
                elif item['before'] is None:
                    row=item['after'];cols=list(row)
                    db.execute('INSERT INTO "'+table+'" ('+','.join('"'+c+'"' for c in cols)+') VALUES ('+','.join('?' for c in cols)+')',[stored(c,row[c],data) for c in cols])
                else:
                    cols=[c for c in item['after'] if c not in item['keys']]
                    if cols: db.execute('UPDATE "'+table+'" SET '+','.join('"'+c+'"=?' for c in cols)+' WHERE '+where,[stored(c,item['after'][c],data) for c in cols]+item['key'])
            new_foreign_keys={tuple(row) for row in db.execute('PRAGMA foreign_key_check')}
            if new_foreign_keys-prior_foreign_keys:raise ValueError('资产更新产生新的关联缺失，已取消整批更新')
            if db.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise ValueError('Asset database integrity check failed')
            db.execute('INSERT INTO iridescently_asset_updates VALUES (?)',(version,));db.commit()
        except BaseException:
            db.rollback();restore_files(data,target,plan);(target/'pending').unlink();raise
    os.utime(database,None)
    write_json(history/'latest.json',completed)
    (target/'pending').unlink()
    return {'version':version,**summary}

def stored(column,value,data):
    return str(data/value) if column in PATH_COLUMNS and isinstance(value,str) and value.startswith(('assets/','portal/')) else value

def restore_files(data,journal,plan):
    for item in plan['files']:
        path=safe_media(data,item['path'])
        invalidate_thumbnail(data,path)
        if item['before']: shutil.copy2(journal/'before'/item['path'],path);os.utime(path,None)
        else: path.unlink(missing_ok=True)
        invalidate_thumbnail(data,path)

def recover(database,data,history):
    if not history.exists():return
    for pending in history.glob('*/pending'):
        journal=pending.parent
        with connection(database) as db:
            exists=db.execute("SELECT 1 FROM sqlite_master WHERE name='iridescently_asset_updates'").fetchone()
            committed=exists and db.execute('SELECT 1 FROM iridescently_asset_updates WHERE version=?',(journal.name,)).fetchone()
        if not committed:restore_files(data,journal,json.loads((journal/'plan.json').read_text(encoding='utf-8')))
        else:
            os.utime(database,None)
            summary=json.loads((journal/'summary.json').read_text(encoding='utf-8'))
            previous=json.loads((history/'latest.json').read_text(encoding='utf-8')) if (history/'latest.json').exists() else {}
            if summary['at']>previous.get('at',0):write_json(history/'latest.json',summary)
        pending.unlink()

def inverse(plan):
    return {'format':1,'rows':[{**r,'before':r['after'],'after':r['before']} for r in reversed(plan['rows'])],
            'files':[{**r,'before':r['after'],'after':r['before']} for r in plan['files']]}
