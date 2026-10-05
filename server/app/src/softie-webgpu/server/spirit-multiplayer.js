import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { DEFAULT_SPIRIT_SETTINGS, validateSpiritSettings } from '../src/games/spirit-playground/settings.js';
import { SpiritRoomPhysics } from '../src/multiplayer/room-physics.js';

export const SPIRIT_ROOM_WS = '/api/spirit-room/ws';
const MAX_PAYLOAD = 8 * 1024;
const CAPACITY = 10;
const SERVER_HZ = 30;
const SNAPSHOT_HZ = 15;
const zeroDirection = () => ({ x: 0, z: 0 });
const isLoopback = address => address === '::1' || /^(?:::ffff:)?127(?:\.\d{1,3}){3}$/.test(address ?? '');

function verifyOrigin(request) {
  const forwarded = isLoopback(request.socket.remoteAddress) && request.headers['x-forwarded-host'];
  const host = forwarded || request.headers.host;
  const protocol = forwarded ? request.headers['x-forwarded-proto'] : request.socket.encrypted ? 'https' : 'http';
  let expected, origin;
  try {
    expected = new URL(`${protocol}://${host}`);
    origin = new URL(request.headers.origin ?? '');
  } catch { return false; }
  return ['http:', 'https:'].includes(expected.protocol) && origin.origin === expected.origin
    && !origin.username && !origin.password;
}

const percentile = (values, fraction) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))];
};

