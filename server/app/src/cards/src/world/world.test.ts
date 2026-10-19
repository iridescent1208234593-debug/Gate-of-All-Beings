import test from 'node:test';
import assert from 'node:assert/strict';
import { reduceRun } from '../game/core/engine';
import { HEROES } from '../game/core/content';
import type { AdventureRun } from '../game/core/types';
import { companionIds, defaultLoadout, expeditionResult, REBIRTH_REWARD, rebirthResult, rebirthResults, startExpedition, startRebirth, stayResult, type ExpeditionSession, type RebirthSession } from './activities';
import { canStartExpedition, commitResult, createWorld, emptySnapshot, markSeen, nightResult, RULES, sealResult, summarize, unseenEntries } from './rules';
import type { ActivitySession, Ledger, WorldSnapshot } from './types';

const ids = companionIds();
const names = (id: number) => `角色${id}`;
function ledger(over: Partial<Ledger['resources']> = {}): Ledger {
  return { resources: { spirit: 40, herb: 8, food: 4, soul: 0, shards: 0, ...over }, characters: {} };
}
/** 把提交结果回写到测试账本，模拟共享存档。 */
function apply(l: Ledger, out: ReturnType<typeof commitResult>): Ledger {
  const next = structuredClone(l);
  for (const [k, v] of Object.entries(out.resources)) next.resources[k as keyof Ledger['resources']] += v!;
  for (const [id, r] of Object.entries(out.roster)) next.characters[id] = { ...next.characters[id], ...r };
  return next;
}
function fresh(l = ledger()): WorldSnapshot { return emptySnapshot(createWorld(ids.map(id => ({ id })), l)); }
function finish(session: ExpeditionSession, phase: 'victory' | 'defeat'): ExpeditionSession {
  return { ...session, state: { ...session.state, phase } };
}
function night(snap: WorldSnapshot, l: Ledger) { const out = commitResult(snap, l, nightResult(snap.world, l, names)); return { snap: out.snapshot, l: apply(l, out), out }; }

test('an expedition result is committed once, takes the day, and lands in the journal with its changes', () => {
  let l = ledger(), snap = fresh(l);
  const session = startExpedition(snap.world, l, defaultLoadout(snap.world), 7);
  snap = { ...snap, activity: session };
  const result = expeditionResult(finish(session, 'victory'), snap.world, l);
  const first = commitResult(snap, l, result);
  l = apply(l, first);
  assert.equal(first.snapshot.world.daypart, 'evening');
  assert.equal(first.snapshot.activity, null, 'finishing clears the active session');
  assert.equal(l.resources.spirit, 40 + RULES.victorySpirit);
  assert.ok(first.entry.changes.some(c => c.kind === 'place' && c.place === 'deep-forest'), 'victory reveals the deep forest');
  assert.ok(first.snapshot.world.places['deep-forest'].discovered);
  const again = commitResult(first.snapshot, l, result);
  assert.equal(again.duplicate, true);
  assert.deepEqual(again.resources, {});
  assert.equal(again.snapshot.journal.entries.length, 1);
});

test('defeat drops a quarter of resources, wounds then fells a companion, and wounded carry their deck', () => {
  let l = ledger({ spirit: 40, herb: 8, food: 4 }), snap = fresh(l);
  const hero = ids[0];
  let session = startExpedition(snap.world, l, { ...defaultLoadout(snap.world, hero) }, 11);
  let out = commitResult({ ...snap, activity: session }, l, expeditionResult(finish(session, 'defeat'), snap.world, l));
  l = apply(l, out); snap = out.snapshot;
  assert.equal(l.resources.spirit, 30); assert.equal(l.resources.herb, 6); assert.equal(l.resources.food, 3);
  assert.equal(snap.world.companions[hero].condition, 'wounded');
  assert.equal(l.characters[hero].deaths, 1);
  assert.ok(snap.world.companions[hero].carry?.deck.length, 'the wounded companion keeps the deck');
  assert.ok(!out.entry.hasOwnProperty('carry'), 'decks are not copied into the journal');
  ({ snap, l } = night(snap, l));
  session = startExpedition(snap.world, l, defaultLoadout(snap.world, hero), 12);
  assert.equal(session.state.maxHp, Math.floor(HEROES[session.state.hero].hp / 2), 'wounded start has half health');
  assert.ok(session.state.deck.length > 0);
  out = commitResult({ ...snap, activity: session }, l, expeditionResult(finish(session, 'defeat'), snap.world, l));
  l = apply(l, out); snap = out.snapshot;
  assert.equal(snap.world.companions[hero].condition, 'fallen');
  assert.equal(l.characters[hero].deaths, 2);
  ({ snap, l } = night(snap, l));
  assert.equal(canStartExpedition(snap.world, hero).ok, false);
});

