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
SSH_PORT = 43012
SSH = ['ssh', '-T', '-i', str(KEY), '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes',
       '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', '-p', str(SSH_PORT),
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

def prepare(base_version=None, overlay_list=None):
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
    overlays = []
    if base_version:
        if remote('status')['current'] != base_version:
            raise RuntimeError('Hong Kong release changed; inspect the new current version before publishing')
        previous_archive = OUTPUT / (base_version + '.tar.gz')
        previous_record = OUTPUT / (base_version + '.json')
        record = json.loads(previous_record.read_text(encoding='utf-8'))
        with previous_archive.open('rb') as stream:
            if hashlib.file_digest(stream, 'sha256').hexdigest() != record['summary']['sha256']:
                raise RuntimeError('Local base archive hash does not match its release record')
        with tarfile.open(previous_archive, 'r:gz') as previous:
            for member in previous:
                if not member.isfile() or Path(member.name).is_absolute() or '..' in Path(member.name).parts:
                    raise RuntimeError('Unsafe file in base release')
                files[member.name] = (previous.extractfile(member).read(), member.mtime)
        overlays = json.loads(Path(overlay_list).read_text(encoding='utf-8'))
        if not isinstance(overlays, list) or not overlays:
            raise RuntimeError('Overlay list must be a nonempty JSON array of release paths')
        for name in overlays:
            if not isinstance(name, str) or Path(name).is_absolute() or '..' in Path(name).parts or '\\' in name:
                raise RuntimeError('Unsafe overlay path')
            if name == 'portal/www/index.html' or name == 'portal/www/assets/homepage':
                source = ROOT / name
            elif name.startswith(('portal/', 'server/', 'shared/')):
                source = published / name
            else:
                raise RuntimeError('Overlay path is outside the published site')
            if not source.exists() or source.is_symlink():
                raise RuntimeError('Missing or linked overlay source: ' + name)
            if source.is_dir():
                if name != 'portal/www/assets/homepage':
                    raise RuntimeError('Only the homepage output may be overlaid as a directory')
                for old_name in list(files):
                    if old_name.startswith(name + '/'):
                        del files[old_name]
                collect(source, name)
            else:
                files[name] = source
    else:
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
            content = source[0] if isinstance(source, tuple) else source.read_bytes()
            if name == 'server/portal_server.py':
                old = 'OZTREE_STATIC = Path(r"E:\\External Projects\\众生之门生物树可视化前端\\OZtree\\static")'
                content = content.decode('utf-8').replace(old, 'OZTREE_STATIC = Path(os.environ.get("IRIDESCENTLY_OZTREE_STATIC", str(ROOT / "external" / "OZtree" / "static")))').encode('utf-8')
            manifest.append({'path': name, 'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content)})
            info = tarfile.TarInfo(name); info.size = len(content); info.mode = 0o644
            # 保留真实修改时间：mtime=0 会让源站对任何 If-Modified-Since 都回 304，浏览器/CDN 永远拿旧文件
            info.mtime = int(source[1] if isinstance(source, tuple) else source.stat().st_mtime)
            import io
            tar.addfile(info, io.BytesIO(content))
    result = {'version': version, 'archive': str(archive), 'files': len(files), 'bytes': archive.stat().st_size,
              'sha256': hashlib.file_digest(archive.open('rb'), 'sha256').hexdigest(),
              'baseVersion': base_version, 'overlays': overlays}
    (OUTPUT / (version + '.json')).write_text(json.dumps({'summary': result, 'files': manifest}, indent=2), encoding='utf-8')
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['status', 'prepare', 'publish', 'rollback'])
    parser.add_argument('--base-version', help='Preserve every file in this currently active HK release')
    parser.add_argument('--overlay-list', help='JSON array of exact published paths to replace')
    args = parser.parse_args()
    if bool(args.base_version) != bool(args.overlay_list):
        parser.error('--base-version and --overlay-list must be used together')
    if args.action in {'prepare', 'publish'}:
        release = prepare(args.base_version, args.overlay_list)
        if args.action == 'prepare': result = release
        else:
            if args.base_version and remote('status')['current'] != args.base_version:
                raise RuntimeError('Hong Kong release changed during preparation; no upload attempted')
            staged = remote('stage ' + release['version'], Path(release['archive']))
            if args.base_version and remote('status')['current'] != args.base_version:
                raise RuntimeError('Hong Kong release changed during upload; staged package was not activated')
            result = remote('activate ' + release['version'])
            result['staged'] = staged
    else: result = remote(args.action)
    print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)

if __name__ == '__main__':
    try: main()
    except Exception as error:
        print('香港操作失败：' + str(error), file=sys.stderr)
        sys.exit(1)
