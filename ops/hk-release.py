"""Manual HK code releases. Databases, secrets and uploads are never published."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '.releases/hk-full-migration'
KEY = PRIVATE / 'deploy_ed25519'
OUTPUT = ROOT / '.releases/hk-code-publish'
SSH = ['ssh', '-T', '-i', str(KEY), '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes',
       '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15',
       'iridescently-deploy@154.222.26.70']
SKIP = {'node_modules', '.git', '__pycache__', 'backups', 'backup', 'work', 'tests',
        '.local', '.homepage-build', '.homepage-publish'}

def remote(command, archive=None):
    with archive.open('rb') if archive else open(os.devnull, 'rb') as stream:
        result = subprocess.run(SSH + [command], stdin=stream, capture_output=True,
                                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    if result.returncode:
        raise RuntimeError(result.stderr.decode('utf-8', 'replace').strip() or
                           result.stdout.decode('utf-8', 'replace').strip() or 'SSH failed')
    return json.loads(result.stdout)

def prepare():
    version = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    files = {}
    def collect(source, target):
        if not source.exists(): return
        for file in ([source] if source.is_file() else source.rglob('*')):
            if not file.is_file() or file.is_symlink(): continue
            rel = Path(file.name) if source.is_file() else file.relative_to(source)
            dest = (Path(target) / rel).as_posix()
            if any(x in SKIP for x in rel.parts): continue
            if file.name.startswith('.env') or file.name in {'characters.json', 'game_saves.json', 'links.json', 'thanks.json'}: continue
            if file.suffix.lower() in {'.db', '.sqlite', '.sqlite3', '.pyc', '.log', '.bak', '.tmp'} or '.bak_' in file.name or file.name.endswith(('.db-wal', '.db-shm')): continue
            if any(dest.startswith(x) for x in ('portal/www/assets/homepage/gallery-files/', 'portal/huiguan/assets/uploads/', 'portal/huiguan/assets/store/', 'portal/huiguan/assets/thumbs/', 'server/app/src/cards/data/card-balance/', 'server/app/src/juling/data/')): continue
            files[dest] = file
    published = ROOT / '.releases/production/site'
    for name in ('server', 'portal', 'shared'): collect(published / name, name)
    # Source files come only from the reviewed site snapshot. The working tree
    # can contain another editor's unpublished changes during a release.
    collect(ROOT / 'server/app/modules', 'server/app/modules')
    collect(ROOT / 'portal/www/index.html', 'portal/www')
    collect(ROOT / 'portal/www/assets/homepage', 'portal/www/assets/homepage')
    assert files and 'server/portal_server.py' in files and 'server/app/modules/cards/index.html' in files
    OUTPUT.mkdir(parents=True, exist_ok=True)
    archive = OUTPUT / (version + '.tar.gz')
    manifest = []
    with tarfile.open(archive, 'w:gz', compresslevel=1) as tar:
        for name, source in sorted(files.items()):
            content = source.read_bytes()
            if name == 'server/portal_server.py':
                old = 'OZTREE_STATIC = Path(r"E:\\External Projects\\众生之门生物树可视化前端\\OZtree\\static")'
                content = content.decode('utf-8').replace(old, 'OZTREE_STATIC = Path(os.environ.get("IRIDESCENTLY_OZTREE_STATIC", str(ROOT / "external" / "OZtree" / "static")))').encode('utf-8')
            manifest.append({'path': name, 'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content)})
            info = tarfile.TarInfo(name); info.size = len(content); info.mode = 0o644
            # 保留真实修改时间：mtime=0 会让源站对任何 If-Modified-Since 都回 304，浏览器/CDN 永远拿旧文件
            info.mtime = int(source.stat().st_mtime)
            import io
            tar.addfile(info, io.BytesIO(content))
    result = {'version': version, 'archive': str(archive), 'files': len(files), 'bytes': archive.stat().st_size,
              'sha256': hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest()}
    (OUTPUT / (version + '.json')).write_text(json.dumps({'summary': result, 'files': manifest}, indent=2), encoding='utf-8')
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['status', 'prepare', 'publish', 'rollback'])
    args = parser.parse_args()
    if args.action in {'prepare', 'publish'}:
        release = prepare()
        if args.action == 'prepare': result = release
        else:
            staged = remote('stage ' + release['version'], Path(release['archive']))
            result = remote('activate ' + release['version'])
            result['staged'] = staged
    else: result = remote(args.action)
    print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)

if __name__ == '__main__':
    try: main()
    except Exception as error:
        print('香港操作失败：' + str(error), file=sys.stderr)
        sys.exit(1)
