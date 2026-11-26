// Shared helpers for the AEON regression tests.
//
// These tests live in the repo (not in a scratch folder) so every reviewer can
// run them with the same command that CI runs:
//
//   cd apps/aeon && npm test
//
// Keep them dependency-free: AEON has no build step and no node_modules, so a
// test may only import from ../src/ and node: builtins.
import { randomGenome } from '../src/sim/brain.js';
import { RNG } from '../src/core/rng.js';

/**
 * A minimal stand-in for a Tribe. Only the fields the touched code paths read
 * are provided — enough for diplomacy / governance / settlement rules without
 * dragging in a whole simulated world.
 */
export function fakeTribe(id, over = {}) {
  return {
    id,
    name: `Tribe ${id}`,
    hue: (id * 67) % 360,
    members: 20,
    births: 0,
    deaths: 0,
    kills: 0,
    capitalX: 20 + id * 30,
    capitalY: 20 + id * 20,
    territory: 0,
    culture: 0,
    isPlayer: false,
    autopilot: false,
    policy: { aggression: 0, expansion: 0, breed: 0, research: 0 },
    tech: { points: 0, known: new Set(), era: 0 },
    caps: {},
    stock: { stone: 100, wood: 100, ore: 0, metal: 0 },
    religion: null,
    founder: randomGenome(new RNG(1000 + id)),
    ...over,
  };
}

/**
 * A tiny sim-shaped object. Diplomacy and governance only touch a handful of
 * fields, so a stub keeps the tests fast and deterministic (no world seeding,
 * no tick loop) while still exercising the real production code paths.
 */
export function fakeSim(tribes = [], over = {}) {
  const map = new Map(tribes.map((t) => [t.id, t]));
  return {
    tick: 0,
    tribes: map,
    settlements: [],
    pool: { agents: [], count: 0 },
    world: {
      w: 200, h: 200,
      blessFood() {},
      idx: (x, y) => y * 200 + x,
      isWater: () => false,
      walkable: () => true,
    },
    settleSys: { countOf: () => 0, bonusFor: () => ({ count: 0 }) },
    tech: { eraName: () => 'Tribal' },
    civics: { governmentName: () => 'Chiefdom' },
    emit() {},
    year: () => 0,
    ...over,
  };
}

/** Count how many years a sim has advanced (AEON ticks 60 times per year). */
export const TICKS_PER_YEAR = 60;

/** Advance a stub sim by whole years so year-gated code actually runs. */
export function advanceYears(sim, years) {
  for (let y = 0; y < years; y++) {
    for (let t = 0; t < TICKS_PER_YEAR; t++) {
      sim.tick++;
      if (sim.diplomacy) sim.diplomacy.tick(sim);
    }
  }
}
