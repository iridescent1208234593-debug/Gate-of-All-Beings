import test from 'node:test';
import assert from 'node:assert/strict';
import { JellyPhysics } from '../src/physics.js';

function advance(physics, seconds) {
  for (let i = 0; i < Math.round(seconds * 120); i++) physics.update(1 / 120);
}

function planarSpeed(physics) {
  return Math.hypot(physics.velocity.x, physics.velocity.z);
}

test('equal-magnitude straight and diagonal drives travel at the same planar speed', () => {
  const directions = [{ x: 1, z: 0 }, { x: 0, z: -1 }, { x: Math.SQRT1_2, z: -Math.SQRT1_2 }];
  const bodies = directions.map(direction => {
    const physics = new JellyPhysics();
    physics.setBounds({ x: [-50, 50], z: [-50, 50] });
    physics.setDriveAcceleration({ x: direction.x * 20, z: direction.z * 20 });
    advance(physics, 1);
    return physics;
  });
  for (const physics of bodies.slice(1)) {
    assert.ok(Math.abs(planarSpeed(physics) - planarSpeed(bodies[0])) < 1e-12);
    assert.ok(Math.abs(Math.hypot(physics.position.x, physics.position.z) - bodies[0].position.x) < 1e-12);
  }
  assert.ok(planarSpeed(bodies[0]) > 2.7);
  assert.ok(bodies[0].position.x > 2);
});

test('release clears propulsion, preserves momentum, and springs the crown back past rest', () => {
  const physics = new JellyPhysics();
  physics.setBounds({ x: [-50, 50], z: [-50, 50] });
  physics.setDriveAcceleration({ x: 20, z: 0 });
  advance(physics, 0.2);
  assert.ok(physics.diagnostics.modes.shearX < -0.07, 'acceleration bends the upper body behind the motion');
  const position = physics.position.x;
  const speed = planarSpeed(physics);
  physics.clearDrive();
  physics.update(1 / 120);
  assert.ok(physics.position.x > position, 'momentum survives key release');
  assert.ok(planarSpeed(physics) > 0 && planarSpeed(physics) < speed, 'existing friction slows the body');
  assert.deepEqual(physics.diagnostics.drive, { x: 0, z: 0 });
  advance(physics, 0.2);
  assert.ok(physics.diagnostics.modes.shearX > 0.04, 'deceleration and the spring cause visible rebound');
  advance(physics, 4);
  assert.equal(planarSpeed(physics), 0);
  assert.ok(physics.diagnostics.deformation < 0.0001);
});

test('drive validation clears stale input and caps vector magnitude without changing its direction', () => {
  const physics = new JellyPhysics();
  for (const force of [100, Number.MAX_VALUE]) {
    physics.setDriveAcceleration({ x: force, z: force });
    const { x, z } = physics.diagnostics.drive;
    assert.ok(Math.abs(Math.hypot(x, z) - 32) < 1e-12);
    assert.equal(x, z);
  }
  for (const invalid of [null, undefined, {}, { x: NaN, z: 0 }, { x: 1, z: Infinity }]) {
    physics.setDriveAcceleration({ x: 12, z: 4 });
    physics.setDriveAcceleration(invalid);
    assert.deepEqual(physics.diagnostics.drive, { x: 0, z: 0 });
  }
  physics.setDriveAcceleration({ x: 20, z: 20 });
  physics.reset();
  advance(physics, 1);
  assert.deepEqual(physics.position, { x: 0, y: 0, z: 0 });
  assert.deepEqual(physics.diagnostics.drive, { x: 0, z: 0 });
});

test('configurable bounds constrain both propulsion and grabbing while defaults stay unchanged', () => {
  const physics = new JellyPhysics();
  assert.deepEqual(physics.diagnostics.bounds, { x: [-2.7, 2.7], y: [0, 3.4], z: [-1.35, 1.35] });
  physics.setBounds({ x: [-5, 5], z: [-5, 5] });
  physics.setDriveAcceleration({ x: 0, z: 20 });
  advance(physics, 1);
  assert.ok(physics.position.z > 1.35, 'the new arena can exceed the homepage limit');
  advance(physics, 5);
  assert.ok(physics.position.z <= 5 && physics.position.z > 4.9);

  physics.reset();
  assert.deepEqual(physics.diagnostics.bounds, { x: [-5, 5], y: [0, 3.4], z: [-5, 5] });
  const point = { x: 0.6, y: 1.1, z: 0.8 };
  physics.beginGrab(point, point);
  physics.moveGrab({ x: 50, y: 50, z: 50 });
  advance(physics, 1);
  assert.ok(physics.position.x > 4.8 && physics.position.x <= 5);
  assert.ok(physics.position.z > 4.8 && physics.position.z <= 5);
  assert.ok(physics.position.y <= 3.4);

  physics.setBounds({ x: [5, -5], y: [0, Infinity], z: [0] });
  assert.deepEqual(physics.diagnostics.bounds, { x: [-5, 5], y: [0, 3.4], z: [-5, 5] });
  const snapshot = physics.diagnostics.bounds;
  snapshot.x[0] = -1000;
  assert.equal(physics.diagnostics.bounds.x[0], -5, 'diagnostics cannot mutate live bounds');
});

test('a configured ground level applies to gravity, contact and visible deformation', () => {
  const physics = new JellyPhysics();
  physics.setBounds({ y: [-1, 2] });
  advance(physics, 3);
  assert.equal(physics.position.y, -1);
  assert.equal(physics.diagnostics.grounded, true);
  const out = physics.deform(0, -2, 0, {});
  assert.ok(out.y + physics.position.y >= -1 + 0.012 - 1e-12);
});
