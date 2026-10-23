#!/usr/bin/python3
"""Root-owned forced SSH command; accepts only bounded code releases."""
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shlex
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request
sys.path.insert(0, '/usr/local/lib/iridescently')
import server_assets

BASE = Path('/srv/iridescently')
DATA = BASE / 'data'
NODE = '/opt/iridescently-node/bin'
UNITS = ['iridescently-' + x for x in ('portal', 'cards', 'balance', 'softie', 'juling')]
STATE = BASE / 'deployment.json'
ASSET_DB = DATA / 'assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db'
ASSET_HISTORY = BASE / 'asset-updates'
CACHE = Path('/tmp/iridescently-npm-cache')
RELEASE_NAME = re.compile(r'\d{8}T\d{6}Z')

def wire_gallery(release):
    persistent = DATA / 'asset-library/homepage-gallery'
    original = BASE / 'current/portal/www/assets/homepage/gallery-files'
    if not persistent.exists():
        if original.exists(): shutil.copytree(original, persistent)
        else: persistent.mkdir(parents=True)
    path = release / 'portal/www/assets/homepage/gallery-files'
    if path.is_symlink() and path.resolve() == persistent.resolve(): return
    link(path, persistent)

def asset_command(action):
    server_assets.recover(ASSET_DB, DATA, ASSET_HISTORY)
    blocked_path=BASE/'control/asset-blocklist.json'
    blocked=json.loads(blocked_path.read_text()) if blocked_path.exists() else None
    if action=='assets-export': return server_assets.export_library(ASSET_DB, DATA)
    if action=='assets-rollback':
        if not (ASSET_HISTORY/'latest.json').exists():raise ValueError('还没有可回滚的资产更新')
        last=json.loads((ASSET_HISTORY/'latest.json').read_text())['version']
        journal=ASSET_HISTORY/last
        plan=server_assets.inverse(json.loads((journal/'plan.json').read_text()))
        files=journal/'before'
        return server_assets.apply_plan(ASSET_DB,DATA,plan,files,ASSET_HISTORY,time.strftime('%Y%m%dT%H%M%S')+'-rollback',blocked)
    with tempfile.TemporaryDirectory(dir=BASE/'incoming',prefix='asset-') as tmp, tempfile.TemporaryFile() as upload:
        count=0
        while True:
            block=sys.stdin.buffer.read(1024*1024)
            if not block:break
            count+=len(block)
            if count>512*1024**2:raise ValueError('Split asset updates into packages below 512 MiB')
            upload.write(block)
        upload.seek(0);folder=Path(tmp)
        with tarfile.open(fileobj=upload,mode='r:gz') as tar:
            members=tar.getmembers()
            if len(members)>10000 or sum(x.size for x in members)>1024**3:raise ValueError('Asset package exceeds limits')
            for item in members:
                path=PurePosixPath(item.name)
                if not item.isfile() or path.is_absolute() or '..' in path.parts:raise ValueError('Invalid asset archive path')
                if item.name!='plan.json':
                    if not item.name.startswith('files/'):raise ValueError('Code is excluded from asset updates')
                    server_assets.safe_media(DATA,item.name[len('files/'):])
            tar.extractall(folder,filter='data')
        plan=json.loads((folder/'plan.json').read_text())
        if action=='assets-check':
            with __import__('sqlite3').connect(ASSET_DB,timeout=30) as db:return server_assets.check_plan(db,DATA,plan,folder/'files',blocked)
        if not plan['rows'] and not plan['files']:return {'records':0,'files':0,'message':'No asset changes'}
        return server_assets.apply_plan(ASSET_DB,DATA,plan,folder/'files',ASSET_HISTORY,time.strftime('%Y%m%dT%H%M%S')+'-assets',blocked)

def run(args, **kwargs):
    result = subprocess.run(args, capture_output=True, text=True, **kwargs)
    if result.returncode: raise RuntimeError((result.stdout + result.stderr)[-6000:])
    return result.stdout

