"""Export committed site source; never copy runtime data or the dirty worktree."""
import io
from pathlib import Path
import shutil
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
target = root / '.releases/candidate/site'
archive = subprocess.check_output(['git', 'archive', '--format=zip', 'HEAD', 'portal', 'server', 'shared'], cwd=root)
if target.exists():
    shutil.rmtree(target)
target.mkdir(parents=True)
with zipfile.ZipFile(io.BytesIO(archive)) as source:
    for item in source.infolist():
        name = item.filename
        parts = Path(name).parts
        if '..' in parts or Path(name).is_absolute():
            raise RuntimeError('Unsafe archive path')
        if name.startswith(('server/app/modules/', 'portal/www/assets/homepage/', 'portal/www/gallery-engine/', 'portal/huiguan/design-system/ui/')):
            continue
        if any(part in ('node_modules', 'uploads', 'store', '__pycache__') or part.startswith('.env') for part in parts):
            continue
        if name.endswith(('.db', '.sqlite', '.bak')) or Path(name).name in ('characters.json', 'game_saves.json'):
            continue
        source.extract(item, target)
print('[build:site] Exported committed source to .releases/candidate/site')
