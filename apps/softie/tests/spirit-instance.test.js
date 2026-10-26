import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { JellyPhysics } from '../src/physics.js';
import { makeSlime } from '../src/slime.js';
import { SpiritInstance } from '../src/games/spirit-playground/spirit-instance.js';
import { normalizeBodyShape } from '../src/games/spirit-playground/body-shape.js';

const softie = options => new SpiritInstance({ ...options,
  appearance: { skin: 'softie', color: '#f17fa9', ...options?.appearance } });

test('softie skin retains its original shared deformation for body and posed face', () => {
  const physics = new JellyPhysics();
  const spirit = softie({ physics });
  const another = softie();
  const slime = spirit.skin.slime;
  physics.beginGrab({ x: 0.3, y: 1.3, z: 0.8 }, { x: 0.3, y: 1.3, z: 0.8 });
  physics.moveGrab({ x: 0.8, y: 2.0, z: 0.8 });
  spirit.skin.faceMotion.grab(true);
  for (let i = 0; i < 40; i++) physics.update(1 / 120);
  spirit.update(1);
  const point = {};
  for (const key of ['body', 'face']) {
    const geometry = slime[key].geometry;
    const rest = geometry.userData.posed ?? geometry.userData.rest;
    const current = geometry.attributes.position.array;
    assert.notEqual(geometry.userData.rest, another.skin.slime[key].geometry.userData.rest);
    assert.notEqual(slime[key].material, another.skin.slime[key].material);
    for (let n = 0; n < rest.length; n += 3) {
      physics.deform(rest[n], rest[n + 1], rest[n + 2], point);
      assert.ok(Math.abs(current[n] - point.x) < 1e-6);
      assert.ok(Math.abs(current[n + 1] - point.y) < 1e-6);
      assert.ok(Math.abs(current[n + 2] - point.z) < 1e-6);
    }
    assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
  }
  assert.ok(spirit.skin.faceMotion.state.squish > 0.5);
  assert.deepEqual(spirit.root.position.toArray(), Object.values(physics.position));
  assert.deepEqual(spirit.skin.root.position.toArray(), [0, 0, 0], 'world translation is applied once');
  spirit.dispose();
  another.dispose();
});

test('skin swaps preserve instance/physics identity and release old assets exactly once', () => {
  const spirit = new SpiritInstance();
  const root = spirit.root;
  const physics = spirit.physics;
  const oldRoot = spirit.skin.root;
  const bodyGeometry = spirit.pickMeshes[0].geometry;
  const bodyMaterial = spirit.pickMeshes[0].material;
  let geometryDisposals = 0, materialDisposals = 0;
  bodyGeometry.addEventListener('dispose', () => geometryDisposals++);
  bodyMaterial.addEventListener('dispose', () => materialDisposals++);
  let updates = 0, disposals = 0;
  const replacementRoot = new THREE.Group();
  spirit.setSkin(({ physics: supplied, appearance }) => {
    assert.equal(supplied, physics);
    assert.equal(appearance.color, '#202b25');
    return {
      root: replacementRoot, pickMeshes: [], metrics: { radius: 1 },
      applyAppearance() {}, update() { updates++; },
      dispose() { disposals++; replacementRoot.removeFromParent(); },
    };
  });
  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 1);
  assert.equal(oldRoot.parent, null);
  assert.equal(spirit.root, root);
  assert.equal(spirit.physics, physics);
  spirit.update(2);
  assert.equal(updates, 1);
  spirit.dispose();
  spirit.dispose();
  spirit.update(3);
  assert.equal(disposals, 1);
  assert.equal(updates, 1);
  assert.equal(root.children.length, 0);
});

test('softie spirit keeps its deforming gel surface and translucent soft highlights', () => {
  const spirit = softie();
  const another = softie();
  const slime = spirit.skin.slime;
  const initial = slime.gel.attenuationColor.clone();
  assert.equal(slime.gel.transmission, 0.62);
  assert.equal(spirit.skin.surfaceMaterial.isMeshPhysicalNodeMaterial, true);
  assert.ok(slime.gel.roughness < 0.1);
  assert.equal(slime.bubbles.visible, true);
  spirit.applyAppearance({ color: '#abc123', opacity: 0.4, size: 1.3 });
  assert.ok(!slime.gel.attenuationColor.equals(initial));
  assert.equal(spirit.skin.surfaceMaterial.opacity, 0.4);
  assert.equal(spirit.skin.surfaceMaterial.opacityNode.value, 0.4);
  assert.equal(slime.gel.transmission, 0.62);
  assert.equal(spirit.skin.surfaceMaterial.transparent, true);
  assert.equal(slime.face.material.opacity, 0.4);
  assert.deepEqual(spirit.skin.root.scale.toArray(), [1.3, 1.3, 1.3]);
  assert.equal(spirit.metrics.radius, 1.66 * 1.3 / 3);
  assert.equal(another.skin.surfaceMaterial.opacity, 1);
  assert.ok(another.skin.slime.gel.attenuationColor.equals(initial));
  spirit.applyAppearance({ opacity: 1, size: 500 });
  assert.equal(spirit.skin.surfaceMaterial.transparent, false);
  assert.equal(spirit.skin.surfaceMaterial.depthWrite, true);
  assert.equal(spirit.skin.size, 1.35);
  spirit.dispose();
  another.dispose();
});

