import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { JellyPhysics } from '../src/physics.js';
import { createSpiritPointerInteraction } from '../src/games/spirit-playground/pointer-interaction.js';
import { createSpiritController } from '../src/games/spirit-playground/controller.js';
import { createInputFixture, emit } from './spirit-input-fixture.js';

function pointerFixture(t, size = 1, callbacks = {}) {
  const input = createInputFixture(t);
  const physics = new JellyPhysics();
  physics.setBounds({ x: [-5, 5], z: [-5, 5] });
  const root = new THREE.Group();
  const skinRoot = new THREE.Group();
  skinRoot.scale.setScalar(size);
  const geometry = new THREE.SphereGeometry(1, 24, 16);
  geometry.translate(0, 1, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  skinRoot.add(mesh);
  root.add(skinRoot);
  const expressions = [];
  const faceMotion = { grab: (...args) => expressions.push(args), lookAt() {} };
  const spirit = { physics, root, pickMeshes: [mesh], skin: { root: skinRoot, faceMotion } };
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 50);
  camera.position.set(0, 6, 6);
  camera.lookAt(0, 1, 0);
  camera.updateMatrixWorld();
  root.updateMatrixWorld(true);
  let activities = 0;
  const pointer = createSpiritPointerInteraction({ canvas: input.canvas, camera, spirit,
    onActivity: () => activities++, ...callbacks });
  const screenPoint = new THREE.Vector3(0, size, 0).project(camera);
  const point = {
    clientX: 20 + (screenPoint.x + 1) * 300,
    clientY: 30 + (1 - screenPoint.y) * 300,
    pointerId: 1, pointerType: 'mouse', button: 0,
  };
  t.after(() => { pointer.dispose(); geometry.dispose(); mesh.material.dispose(); });
  return { ...input, physics, spirit, camera, pointer, point, expressions, activities: () => activities };
}

test('pointer grab sends ordered, bounded network commands and always ends on release', t => {
  const commands = [];
  const { canvas, pointer, point } = pointerFixture(t, 1, { onCommand: command => commands.push(command) });
  pointer.setActive(true);
  emit(canvas, 'pointerdown', point);
  assert.equal(commands[0].type, 'grab');
  assert.equal(commands[0].phase, 'start');
  emit(canvas, 'pointermove', { ...point, clientX: point.clientX + 80 });
  emit(canvas, 'pointerup', point);
  assert.deepEqual(commands.map(command => command.phase), ['start', 'move', 'end']);
  assert.ok(Object.values(commands[1].target).every(Number.isFinite));
});

test('a tap on the local spirit pokes it, while a tap on a remote spirit requests approach', t => {
  let pokes = 0, destination;
  const { canvas, pointer, point, camera, spirit } = pointerFixture(t, 1, {
    onPoke: () => pokes++, onMoveTo: value => { destination = value; },
  });
  pointer.setActive(true);
  emit(canvas, 'pointerdown', { ...point, pointerType: 'touch' });
  emit(canvas, 'pointerup', { ...point, pointerType: 'touch' });
  assert.equal(pokes, 1);

  const root = new THREE.Group(); root.position.x = 2.7;
  const geometry = new THREE.SphereGeometry(1, 24, 16); geometry.translate(0, 1, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()); root.add(mesh);
  const remote = { instance: { root, pickMeshes: [mesh] } };
  const remotes = new Map([['friend', remote]]);
  pointer.dispose();
  const otherPointer = createSpiritPointerInteraction({ canvas, camera,
    spirit, getRemoteSpirits: () => remotes,
    onMoveTo: value => { destination = value; } });
  otherPointer.setActive(true);
  root.updateMatrixWorld(true); camera.updateMatrixWorld();
  const projected = new THREE.Vector3(2.7, 1, 0).project(camera);
  emit(canvas, 'pointerdown', { clientX: 20 + (projected.x + 1) * 300,
    clientY: 30 + (1 - projected.y) * 300, pointerId: 2, pointerType: 'mouse', button: 0 });
  assert.equal(destination?.spiritId, 'friend');
  otherPointer.dispose(); geometry.dispose(); mesh.material.dispose();
});

test('two touch pointers sync pinch stretch while preserving the primary grab', t => {
  const commands = [];
  const { canvas, physics, pointer, point } = pointerFixture(t, 1, { onCommand: command => commands.push(command) });
  pointer.setActive(true);
  emit(canvas, 'pointerdown', { ...point, pointerType: 'touch' });
  emit(canvas, 'pointerdown', { ...point, pointerId: 2, pointerType: 'touch', clientX: point.clientX + 24 });
  assert.equal(physics.diagnostics.dragging, true);
  assert.equal(physics.diagnostics.pinching, true);
  emit(canvas, 'pointermove', { ...point, pointerId: 2, pointerType: 'touch', clientX: point.clientX + 60 });
  assert.ok(physics.captureState().pinch.target > 0);
  emit(canvas, 'pointerup', { ...point, pointerId: 2, pointerType: 'touch' });
  assert.equal(physics.diagnostics.pinching, false);
  assert.equal(physics.diagnostics.dragging, true);
  emit(canvas, 'pointerup', { ...point, pointerType: 'touch' });
  assert.equal(physics.diagnostics.dragging, false);
  assert.deepEqual(commands.map(command => `${command.type}:${command.phase}`), [
    'grab:start', 'pinch:start', 'pinch:move', 'pinch:end', 'grab:end',
  ]);
});

