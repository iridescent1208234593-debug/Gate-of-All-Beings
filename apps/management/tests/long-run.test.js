import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createInitialState, MINUTES_PER_DAY, TICK_GAME_SECONDS } from '../src/core/gameState.js';
import { createRng } from '../src/core/rng.js';
import { reducer } from '../src/core/reducer.js';
import { getBuilding } from '../src/content/buildings.js';
import { getEra, eraIndex } from '../src/content/eras.js';
import { getEvent } from '../src/content/events.js';
import { NEEDS } from '../src/content/needs.js';
import { getResearch } from '../src/content/research.js';
import { phaseDuration } from '../src/systems/expedition.js';
import { storageCapacity } from '../src/systems/storageCapacity.js';

const TICKS = 5001;
const action = (type, payload = {}) => ({type, payload});

function check(state, context) {
  const bounded = (n, min, max, field) => assert.ok(
    Number.isFinite(n) && n >= min && n <= max,
    `${context}: ${field}=${n}, expected ${min}–${max}`);
  const tick = state.tick;
  assert.deepEqual(state.time, {
    day: Math.floor(tick * TICK_GAME_SECONDS / MINUTES_PER_DAY),
    minute: tick * TICK_GAME_SECONDS % MINUTES_PER_DAY,
  }, context);
  const caps = storageCapacity(state);
  for (const resource of ['spirit', 'food', 'faqi', 'wood', 'herb', 'stone', 'ore']) {
    bounded(state.resources[resource], 0, caps[resource] ?? Infinity, resource);
  }
  const {width, height, tiles} = state.space;
  assert.equal(tiles.length, width * height, context);
  const occupied = new Map();
  for (const b of state.buildings) {
    assert.ok(getBuilding(b.buildingId), context);
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      assert.ok(x >= 0 && x < width && y >= 0 && y < height, context);
      const index = y * width + x;
      assert.ok(!occupied.has(index), `${context}: buildings overlap at ${x},${y}`);
      occupied.set(index, b.id);
    }
  }
  for (let i = 0; i < tiles.length; i++) {
    assert.equal(tiles[i].buildingId ?? null, occupied.get(i) ?? null, `${context}: tile ${i}`);
  }
  const living = new Set();
  for (const c of state.colonists) {
    assert.ok(!living.has(c.id), `${context}: repeated colonist ${c.id}`);
    living.add(c.id);
    bounded(c.hp, 0, c.maxHp, `${c.id}.hp`);
    for (const {id} of NEEDS) bounded(c.needs[id], 0, 100, `${c.id}.needs.${id}`);
  }
  assert.ok(getEra(state.era), context);
  assert.equal(new Set(state.tech.unlocked).size, state.tech.unlocked.length, context);
  for (const id of state.tech.unlocked) assert.ok(getResearch(id), context);
  if (state.tech.researching) {
    const research = getResearch(state.tech.researching);
    assert.ok(research, context);
    for (const id of research.requires) assert.ok(state.tech.unlocked.includes(id), context);
    bounded(state.tech.progress, 0, research.durationTicks - 1, 'tech.progress');
  } else assert.equal(state.tech.progress, 0, context);
  for (const ev of state.events) {
    assert.ok(getEvent(ev.id), context);
    bounded(ev.duration, 1, Infinity, `event.${ev.id}.duration`);
  }
  assert.ok(state.expedition.parties.length <= 1, context);
  for (const party of state.expedition.parties) {
    assert.ok(['travel', 'event', 'return'].includes(party.phase), context);
    bounded(party.phaseTicks, 0, phaseDuration(party) - 1, 'expedition.phaseTicks');
    assert.equal(new Set(party.colonistIds).size, party.colonistIds.length, context);
    assert.deepEqual(party.colonists.map(c => c.id), party.colonistIds, context);
    for (const id of party.colonistIds) assert.ok(!living.has(id), `${context}: away colonist ${id} is home`);
  }
}

