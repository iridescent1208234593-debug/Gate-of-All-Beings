// GHOST-CITY regression test.
//
// A founded city is "permanent": the starvation rule in SettlementSystem only
// applies to non-permanent settlements, so a city whose population had dropped
// to zero stayed on the map forever. It still occupied tiles, still received a
// production focus payout and the player had no way to clear it.
//
// After the fix a permanent city tracks CONSECUTIVE empty years in `s.empty`
// and is abandoned once that counter passes MAX_STARVE (3). The counter resets
// as soon as a resident comes back, so a temporary evacuation is survivable.
//
// Run: node --test test/ghost-city.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Settlement, SettlementSystem } from '../src/sim/settlement.js';
import { fakeTribe } from './helpers.mjs';

const TICKS_PER_YEAR = 60;
const MAX_STARVE = 3;      // src/sim/settlement.js
const ABANDON_MIN = 5;     // src/sim/settlement.js

function makeWorld(w = 64, h = 64) {
  return {
    w, h,
    fert: new Float32Array(w * h).fill(1),
    food: new Float32Array(w * h).fill(1),
    dev: new Uint8Array(w * h),
    elev: new Float32Array(w * h),
    temp: new Float32Array(w * h),
    dirty: false,
    idx: (x, y) => y * w + x,
    inBounds: (x, y) => x >= 0 && y >= 0 && x < w && y < h,
    isWater: () => false,
    walkable: () => true,
    blessFood() {},
  };
}

/** A sim stub with just enough surface for SettlementSystem.update(). */
function makeSim(tribe) {
  return {
    tick: 0,
    tribes: new Map([[tribe.id, tribe]]),
    settlements: [],
    pool: { agents: [] },
    world: makeWorld(),
    emit() {},
    year: () => 0,
    resources: null,
  };
}

function makeCity(tribe, { permanent = true, id = 1000 } = {}) {
  const s = new Settlement(id, tribe.id, 10.5, 10.5);
  s.permanent = permanent;
  s.pop = 0;
  return s;
}

/** Advance the settlement system by one sim-year (it self-gates on tick % 60). */
function runYear(sim, sys) {
  sim.tick += TICKS_PER_YEAR;
  sys.update(sim, 0);
}

/** Put one living resident inside the city. */
function addResident(sim, tribe, x = 10.5, y = 10.5) {
  sim.pool.agents.push({ alive: true, tribeId: tribe.id, x, y });
}

test('a permanent city with no residents is abandoned after MAX_STARVE empty years', () => {
  const tribe = fakeTribe(1);
  const sim = makeSim(tribe);
  const sys = new SettlementSystem();
  sim.settlements.push(makeCity(tribe));

  for (let y = 0; y < MAX_STARVE; y++) {
    runYear(sim, sys);
    assert.equal(sim.settlements.length, 1, `the city must survive empty year ${y + 1}`);
  }

  runYear(sim, sys);
  assert.equal(
    sim.settlements.length, 0,
    'a city without residents must be abandoned instead of lingering as a ghost',
  );
});

test('the settlement tracks an empty-year counter', () => {
  const tribe = fakeTribe(1);
  const sim = makeSim(tribe);
  const sys = new SettlementSystem();
  const city = makeCity(tribe);
  sim.settlements.push(city);

  assert.equal(typeof city.empty, 'number', 'a settlement must track its empty-year counter');
  assert.equal(city.empty, 0, 'the counter starts at zero');

  runYear(sim, sys);
  assert.equal(city.empty, 1);
});

test('the empty-year counter only counts CONSECUTIVE empty years', () => {
  const tribe = fakeTribe(1);
  const sim = makeSim(tribe);
  const sys = new SettlementSystem();
  const city = makeCity(tribe);
  sim.settlements.push(city);

  runYear(sim, sys);
  runYear(sim, sys);
  assert.equal(city.empty, 2);

  addResident(sim, tribe);
  runYear(sim, sys);
  assert.equal(city.pop, 1, 'the returning resident must repopulate the city');
  assert.equal(city.empty, 0, 'the counter must reset once residents are back');

  // the city may now sit empty again, but the counter starts from scratch
  sim.pool.agents.length = 0;
  runYear(sim, sys);
  assert.equal(city.empty, 1);
});

test('a city with residents is never treated as a ghost', () => {
  const tribe = fakeTribe(1);
  const sim = makeSim(tribe);
  const sys = new SettlementSystem();
  sim.settlements.push(makeCity(tribe));
  addResident(sim, tribe);

  for (let y = 0; y < MAX_STARVE * 3; y++) runYear(sim, sys);

  assert.equal(sim.settlements.length, 1, 'a populated city must survive');
});

test('a non-permanent settlement still starves out exactly as before', () => {
  const tribe = fakeTribe(1);
  const sim = makeSim(tribe);
  const sys = new SettlementSystem();
  sim.settlements.push(makeCity(tribe, { permanent: false, id: 1001 }));

  for (let y = 0; y < MAX_STARVE; y++) {
    runYear(sim, sys);
    assert.equal(sim.settlements.length, 1, `the camp must survive starvation year ${y + 1}`);
  }

  runYear(sim, sys);
  assert.equal(sim.settlements.length, 0, 'a starving camp must still be abandoned');
});

test('a city whose nation went extinct is still cleared', () => {
  const tribe = fakeTribe(1);
  const sim = makeSim(tribe);
  const sys = new SettlementSystem();
  sim.settlements.push(makeCity(tribe));
  addResident(sim, tribe);

  tribe.members = 0;
  runYear(sim, sys);

  assert.equal(sim.settlements.length, 0, 'an extinct nation must lose its cities');
});

test('a city below ABANDON_MIN but still inhabited keeps existing', () => {
  // 1..4 residents: the city starves (s.starve climbs) but it is NOT empty, so
  // the ghost rule must not fire and the city stays on the map.
  const tribe = fakeTribe(1);
  const sim = makeSim(tribe);
  const sys = new SettlementSystem();
  sim.settlements.push(makeCity(tribe));
  addResident(sim, tribe);

  for (let y = 0; y < MAX_STARVE * 2; y++) runYear(sim, sys);

  assert.equal(sim.settlements.length, 1, 'an inhabited but hungry city must not be culled');
  assert.ok(ABANDON_MIN > 1, 'ABANDON_MIN must stay above 1 for this scenario to be meaningful');
});
