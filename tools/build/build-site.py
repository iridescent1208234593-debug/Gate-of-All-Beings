"""Export committed site source; never copy runtime data or the dirty worktree."""
import io
import os
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile

root = Path(os.environ.get('IRIDESCENTLY_PROJECT_ROOT', Path.cwd())).resolve()
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "platform"))
from storage_paths import release_root

releases = release_root()
target = releases / 'candidate' / 'site'
if target.resolve().parent != (releases / 'candidate').resolve():
    raise RuntimeError('Site candidate escapes release root')
# Deployable source roots; a checkout only needs the ones it has.
SOURCE_DIRS = ('apps', 'services', 'packages')
present = set(subprocess.check_output(['git', 'ls-tree', '--name-only', 'HEAD'], cwd=root, text=True).split())
archive = subprocess.check_output(['git', 'archive', '--format=zip', 'HEAD', *(d for d in SOURCE_DIRS if d in present)], cwd=root)
if target.exists():
    shutil.rmtree(target)
target.mkdir(parents=True)
with zipfile.ZipFile(io.BytesIO(archive)) as source:
    for item in source.infolist():
        name = item.filename
        parts = Path(name).parts
        if '..' in parts or Path(name).is_absolute():
            raise RuntimeError('Unsafe archive path')
        # apps/bilibili-toy is published to B站 Toy by the owner, never served from the site.
        if name.startswith(('apps/www/assets/homepage/', 'apps/www/gallery-engine/', 'apps/huiguan/design-system/ui/', 'apps/bilibili-toy/')):
            continue
        if any(part in ('node_modules', 'uploads', 'store', '__pycache__') or part.startswith('.env') for part in parts):
            continue
        if name.endswith(('.db', '.sqlite', '.sqlite3', '.db-wal', '.db-shm', '.bak', '.log', '.pid')) or Path(name).name in ('characters.json', 'game_saves.json'):
            continue
        source.extract(item, target)
print(f'[build:site] Exported committed source to {target}')
