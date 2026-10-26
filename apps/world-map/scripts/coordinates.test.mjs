import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP_SIZE, MAP_SEAM_U, mapPoint, mapPixelFromUV } from '../src/map-coordinates.ts';
import { ATLAS_NODES } from '../src/nodes.ts';

test('red 7 and red 8 match registered reference, rather than renaming black U24', () => {
  for (const [code, x, y] of [['07', 2573.892, 749.657], ['08', 2388.962, 841.822]]) {
    const node = ATLAS_NODES.find(n => n.code === code);
    assert.ok(node && Math.hypot(node.x-x, node.y-y) < 1, `${code} must match reference within one source pixel`);
  }
  assert.equal(ATLAS_NODES.find(n => n.code === 'U24')?.kind, 'unnamed');
  assert.equal(new Set(ATLAS_NODES.map(n => n.code)).size, ATLAS_NODES.length);
});

test('source pixels, cylindrical display and editor UV round-trip across seam', () => {
  for (const x of [0, 1, 2389, 2574, 8191, 8192, 9215]) {
    for (const y of [0, 1, 842, 1899, 1900]) {
      const [px, py, pz] = mapPoint(x, y, 7.794, 10);
      const u = ((Math.atan2(px, -pz) / (Math.PI*2) + .5) % 1 + 1) % 1;
      const pixel = mapPixelFromUV(u, py/10+.5);
      const deltaX = Math.min(Math.abs(pixel.x-x), Math.abs(pixel.x-x-MAP_SIZE.width));
      assert.ok(deltaX < 1e-8 && Math.abs(pixel.y-y) < 1e-8);
    }
  }
  assert.ok(MAP_SEAM_U > 0 && MAP_SEAM_U < 1);
});