function buildFixture(state, type, x, y) {
  const def = getBuilding(type);
  const id = 'fixture-' + type;
  const {w, h} = def.size;
  const b = {id, buildingId: type, x, y, w, h, hp: 100, workers: [], builtAt: 0,
    construction: def.buildTime ?? 0, buildTime: def.buildTime ?? 0};
  state.buildings.push(b);
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    const t = state.space.tiles[(y+dy)*state.space.width + x+dx];
    assert.equal(t.buildingId, null);
    t.buildingId = id;
    t.resource = null;
  }
}

function run(seed) {
  // The browser simulation still uses Math.random for traits, resources, events,
  // combat, movement and expeditions. Only this test seeds that ambient source.
  const ambientRandom = Math.random;
  Math.random = createRng(seed).next;
  try {
    let state = createInitialState();
    buildFixture(state, 'researchTable', 1, 1);
    buildFixture(state, 'chuansongshuniu', 6, 1);
    const away = state.colonists.slice(0, 2).map(c => c.id);
    const scripted = new Map([
      [0, [action('ERA_ADVANCE'), action('RESEARCH_START', {researchId: 'lingchu'}),
        action('EXPEDITION_START', {colonistIds: away})]],
      [180, [action('TRIGGER_EVENT', {eventId: 'lingchi-tide'})]],
      [400, [action('CANCEL_RESEARCH'), action('ADD_COLONIST', {element: 'mu', name: 'QA'})]],
      [800, [action('ADD_RESOURCE', {spirit: 150, food: 75}), action('SPACE_EXPAND', {dir: 'east'})]],
      [2000, [action('SET_SETTINGS', {eventFrequency: 'high'})]],
      [4000, [action('SET_SETTINGS', {eventFrequency: 'low'})]],
    ]);
    const seen = new Set();
    const digest = createHash('sha256');
    for (let t = 0; t < TICKS; t++) {
      const actions = scripted.get(t) ?? [];
      const context = `seed=${seed} tick=${t+1} actions=${JSON.stringify(actions)}`;
      const before = state;
      try {
        for (const a of actions) state = reducer(state, a);
        if (t === 0) assert.equal(state.era, before.era, `${context}: blocked advancement`);
        state = reducer(state, action('TICK'));
      } catch (cause) {
        throw new Error(context, {cause});
      }
      assert.equal(state.tick, t+1, context);
      assert.ok(eraIndex(state.era) - eraIndex(before.era) >= 0 &&
        eraIndex(state.era) - eraIndex(before.era) <= 1, context);
      check(state, context);
      for (const p of state.expedition.parties) seen.add('party:' + p.phase);
      if (state.tech.researching) seen.add('researching');
      if (state.events.length || state.stats.eventCount > 0) seen.add('event');
      if (t === 149) {
        assert.equal(state.expedition.parties.length, 0, context);
        for (const id of away) assert.ok(state.colonists.some(c => c.id === id), context);
      }
      digest.update(JSON.stringify(state));
    }
    assert.deepEqual([...seen].sort(), ['event', 'party:event', 'party:return', 'party:travel', 'researching']);
    return digest.digest('hex');
  } finally {
    Math.random = ambientRandom;
  }
}

test('5001 management reducer ticks replay the exact trajectory using a fixed seed and actions', () => {
  const seed = 38491;
  assert.equal(run(seed), run(seed), `trajectory diverged for seed=${seed}`);
});

test('era advance requires the next era research and existing building and event milestones', () => {
  const state = createInitialState();
  const alliance = getEra('alliance');
  // A fixture for the reducer gate, not a claim that 5001 ticks reach the next era.
  state.buildings = Array.from({length: alliance.minBuildings}, (_, i) => ({id: `fixture-${i}`}));
  state.stats.eventCount = alliance.minEvents;
  assert.equal(reducer(state, action('ERA_ADVANCE')).era, 'tribal');
  state.tech.unlocked.push(alliance.keyResearch);
  const advanced = reducer(state, action('ERA_ADVANCE'));
  assert.equal(advanced.era, 'alliance');
  assert.equal(reducer(advanced, action('ERA_ADVANCE')).era, 'alliance');
});