for (const size of [0.65, 1.35]) {
  test(`a skin at size ${size} is picked in authored units, indents, drags and releases with inertia`, t => {
    const { canvas, physics, pointer, point, captures, expressions, activities } = pointerFixture(t, size);
    let anchor;
    const beginGrab = physics.beginGrab.bind(physics);
    physics.beginGrab = (local, world) => { anchor = { ...local }; beginGrab(local, world); };
    pointer.setActive(true);
    assert.equal(emit(canvas, 'pointerdown', point).defaultPrevented, true);
    assert.equal(physics.diagnostics.dragging, true);
    assert.ok(captures.has(1));
    assert.ok(Math.abs(Math.hypot(anchor.x, anchor.y - 1, anchor.z) - 1) < 0.02,
      'the hit is transformed out of skin scaling');
    for (let i = 0; i < 12; i++) physics.update(1 / 120);
    assert.ok(physics.diagnostics.deformation > 0.02, 'a stationary press locally indents the surface');
    emit(canvas, 'pointermove', { ...point, clientX: point.clientX + 70 });
    for (let i = 0; i < 30; i++) physics.update(1 / 120);
    assert.ok(physics.position.x > 0.5, 'drag target moves the soft body');
    emit(canvas, 'pointermove', { ...point, clientX: point.clientX + 90 });
    physics.update(1 / 120);
    const beforeRelease = physics.position.x;
    emit(canvas, 'pointerup', point);
    assert.equal(physics.diagnostics.dragging, false);
    assert.equal(captures.size, 0);
    assert.deepEqual(expressions.at(-1), [false, true]);
    physics.update(1 / 120);
    assert.ok(physics.position.x > beforeRelease, 'normal release keeps momentum');
    assert.ok(activities() >= 4);
  });
}

test('only one touch owns grabbing, and all interruption paths release capture and clear propulsion', t => {
  const { canvas, physics, pointer, point, testDocument, testWindow, captures } = pointerFixture(t);
  const cancellations = [
    () => emit(canvas, 'pointercancel', point),
    () => emit(canvas, 'lostpointercapture', point),
    () => emit(testWindow, 'blur'),
    () => { testDocument.hidden = true; emit(testDocument, 'visibilitychange'); },
    () => { testDocument.activeElement = {}; emit(testDocument, 'focusin'); },
    () => { testDocument.body.dataset.softiePage = 'home'; emit(testDocument, 'softie-route'); },
    () => pointer.setActive(false),
    () => pointer.clear(),
  ];
  for (const cancel of cancellations) {
    physics.reset();
    testDocument.hidden = false;
    testDocument.body.dataset.softiePage = 'spirit';
    pointer.setActive(true);
    emit(canvas, 'pointerdown', { ...point, pointerType: 'touch' });
    emit(canvas, 'pointerdown', { ...point, pointerId: 2, pointerType: 'touch' });
    assert.equal(pointer.getDiagnostics().pointerId, 1);
    assert.equal(captures.size, 1);
    emit(canvas, 'pointermove', { ...point, pointerId: 2, clientX: point.clientX + 100 });
    assert.equal(physics.position.x, 0);
    physics.setDriveAcceleration({ x: 12, z: 0 });
    physics.velocity.x = 1;
    cancel();
    assert.equal(pointer.getDiagnostics().pointerId, null);
    assert.equal(physics.diagnostics.dragging, false);
    assert.deepEqual(physics.diagnostics.drive, { x: 0, z: 0 });
    assert.equal(physics.velocity.x, 0);
    assert.equal(captures.size, 0);
  }
});

test('keyboard propulsion yields to grabbing and can resume after the pointer releases', t => {
  const { canvas, physics, pointer, point, testWindow } = pointerFixture(t);
  const controller = createSpiritController({ canvas, physics });
  t.after(() => controller.dispose());
  controller.setActive(true);
  pointer.setActive(true);
  emit(testWindow, 'keydown', { code: 'KeyD' });
  controller.update();
  assert.ok(physics.diagnostics.drive.x > 0);
  emit(canvas, 'pointerdown', point);
  controller.update();
  assert.deepEqual(physics.diagnostics.drive, { x: 0, z: 0 });
  assert.deepEqual(controller.getDiagnostics().keys, []);
  emit(canvas, 'pointerup', point);
  emit(testWindow, 'keydown', { code: 'KeyW' });
  controller.update();
  assert.ok(physics.diagnostics.drive.z < 0);
  controller.dispose();
  pointer.dispose();
  assert.equal(canvas.style.touchAction, 'auto');
  emit(canvas, 'pointerdown', point);
  emit(testWindow, 'keydown', { code: 'KeyD' });
  assert.equal(physics.diagnostics.dragging, false);
  assert.deepEqual(physics.diagnostics.drive, { x: 0, z: 0 });
});