test('all companions fallen: expeditions close, and they recover together after the configured nights', () => {
  let l = ledger(), snap = fresh(l);
  for (const id of ids) snap.world.companions[id].condition = 'fallen';
  snap.world.daypart = 'evening';
  assert.equal(canStartExpedition({ ...snap.world, daypart: 'morning' }).ok, false);
  let nights = 0;
  while (Object.values(snap.world.companions).some(c => c.condition === 'fallen')) {
    if (snap.world.daypart === 'morning') snap = commitResult(snap, l, stayResult(snap.world)).snapshot;
    ({ snap, l } = night(snap, l)); nights++;
    assert.ok(nights <= RULES.reviveNights, 'recovery uses game days, not wall time');
  }
  assert.equal(nights, RULES.reviveNights);
  assert.ok(ids.every(id => l.characters[id]?.deaths === 0));
});

test('a wounded companion assigned to rest heals with herbs after enough nights', () => {
  let l = ledger({ herb: 5 }), snap = fresh(l);
  const id = ids[1];
  snap.world.companions[id] = { assignment: 'rest', condition: 'wounded', nights: 0, carry: { deck: [], relics: [] } };
  snap.world.daypart = 'evening';
  ({ snap, l } = night(snap, l));
  assert.equal(snap.world.companions[id].condition, 'wounded');
  snap = commitResult(snap, l, stayResult(snap.world)).snapshot;
  const before = l.resources.herb;
  ({ snap, l } = night(snap, l));
  assert.equal(snap.world.companions[id].condition, 'healthy');
  assert.equal(snap.world.companions[id].carry, undefined);
  assert.ok(l.resources.herb < before + RULES.gardenHerbs * 3, 'healing spends herbs');
});

test('clock rules: one daytime activity per day, nights only in the evening, sealing takes no time', () => {
  let l = ledger({ spirit: 30 }), snap = fresh(l);
  assert.throws(() => commitResult(snap, l, nightResult(snap.world, l, names)), /还没到晚上/);
  snap = commitResult(snap, l, stayResult(snap.world)).snapshot;
  assert.throws(() => commitResult(snap, l, { ...stayResult(snap.world), id: 'stay:again' }), /已经出过门/);
  l.characters[ids[0]] = { bond: RULES.sealBond };
  const out = commitResult(snap, l, sealResult(snap.world, l, ids[0], '小黑'));
  assert.equal(out.snapshot.world.daypart, 'evening');
  assert.equal(apply(l, out).characters[ids[0]].sealed, true);
});

test('the return summary groups unseen entries, and marking seen clears it', () => {
  let l = ledger(), snap = fresh(l);
  const session = startExpedition(snap.world, l, defaultLoadout(snap.world), 3);
  const played = reduceRun(session.state, { type: 'enter', node: session.state.nodes.find(n => n.floor === 0)!.id });
  const s2 = { ...session, state: { ...played, phase: 'map' as const } };
  const out = commitResult({ ...snap, activity: s2 }, l, expeditionResult(s2, snap.world, l, true));
  l = apply(l, out); snap = out.snapshot;
  const unseen = unseenEntries(snap.journal);
  assert.equal(unseen.length, 1);
  const sum = summarize(unseen);
  assert.ok(sum.newCards.length > 0, 'starter cards enter the codex on the first trip');
  assert.equal(sum.bonds[Number(snap.journal.entries[0].companions[0])], RULES.returnBond);
  assert.equal(unseenEntries(markSeen(snap).journal).length, 0);
});

