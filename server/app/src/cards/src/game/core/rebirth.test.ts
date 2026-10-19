import test from 'node:test';
import assert from 'node:assert/strict';
import rebirthData from '../data/rebirth.json';
import { CARDS, pool, rebirthPool } from './content';
import { canPlayCard, costOf, createRebirthRun, effectOf, reduceRun } from './engine';
import { decay, REBIRTH_ELEMENTS, REBIRTH_STARTERS } from './rebirth';
import type { Enemy, RebirthElement, RunState } from './types';

/** 进入第一层的战斗，然后把手牌和敌人换成指定内容，方便逐项核对卡牌语义。 */
function battle(cards: string[], enemies?: Partial<Enemy>[], seed = 7): RunState {
  let s = createRebirthRun('金', seed);
  s = reduceRun(s, { type: 'enter', node: s.nodes.find(n => n.floor === 0)!.id });
  // 只核对卡牌机制：去掉本命、分馆、天赋、灵机、法宝的加成（加成体系另有对照测试）。
  s.rebirth = { ...s.rebirth!, element: '' as RebirthElement, branch: null, guild: null, dailyKey: null, treasures: [] };
  const b = s.battle!;
  b.hand = cards.map((id, i) => ({ uid: `t${i}`, card: id.startsWith('rebirth:') ? id : `rebirth:${id.replace(/\+$/, '')}`, upgraded: id.endsWith('+') }));
  b.energy = 3; b.block = 0;
  if (enemies) b.enemies = enemies.map((e, i) => ({ id: `e${i + 1}`, name: `敌${i + 1}`, hp: 40, maxHp: 40, block: 0, weak: 0, poison: 0, vulnerable: 0, intent: 'attack', damage: 6, intents: [{ damage: 6 }], next: 0, strength: 0, regen: 0, resistance: 0, potency: 0, ...e }));
  return s;
}
const play = (s: RunState, uid: string, target = 'e1') => reduceRun(s, { type: 'play', uid, target });

test('every 重生之门 card and all five 本命 starter decks are migrated with their original lists', () => {
  assert.equal(rebirthPool().length, 70);
  assert.deepEqual(REBIRTH_ELEMENTS, ['金', '木', '水', '火', '土']);
  assert.deepEqual(REBIRTH_STARTERS['木'].map(id => id.slice(8)), ['木缠暗击', '木缠暗击', '木缠暗击', '木愈回春', '回春术', '回春术', '眷灵', '金刃', '土盾', '土盾']);
  for (const deck of Object.values(REBIRTH_STARTERS)) for (const id of deck) assert.ok(CARDS[id], id);
  for (const c of rebirthPool()) assert.ok(c.upgrade, `${c.name} keeps its explicit upgrade`);
  assert.equal(pool('xiaohei').some(c => c.id.startsWith('rebirth:')), false, '入世历练 reward pools stay separate');
  assert.ok(Array.isArray(rebirthData.deviations));
});

test('first turn: a fresh run reaches its first battle with 5 cards, 3 energy, and every playable card plays without ending the turn', () => {
  for (const element of REBIRTH_ELEMENTS) for (const seed of [1, 2, 3, 99, 2024]) {
    let s = createRebirthRun({ element, guild: 'liushi' }, seed);
    assert.equal(s.hp, 72);
    s = reduceRun(s, { type: 'enter', node: s.nodes.find(n => n.floor === 0)!.id });
    const b = s.battle!;
    assert.equal(s.phase, 'battle'); assert.equal(b.turn, 1); assert.equal(b.hand.length, 5); assert.equal(b.energy, 3);
    assert.ok(b.enemies.length >= 1 && b.enemies.every(e => e.hp > 0 && e.intents?.length));
    const playable = b.hand.find(c => canPlayCard(s, c));
    assert.ok(playable, `${element}/${seed}: at least one card is playable on turn one`);
    const target = b.enemies[0], before = target.hp + target.block;
    const after = play(s, playable!.uid, target.id);
    assert.equal(after.battle!.turn, 1, 'still the first turn');
    assert.equal(after.battle!.energy, 3 - costOf(playable!) + (effectOf(playable!).energy ?? 0));
    assert.ok(!after.battle!.hand.some(c => c.uid === playable!.uid));
    assert.ok([...after.battle!.discard, ...after.battle!.exhaust].some(c => c.uid === playable!.uid));
    if (effectOf(playable!).damage && CARDS[playable!.card].target !== 'self') {
      const t = after.battle!.enemies.find(e => e.id === target.id)!;
      assert.ok(t.hp + t.block < before || after.phase !== 'battle', `${element}/${seed}: damage lands on the chosen enemy`);
    }
  }
});