test('scaled softie vertices never cross the floor while the body is lifted', () => {
  const physics = new JellyPhysics();
  physics.position.y = 0.3;
  // Deliberately push authored points through the floor to exercise the scaled clamp.
  physics.deform = (x, y, z, out) => Object.assign(out, { x, y: y - 1, z });
  const spirit = softie({ physics, appearance: { size: 1.35 } });
  for (const key of ['body', 'face']) {
    const position = spirit.skin.slime[key].geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const worldY = position.getY(i) * spirit.skin.size / 3 + physics.position.y;
      assert.ok(worldY >= 0.012 - 1e-7, `floor clearance ${worldY}`);
    }
  }
  spirit.dispose();
});

test('playground detail reduces geometry while the original home defaults stay intact', () => {
  const home = makeSlime(new JellyPhysics());
  const spirit = softie();
  assert.equal(home.bubbles.count, 116);
  assert.equal(spirit.skin.slime.bubbles.count, 18);
  assert.ok(spirit.pickMeshes[0].geometry.attributes.position.count
    < home.body.geometry.attributes.position.count / 3);
  assert.equal(spirit.skin.surfaceMaterial.isMeshPhysicalNodeMaterial, true);
  assert.equal(spirit.skin.slime.face.material.color.getHexString(), home.face.material.color.getHexString());
  home.dispose();
  spirit.dispose();
});

test('default cat parts share deformation and retain independent buffers and expression', () => {
  const spirit = new SpiritInstance();
  const other = new SpiritInstance();
  assert.equal(spirit.skin.id, 'cat-spirit');
  assert.equal(spirit.skin.body.material.color.getHexString(), '202b25');
  assert.equal(spirit.metrics.radius, 1.2 / 3);
  assert.equal(spirit.skin.parts.length, 4);
  assert.equal(spirit.skin.outlines.length, 3);
  assert.equal(spirit.skin.outlines[0].geometry, spirit.skin.body.geometry);
  assert.equal(spirit.skin.outlines[0].material.side, THREE.BackSide);
  assert.equal(spirit.skin.outlines[0].scale.x, 1.045);
  const vertices = spirit.skin.parts.reduce((sum, part) => sum + part.geometry.attributes.position.count, 0);
  assert.ok(vertices < 2400, `cat has ${vertices} dynamic vertices`);
  spirit.physics.beginGrab({ x: 0.3, y: 1.2, z: 0.7 }, { x: 0.3, y: 1.2, z: 0.7 });
  spirit.physics.moveGrab({ x: 0.7, y: 1.8, z: 0.8 });
  spirit.skin.faceMotion.grab(true);
  for (let i = 0; i < 35; i++) spirit.physics.update(1 / 120);
  spirit.update(1);
  const expected = {};
  for (let i = 0; i < spirit.skin.parts.length; i++) {
    const part = spirit.skin.parts[i], geometry = part.geometry;
    const authored = geometry.userData.posed ?? geometry.userData.rest;
    assert.notEqual(geometry.userData.rest, other.skin.parts[i].geometry.userData.rest);
    assert.notEqual(part.material, other.skin.parts[i].material);
    for (let n = 0; n < authored.length; n += 3) {
      spirit.physics.deform(authored[n], authored[n + 1], authored[n + 2], expected);
      const position = geometry.attributes.position.array;
      assert.ok(Math.abs(position[n] - expected.x) < 1e-6);
      assert.ok(Math.abs(position[n + 1] - expected.y) < 1e-6);
      assert.ok(Math.abs(position[n + 2] - expected.z) < 1e-6);
    }
    assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
  }
  assert.ok(spirit.skin.faceMotion.state.squish > 0.5);
  spirit.dispose(); other.dispose();
});

test('cat shape controls reuse geometry, change silhouette, and respect scaled floor', () => {
  const physics = new JellyPhysics();
  physics.position.y = 0.3;
  physics.deform = (x, y, z, out) => Object.assign(out, { x, y: y - 1, z });
  const spirit = new SpiritInstance({ physics });
  const geometry = spirit.skin.body.geometry;
  const original = Float32Array.from(geometry.userData.rest);
  const originalEye = Float32Array.from(spirit.skin.eyes.geometry.userData.posed);
  spirit.applyAppearance({ earSize: 1.3, tailLength: 1.5, eyeSize: 1.2, size: 1.35, opacity: 0.4, color: '#c98b4b' });
  spirit.update(0.05);
  assert.equal(spirit.skin.body.geometry, geometry);
  assert.notDeepEqual(geometry.userData.rest, original);
  assert.notDeepEqual(spirit.skin.eyes.geometry.userData.posed, originalEye);
  assert.deepEqual(spirit.skin.root.scale.toArray(), [1.35, 1.35, 1.35]);
  assert.equal(spirit.skin.body.material.color.getHexString(), 'c98b4b');
  for (const part of spirit.skin.parts) {
    assert.equal(part.material.opacity, 0.4); assert.equal(part.material.depthWrite, false);
    const position = part.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      assert.ok(position.getY(i) * spirit.skin.size / 3 + physics.position.y >= 0.012 - 1e-7);
    }
  }
  assert.equal(spirit.skin.outlines[0].material.opacity, 0.4);
  assert.equal(spirit.skin.outlines[0].material.depthWrite, false);
  spirit.applyAppearance({ earSize: 1, tailLength: 1, opacity: 1 });
  assert.deepEqual(geometry.userData.rest, original);
  assert.equal(spirit.skin.body.material.depthWrite, true);
  spirit.dispose();
});