test('rebirth gate settlements become journal entries once, without re-crediting the shared ledger', () => {
  let l = ledger(), snap = fresh(l);
  const recent = [{ id: 'rebirth-run:run-1', mode: 'slay', resources: { spirit: 20, herb: 2 }, summary: '重生之门 · 通关', at: 1 }, { id: 'manual-history:run-1', mode: 'slay', resources: {}, summary: '重生之门 · 对局记录', at: 2 }, { id: 'x', mode: 'cards', resources: {}, summary: '', at: 3 }];
  const results = rebirthResults(snap.world, recent);
  assert.equal(results.length, 1);
  const out = commitResult(snap, l, results[0]);
  assert.deepEqual(out.resources, {}, 'already settled by the gate');
  assert.equal(out.snapshot.world.daypart, 'evening');
  assert.equal(rebirthResults(out.snapshot.world, recent).length, 0);
});

test('重生之门 is a journal activity: open when everyone has fallen, rewards per outcome, no companion injuries', () => {
  let l = ledger(), snap = fresh(l);
  for (const id of ids) snap.world.companions[id].condition = 'fallen';
  const session = startRebirth(snap.world, { element: '木', difficulty: 'normal' }, 42);
  assert.equal(session.activity, 'rebirth-gate');
  assert.equal(session.state.hero, 'seeker');
  const win: RebirthSession = { ...session, state: { ...session.state, phase: 'victory' } };
  const out = commitResult({ ...snap, activity: session }, l, rebirthResult(win, snap.world));
  l = apply(l, out);
  assert.equal(l.resources.spirit, 40 + REBIRTH_REWARD.victory.spirit);
  assert.equal(l.resources.herb, 8 + REBIRTH_REWARD.victory.herb);
  assert.deepEqual(out.roster, {}, 'the seeker is not an official character');
  assert.equal(out.snapshot.activity, null);
  assert.equal(out.snapshot.world.daypart, 'evening');
  assert.ok(out.entry.changes.some(c => c.kind === 'card' && c.card.startsWith('rebirth:')), 'rebirth cards enter the codex');
  assert.throws(() => startRebirth(out.snapshot.world, { element: '金', difficulty: 'normal' }, 1), /天色已晚/);
  const lose = startRebirth(fresh(l).world, { element: '火', difficulty: 'normal' }, 3);
  const defeat = rebirthResult({ ...lose, state: { ...lose.state, phase: 'defeat' } }, fresh(l).world);
  assert.deepEqual(defeat.changes.filter(c => c.kind === 'resource'), [{ kind: 'resource', key: 'spirit', amount: REBIRTH_REWARD.defeat.spirit }]);
  assert.throws(() => rebirthResult(lose, fresh(l).world), /还没有结束/);
});

test('重生之门开局选择从手记传入：天赋卡与开局法宝、分馆与难度的生命上限、按游戏日的今日灵机', async () => {
  const { dailyFor } = await import('../game/core/rebirthBonus');
  const l = ledger(), snap = fresh(l);
  const session = startRebirth(snap.world, { element: '金', branch: 'suoyu', guild: 'longyou', difficulty: 'trial' }, 5);
  const run = session.state;
  assert.equal(run.rebirth!.dailyKey, `游戏日-${snap.world.day}`);
  assert.equal(run.maxHp, 72 + 12 + 5 + (dailyFor(`游戏日-${snap.world.day}`).blessing.passive.maxHealth ?? 0));
  assert.ok(run.deck.some(c => c.card === 'rebirth:御灵环'), '锁御系开局卡');
  assert.deepEqual(run.rebirth!.treasures, ['定心镜']);
  assert.deepEqual(run.relics, ['定心镜']);
  const next = startRebirth({ ...snap.world, day: snap.world.day + 1 }, { element: '金', difficulty: 'normal' }, 5);
  assert.equal(next.state.rebirth!.dailyKey, `游戏日-${snap.world.day + 1}`, '换一天，灵机跟着换');
});