test('first-floor enemies come from the original 新手 pool with original HP ranges and damage spread', () => {
  const easy = rebirthData.encounters.easy as Record<string, { name: string; hp: number[]; intents: { damage?: number }[]; spread: number }[]>;
  for (const seed of [1, 5, 9, 13, 21, 34]) {
    let s = createRebirthRun('土', seed);
    s = reduceRun(s, { type: 'enter', node: s.nodes.find(n => n.floor === 0)!.id });
    const room = Object.values(easy).find(r => r.length === s.battle!.enemies.length && r.every((m, i) => m.name === s.battle!.enemies[i].name));
    assert.ok(room, 'enemy group matches an original 新手 room');
    room!.forEach((m, i) => {
      const e = s.battle!.enemies[i];
      assert.ok(e.hp >= m.hp[0] && e.hp <= m.hp[1]);
      m.intents.forEach((it, j) => { if (it.damage && m.spread) assert.ok(e.intents![j].damage! >= it.damage - m.spread && e.intents![j].damage! <= it.damage - m.spread + 4); });
    });
  }
});

test('card semantics: damage, upgrades, all-enemy powers and vulnerable', () => {
  let s = play(battle(['金刃', '金刃+'], [{}]), 't0');
  assert.equal(s.battle!.enemies[0].hp, 34);
  s = play(s, 't1');
  assert.equal(s.battle!.enemies[0].hp, 25, 'upgraded 金刃 deals 9');
  s = play(battle(['雷灵闪'], [{}, {}]), 't0');
  assert.deepEqual(s.battle!.enemies.map(e => [e.hp, e.vulnerable]), [[36, 1], [36, 1]]);
  s = play(battle(['金刃'], [{ vulnerable: 2 }]), 't0');
  assert.equal(s.battle!.enemies[0].hp, 31, 'vulnerable takes 50% more');
  const weak = battle(['金刃'], [{}]); weak.battle!.weak = 2;
  assert.equal(play(weak, 't0').battle!.enemies[0].hp, 36, 'a weakened player deals 25% less (6 → 4)');
});

test('card semantics: debuff-based HP loss, regen from all damage, self damage, power reduction, energy and cleansing', () => {
  let s = play(battle(['咒术化解'], [{ weak: 2, vulnerable: 3, block: 10 }]), 't0');
  assert.deepEqual([s.battle!.enemies[0].hp, s.battle!.enemies[0].weak, s.battle!.enemies[0].vulnerable, s.battle!.enemies[0].block], [35, 0, 0, 10], 'loses weak+vulnerable HP through block, then debuffs clear');
  s = play(battle(['咒术化解+'], [{ weak: 2, vulnerable: 3 }]), 't0');
  assert.deepEqual([s.battle!.enemies[0].weak, s.battle!.enemies[0].vulnerable], [2, 3], 'upgraded version keeps the debuffs');
  s = play(battle(['噬灵术'], [{}, {}]), 't0');
  assert.equal(s.battle!.regen, 4, '2 living enemies × 2 damage');
  let t = battle(['摄魂术'], [{}]); t.battle!.block = 2;
  t = play(t, 't0');
  assert.equal(t.hp, 71, 'self damage 3 is absorbed by 2 block first');
  assert.deepEqual([t.battle!.enemies[0].weak, t.battle!.enemies[0].vulnerable], [3, 3]);
  s = play(battle(['散灵诀'], [{ regen: 5, strength: 4 }]), 't0');
  assert.deepEqual([s.battle!.enemies[0].regen, s.battle!.enemies[0].strength], [2, 2]);
  s = play(battle(['无相面具']), 't0');
  assert.equal(s.battle!.energy, 4);
  const dirty = battle(['净灵之雨']); dirty.battle!.weak = 3; dirty.battle!.vulnerable = 2;
  s = play(dirty, 't0');
  assert.deepEqual([s.battle!.weak, s.battle!.vulnerable], [0, 0]);
  const blocky = battle(['金刚撞', '金刚撞+'], [{}]); blocky.battle!.block = 11;
  assert.equal(play(blocky, 't0').battle!.enemies[0].hp, 29, 'damage equal to block');
  assert.equal(costOf(blocky.battle!.hand[1]), 0, 'upgraded 金刚撞 costs 0');
});

