import test from 'node:test';
import assert from 'node:assert/strict';
import { JellyPhysics } from '../src/physics.js';
import { SpiritRoomPhysics, ROOM_STEP, ROOM_CAPACITY, ROOM_HALF_SIZE } from '../src/multiplayer/room-physics.js';
import { spiritRadius } from '../src/games/spirit-playground/settings.js';

test('a restored grab and pinch snapshot continues the same spring motion', () => {
  const first = new JellyPhysics();
  first.setConfig({ stiffness: 0.12, damping: 0.18 });
  first.setBounds({ x: [-5, 5], z: [-5, 5] });
  first.poke(); first.update(0.019);
  first.beginGrab({ x: 0.8, y: 1.1, z: 0.9 }, { x: 0.8, y: 1.1, z: 0.9 });
  first.moveGrab({ x: 2, y: 1.8, z: 1.2 });
  first.beginPinch({ x: 1, y: 1, z: 0 }); first.movePinch(1.4);
  first.update(0.213);
  const second = new JellyPhysics();
  second.restoreState(JSON.parse(JSON.stringify(first.captureState())));
  assert.deepEqual(second.deform(0.8, 1.1, 0.9, {}), first.deform(0.8, 1.1, 0.9, {}));
  for (let step = 0; step < 200; step++) {
    if (step === 15) for (const physics of [first, second]) physics.movePinch(0.7);
    if (step === 30) for (const physics of [first, second]) physics.endGrab();
    if (step === 50) for (const physics of [first, second]) physics.applyImpulse({ x: 1.5, y: 0, z: -0.7 });
    first.stepFixed(); second.stepFixed();
    assert.deepEqual(second.captureState(), first.captureState());
  }
});

test('invalid state is rejected atomically and valid state never shares mutable arrays', () => {
  const physics = new JellyPhysics(); physics.poke(); physics.update(0.03);
  const before = physics.captureState();
  for (const mutate of [
    state => { state.version = 2; }, state => { state.position.x = Infinity; },
    state => { state.modes.localZ[1] = NaN; }, state => { state.modes.shearX = [1, 0]; },
    state => { state.grab.target = null; }, state => { state.bounds.z = [2, -2]; },
    state => { state.drive.x = 33; }, state => { state.pinch.axis = { x: 0, y: 0, z: 0 }; },
    state => { state.clock.steps = -1; }, state => { state.entry.landed = ['false', false]; },
  ]) {
    const invalid = structuredClone(before); mutate(invalid);
    assert.throws(() => physics.restoreState(invalid), TypeError);
    assert.deepEqual(physics.captureState(), before);
  }
  physics.restoreState(before);
  before.position.x = 900; before.modes.squash[0] = 0.4; before.bounds.x[0] = -1000;
  assert.notEqual(physics.position.x, 900);
  assert.notEqual(physics.captureState().modes.squash[0], 0.4);
  assert.notEqual(physics.captureState().bounds.x[0], -1000);
});

test('drive and entry snapshots resume exactly and collisions share one fixed room clock', () => {
  for (const start of [physics => physics.setDriveAcceleration({ x: 12, z: -7 }), physics => physics.startEntry()]) {
    const first = new JellyPhysics(); start(first); first.update(0.019);
    const second = new JellyPhysics().restoreState(first.captureState());
    for (let i = 0; i < 240; i++) { first.stepFixed(); second.stepFixed(); }
    assert.deepEqual(first.captureState(), second.captureState());
  }
  const states = [30, 60, 120].map(fps => {
    const room = new SpiritRoomPhysics();
    const a = room.add('a'), b = room.add('b');
    a.physics.position.x = -1; b.physics.position.x = 1;
    a.physics.position.z = b.physics.position.z = 0;
    room.command('a', { type: 'move', seq: 1, direction: { x: 1, z: 0 } });
    room.command('b', { type: 'move', seq: 1, direction: { x: -1, z: 0 } });
    for (let frame = 0; frame < fps; frame++) room.update(1 / fps);
    return room.snapshot();
  });
  for (const state of states.slice(1)) assert.deepEqual(state, states[0]);
  assert.ok(states[0].entities[0].state.position.x < states[0].entities[1].state.position.x);
});

test('room commands reject stale or impossible input without advancing acknowledgement', () => {
  const room = new SpiritRoomPhysics(); const entity = room.add('one', { skin: 'cat' });
  entity.physics.position.x = entity.physics.position.z = 0;
  assert.equal(room.command('one', { type: 'poke', seq: 1 }), true);
  const hopped = entity.physics.velocity.y;
  assert.equal(room.command('one', { type: 'poke', seq: 1 }), false);
  assert.equal(entity.physics.velocity.y, hopped);
  for (const command of [
    { type: 'move', seq: 2, direction: { x: Infinity, z: 0 } },
    { type: 'move', seq: 2, direction: { x: 1, z: 1 } },
    { type: 'grab', seq: 2, phase: 'start', anchor: { x: 50, y: 1, z: 0 }, target: { x: 0, y: 1, z: 0 } },
    { type: 'grab', seq: 2, phase: 'move', target: { x: 0, y: 1, z: 0 } },
    { type: 'grab', seq: 2, phase: 'start', anchor: { x: 0.8, y: 1.1, z: 0.9 }, target: { x: 8, y: 1.1, z: 0.9 } },
    { type: 'unknown', seq: 2 },
  ]) assert.equal(room.command('one', command), false);
  assert.equal(entity.lastSeq, 1);
  assert.equal(room.command('one', { type: 'grab', seq: 2, phase: 'start', anchor: { x: 0.8, y: 1.1, z: 0.9 }, target: { x: 0.8, y: 1.1, z: 0.9 } }), true);
  assert.equal(room.command('one', { type: 'grab', seq: 3, phase: 'move', target: { x: 1.4, y: 1.7, z: 0.9 } }), true);
  room.update(0.2); assert.ok(entity.physics.diagnostics.deformation > 0.01);
  assert.equal(room.command('one', { type: 'stop', seq: 4 }), true);
  assert.equal(entity.physics.diagnostics.dragging, false);
  assert.deepEqual(entity.physics.diagnostics.drive, { x: 0, z: 0 });
  assert.equal(room.snapshot().entities[0].ack, 4);
});

