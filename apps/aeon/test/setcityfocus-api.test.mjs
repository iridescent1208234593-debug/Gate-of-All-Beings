// SETCITYFOCUS-API regression test.
//
// The city production focus had no symmetric API: the player's inspect panel
// wrote `settlement.focus` directly and the AI had no way to steer a city at
// all. This PR adds `Governance.setCityFocus(sim, settlement, focus)` as the
// single lever both sides use, and teaches the AI yearly turn to pick one.
//
// Run: node --test test/setcityfocus-api.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Governance } from '../src/game/governance.js';
import { fakeTribe, fakeSim } from './helpers.mjs';

const VALID_FOCUSES = ['growth', 'build', 'military', 'gold', 'research'];

function govWithCity(tribeId = 1, cityId = 900) {
  const gov = new Governance();
  const tribe = fakeTribe(tribeId);
  const sim = fakeSim([tribe]);
  const city = { id: cityId, tribeId, x: 10, y: 10, pop: 12, focus: 'growth', defense: 0 };
  sim.settlements.push(city);
  return { gov, sim, tribe, city };
}

test('setCityFocus applies every valid focus', () => {
  const { gov, sim, city } = govWithCity();
  for (const focus of VALID_FOCUSES) {
    const applied = gov.setCityFocus(sim, city, focus);
    assert.equal(applied, focus, `focus "${focus}" must be accepted`);
    assert.equal(city.focus, focus, 'the settlement focus must actually change');
  }
});

test('setCityFocus rejects an unknown focus without touching the city', () => {
  const { gov, sim, city } = govWithCity();
  city.focus = 'gold';

  const applied = gov.setCityFocus(sim, city, 'plunder');

  assert.equal(applied, false, 'an unknown focus must be rejected');
  assert.equal(city.focus, 'gold', 'a rejected focus must not change the city');
});

test('setCityFocus rejects a missing settlement', () => {
  const { gov, sim } = govWithCity();

  assert.equal(gov.setCityFocus(sim, null, 'gold'), false);
  assert.equal(gov.setCityFocus(sim, undefined, 'gold'), false);
});

test('the AI yearly turn steers exactly one of its own cities', () => {
  const gov = new Governance();
  const tribe = fakeTribe(1);
  const other = fakeTribe(2);
  const sim = fakeSim([tribe, other]);
  sim.rng = { seed: 7, gauss: () => 0, int: () => 0, pick: (a) => a[0] };
  sim.diplomacy = null;

  // Two cities of this tribe plus one belonging to a rival nation.
  const mine = [
    { id: 901, tribeId: 1, x: 10, y: 10, pop: 12, focus: 'growth', defense: 0 },
    { id: 902, tribeId: 1, x: 20, y: 20, pop: 12, focus: 'growth', defense: 0 },
  ];
  const theirs = { id: 903, tribeId: 2, x: 30, y: 30, pop: 12, focus: 'growth', defense: 0 };
  sim.settlements.push(...mine, theirs);

  gov.aiTurn(sim, tribe);

  const steeredMine = mine.filter((c) => c.focus !== 'growth');
  assert.equal(steeredMine.length, 1, 'the AI must steer exactly ONE of its cities');
  assert.ok(
    ['gold', 'build'].includes(steeredMine[0].focus),
    `the AI should steer a cheap, O(1) focus, got "${steeredMine[0].focus}"`,
  );
  assert.equal(theirs.focus, 'growth', 'the AI must not touch another nation\'s city');
});

test('the AI yearly turn leaves the player nation alone', () => {
  const gov = new Governance();
  const player = fakeTribe(1, { isPlayer: true });
  const sim = fakeSim([player]);
  sim.rng = { seed: 7, gauss: () => 0, int: () => 0, pick: (a) => a[0] };
  sim.diplomacy = null;

  const city = { id: 901, tribeId: 1, x: 10, y: 10, pop: 12, focus: 'growth', defense: 0 };
  sim.settlements.push(city);

  gov.aiTurn(sim, player);

  assert.equal(city.focus, 'growth', 'aiTurn must not run for the player');
});
