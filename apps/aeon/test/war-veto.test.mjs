// WAR-VETO regression test.
//
// Before the fix, the yearly diplomacy maintenance forced a peace on ANY war
// whose weariness reached EXHAUST_CAP — including wars the PLAYER started.
// The player could declare a war, watch it for a few years, and then see it
// silently end without the player asking for peace.
//
// After the fix, a war involving the player is never auto-ended by weariness:
// only the player (or a nation that has been wiped out) ends it. AI<->AI wars
// keep both auto-peace paths.
//
// Run: node --test test/war-veto.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Diplomacy } from '../src/sim/diplomacy.js';
import { fakeTribe, fakeSim, advanceYears, TICKS_PER_YEAR } from './helpers.mjs';

// EXHAUST_CAP in src/sim/diplomacy.js is 1.0 and EXHAUST_RATE is 0.16, so a
// war reaches the cap after 7 yearly ticks (0.16 * 7 > 1.0). We run 12 years
// to be safely past the cap.
const YEARS_PAST_EXHAUST = 12;

function warScenario({ playerInvolved }) {
  const player = fakeTribe(1, { isPlayer: true });
  const ai = fakeTribe(2);
  const sim = fakeSim([player, ai]);
  sim.diplomacy = new Diplomacy();
  sim.diplomacy.declareWar(sim, player, ai);
  return { sim, player, ai };
}

test('a war involving the player is not ended by war weariness', () => {
  const { sim, player, ai } = warScenario({ playerInvolved: true });
  assert.equal(sim.diplomacy.atWar(sim, player, ai), true, 'war should be declared');

  advanceYears(sim, YEARS_PAST_EXHAUST);

  assert.equal(
    sim.diplomacy.atWar(sim, player, ai), true,
    'player war must survive the weariness cap — only the player may end it',
  );
  assert.equal(sim.diplomacy.stanceBetween(sim, player, ai), 'war');
});

test('an AI<->AI war is still ended by the weariness cap', () => {
  // The player gate must not disable auto-peace between two AI nations.
  const a = fakeTribe(1);
  const b = fakeTribe(2);
  const sim = fakeSim([a, b]);
  sim.diplomacy = new Diplomacy();
  sim.diplomacy.declareWar(sim, a, b);

  advanceYears(sim, YEARS_PAST_EXHAUST);

  assert.equal(
    sim.diplomacy.atWar(sim, a, b), false,
    'AI<->AI wars must still auto-peace once exhausted',
  );
  // After the war ends the yearly stance drift may pull the pair to 'rival'
  // again (pressure stays high), so only the end of the WAR is asserted here.
  assert.notEqual(sim.diplomacy.stanceBetween(sim, a, b), 'war');
});

test('the player can still end a player war by making peace explicitly', () => {
  const { sim, player, ai } = warScenario({ playerInvolved: true });
  advanceYears(sim, 2);

  const ended = sim.diplomacy.makePeace(sim, player, ai);

  assert.equal(ended, true, 'makePeace must still work for the player');
  assert.equal(sim.diplomacy.atWar(sim, player, ai), false);
  assert.equal(sim.diplomacy.stanceBetween(sim, player, ai), 'neutral');
});

test('a wiped-out nation still ends its war with the player', () => {
  // If a belligerent dies out the war has to end — that path is NOT gated on
  // isPlayer and must keep working.
  const { sim, player, ai } = warScenario({ playerInvolved: true });
  ai.members = 0;

  advanceYears(sim, 1);

  assert.equal(
    sim.diplomacy.atWar(sim, player, ai), false,
    'a crushed nation must not keep the player at war forever',
  );
});

test('the yearly tick really is year-gated (60 ticks per year)', () => {
  // Guards the test harness itself: diplomacy.tick only runs on a year
  // boundary, so a test that advances fewer ticks would silently pass.
  const { sim, player, ai } = warScenario({ playerInvolved: true });
  sim.diplomacy.declareWar(sim, player, ai);

  let ticks = 0;
  const realTick = sim.diplomacy.tick.bind(sim.diplomacy);
  sim.diplomacy.tick = (s) => { ticks++; return realTick(s); };

  advanceYears(sim, 3);

  assert.equal(ticks, 3 * TICKS_PER_YEAR);
  assert.equal(sim.diplomacy.atWar(sim, player, ai), true);
});
