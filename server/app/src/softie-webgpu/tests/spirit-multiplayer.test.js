import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { createSpiritMultiplayer, SPIRIT_ROOM_WS } from '../server/spirit-multiplayer.js';
import { DEFAULT_SPIRIT_SETTINGS, spiritRadius } from '../src/games/spirit-playground/settings.js';
import { normalizeBodyShape } from '../src/games/spirit-playground/body-shape.js';

function waitForMessage(socket, predicate, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('Timed out waiting for room snapshot.')); }, timeout);
    const onMessage = data => {
      const message = JSON.parse(data.toString());
      if (!predicate(message)) return;
      cleanup(); resolve(message);
    };
    const cleanup = () => { clearTimeout(timer); socket.off('message', onMessage); };
    socket.on('message', onMessage);
  });
}

test('the room server releases a stale grab when an open client stops sending pointer keepalives', async t => {
  const http = createServer();
  const roomServer = createSpiritMultiplayer();
  http.on('upgrade', roomServer.upgrade);
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  const address = http.address();
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}${SPIRIT_ROOM_WS}`, {
    origin: `http://127.0.0.1:${address.port}`,
  });
  t.after(async () => {
    socket.terminate(); roomServer.close();
    await new Promise(resolve => http.close(resolve));
  });
  await new Promise((resolve, reject) => {
    socket.once('open', resolve); socket.once('error', reject);
  });
  const joinedPromise = waitForMessage(socket, message => message.type === 'joined');
  socket.send(JSON.stringify({ type: 'join', protocol: 1, roomId: 'stale-grab-test' }));
  const joined = await joinedPromise;
  const entity = joined.entities.find(value => value.id === joined.selfId);
  assert.ok(entity);

  const anchor = { x: 0.4, y: 1, z: 0.3 };
  const target = { x: entity.state.position.x + anchor.x,
    y: entity.state.position.y + anchor.y, z: entity.state.position.z + anchor.z };
  const grabbedPromise = waitForMessage(socket, message =>
    message.type === 'snapshot' && message.entities.find(value => value.id === joined.selfId)?.state.grab.active);
  socket.send(JSON.stringify({ type: 'command', inputSeq: 1,
    command: { type: 'grab', phase: 'start', anchor, target } }));
  await grabbedPromise;

  const released = await waitForMessage(socket, message =>
    message.type === 'snapshot' && !message.entities.find(value => value.id === joined.selfId)?.state.grab.active, 2000);
  assert.equal(released.entities.find(value => value.id === joined.selfId).state.pinch.active, false);
});

test('a new room server accepts and broadcasts the bud spirit profile and collision radius', async t => {
  const http = createServer();
  const roomServer = createSpiritMultiplayer();
  http.on('upgrade', roomServer.upgrade);
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
  const address = http.address();
  const connect = () => new WebSocket(`ws://127.0.0.1:${address.port}${SPIRIT_ROOM_WS}`, {
    origin: `http://127.0.0.1:${address.port}`,
  });
  const [first, second] = [connect(), connect()];
  t.after(async () => {
    first.terminate(); second.terminate(); roomServer.close();
    await new Promise(resolve => http.close(resolve));
  });
  await Promise.all([first, second].map(socket => new Promise((resolve, reject) => {
    socket.once('open', resolve); socket.once('error', reject);
  })));

  const firstJoined = waitForMessage(first, message => message.type === 'joined');
  first.send(JSON.stringify({ type: 'join', protocol: 1, roomId: 'bud-profile-test' }));
  const joinedA = await firstJoined;
  const secondJoined = waitForMessage(second, message => message.type === 'joined');
  second.send(JSON.stringify({ type: 'join', protocol: 1, roomId: 'bud-profile-test' }));
  const joinedB = await secondJoined;

  const remoteProfile = waitForMessage(second, message => message.type === 'snapshot'
    && message.entities.some(entity => entity.id === joinedA.selfId
      && entity.settings.skin === 'bud'
      && Math.abs(entity.state.bounds.x[1] - (6.3 - spiritRadius({ skin: 'bud', size: 1.2 }))) < 1e-10));
  first.send(JSON.stringify({ type: 'profile', inputSeq: 1, settings: {
    version: 2, name: '芽灵', color: '#92d6bd', size: 1.2,
    stiffness: 0.35, damping: 0.45, opacity: 1, acceleration: 20,
    skin: 'bud', earSize: 1, tailLength: 1, eyeSize: 1,
  } }));
  const snapshot = await remoteProfile;
  assert.ok(snapshot.entities.some(entity => entity.id === joinedB.selfId));
  assert.equal(roomServer.rooms.get('bud-profile-test').physics.entities.get(joinedA.selfId).settings.skin, 'bud');
  const bodyShape = normalizeBodyShape(Array.from({ length: 48 }, (_, i) => ({
    x: Math.cos(i * Math.PI / 24), y: Math.sin(i * Math.PI / 24),
  })));
  const customSnapshot = waitForMessage(second, message => message.type === 'snapshot'
    && message.entities.some(entity => entity.id === joinedA.selfId && entity.settings.skin === 'custom'));
  first.send(JSON.stringify({ type: 'profile', inputSeq: 2, settings: {
    ...DEFAULT_SPIRIT_SETTINGS, skin: 'custom', bodyShape,
  } }));
  const received = await customSnapshot;
  const remote = received.entities.find(entity => entity.id === joinedA.selfId);
  assert.equal(remote.settings.bodyShape.points.length, 40);
  assert.equal(remote.state.bounds.x[1], 6.3 - spiritRadius(remote.settings));
});
