"""Build deterministic, lossless tiles from the unchanged atlas raster (Pillow)."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'art-source/fantasy-world-map.jpg'
image = Image.open(source).convert('RGB')
assert image.size == (8192, 1900), 'Do not silently rescale a different map edition'
out = ROOT / 'public/assets/atlas-tiles'
out.mkdir(parents=True, exist_ok=True)
manifest = {'width': image.width, 'height': image.height, 'tileSize': 512,
            'gutter': 1, 'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'levels': []}
vector = json.loads((ROOT / 'public/assets/atlas-regions.json').read_text())
assert manifest['sourceSha256'] == vector['sourceSha256'], 'Raster and authored extension must share the same source edition'
for level, divisor in enumerate((4, 2, 1)):
    size = (image.width // divisor, round(image.height / divisor))
    scaled = image.resize(size, Image.Resampling.LANCZOS) if divisor != 1 else image
    tiles = []
    for y in range(0, size[1], 512):
        for x in range(0, size[0], 512):
            w, h = min(512, size[0]-x), min(512, size[1]-y)
            # One real neighboring pixel on each interior edge prevents filtering seams.
            box = (max(0, x-1), max(0, y-1), min(size[0], x+w+1), min(size[1], y+h+1))
            tile = scaled.crop(box)
            filename = f'{level}/{x//512}-{y//512}.png'
            path = out / filename
            path.parent.mkdir(exist_ok=True)
            tile.save(path, optimize=True)
            tiles.append({'url': filename, 'x': x, 'y': y, 'width': w, 'height': h,
                          'crop': list(box), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    manifest['levels'].append({'width': size[0], 'height': size[1], 'tiles': tiles})
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
print(f'{sum(len(l["tiles"]) for l in manifest["levels"])} tiles; {sum(p.stat().st_size for p in out.rglob("*.png"))} bytes')