/** In-memory rooms only; the existing physics is authoritative and meshes stay client-side. */
export function createSpiritMultiplayer() {
  const rooms = new Map();
  const peers = new Set();
  const tickCosts = [];
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD, perMessageDeflate: false });
  let closed = false;
  let schedulerTicks = 0, measuredSchedulerHz = 0;
  let schedulerSampleAt = performance.now(), schedulerSampleTick = 0;

  const send = (peer, message) => {
    if (peer.socket.readyState !== WebSocket.OPEN) return;
    if (peer.socket.bufferedAmount > 128 * 1024) { peer.socket.close(1013, '网络较慢，请重新进入。'); return; }
    const payload = JSON.stringify(message);
    peer.bytesSent += Buffer.byteLength(payload);
    peer.socket.send(payload);
  };
  const snapshotMessage = (roomId, peer, type = 'snapshot') => {
    const room = rooms.get(roomId);
    if (!room) return null;
    return {
      type, roomId, selfId: peer.id, serverTime: Date.now(), ...room.physics.snapshot(),
      tick: room.tick, physicsTick: room.physics.tick,
      metrics: {
        receivedBytesPerSec: peer.rxBps,
        sentBytesPerSec: peer.txBps,
        bufferedAmount: peer.socket.bufferedAmount,
        schedulerHz: measuredSchedulerHz,
        physicsStepHz: room.measuredPhysicsHz,
        tickMs: { mean: tickCosts.length ? tickCosts.reduce((sum, n) => sum + n, 0) / tickCosts.length : 0,
          p95: percentile(tickCosts, 0.95), max: tickCosts.length ? Math.max(...tickCosts) : 0 },
      },
    };
  };
  const sendSnapshot = (roomId, peer) => send(peer, snapshotMessage(roomId, peer));
  const broadcast = roomId => {
    for (const peer of peers) if (peer.roomId === roomId) sendSnapshot(roomId, peer);
  };

  const upgrade = (request, socket, head) => {
    if (request.url?.split('?')[0] !== SPIRIT_ROOM_WS) return;
    if (!verifyOrigin(request) || closed) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
  };

  wss.on('connection', socket => {
    const peer = {
      socket, id: randomUUID(), roomId: null, alive: true,
      rxBytes: 0, bytesSent: 0, rxBps: 0, txBps: 0,
      lastRateAt: performance.now(), lastRxBytes: 0, lastTxBytes: 0,
      lastDirection: zeroDirection(), lastInputAt: performance.now(), lastPointerAt: performance.now(),
      inputCount: 0, inputWindow: Date.now(),
    };
    peers.add(peer);
    const joinTimeout = setTimeout(() => { if (!peer.roomId) socket.close(1008, '请先进入房间。'); }, 10000);
    joinTimeout.unref();
    socket.on('pong', () => { peer.alive = true; });
    socket.on('error', () => {});
    socket.on('message', (data, binary) => {
      peer.rxBytes += data.length;
      try {
        if (binary) throw new Error('此房间只接受 JSON。');
        if (Date.now() - peer.inputWindow >= 1000) { peer.inputWindow = Date.now(); peer.inputCount = 0; }
        if (++peer.inputCount > 60) { socket.close(1008, '移动输入过于频繁。'); return; }
        const message = JSON.parse(data.toString('utf8'));
        if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error('消息格式无效。');
        if (message.type === 'join') {
          if (peer.roomId) throw new Error('已经加入房间。');
          const roomId = message.roomId ?? 'forest';
          if (message.protocol !== 1 || typeof roomId !== 'string' || !/^[a-zA-Z0-9_-]{1,24}$/.test(roomId)) throw new Error('房间编号无效。');
          if (rooms.size >= 64 && !rooms.has(roomId)) throw new Error('房间暂时已满。');
          const settings = validateSpiritSettings(message.settings ?? DEFAULT_SPIRIT_SETTINGS);
          let room = rooms.get(roomId);
          if (room?.physics.entities.size >= CAPACITY) throw new Error('房间已经有 10 个灵体。');
          if (!room) {
            const now = performance.now();
            room = { physics: new SpiritRoomPhysics(), tick: 0, measuredPhysicsHz: 0,
              physicsSampleAt: now, physicsSampleTick: 0 };
            rooms.set(roomId, room);
          }
          room.physics.add(peer.id, settings);
          peer.roomId = roomId;
          clearTimeout(joinTimeout);
          send(peer, snapshotMessage(roomId, peer, 'joined'));
          broadcast(roomId);
          return;
        }
        if (!peer.roomId || !Number.isSafeInteger(message.inputSeq)) {
          throw new Error('只接受有效的移动方向和输入序号。');
        }
        const room = rooms.get(peer.roomId);
        const entity = room?.physics.entities.get(peer.id);
        const inputSeq = message.inputSeq;
        if (message.type === 'profile') {
          if (!entity || inputSeq <= entity.lastSeq) throw new Error('灵体配置无效或已经过期。');
          const settings = validateSpiritSettings(message.settings);
          room.physics.configure(peer.id, settings);
          entity.lastSeq = inputSeq;
          peer.lastDirection = zeroDirection();
          peer.lastInputAt = performance.now();
          broadcast(peer.roomId);
          return;
        }
        if (message.type === 'command') {
          if (!entity || inputSeq <= entity.lastSeq || !message.command || typeof message.command !== 'object'
            || !room.physics.command(peer.id, { ...message.command, seq: inputSeq })) {
            throw new Error('灵体互动指令无效或已经过期。');
          }
          if (message.command.type === 'grab' && message.command.phase === 'start') {
            peer.lastDirection = zeroDirection();
            peer.lastInputAt = performance.now();
          }
          if (['grab', 'pinch'].includes(message.command.type)) peer.lastPointerAt = performance.now();
          return;
        }
        if (message.type !== 'move' || !message.direction
          || !Number.isFinite(message.direction.x) || !Number.isFinite(message.direction.z)) {
          throw new Error('只接受有效的移动方向和输入序号。');
        }
        const direction = message.direction;
        if (!entity || inputSeq <= entity.lastSeq || Math.abs(direction.x) > 1 || Math.abs(direction.z) > 1
          || Math.hypot(direction.x, direction.z) > 1.001) throw new Error('移动输入无效或已经过期。');
        if (!room.physics.command(peer.id, { type: 'move', seq: inputSeq, direction })) throw new Error('移动输入已过期。');
        peer.lastDirection = direction;
        peer.lastInputAt = performance.now();
      } catch (error) {
        send(peer, { type: 'error', error: error.message || '消息格式无效。' });
        if (!peer.roomId) socket.close(1008, '无法加入房间。');
      }
    });
    socket.on('close', () => {
      clearTimeout(joinTimeout); peers.delete(peer);
      const room = rooms.get(peer.roomId);
      if (!room) return;
      room.physics.remove(peer.id);
      if (room.physics.entities.size === 0) rooms.delete(peer.roomId);
      else broadcast(peer.roomId);
    });
  });

  let lastTickAt = performance.now(), tickAccumulator = 0;
  const tickTimer = setInterval(() => {
    const now = performance.now();
    tickAccumulator += Math.min(now - lastTickAt, 250) / 1000;
    lastTickAt = now;
    for (const peer of peers) {
      if (peer.roomId && (peer.lastDirection.x !== 0 || peer.lastDirection.z !== 0)
        && now - peer.lastInputAt > 600) {
        rooms.get(peer.roomId)?.physics.entities.get(peer.id)?.physics.setDriveAcceleration({ x: 0, z: 0 });
        peer.lastDirection = zeroDirection();
      }
      const physics = rooms.get(peer.roomId)?.physics.entities.get(peer.id)?.physics;
      if (physics?.diagnostics.dragging && now - peer.lastPointerAt > 650) {
        physics.clearDrive(); physics.endGrab();
        peer.lastDirection = zeroDirection(); peer.lastPointerAt = now;
      }
    }
    const snapshotRooms = new Set();
    const step = 1 / SERVER_HZ;
    while (tickAccumulator + 1e-9 >= step) {
      const started = performance.now();
      schedulerTicks++;
      for (const [roomId, room] of rooms) {
        room.physics.update(step); room.tick++;
        if (room.tick % (SERVER_HZ / SNAPSHOT_HZ) === 0) snapshotRooms.add(roomId);
      }
      tickCosts.push(performance.now() - started);
      if (tickCosts.length > 300) tickCosts.shift();
      tickAccumulator = Math.max(0, tickAccumulator - step);
    }
    for (const roomId of snapshotRooms) broadcast(roomId);
  }, 10);
  const rateTimer = setInterval(() => {
    const now = performance.now();
    const schedulerElapsed = (now - schedulerSampleAt) / 1000;
    if (schedulerElapsed > 0) {
      measuredSchedulerHz = (schedulerTicks - schedulerSampleTick) / schedulerElapsed;
      schedulerSampleAt = now;
      schedulerSampleTick = schedulerTicks;
    }
    for (const room of rooms.values()) {
      const roomElapsed = (now - room.physicsSampleAt) / 1000;
      if (roomElapsed > 0) {
        room.measuredPhysicsHz = (room.physics.tick - room.physicsSampleTick) / roomElapsed;
        room.physicsSampleAt = now;
        room.physicsSampleTick = room.physics.tick;
      }
    }
    for (const peer of peers) {
      const peerElapsed = (now - peer.lastRateAt) / 1000;
      if (peerElapsed <= 0) continue;
      peer.rxBps = Math.round((peer.rxBytes - peer.lastRxBytes) / peerElapsed);
      peer.txBps = Math.round((peer.bytesSent - peer.lastTxBytes) / peerElapsed);
      peer.lastRxBytes = peer.rxBytes; peer.lastTxBytes = peer.bytesSent; peer.lastRateAt = now;
    }
  }, 1000);
  const heartbeatTimer = setInterval(() => {
    for (const peer of peers) {
      if (!peer.alive) peer.socket.terminate();
      else { peer.alive = false; peer.socket.ping(); }
    }
  }, 15000);
  for (const timer of [tickTimer, rateTimer, heartbeatTimer]) timer.unref();

  return { upgrade, rooms, close() {
    if (closed) return; closed = true;
    for (const timer of [tickTimer, rateTimer, heartbeatTimer]) clearInterval(timer);
    for (const peer of peers) peer.socket.terminate();
    wss.close(); rooms.clear();
  } };
}

/** Vite owns HTTP in both dev and preview; attach only the game room upgrade. */
export function spiritMultiplayerPlugin() {
  const attach = server => {
    const multiplayer = createSpiritMultiplayer();
    server.httpServer.on('upgrade', multiplayer.upgrade);
    server.httpServer.once('close', () => {
      server.httpServer.off('upgrade', multiplayer.upgrade);
      multiplayer.close();
    });
  };
  return { name: 'spirit-multiplayer', configureServer: attach, configurePreviewServer: attach };
}
