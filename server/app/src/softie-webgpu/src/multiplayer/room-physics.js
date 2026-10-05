import { JellyPhysics } from '../physics.js';
import { normalizeSpiritSettings, spiritRadius, SPIRIT_WORLD_SCALE } from '../games/spirit-playground/settings.js';

export const ROOM_STEP = 1 / 120;
export const ROOM_HALF_SIZE = 6.3;
export const ROOM_CAPACITY = 10;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const vector = value => value && ['x', 'y', 'z'].every(key => Number.isFinite(value[key]));
const radius = entity => spiritRadius(entity.settings);

/** Shared authoritative world: no renderer, browser API, or network transport. */
export class SpiritRoomPhysics {
  constructor() {
    this.entities = new Map();
    this.tick = 0;
    this._accumulator = 0;
  }

  add(id, settings = {}) {
    if (typeof id !== 'string' || !id || this.entities.has(id)) throw new TypeError('Invalid or duplicate spirit id.');
    if (this.entities.size >= ROOM_CAPACITY) throw new RangeError('The spirit room is full.');
    const index = this.entities.size;
    const entity = { id, settings: {}, physics: new JellyPhysics(), lastSeq: 0 };
    this.entities.set(id, entity);
    this.configure(id, settings);
    const edge = ROOM_HALF_SIZE - radius(entity);
    const angle = index * 2.399963229728653;
    entity.physics.position.x = Math.cos(angle) * edge * 0.78;
    entity.physics.position.z = Math.sin(angle) * edge * 0.78;
    return entity;
  }

  remove(id) { return this.entities.delete(id); }

  configure(id, settings) {
    const entity = this.entities.get(id);
    if (!entity) return null;
    entity.settings = { ...settings, ...normalizeSpiritSettings(settings) };
    entity.physics.setConfig(entity.settings);
    entity.physics.endGrab(); entity.physics.clearDrive();
    const edge = ROOM_HALF_SIZE - radius(entity);
    entity.physics.setBounds({ x: [-edge, edge], y: [0, 3.4], z: [-edge, edge] });
    this._constrain(entity);
    return entity;
  }

  /** Ownership is assigned by the WS server; clients only supply validated intent. */
  command(id, command) {
    const entity = this.entities.get(id);
    if (!entity || !Number.isSafeInteger(command?.seq) || command.seq <= entity.lastSeq) return false;
    const physics = entity.physics;
    const targetValid = target => vector(target) && Math.abs(target.x) <= ROOM_HALF_SIZE + 2
      && target.y >= -1 && target.y <= 7 && Math.abs(target.z) <= ROOM_HALF_SIZE + 2;
    switch (command.type) {
      case 'move': {
        const direction = command.direction;
        if (!Number.isFinite(direction?.x) || !Number.isFinite(direction?.z)
          || Math.abs(direction.x) > 1 || Math.abs(direction.z) > 1) return false;
        const length = Math.hypot(direction.x, direction.z);
        if (length > 1.001) return false;
        physics.setDriveAcceleration({ x: direction.x * entity.settings.acceleration,
          z: direction.z * entity.settings.acceleration });
        break;
      }
      case 'grab':
        if (command.phase === 'start') {
          if (!vector(command.anchor) || Math.hypot(command.anchor.x, command.anchor.y, command.anchor.z) > 3.8 || Math.abs(command.anchor.x) > 2.5
            || command.anchor.y < -0.25 || command.anchor.y > 3.5 || Math.abs(command.anchor.z) > 2
            || !targetValid(command.target)) return false;
          const expected = {
            x: physics.position.x + command.anchor.x * entity.settings.size * SPIRIT_WORLD_SCALE,
            y: physics.position.y + command.anchor.y * entity.settings.size * SPIRIT_WORLD_SCALE,
            z: physics.position.z + command.anchor.z * entity.settings.size * SPIRIT_WORLD_SCALE,
          };
          if (Math.hypot(command.target.x - expected.x, command.target.y - expected.y,
            command.target.z - expected.z) > 1.5) return false;
          physics.clearDrive(); physics.beginGrab(command.anchor, command.target);
        } else if (command.phase === 'move') {
          if (!targetValid(command.target) || !physics.diagnostics.dragging) return false;
          physics.moveGrab(command.target);
        } else if (command.phase === 'end') physics.endGrab();
        else return false;
        break;
      case 'pinch':
        if (command.phase === 'start') {
          if (!physics.diagnostics.dragging || !vector(command.axis)) return false;
          const length = Math.hypot(command.axis.x, command.axis.y, command.axis.z);
          if (length < 0.05 || length > 3.8 || Math.abs(command.axis.x) > 3
            || Math.abs(command.axis.y) > 3 || Math.abs(command.axis.z) > 3) return false;
          physics.beginPinch(command.axis);
          if (!physics.diagnostics.pinching) return false;
        } else if (command.phase === 'move') {
          if (!physics.diagnostics.pinching || !Number.isFinite(command.ratio)
            || command.ratio < 0.1 || command.ratio > 10) return false;
          physics.movePinch(command.ratio);
        } else if (command.phase === 'end') physics.endPinch();
        else return false;
        break;
      case 'poke': physics.poke(); break;
      case 'reset': physics.reset(); break;
      case 'stop':
        physics.clearDrive(); physics.endGrab();
        physics.velocity.x = physics.velocity.z = 0;
        break;
      default: return false;
    }
    entity.lastSeq = command.seq;
    return true;
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this._accumulator += Math.min(dt, 0.1);
    while (this._accumulator + 1e-10 >= ROOM_STEP) {
      for (const entity of this.entities.values()) entity.physics.stepFixed();
      this._collide();
      this.tick++;
      this._accumulator = Math.max(0, this._accumulator - ROOM_STEP);
    }
  }

