import test from 'node:test';
import assert from 'node:assert/strict';
import { movementDirection, createSpiritController } from '../src/games/spirit-playground/controller.js';
import { JellyPhysics } from '../src/physics.js';
import { createInputFixture, emit } from './spirit-input-fixture.js';

test('WASD maps to the camera-aligned XZ plane, with equal diagonal magnitude', () => {
  assert.deepEqual(movementDirection(new Set(['KeyW'])), { x: 0, z: -1 });
  assert.deepEqual(movementDirection(new Set(['KeyA', 'KeyD'])), { x: 0, z: 0 });
  const diagonal = movementDirection(new Set(['KeyW', 'KeyD']));
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 1e-12);
  assert.ok(diagonal.x > 0 && diagonal.z < 0);
  assert.deepEqual(movementDirection(new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD'])), { x: 0, z: 0 });
});

test('movement acceleration changes within the panel range and pauses while grabbed', t => {
  const { canvas, testWindow } = createInputFixture(t);
  const physics = new JellyPhysics();
  const controller = createSpiritController({ canvas, physics });
  t.after(() => controller.dispose());
  controller.setActive(true);
  emit(testWindow, 'keydown', { code: 'KeyD' });
  controller.update();
  assert.deepEqual(physics.diagnostics.drive, { x: 20, z: 0 });
  controller.setAcceleration(100);
  controller.update();
  assert.deepEqual(physics.diagnostics.drive, { x: 28, z: 0 });
  controller.setAcceleration(-100);
  controller.setAcceleration(NaN);
  controller.update();
  assert.deepEqual(physics.diagnostics.drive, { x: 6, z: 0 });
  physics.beginGrab({ x: 0.5, y: 1, z: 0.8 }, { x: 0.5, y: 1, z: 0.8 });
  controller.update();
  emit(testWindow, 'keydown', { code: 'KeyW' });
  assert.deepEqual(physics.diagnostics.drive, { x: 0, z: 0 });
  assert.deepEqual(controller.getDiagnostics().keys, []);
  physics.endGrab();
  emit(testWindow, 'keydown', { code: 'KeyA' });
  controller.update();
  assert.deepEqual(physics.diagnostics.drive, { x: -6, z: 0 });
});

test('focus, blur, visibility and inactive routes clear keyboard input and momentum', t => {
  const { canvas, testWindow, testDocument } = createInputFixture(t);
  const physics = new JellyPhysics();
  let stopCommands = 0;
  const controller = createSpiritController({ canvas, physics, onStop: () => stopCommands++ });
  t.after(() => controller.dispose());
  const cancellations = [
    () => { testDocument.activeElement = {}; emit(testDocument, 'focusin'); },
    () => emit(testWindow, 'blur'),
    () => { testDocument.hidden = true; emit(testDocument, 'visibilitychange'); },
    () => { testDocument.body.dataset.softiePage = 'home'; emit(testDocument, 'softie-route'); },
    () => controller.setActive(false),
  ];
  for (const cancel of cancellations) {
    testDocument.hidden = false;
    testDocument.body.dataset.softiePage = 'spirit';
    controller.setActive(true);
    emit(testWindow, 'keydown', { code: 'KeyD' });
    controller.update();
    physics.update(0.1);
    assert.ok(physics.velocity.x > 0);
    cancel();
    assert.deepEqual(controller.getDiagnostics().keys, []);
    assert.deepEqual(physics.diagnostics.drive, { x: 0, z: 0 });
    assert.equal(physics.velocity.x, 0);
  }
  assert.equal(stopCommands, cancellations.length * 2);
});

test('tap destinations steer with soft-body acceleration and stop at a contact radius', t => {
  const { canvas } = createInputFixture(t);
  const physics = new JellyPhysics();
  const inputs = [];
  const controller = createSpiritController({ canvas, physics, onMove: input => inputs.push(input) });
  t.after(() => controller.dispose());
  controller.setActive(true);
  controller.setTarget({ position: { x: 3, z: 0 }, stopDistance: 1 });
  controller.update();
  assert.deepEqual(physics.diagnostics.drive, { x: 20, z: 0 });
  physics.position.x = 2.5;
  controller.update();
  assert.deepEqual(physics.diagnostics.drive, { x: 0, z: 0 });
  assert.deepEqual(inputs.at(-1), { x: 0, z: 0 });
  assert.equal(controller.getDiagnostics().targeting, false);
});
