import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const roomPrefix = `load-${randomUUID().slice(0, 8)}`;
const capacityPerRoom = 10;
const maxRooms = Number(process.env.LOAD_MAX_ROOMS || 64);
const maxRoomsAtTargetHz = 27;
const actors = [];
const rooms = [];
const samples = [];
const url = new URL('/api/spirit-room/ws', base.replace(/^http/, 'ws')).href;

function connect(roomId) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { origin: base });
    const timer = setTimeout(() => fail(new Error('join timed out')), 10000);
    let done = false;
    const fail = error => {
      if (done) return;
      done = true; clearTimeout(timer); socket.terminate(); reject(error);
    };
    socket.once('error', fail);
    socket.on('message', raw => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'error') return fail(Object.assign(new Error(message.error), { code: 'ROOM_ERROR' }));
      if (message.type !== 'joined') return;
      done = true; clearTimeout(timer); socket.off('error', fail);
      const actor = { socket, roomId, latest: message };
      socket.on('message', data => {
        const next = JSON.parse(data.toString());
        if (next.type === 'snapshot') actor.latest = next;
      });
      resolve(actor);
    });
    socket.once('open', () => socket.send(JSON.stringify({ type: 'join', protocol: 1, roomId })));
  });
}

async function main() {
  let roomLimitError = null;
  let roomNumber = 0;
  while (roomNumber < maxRooms) {
    const roomId = `${roomPrefix}-${roomNumber}`;
    const roomActors = [];
    for (let i = 0; i < capacityPerRoom; i++) {
      try {
        const actor = await connect(roomId);
        actors.push(actor); roomActors.push(actor);
      } catch (error) {
        roomLimitError = error.message;
        break;
      }
    }
    if (roomActors.length === 0) break;
    rooms.push({ roomId, actors: roomActors });
    if (roomActors.length < capacityPerRoom) break;
    if (roomNumber === 0) {
      try {
        const extra = await connect(roomId);
        actors.push(extra); roomActors.push(extra);
      } catch (error) {
        if (error.code !== 'ROOM_ERROR' || !error.message.includes('10')) throw error;
      }
    }
    roomNumber++;
    if (roomNumber % 5 === 0 || roomNumber === maxRooms) {
      await new Promise(resolve => setTimeout(resolve, 2200));
      const metric = rooms.at(-1)?.actors[0].latest.metrics;
      const sample = { spirits: actors.length, rooms: rooms.length,
        schedulerHz: metric?.schedulerHz ?? 0, physicsHz: metric?.physicsStepHz ?? 0,
        tickMs: metric?.tickMs ?? { mean: 0, p95: 0, max: 0 } };
      samples.push(sample);
      console.log(JSON.stringify({ stage: sample }));
      if (sample.schedulerHz > 0 && sample.schedulerHz < maxRoomsAtTargetHz) break;
    }
  }

  await new Promise(resolve => setTimeout(resolve, 1500));
  const roomMetrics = rooms.map(({ roomId, actors: members }) => {
    const snapshot = members[0].latest;
    return { roomId, count: members.length,
      schedulerHz: snapshot.metrics?.schedulerHz ?? 0,
      physicsHz: snapshot.metrics?.physicsStepHz ?? 0,
      tickMs: snapshot.metrics?.tickMs ?? { mean: 0, p95: 0, max: 0 },
      bufferedAmount: members.reduce((max, actor) => Math.max(max, actor.socket.bufferedAmount), 0) };
  });
  const allTicks = roomMetrics.map(room => room.tickMs);
  console.log(JSON.stringify({ base, roomPrefix, maxRooms, capacityPerRoom,
    concurrentSpirits: actors.length, testRooms: rooms.length,
    singleRoomLimitRejectedExtra: rooms[0]?.actors.length === capacityPerRoom,
    roomLimitError, schedulerHz: roomMetrics.at(-1)?.schedulerHz ?? 0,
    minRoomPhysicsHz: Math.min(...roomMetrics.map(room => room.physicsHz)),
    maxTickMs: Math.max(...allTicks.map(tick => tick.max)),
    p95TickMs: Math.max(...allTicks.map(tick => tick.p95)),
    maxBufferedAmount: Math.max(...roomMetrics.map(room => room.bufferedAmount)),
    samples,
    rooms: roomMetrics }, null, 2));
}

try { await main(); }
finally { for (const actor of actors) actor.socket.close(1000, 'smoke complete'); }
