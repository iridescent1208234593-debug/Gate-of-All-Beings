"""Check full-resolution island fidelity, gutters and all pyramid coverage."""
import hashlib
import json
import unittest
from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/assets/atlas-tiles'

class TilesTest(unittest.TestCase):
    def test_complete_lossless_source_and_gutters(self):
        data = json.loads((ASSETS/'manifest.json').read_text())
        source = ROOT/'art-source/fantasy-world-map.jpg'
        self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), data['sourceSha256'])
        original = Image.open(source).convert('RGB')
        for level in data['levels']:
            size = (level['width'], level['height'])
            expected = original if size == original.size else original.resize(size, Image.Resampling.LANCZOS)
            reconstructed = Image.new('RGB', size, 'magenta')
            area = 0
            for tile in level['tiles']:
                path = ASSETS/tile['url']
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), tile['sha256'])
                pixels = Image.open(path).convert('RGB')
                self.assertIsNone(ImageChops.difference(pixels, expected.crop(tile['crop'])).getbbox())
                left, top, _, _ = tile['crop']
                x, y, w, h = (tile[k] for k in ('x','y','width','height'))
                reconstructed.paste(pixels.crop((x-left,y-top,x-left+w,y-top+h)), (x,y))
                area += w*h
            self.assertEqual(area, size[0]*size[1])
            self.assertIsNone(ImageChops.difference(reconstructed, expected).getbbox(), 'No island or coastal pixel may be discarded')

if __name__ == '__main__':
    unittest.main()