def status():
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    assets=json.loads((ASSET_HISTORY/'latest.json').read_text()) if (ASSET_HISTORY/'latest.json').exists() else None
    return {'current': (BASE / 'current').resolve().name, 'previous': state.get('previous'), 'asset_update':assets,
            'services': {unit: subprocess.run(['systemctl', 'is-active', unit], capture_output=True, text=True).stdout.strip() for unit in UNITS}}

def tree_summary(path):
    total = count = latest = 0
    if not path.exists(): return {'bytes': 0, 'files': 0, 'latest_mtime_ns': 0}
    if path.is_symlink(): raise ValueError('Refusing to inspect a symlinked cleanup path: ' + str(path))
    for root, dirs, files in os.walk(path, followlinks=False):
        base = Path(root)
        dirs[:] = [name for name in dirs if not (base / name).is_symlink()]
        for name in files:
            item = base / name
            try:
                stat = item.lstat()
            except FileNotFoundError:
                continue
            if item.is_symlink(): continue
            total += stat.st_size; count += 1; latest = max(latest, stat.st_mtime_ns)
    return {'bytes': total, 'files': count, 'latest_mtime_ns': latest}

def process_release_cwds():
    active = set()
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit(): continue
        try: cwd = (entry / 'cwd').resolve()
        except (OSError, RuntimeError): continue
        try: relative = cwd.relative_to(BASE / 'releases')
        except ValueError: continue
        if relative.parts: active.add(relative.parts[0])
    return active

def npm_running():
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit(): continue
        try: command = (entry / 'cmdline').read_bytes().lower()
        except OSError: continue
        if b'npm' in command: return True
    return False

def cleanup_plan():
    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    current = (BASE / 'current').resolve().name
    previous = state.get('previous')
    protected = {current, previous} - {None, ''}
    named = sorted((p.name for p in (BASE / 'releases').iterdir()
                    if p.is_dir() and not p.is_symlink() and RELEASE_NAME.fullmatch(p.name)))
    valid_versions = sorted(v for v in protected if v)
    rollback_floor = min(valid_versions) if valid_versions else current
    cutoff = time.time() - 24 * 60 * 60
    running = process_release_cwds()
    candidates = []
    for version in named:
        path = BASE / 'releases' / version
        if version in protected or version in running: continue
        marker = path / '.validated'
        valid = marker.is_file() and marker.read_text(errors='replace').strip() == version
        mtime = path.stat().st_mtime
        old_valid = bool(valid and rollback_floor and version < rollback_floor)
        stale_failed = not valid and mtime < cutoff
        if old_valid or stale_failed:
            candidates.append({'version': version, 'kind': 'old' if old_valid else 'failed', **tree_summary(path)})
    cache = tree_summary(CACHE)
    return {'current': current, 'previous': previous, 'protected': sorted(protected),
            'running_releases': sorted(running), 'releases': candidates,
            'cache': {'path': str(CACHE), **cache, 'npm_running': npm_running()}}

