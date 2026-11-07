// SETCITYFOCUS-WIRE regression test.
//
// The symmetric city-focus API (`Governance.setCityFocus`, PR #117) had no
// player-side entry point: the inspect panel still wrote `settlement.focus`
// directly from the click handler, so the player's UI and the AI's yearly turn
// used two different code paths and only the AI path was validated.
//
// After this PR the inspect panel routes its five focus buttons through
// `Game.setCityFocus()` — the same verb an AI city uses — and `Game` owns the
// toast, the ownership check and the re-render.
//
// Run: node --test test/setcityfocus-wire.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Game } from '../src/game/game.js';
import { Governance } from '../src/game/governance.js';
import { fakeTribe, fakeSim } from './helpers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const UI_SRC = join(HERE, '..', 'src', 'game', 'ui.js');

/**
 * `Game` needs a canvas / window / WebGL, so the verb is exercised against a
 * hand-built `this`: the real GovernanceAPI, a real player tribe and a toast
 * recorder. Everything the method touches is the production code.
 */
function fakeGame({ playerId = 1, otherId = 2 } = {}) {
  const player = fakeTribe(playerId, { isPlayer: true });
  const other = fakeTribe(otherId);
  const toasts = [];
  const gov = new Governance();
  const sim = fakeSim([player, other]);
  return {
    playerTribe: player,
    gov,
    sim,
    ui: { toast: (t) => toasts.push(t) },
    toasts,
  };
}

function cityOf(tribeId, id = 700) {
  return { id, tribeId, x: 10, y: 10, pop: 12, focus: 'growth', defense: 0, name: 'Testburg' };
}

test('Game exposes the symmetric setCityFocus verb', () => {
  assert.equal(
    typeof Game.prototype.setCityFocus, 'function',
    'Game.prototype.setCityFocus must exist so the UI can call it',
  );
});

test('the verb applies a valid focus to the player\'s own city', () => {
  const game = fakeGame();
  const city = cityOf(game.playerTribe.id);

  const applied = Game.prototype.setCityFocus.call(game, city, 'gold');

  assert.equal(applied, 'gold', 'the applied focus must be returned');
  assert.equal(city.focus, 'gold', 'the settlement focus must actually change');
  assert.equal(game.toasts.length, 1, 'the player must get a toast');
  assert.match(String(game.toasts[0].msg), /gold focus/);
});

test('the verb refuses another nation\'s city', () => {
  const game = fakeGame();
  const foreign = cityOf(2);
  foreign.focus = 'growth';

  const applied = Game.prototype.setCityFocus.call(game, foreign, 'gold');

  assert.equal(applied, false, 'a foreign city must be rejected');
  assert.equal(foreign.focus, 'growth', 'a foreign city must not change');
  assert.equal(game.toasts.length, 0, 'a rejected action must not toast');
});

test('the verb refuses an unknown focus', () => {
  const game = fakeGame();
  const city = cityOf(game.playerTribe.id);
  city.focus = 'growth';

  const applied = Game.prototype.setCityFocus.call(game, city, 'plunder');

  assert.equal(applied, false, 'an unknown focus must be rejected');
  assert.equal(city.focus, 'growth', 'a rejected focus must not change the city');
  assert.equal(game.toasts.length, 0);
});

test('the verb refuses a missing settlement', () => {
  const game = fakeGame();
  assert.equal(Game.prototype.setCityFocus.call(game, null, 'gold'), false);
  assert.equal(Game.prototype.setCityFocus.call(game, undefined, 'gold'), false);
});

test('the inspect panel routes its focus buttons through the verb', () => {
  // The UI is DOM-bound and cannot be instantiated headlessly, so the wiring is
  // asserted at the source level: the button handler must call
  // game.setCityFocus(...) and must NOT write settlement.focus directly.
  const src = readFileSync(UI_SRC, 'utf8');

  assert.match(
    src, /game\.setCityFocus\(s,\s*b\.dataset\.f\)/,
    'the .fbtn handler must call game.setCityFocus(s, b.dataset.f)',
  );
  assert.doesNotMatch(
    src, /s\.focus\s*=\s*b\.dataset\.f/,
    'the inspect panel must not write settlement.focus directly any more',
  );
});