  _constrain(entity) {
    const edge = ROOM_HALF_SIZE - radius(entity);
    const { position, velocity } = entity.physics;
    for (const axis of ['x', 'z']) {
      const limited = clamp(position[axis], -edge, edge);
      if (limited !== position[axis]) {
        position[axis] = limited;
        if (velocity[axis] * limited > 0) velocity[axis] *= -0.16;
      }
    }
  }

  _collide() {
    const bodies = [...this.entities.values()];
    // ponytail: at most 10 bodies (45 pairs); add a spatial grid only for larger rooms.
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        const pa = a.physics.position, pb = b.physics.position;
        if (Math.abs(pa.y - pb.y) > 2.4 * SPIRIT_WORLD_SCALE * Math.min(a.settings.size, b.settings.size)) continue;
        const dx = pb.x - pa.x, dz = pb.z - pa.z, distance = Math.hypot(dx, dz);
        const overlap = radius(a) + radius(b) - distance;
        if (overlap <= 0) continue;
        const nx = distance > 1e-8 ? dx / distance : Math.cos((i + j) * 2.399963);
        const nz = distance > 1e-8 ? dz / distance : Math.sin((i + j) * 2.399963);
        const separation = overlap * 0.5;
        pa.x -= nx * separation; pa.z -= nz * separation;
        pb.x += nx * separation; pb.z += nz * separation;
        const relative = (b.physics.velocity.x - a.physics.velocity.x) * nx
          + (b.physics.velocity.z - a.physics.velocity.z) * nz;
        const push = Math.min(2.5, Math.max(0, -relative * 0.55) + Math.min(overlap * 4, 0.4));
        a.physics.applyImpulse({ x: -nx * push, y: 0, z: -nz * push });
        b.physics.applyImpulse({ x: nx * push, y: 0, z: nz * push });
        this._constrain(a); this._constrain(b);
      }
    }
  }

  snapshot() {
    return { tick: this.tick, entities: [...this.entities.values()].map(entity => ({
      id: entity.id, settings: { ...entity.settings }, state: entity.physics.captureState(),
      ack: entity.lastSeq, lastSeq: entity.lastSeq,
    })) };
  }
}