def cleanup_preview():
    plan = cleanup_plan()
    canonical = json.dumps(plan, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    token = hashlib.sha256(canonical).hexdigest()
    return {'plan_token': token, **plan,
            'message': '只预览专用 npm 缓存与非 current/previous 的旧版本；未删除任何文件。'}

def cleanup_apply(token):
    if not re.fullmatch(r'[0-9a-f]{64}', token): raise ValueError('Invalid cleanup preview token')
    plan = cleanup_plan()
    canonical = json.dumps(plan, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    if hashlib.sha256(canonical).hexdigest() != token:
        raise ValueError('服务器状态已变化，请重新预览后再清理')
    if plan['cache']['npm_running']: raise ValueError('检测到 npm 正在运行，未清理缓存')
    deleted = []
    releases = BASE / 'releases'
    for item in plan['releases']:
        target = releases / item['version']
        if target.parent.resolve() != releases.resolve() or target.is_symlink() or not target.is_dir():
            raise ValueError('Release path changed; cleanup stopped')
        shutil.rmtree(target)
        deleted.append(item['version'])
    if CACHE.exists():
        if CACHE.is_symlink() or CACHE.resolve() != Path('/tmp/iridescently-npm-cache'):
            raise ValueError('npm cache path changed; cleanup stopped')
        for child in CACHE.iterdir():
            if child.is_symlink() or child.is_file(): child.unlink()
            elif child.is_dir(): shutil.rmtree(child)
    return {'deleted_releases': deleted, 'cleared_cache': str(CACHE),
            'freed_release_bytes': sum(x['bytes'] for x in plan['releases']),
            'freed_cache_bytes': plan['cache']['bytes'],
            'message': '清理完成；current、previous、运行中版本与用户数据均未改动。'}

def link(path, target):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.is_dir(): shutil.rmtree(path)
        else: path.unlink()
    path.symlink_to(target)

def stage(version):
    release = BASE / 'releases' / version
    if release.exists(): raise ValueError('Release already exists')
    with tempfile.TemporaryFile() as upload:
        count = 0
        while True:
            block = sys.stdin.buffer.read(1024 * 1024)
            if not block: break
            count += len(block)
            if count > 512 * 1024 * 1024: raise ValueError('Code archive exceeds 512 MiB')
            upload.write(block)
        upload.seek(0)
        with tarfile.open(fileobj=upload, mode='r:gz') as tar:
            members = tar.getmembers()
            if len(members) > 30000 or sum(x.size for x in members) > 2 * 1024**3: raise ValueError('Code archive exceeds limits')
            for item in members:
                path = PurePosixPath(item.name)
                if not item.isfile() or path.is_absolute() or '..' in path.parts or not path.parts or path.parts[0] not in {'server', 'portal', 'shared'}: raise ValueError('Invalid code path')
                if any(x in {'node_modules', '.git', '.local', 'backups', 'backup'} or x.startswith('.env') for x in path.parts): raise ValueError('Runtime/private files are excluded')
                if path.suffix.lower() in {'.db', '.sqlite', '.sqlite3'} or path.name.endswith(('.db-wal', '.db-shm')) or path.name in {'characters.json', 'game_saves.json', 'links.json', 'thanks.json'}: raise ValueError('User data is excluded')
                if any(item.name.startswith(x) for x in ('portal/www/assets/homepage/gallery-files/', 'portal/huiguan/assets/uploads/', 'portal/huiguan/assets/store/', 'portal/huiguan/assets/thumbs/', 'server/app/src/cards/data/card-balance/', 'server/app/src/juling/data/')): raise ValueError('User data and asset library are excluded')
            release.mkdir(mode=0o755)
            tar.extractall(release, members=members, filter='data')
    for name in ('uploads', 'store', 'thumbs'):
        rel = 'portal/huiguan/assets/' + name; link(release / rel, DATA / rel)
    wire_gallery(release)
    for rel in ('server/app/src/cards/data/card-balance', 'server/app/src/softie-webgpu/.local', 'server/app/src/juling/data'):
        link(release / rel, DATA / rel)
    for name in ('shared-types', 'shared-data', 'shared-ui', 'shared-session'):
        if (release / 'shared' / name).exists(): link(release / 'node_modules/@lxh' / name, release / 'shared' / name)
    for project in ('cards', 'softie-webgpu', 'juling'):
        run(['chown', '-R', 'iridescently:iridescently', str(release / 'server/app/src' / project)])
    for project in ('cards', 'softie-webgpu'):
        run(['runuser', '-u', 'iridescently', '--', 'env', 'PATH=' + NODE + ':/usr/bin:/bin', NODE + '/npm',
             'ci', '--cache', '/tmp/iridescently-npm-cache', '--ignore-scripts', '--no-audit', '--no-fund'], cwd=release / 'server/app/src' / project, timeout=180)
    output = run(['runuser', '-u', 'iridescently', '--', 'env', 'PORT=19081', 'PYTHONUTF8=1',
                  'IRIDESCENTLY_PROJECT_ROOT=' + str(DATA), '/usr/bin/python3', 'server/verify_portal.py'], cwd=release, timeout=150)
    (release / '.validation.log').write_text(output)
    (release / '.validated').write_text(version)
    return {'staged': version, 'archive_bytes': count, 'validation': output.splitlines()[-1:]}

def health():
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for _ in range(30):
        try:
            for port, path in [(18180, '/api/user'), (5174, '/api/sso-user'), (5178, '/api/card-balance')]:
                request = urllib.request.Request(f'http://127.0.0.1:{port}{path}', headers={
                    'Host': 'huiguan.iridescently.xyz' if port == 18180 else 'zszm.iridescently.xyz',
                    'X-Forwarded-Proto': 'https', 'User-Agent': 'Iridescently-HK-health/1'})
                with opener.open(request, timeout=2) as response:
                    if response.status != 200: raise ValueError('Bad health response')
            if all(value == 'active' for value in status()['services'].values()): return
        except Exception: time.sleep(1)
    raise RuntimeError('Backend health checks failed')

def pointer(release):
    temp = BASE / 'current.next'
    if temp.is_symlink(): temp.unlink()
    temp.symlink_to(BASE / 'releases' / release)
    os.replace(temp, BASE / 'current')

def activate(version, rollback=False):
    release = BASE / 'releases' / version
    if not release.is_dir() or (not rollback and not (release / '.validated').is_file()): raise ValueError('Release has not passed validation')
    before = (BASE / 'current').resolve().name
    if before == version: return status()
    wire_gallery(release)
    pointer(version)
    try:
        run(['systemctl', 'restart', *UNITS], timeout=90)
        health()
    except Exception as error:
        pointer(before); run(['systemctl', 'restart', *UNITS], timeout=90)
        health()
        raise RuntimeError('New release failed health checks; restored ' + before + ': ' + str(error)) from error
    temp = STATE.with_suffix('.tmp')
    temp.write_text(json.dumps({'previous': before, 'current': version, 'at': time.time()})); os.replace(temp, STATE)
    return status()

def main():
    args = shlex.split(os.environ.get('SSH_ORIGINAL_COMMAND', ''))
    if args == ['status']: result = status()
    elif args == ['cleanup-preview']:
        with (BASE / '.deploy.lock').open('w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            result = cleanup_preview()
    else:
        with (BASE / '.deploy.lock').open('w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            if len(args)==1 and args[0] in {'assets-export','assets-check','assets-apply','assets-rollback'}:
                try:result=asset_command(args[0])
                finally:
                    owner=ASSET_DB.stat()
                    for suffix in ('-wal','-shm'):
                        extra=Path(str(ASSET_DB)+suffix)
                        if extra.exists():os.chown(extra,owner.st_uid,owner.st_gid)
            elif args == ['rollback']:
                previous = status()['previous']
                if not previous: raise ValueError('No previous release is available')
                result = activate(previous, rollback=True)
            elif len(args) == 2 and args[0] == 'cleanup-apply' and re.fullmatch(r'[0-9a-f]{64}', args[1]):
                result = cleanup_apply(args[1])
            elif len(args) == 2 and args[0] in {'stage', 'activate'} and re.fullmatch(r'\d{8}T\d{6}Z', args[1]):
                result = stage(args[1]) if args[0] == 'stage' else activate(args[1])
            else: raise ValueError('Allowed commands: status, stage VERSION, activate VERSION, rollback, cleanup-preview, cleanup-apply TOKEN')
    print(json.dumps(result))

if __name__ == '__main__':
    try: main()
    except Exception as error:
        print(str(error), file=sys.stderr); sys.exit(1)
