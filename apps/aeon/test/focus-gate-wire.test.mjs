// FOCUS-GATE-WIRE regression test.
//
// The yearly production focus paid out whenever the TRIBE was alive
// (`tr.members > 0`). A tribe can be perfectly healthy elsewhere while ONE of
// its towns has emptied out — and that empty town kept collecting gold,
// research and build payouts forever.
//
// This PR wires the empty-city gate (PR #122, `focusPayoutAllowed`) into the
// yearly payout loop: the switch is extracted into `Sim.applyCityFocus()` and
// it now checks the city's OWN resident count before paying out.
//
// Run: node --test test/focus-gate-wire.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sim } from '../src/sim/sim.js';
import { fakeTribe } from './helpers.mjs';

/**
 * A minimal `this` for Sim.applyCityFocus(): the method only needs the world
 * (growth blessing) and trainSoldier (military focus).
 */
function fakeSimHost() {
  return {
    world: { blessFood() {} },
    trainSoldier() {},
  };
}

function city(focus, pop) {
  return { id: 8001, tribeId: 1, x: 10, y: 10, pop, focus, defense: 0 };
}

test('Sim exposes applyCityFocus', () => {
  assert.equal(
    typeof Sim.prototype.applyCityFocus, 'function',
    'the yearly payout must live in Sim.applyCityFocus()',
  );
});

test('an empty city pays nothing even when the nation is alive', () => {
  const host = fakeSimHost();
  const tribe = fakeTribe(1);
  tribe.gold = 0;
  tribe.tech.points = 0;
  const s = city('gold', 0);

  Sim.prototype.applyCityFocus.call(host, s, tribe);

  assert.equal(tribe.gold, 0, 'a ghost city must not mint gold');
});

test('a populated city pays out normally', () => {
  const host = fakeSimHost();
  const tribe = fakeTribe(1);
  tribe.gold = 0;
  const s = city('gold', 12);

  Sim.prototype.applyCityFocus.call(host, s, tribe);

  assert.equal(tribe.gold, 3, 'a populated city must pay its yearly gold focus');
});

test('every focus switch is gated on the city\'s residents', () => {
  const host = fakeSimHost();
  const tribe = fakeTribe(1);

  // research
  const t1 = fakeTribe(1);
  t1.tech.points = 0;
  Sim.prototype.applyCityFocus.call(host, city('research', 0), t1);
  assert.equal(t1.tech.points, 0, 'an empty city must not earn research');
  Sim.prototype.applyCityFocus.call(host, city('research', 5), t1);
  assert.equal(t1.tech.points, 4, 'a populated city must earn research');

  // build
  const t2 = fakeTribe(1);
  t2.stock.stone = 10;
  const s2 = city('build', 0);
  Sim.prototype.applyCityFocus.call(host, s2, t2);
  assert.equal(t2.stock.stone, 10, 'an empty city must not consume stone');
  assert.equal(s2.defense, 0);
  Sim.prototype.applyCityFocus.call(host, s2, t2);
  assert.equal(t2.stock.stone, 10);

  const s3 = city('build', 5);
  Sim.prototype.applyCityFocus.call(host, s3, t2);
  assert.equal(t2.stock.stone, 8, 'a populated city must build');
  assert.equal(s3.defense, 3);
});

test('a dead nation still pays nothing', () => {
  const host = fakeSimHost();
  const tribe = fakeTribe(1);
  tribe.members = 0;
  tribe.gold = 0;

  Sim.prototype.applyCityFocus.call(host, city('gold', 50), tribe);

  assert.equal(tribe.gold, 0, 'a nation without members must pay nothing');
});

test('the yearly payout loop actually goes through applyCityFocus', () => {
  // Integration proof: a real Sim runs its yearly payout through the verb.
  const sim = new Sim({ w: 80, h: 60, seed: 11, cap: 200 });

  let calls = 0;
  const original = sim.applyCityFocus.bind(sim);
  sim.applyCityFocus = (s, tr) => { calls++; return original(s, tr); };

  for (let t = 0; t < 60; t++) sim.step();   // exactly one sim-year

  assert.ok(calls > 0, 'the yearly payout must be routed through applyCityFocus');
});

test('a full year of simulation does not crash on the new payout path', () => {
  const sim = new Sim({ w: 80, h: 60, seed: 12, cap: 200 });
  for (let t = 0; t < 180; t++) sim.step();  // three sim-years

  assert.ok(sim.population() >= 0, 'the sim must still run');
  assert.equal(typeof sim.applyCityFocus, 'function');
});