test('authoritative rooms validate, simulate and release two-finger pinch commands', () => {
  const room = new SpiritRoomPhysics(); const entity = room.add('pincher');
  entity.physics.position.x = entity.physics.position.z = 0;
  assert.equal(room.command('pincher', { type: 'grab', phase: 'start', seq: 1,
    anchor: { x: 0.5, y: 1, z: 0.8 }, target: { x: 0.5, y: 1, z: 0.8 } }), true);
  assert.equal(room.command('pincher', { type: 'pinch', phase: 'start', seq: 2, axis: { x: 1, y: 0, z: 0 } }), true);
  assert.equal(entity.physics.diagnostics.pinching, true);
  assert.equal(room.command('pincher', { type: 'pinch', phase: 'move', seq: 3, ratio: 2 }), true);
  assert.equal(room.command('pincher', { type: 'pinch', phase: 'move', seq: 4, ratio: Infinity }), false);
  room.update(0.12);
  assert.ok(entity.physics.diagnostics.modes.pinch > 0.1);
  assert.equal(room.command('pincher', { type: 'pinch', phase: 'end', seq: 4 }), true);
  assert.equal(entity.physics.diagnostics.pinching, false);
  assert.equal(entity.physics.diagnostics.dragging, true);
  assert.equal(room.command('pincher', { type: 'stop', seq: 5 }), true);
});

test('rooms preserve equal straight and diagonal speed and bound suspended catch-up', () => {
  const rooms = [{ x: 1, z: 0 }, { x: Math.SQRT1_2, z: -Math.SQRT1_2 }].map(direction => {
    const room = new SpiritRoomPhysics(); const entity = room.add('one');
    entity.physics.position.x = entity.physics.position.z = 0;
    room.command('one', { type: 'move', seq: 1, direction });
    for (let i = 0; i < 120; i++) room.update(ROOM_STEP);
    return room;
  });
  const speeds = rooms.map(room => { const v = room.entities.get('one').physics.velocity; return Math.hypot(v.x, v.z); });
  assert.ok(Math.abs(speeds[0] - speeds[1]) < 1e-12);
  assert.equal(rooms[0].tick, 120);
  rooms[0].update(1000); assert.equal(rooms[0].tick, 132);
});

test('ten colliding actors push, deform and remain finite within the room', () => {
  const room = new SpiritRoomPhysics();
  for (let i = 0; i < ROOM_CAPACITY; i++) {
    const entity = room.add(`spirit-${i}`, { skin: 'cat', size: 1, stiffness: 0.1, damping: 0.1 });
    entity.physics.position.x = (i % 5 - 2) * 2.35;
    entity.physics.position.z = i < 5 ? -1.15 : 1.15;
    const length = Math.hypot(1, 0.1);
    assert.equal(room.command(entity.id, { type: 'move', seq: 1,
      direction: { x: (i % 2 ? -1 : 1) / length, z: (i < 5 ? 0.1 : -0.1) / length } }), true);
  }
  assert.throws(() => room.add('overflow'), RangeError);
  let deformed = false, displaced = false;
  const initial = room.snapshot();
  for (let i = 0; i < 600; i++) {
    room.update(ROOM_STEP);
    for (const entity of room.entities.values()) {
      const state = entity.physics.captureState();
      assert.ok(Object.values(state.position).every(Number.isFinite));
      const edge = ROOM_HALF_SIZE - spiritRadius({ skin: 'cat', size: 1 });
      assert.ok(Math.abs(state.position.x) <= edge + 1e-10 && Math.abs(state.position.z) <= edge + 1e-10);
      deformed ||= Math.abs(state.modes.shearX[0]) + Math.abs(state.modes.shearZ[0]) > 0.02;
      displaced ||= Math.abs(state.position.x - initial.entities.find(value => value.id === entity.id).state.position.x) > 0.1;
      new JellyPhysics().restoreState(state);
    }
  }
  assert.ok(deformed && displaced, 'contact is visibly elastic and pushes neighbouring actors');
  const state = room.snapshot(); state.entities[0].settings.size = 100; state.entities[0].state.position.x = 100;
  assert.equal(room.entities.get('spirit-0').settings.size, 1);
  assert.notEqual(room.entities.get('spirit-0').physics.position.x, 100);
  room.configure('spirit-0', { skin: 'softie', size: 1.35 });
  assert.ok(Math.abs(room.entities.get('spirit-0').physics.position.x)
    <= ROOM_HALF_SIZE - spiritRadius({ skin: 'softie', size: 1.35 }));
  assert.equal(room.remove('spirit-9'), true);
});