test('appearance can switch cat and original softie without replacing world identity', () => {
  const spirit = new SpiritInstance();
  const root = spirit.root, physics = spirit.physics, cat = spirit.skin;
  let disposed = 0;
  cat.body.geometry.addEventListener('dispose', () => disposed++);
  physics.position.x = 2;
  spirit.applyAppearance({ skin: 'softie', color: '#f17fa9' });
  assert.equal(spirit.skin.id, 'softie-spirit');
  assert.equal(disposed, 1); assert.equal(cat.root.parent, null);
  assert.equal(spirit.physics, physics); assert.equal(spirit.root, root);
  assert.equal(root.position.x, 2); assert.equal(root.children.length, 1);
  spirit.applyAppearance({ skin: 'cat', color: '#202b25' });
  assert.equal(spirit.skin.id, 'cat-spirit');
  assert.equal(spirit.physics, physics); assert.equal(root.children.length, 1);
  spirit.dispose(); assert.equal(disposed, 1);
});

test('custom drawing replaces only the body geometry and keeps the shared softie deformation', () => {
  const spirit = softie();
  const bodyShape = normalizeBodyShape(Array.from({ length: 80 }, (_, i) => ({
    x: Math.cos(i * Math.PI / 40) * 2, y: Math.sin(i * Math.PI / 40),
  })));
  spirit.applyAppearance({ skin: 'custom', bodyShape });
  assert.equal(spirit.skin.id, 'custom-drawn-spirit');
  assert.equal(spirit.skin.slime.body.geometry.userData.rest.length > 0, true);
  assert.ok(spirit.skin.slime.body.geometry.attributes.position.count < 2000);
  spirit.physics.position.x = 0.3;
  spirit.physics.setDriveAcceleration({ x: 1, z: 0 });
  for (let i = 0; i < 12; i++) spirit.physics.update(1 / 120);
  spirit.update(0.2);
  assert.ok(spirit.skin.slime.body.geometry.attributes.position.array.every(Number.isFinite));
  spirit.dispose();
});

test('test charm is visible on each preset and follows the shared deformation point', () => {
  const spirit = softie();
  spirit.applyAppearance({ accessory: 'test-badge' });
  assert.equal(spirit.skin.slime.accessory, 'badge');
  spirit.applyAppearance({ skin: 'cat' });
  assert.equal(spirit.genericAccessory.visible, true);
  spirit.physics.deform = (x, y, z, out) => Object.assign(out, { x: x + 0.2, y: y + 0.1, z: z - 0.15 });
  spirit.update(0.1);
  assert.ok(spirit.genericAccessory.position.distanceTo(new THREE.Vector3(0.76, 1.02, 0.67)) < 1e-12);
  spirit.applyAppearance({ skin: 'bud' });
  assert.equal(spirit.genericAccessory.visible, true);
  spirit.applyAppearance({ accessory: 'none' });
  assert.equal(spirit.genericAccessory.visible, false);
  spirit.dispose();
});

test('bud skin is replaceable, parameterized, and deforms every visible part with physics', () => {
  const physics = new JellyPhysics();
  physics.deform = (x, y, z, out) => Object.assign(out, { x: x * 0.92, y: y - 0.08 * Math.sin(x), z: z * 0.9 });
  const spirit = new SpiritInstance({ physics, appearance: { skin: 'bud', color: '#92d6bd', size: 1.1, eyeSize: 1.1 } });
  assert.equal(spirit.skin.id, 'bud-spirit');
  assert.equal(spirit.skin.leaves.name, 'bud-leaves');
  assert.equal(spirit.metrics.radius, 1.25 * 1.1 / 3);
  for (const part of spirit.skin.parts) {
    const { rest } = part.geometry.userData;
    const position = part.geometry.attributes.position.array;
    assert.ok(rest.length > 0);
    assert.ok(position.some((value, index) => Math.abs(value - rest[index]) > 1e-5), `${part.name} did not follow physics`);
    assert.ok(part.geometry.attributes.normal.array.every(Number.isFinite));
  }
  assert.equal(spirit.skin.body.material.color.getHexString(), '92d6bd');
  spirit.applyAppearance({ skin: 'softie' });
  assert.equal(spirit.skin.id, 'softie-spirit');
  assert.equal(spirit.physics, physics);
  spirit.dispose();
});
