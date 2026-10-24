"""Build an HK code candidate = one exact base release archive + git-tracked overlays.

Unlike `hk-release.py prepare`, overlay bytes come from a git ref, so neither another
session's working tree nor a stale .releases/production/site snapshot can leak in.
Every other file keeps the base archive's bytes and mtime. Overlays keep the base
file's CRLF convention, so a per-file diff shows only intended lines. The archive
is deterministic (fixed gzip/tar metadata): rebuilding the same ref on the same
base must reproduce the same SHA-256.

  python -X utf8 ops/security/build_overlay_candidate.py \
      --releases E:/Projects/.releases/hk-code-publish --base 20261023T184556Z \
      --overlay-list ops/security/candidate-overlays.json --ref HEAD [--compare 20261024T044733Z]
"""
import argparse
from datetime import datetime, timezone
import difflib
import gzip
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[2]
OZTREE_OLD = 'OZTREE_STATIC = Path(r"E:\\External Projects\\众生之门生物树可视化前端\\OZtree\\static")'
OZTREE_NEW = 'OZTREE_STATIC = Path(os.environ.get("IRIDESCENTLY_OZTREE_STATIC", str(ROOT / "external" / "OZtree" / "static")))'

parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument('--releases', type=Path, required=True, help='directory holding <version>.tar.gz/.json')
parser.add_argument('--output', type=Path, help='where to write the candidate (default: --releases)')
parser.add_argument('--base', required=True, help='base release version; must equal HK current')
parser.add_argument('--overlay-list', type=Path, required=True)
parser.add_argument('--ref', default='HEAD')
parser.add_argument('--version', help='candidate version (default: now, UTC)')
parser.add_argument('--compare', help='existing candidate version to diff against')
args = parser.parse_args()


def git(*command):
    return subprocess.run(['git', '-C', str(ROOT), *command], check=True, capture_output=True).stdout


def read_archive(version):
    archive, record = args.releases / (version + '.tar.gz'), args.releases / (version + '.json')
    summary = json.loads(record.read_text(encoding='utf-8'))['summary']
    with archive.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != summary['sha256']:
            raise SystemExit('Archive hash does not match its release record: ' + version)
    files = {}
    with tarfile.open(archive, 'r:gz') as tar:
        for member in tar:
            path = PurePosixPath(member.name)
            if not member.isfile() or path.is_absolute() or '..' in path.parts:
                raise SystemExit('Unsafe member in ' + version + ': ' + member.name)
            files[member.name] = (tar.extractfile(member).read(), member.mtime)
    return files


def lines(content):
    return content.replace(b'\r\n', b'\n').split(b'\n')


base = read_archive(args.base)
overlays = json.loads(args.overlay_list.read_text(encoding='utf-8'))
commit = git('rev-parse', args.ref + '^{commit}').decode().strip()
if git('status', '--porcelain', '--', *overlays).strip() and args.ref == 'HEAD':
    print('note: working tree differs from HEAD for some overlays; HEAD bytes are used')
mtime = int(git('log', '-1', '--format=%ct', commit).decode())
files, report = dict(base), []
for name in overlays:
    path = PurePosixPath(name)
    if path.is_absolute() or '..' in path.parts or '\\' in name or path.parts[0] not in {'server', 'portal', 'shared'}:
        raise SystemExit('Unsafe overlay path: ' + name)
    content = git('show', commit + ':' + name)
    if name == 'server/portal_server.py':
        content = content.replace(OZTREE_OLD.encode(), OZTREE_NEW.encode())  # same rewrite as hk-release.py prepare
    old = base.get(name, (None, None))[0]
    if old is not None and b'\r\n' in old and b'\r\n' not in content:
        content = content.replace(b'\n', b'\r\n')
    changed = None if old is None else sum(max(i2 - i1, j2 - j1) for tag, i1, i2, j1, j2 in
                                           difflib.SequenceMatcher(None, lines(old), lines(content), autojunk=False).get_opcodes() if tag != 'equal')
    report.append({'path': name, 'base_sha256': old and hashlib.sha256(old).hexdigest(),
                   'sha256': hashlib.sha256(content).hexdigest(), 'changed_lines_vs_base': changed})
    files[name] = (content, mtime)
assert 'server/portal_server.py' in files and 'server/app/modules/cards/index.html' in files

version = args.version or datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
output = args.output or args.releases
archive = output / (version + '.tar.gz')
if archive.exists():
    raise SystemExit('Refusing to overwrite ' + str(archive))
manifest = []
with archive.open('wb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', compresslevel=1, mtime=0) as packed, \
        tarfile.open(fileobj=packed, mode='w', format=tarfile.GNU_FORMAT) as tar:
    for name, (content, stamp) in sorted(files.items()):
        manifest.append({'path': name, 'sha256': hashlib.sha256(content).hexdigest(), 'bytes': len(content)})
        info = tarfile.TarInfo(name); info.size = len(content); info.mode = 0o644; info.mtime = int(stamp)
        tar.addfile(info, io.BytesIO(content))
with archive.open('rb') as stream:
    digest = hashlib.file_digest(stream, 'sha256').hexdigest()
summary = {'version': version, 'archive': str(archive), 'files': len(files), 'bytes': archive.stat().st_size,
           'sha256': digest, 'baseVersion': args.base, 'overlays': overlays, 'gitCommit': commit}
(output / (version + '.json')).write_text(json.dumps({'summary': summary, 'files': manifest}, indent=2), encoding='utf-8')
untouched = sum(1 for name in base if name not in overlays and files[name] == base[name])
result = {'summary': summary, 'overlays': report, 'untouched_base_files': untouched,
          'base_files': len(base), 'added_files': sorted(set(files) - set(base))}
if args.compare:
    other = read_archive(args.compare)
    result['compare'] = {'version': args.compare,
                         'byte_differences': sorted(n for n in set(files) | set(other) if files.get(n, (None,))[0] != other.get(n, (None,))[0]),
                         'differences_ignoring_crlf': sorted(n for n in set(files) | set(other)
                                                             if n not in files or n not in other or lines(files[n][0]) != lines(other[n][0]))}
print(json.dumps(result, ensure_ascii=False, indent=2))
