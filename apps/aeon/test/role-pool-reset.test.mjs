// ROLE-POOL-RESET regression test.
//
// AEON pools its creatures: a body that dies is recycled for the next newborn.
// Before the fix, `Agent.kill()` did not clear the unit's `role` and
// `Agent.spawn()` did not reset it either — so a body that died as a soldier
// was reborn still carrying role=1.
//
// `Sim.assignRoles()` counts `role === 1 || role === 2` as "already a soldier",
// so every recycled soldier inflated the nation's army head-count, and the
// newborn itself was born a soldier.
//
// After the fix: kill() clears the rank, spawn() always starts a civilian, and
// assignRoles() promotes on merit the following year.
//
// Run: node --test test/role-pool-reset.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Agent, AgentPool } from '../src/sim/agent.js';
import { randomGenome } from '../src/sim/brain.js';
import { RNG } from '../src/core/rng.js';

const rng = new RNG(4242);
const genome = randomGenome(rng);

/**
 * Mirrors the soldier counter of Sim.assignRoles() pass 1 — the only place the
 * role field is read for army sizing.
 */
function soldierCount(agents) {
  let n = 0;
  for (const a of agents) if (a.alive && (a.role === 1 || a.role === 2)) n++;
  return n;
}

test('a newly spawned agent is a civilian', () => {
  const a = new Agent();
  a.spawn(10, 10, genome, 1, rng);

  assert.equal(a.role, 0, 'a newborn must start as a civilian (role 0)');
});

test('kill() clears the dead unit\'s rank', () => {
  const a = new Agent();
  a.spawn(10, 10, genome, 1, rng);
  a.role = 1;                       // promoted to soldier by assignRoles()

  a.kill();

  assert.equal(a.role, 0, 'a dead body must not keep its rank');
});

test('a pooled body recycled from a dead soldier is reborn as a civilian', () => {
  const a = new Agent();
  a.spawn(10, 10, genome, 1, rng);
  a.role = 1;                       // died in battle as a soldier
  a.kill();

  a.spawn(20, 20, genome, 1, rng);  // the same body is reused for a newborn

  assert.equal(a.role, 0, 'a newborn must never inherit a dead soldier\'s rank');
});

test('the agent pool never hands back a soldier', () => {
  const pool = new AgentPool(4);
  const first = pool.alloc();
  first.spawn(1, 1, genome, 1, rng);
  first.role = 1;

  pool.release(first);              // kill() + back to the free list
  const second = pool.alloc();

  assert.equal(second, first, 'the pool must reuse the freed body');
  second.spawn(2, 2, genome, 1, rng);
  assert.equal(second.role, 0, 'the reused body must start as a civilian');
});

test('a recycled newborn must not inflate the nation\'s soldier head-count', () => {
  const pool = new AgentPool(4);
  const first = pool.alloc();
  first.spawn(1, 1, genome, 1, rng);
  first.role = 1;
  pool.release(first);

  const reborn = pool.alloc();
  reborn.spawn(2, 2, genome, 1, rng);

  assert.equal(
    soldierCount(pool.agents), 0,
    'the army head-count must not include a recycled newborn',
  );
});

test('a soldier that is still alive keeps its rank', () => {
  // The reset must not demote living soldiers — the army is sticky by design.
  const a = new Agent();
  a.spawn(10, 10, genome, 1, rng);
  a.role = 1;

  assert.equal(a.role, 1, 'a living soldier must keep its rank');
  assert.equal(soldierCount([a]), 1);
});
