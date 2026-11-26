// EMPTY-CITY-GATE regression test.
//
// A settlement's yearly production focus only paid out while the tribe was
// alive (`tr.members > 0`). But a tribe can be perfectly healthy elsewhere
// while ONE of its towns has emptied out (settlers marched away, famine,
// siege) — and that empty town kept collecting gold / research / build
// payouts forever.
//
// This PR adds the gate itself: `focusPayoutAllowed(settlement)` in the
// coremech-owned world module. It answers a single question — does this city
// still have residents? — and lives next to the world data so the integrator
// can wire it into the yearly payout switch without reaching into settlement
// internals.
//
// Run: node --test test/empty-city-gate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('world.js exports the focus payout gate', async () => {
  // Dynamic import on purpose: on master the export does not exist at all, and
  // a static import would abort the whole file with a SyntaxError instead of
  // reporting a readable assertion failure.
  const world = await import('../src/sim/world.js');
  assert.equal(
    typeof world.focusPayoutAllowed, 'function',
    'world.js must export focusPayoutAllowed(settlement)',
  );
});

test('a city with residents is allowed to pay out', async () => {
  const { focusPayoutAllowed } = await import('../src/sim/world.js');
  assert.equal(focusPayoutAllowed({ pop: 1 }), true, 'one resident is enough');
  assert.equal(focusPayoutAllowed({ pop: 12 }), true);
  assert.equal(focusPayoutAllowed({ pop: 250 }), true);
});

test('an empty city is not allowed to pay out', async () => {
  const { focusPayoutAllowed } = await import('../src/sim/world.js');
  assert.equal(focusPayoutAllowed({ pop: 0 }), false, 'a ghost city pays nothing');
  assert.equal(focusPayoutAllowed({ pop: -3 }), false, 'a negative population is not a city');
});

test('a missing settlement is not allowed to pay out', async () => {
  const { focusPayoutAllowed } = await import('../src/sim/world.js');
  assert.equal(focusPayoutAllowed(null), false);
  assert.equal(focusPayoutAllowed(undefined), false);
  assert.equal(focusPayoutAllowed({}), false, 'a settlement without pop is not populated');
});