test('card semantics: health-percentage conditions follow the original strict thresholds, including upgrades', () => {
  const s = battle(['木愈回春', '木愈回春+', '回春术']);
  assert.equal(canPlayCard(s, s.battle!.hand[0]), false, 'full health: 50% card is locked');
  s.hp = 50;
  assert.equal(canPlayCard(s, s.battle!.hand[0]), false, '69%');
  assert.equal(canPlayCard(s, s.battle!.hand[1]), true, 'upgrade unlocks below 75%');
  s.hp = 35;
  assert.equal(canPlayCard(s, s.battle!.hand[0]), true);
  const draws = play(s, 't2');
  assert.equal(draws.hp, 36);
  assert.equal(draws.battle!.hand.length, s.battle!.hand.length - 1 + 2, '回春术 draws 2 below 50%');
  const healthy = battle(['回春术']);
  assert.equal(play(healthy, 't0').battle!.hand.length, 0, 'no extra draw at full health');
});

test('enemy turn: 御灵技, intents, +1 debuff rule, decay, strength and phase two', () => {
  let s = battle([], [{ name: '离岛小妖', skill: '藤蔓缠绕', intents: [{ damage: 7 }, { block: 9 }], strength: 0 }]);
  s = reduceRun(s, { type: 'end' });
  assert.equal(s.hp, 65, '7 damage');
  assert.equal(s.battle!.weak, 1, 'skill adds weak 1 (+1), then the player decays 1');
  assert.equal(s.battle!.enemies[0].next, 1);
  assert.equal(s.battle!.turn, 2); assert.equal(s.battle!.energy, 3); assert.equal(s.battle!.hand.length, 5);
  s = reduceRun(s, { type: 'end' });
  assert.equal(s.battle!.enemies[0].block, 9);
  let v = battle([], [{ intents: [{ damage: 10 }] }]); v.battle!.vulnerable = 2;
  v = reduceRun(v, { type: 'end' });
  assert.equal(v.hp, 57, 'vulnerable player takes 15');
  let st = battle([], [{ intents: [{ strength: 4 }, { damage: 5 }], resistance: 0, potency: 0 }]);
  st = reduceRun(st, { type: 'end' });
  assert.equal(st.battle!.enemies[0].strength, 2, 'strength halves at end of turn');
  st = reduceRun(st, { type: 'end' });
  assert.equal(st.hp, 72 - 7, 'damage 5 + strength 2');
  let p2 = battle([], [{ hp: 20, maxHp: 40, intents: [{ block: 1 }], phase2: [{ damage: 20 }] }]);
  p2 = reduceRun(p2, { type: 'end' });
  assert.equal(p2.battle!.enemies[0].phase2Active, true);
  assert.equal(p2.hp, 52, 'switches to phase-two intents immediately');
  assert.equal(decay(5, 'half'), 3); assert.equal(decay(1, 'half'), 0); assert.equal(decay(3, 'debuff', 12), 1);
});

test('winning a battle offers only 重生之门 cards as rewards', () => {
  let s = battle(['金刃'], [{ hp: 1, maxHp: 1 }]);
  s = play(s, 't0');
  assert.equal(s.phase, 'reward');
  assert.ok(s.offers.length === 3 && s.offers.every(id => id.startsWith('rebirth:')));
});
