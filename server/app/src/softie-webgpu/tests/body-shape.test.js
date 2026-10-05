import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY_SHAPE_POINT_COUNT, extractLargestContour, normalizeBodyShape } from '../src/games/spirit-playground/body-shape.js';
import { DEFAULT_SPIRIT_SETTINGS, validateSpiritSettings } from '../src/games/spirit-playground/settings.js';

test('normalizes ellipse and irregular outlines to a fixed, centered point budget', () => {
  for (const outline of [
    Array.from({ length: 120 }, (_, i) => ({ x: Math.cos(i * Math.PI / 60) * 4, y: Math.sin(i * Math.PI / 60) * 1.5 })),
    [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 3, y: 1 }, { x: 2, y: 0.5 }, { x: 0, y: 1 }],
  ]) {
    const shape = normalizeBodyShape(outline);
    assert.equal(shape.points.length, BODY_SHAPE_POINT_COUNT);
    assert.deepEqual(normalizeBodyShape(shape), shape);
    assert.ok(Math.abs(Math.max(...shape.points.map(p => p.x)) + Math.min(...shape.points.map(p => p.x))) < 0.05);
    assert.ok(shape.points.every(p => Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1));
  }
});

test('very detailed outlines are bounded before simplification', () => {
  const detailed = Array.from({ length: 30000 }, (_, i) => {
    const angle = i * Math.PI * 2 / 30000, radius = 1 + Math.sin(i * 0.73) * 0.08;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
  assert.equal(normalizeBodyShape(detailed).points.length, BODY_SHAPE_POINT_COUNT);
});

test('solid painting extracts only the largest connected region', () => {
  const width = 32, height = 24, data = new Uint8ClampedArray(width * height * 4);
  const fill = (x0, y0, w, h) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) data[(y * width + x) * 4 + 3] = 255;
  };
  fill(3, 3, 18, 15); fill(27, 2, 2, 2);
  const shape = extractLargestContour({ data, width, height });
  assert.equal(shape.points.length, BODY_SHAPE_POINT_COUNT);
  assert.ok(Math.max(...shape.points.map(p => p.x)) > 0.7);
  assert.ok(Math.min(...shape.points.map(p => p.x)) < -0.7);
});

test('custom body profile is strictly persisted as normalized shape data only', () => {
  const points = Array.from({ length: BODY_SHAPE_POINT_COUNT }, (_, i) => ({
    x: Math.cos(i * Math.PI * 2 / BODY_SHAPE_POINT_COUNT), y: Math.sin(i * Math.PI * 2 / BODY_SHAPE_POINT_COUNT),
  }));
  const profile = validateSpiritSettings({ ...DEFAULT_SPIRIT_SETTINGS, skin: 'custom', bodyShape: { points } });
  assert.equal(profile.bodyShape.points.length, BODY_SHAPE_POINT_COUNT);
  assert.throws(() => validateSpiritSettings({ ...profile, bodyShape: { points: points.slice(1) } }), TypeError);
  assert.throws(() => validateSpiritSettings({ ...DEFAULT_SPIRIT_SETTINGS, skin: 'softie', bodyShape: { points } }), TypeError);
});
