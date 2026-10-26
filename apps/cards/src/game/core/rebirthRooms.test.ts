/**
 * 房间：直接加载原重生之门模块对照。地图房型、区域守门者、商店、事件与灵质空间的效果迁移。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CARDS } from './content';
import { createRebirthRun, reduceRun } from './engine';
import * as rooms from './rebirthRooms';
import { TREASURES } from './rebirthBonus';
import type { RunState } from './types';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){return s.startsWith('/shared/')?n(${JSON.stringify(pathToFileURL(repo).href)}+'/packages/'+s.slice(8),c):n(s,c);}`));
const slay = (p: string) => import(pathToFileURL(resolve(repo, 'apps/slay/public', p)).href);
/* eslint-disable @typescript-eslint/no-explicit-any */
const DG: any = await slay('game/dungeon.js');
const EN: any = await slay('content/dungeon-encounters.js');
const SH: any = await slay('content/shop.js');
const CU: any = await slay('content/cultivation.js');
const WV: any = await slay('content/worldview-events.js');
const LX: any = await slay('content/lxz-events.js');
const SP: any = await slay('content/spirit-spaces.js');
const GB: any = await slay('content/guild-branches.js');
const RL: any = await slay('content/relations-data.js');
const TE: any = await slay('content/timeline-echoes.js');
const all: any = (await slay('game/actions.js')).default;
const BD: any = await slay('content/bonds.js');
// 原 makeSpiritChoice 在 produce 之后对冻结的结果再写日志（解锁词条时会抛错，见 WORLD-JOURNAL.md）；对照时关掉自动冻结。
(await slay('web_modules/immer.js')).setAutoFreeze(false);

const KEEP = ['health', 'maxHealth', 'addCard', 'treasure'];
const KIND: Record<string, string> = { M: 'battle', E: 'elite', C: 'rest', S: 'shop', V: 'event', Z: 'space', T: 'battle', B: 'guardian' };
const rand = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

test('地图：每层房型都在原 generateGraph 该层可能出现的房型内；第 5–9 层各一间区域守门者，第 11 层最终守门者', () => {
  const allowed: Set<string>[] = Array.from({ length: 10 }, () => new Set());
  for (let i = 0; i < 400; i++) {
    const graph = DG.generateGraph({ width: 6, height: 10, minRooms: 3, maxRooms: 4 });
    graph.slice(1, 11).forEach((floor: any[], f: number) => floor.forEach(n => n.type && allowed[f].add(KIND[n.type])));
  }
  for (let seed = 1; seed <= 200; seed++) {
    const s = createRebirthRun('木', seed);
    for (let f = 0; f < 10; f++) {
      const nodes = s.nodes.filter(n => n.floor === f);
      assert.equal(nodes.length, 3);
      for (const n of nodes) assert.ok(allowed[f].has(n.kind), `第 ${f + 1} 层 ${n.kind} 不在原房型 ${[...allowed[f]]}`);
      assert.equal(nodes.filter(n => n.kind === 'guardian').length, [5, 6, 7, 8, 9].includes(f + 1) ? 1 : 0);
    }
    assert.deepEqual(s.nodes.filter(n => n.floor === 10).map(n => n.kind), ['boss']);
  }
  for (let f = 0; f < 10; f++) assert.deepEqual(rooms.regionBossPool(f), EN.regionBossPools[[5, 6, 7, 8, 9].indexOf(f + 1)] ?? []);
});

test('商店：主题、价格、卡牌与法宝的楼层限制、疗伤选项与原 createShop 一致；守门者专属法宝和只加福缘的法宝不上架', () => {
  const loot = new Set(Object.values(EN.REGION_BOSS_LOOT));
  for (let y = 1; y <= 10; y++) for (let seed = 1; seed <= 40; seed++) {
    const mine = rooms.createShop(y, rand(seed * 31 + y)), theirs = SH.createShop(y);
    assert.deepEqual(mine.theme, theirs.theme);
    const cards = mine.items.filter(i => i.kind === 'card'), treasures = mine.items.filter(i => i.kind === 'treasure');
    assert.equal(cards.length, theirs.items.filter((i: any) => i.kind === 'card').length);
    assert.ok(treasures.length === 1 || treasures.length === 2);
    for (const c of cards) {
      const card = CARDS[c.card!];
      if (y < 3) assert.ok(card.cost <= 1);
      assert.equal(c.price, SH.cardPrice({ energy: card.cost }));
    }
    for (const t of treasures) {
      const tr = CU.treasures[t.treasure!];
      if (y < 3) assert.ok(tr.rarity <= 3);
      assert.ok(!loot.has(t.treasure));
      assert.equal(t.price, SH.treasurePrice(tr));
      assert.ok(Object.keys(TREASURES[t.treasure!].passive).some(k => ['atkBonus', 'defBonus', 'hpRegen', 'maxHealth'].includes(k)));
    }
    assert.deepEqual(mine.items.at(-1), { ...SH.HEAL_OPTION });
  }
});

/** 原实现的房间现场。 */
function theirState(room: any, hp = 40) {
  const s = JSON.parse(JSON.stringify(all.addStarterDeck(all.createNewGame('金', undefined, 'normal', 'liushi'))));
  s.dungeon = { graph: [[{ room: { type: 'start' } }], [{ room }]], x: 0, y: 1 };
  s.player.currentHealth = hp; s.player.gold = 200; s.player.treasures = [];
  return s;
}
/** 与原现场对齐起点：原 createNewGame 会按当天日期的灵机祝福调整生命上限。 */
function ourState(room: RunState['room'], hp = 40, phase: RunState['phase'] = 'event', maxHp = 72): RunState {
  const s = createRebirthRun({ element: '金', guild: 'liushi' }, 1);
  s.floor = 0; s.phase = phase; s.room = room; s.hp = hp; s.maxHp = maxHp; s.gold = 200; s.rebirth!.treasures = []; s.relics = [];
  return s;
}

test('商店购买：卡牌、法宝、疗伤与原 buyItem 结算一致', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const shop = rooms.createShop(4, rand(seed));
    for (const item of shop.items) {
      const theirItem = item.kind === 'card' ? { id: item.id, kind: 'card', cardName: CARDS[item.card!].name, price: item.price } : item.kind === 'treasure' ? { id: item.id, kind: 'treasure', treasureId: item.treasure, price: item.price } : { ...SH.HEAL_OPTION };
      const before = theirState({ type: 'shop', shop: { theme: shop.theme, items: [theirItem] } });
      const theirs = all.buyItem(before, { item: theirItem });
      const mine = reduceRun(ourState({ kind: 'shop', shop: structuredClone(shop) }, 40, 'shop', before.player.maxHealth), { type: 'buy-item', id: item.id });
      assert.equal(mine.gold, theirs.player.gold, item.name);
      assert.equal(mine.hp, theirs.player.currentHealth, item.name);
      assert.equal(mine.deck.length - 10, theirs.deck.length - 10, item.name);
      assert.deepEqual(mine.rebirth!.treasures, theirs.player.treasures.map((t: any) => t.id), item.name);
    }
  }
  const poor = ourState({ kind: 'shop', shop: rooms.createShop(4, rand(1)) }, 40, 'shop'); poor.gold = 1;
  assert.throws(() => reduceRun(poor, { type: 'buy-item', id: poor.room!.kind === 'shop' ? poor.room!.shop.items[0].id : '' }), /灵石不足/);
});

/** 原事件按 id 查找（静态池、会馆支援、灵质空间、因缘、纪年回响）。 */
const originals = new Map<string, any>([
  ...WV.worldviewEventPool, ...LX.lxzEventPool, ...GB.guildSupportEvents, ...SP.spiritSpacePool,
  ...RL.relations.map(WV.buildRelationEvent), ...[...Array(13).keys()].map(y => TE.pickTimelineEchoForFloor(y, new Set())).filter(Boolean),
].map((e: any) => [e.id, e]));
const exported = [...rooms.ROOM_EVENTS, ...rooms.ROOM_SPACES, ...rooms.ROOM_RELATIONS, ...Object.values(rooms.ROOM_ECHOES)];
const keepOf = (effects: any = {}) => Object.fromEntries(Object.entries(effects).filter(([k, v]) => KEEP.includes(k) && v && (k !== 'treasure' || TREASURES[v as string] && Object.keys(TREASURES[v as string].passive).some(p => ['atkBonus', 'defBonus', 'hpRegen', 'maxHealth'].includes(p)))).map(([k, v]) => [k, k === 'addCard' ? `rebirth:${v}` : v]));
const positive = (e: any) => (e.health ?? 0) > 0 || (e.maxHealth ?? 0) > 0 || e.addCard || e.treasure;

test('事件与灵质空间：每个保留的选项效果等于原效果中已迁移的部分；没有正向收益的原选项都不保留', () => {
  for (const e of exported) {
    const o = originals.get(e.id);
    assert.ok(o, `原事件 ${e.id}`);
    for (const c of e.choices) {
      const src = c.side === 'branch' ? o.branchChoice : o.choices[c.side];
      assert.deepEqual(c.effects, keepOf(src.effects), `${e.id}.${c.side}`);
      assert.equal(c.text, src.text);
    }
  }
  for (const [id, o] of originals) {
    const kept = exported.find(e => e.id === id);
    const sides = Object.entries(o.choices ?? {}).filter(([, c]: any) => positive(keepOf(c.effects))).map(([s]) => s);
    if (o.guildId && !['longyou', 'liushi', 'dongqiao', 'hanmu'].includes(o.guildId)) { assert.equal(kept, undefined, `${id} 属于隐藏分馆`); continue; }
    assert.deepEqual(kept?.choices.filter(c => c.side !== 'branch').map(c => c.side) ?? [], sides, id);
  }
  assert.equal(rooms.ROOM_EVENTS.some(e => CU.eventPool.some((x: any) => x.id === e.id)), false, '修仙事件池不迁移');
});

test('事件与灵质空间的效果结算与原 makeEventChoice / makeSpiritChoice 一致（生命、生命上限、得卡、法宝）', () => {
  let compared = 0;
  for (const e of exported) for (const c of e.choices) {
    if (c.branch) continue;
    // 原实现的 immer 会冻结传进去的模块级事件对象，每次传一份拷贝。
    const o = JSON.parse(JSON.stringify(originals.get(e.id)));
    const theirsBefore = theirState(e.source === 'space' ? { type: 'spirit-space', space: o } : { type: 'event', event: o });
    const theirs = e.source === 'space' ? all.makeSpiritChoice(theirsBefore, { side: c.side, space: o }) : all.makeEventChoice(theirsBefore, { side: c.side, event: o });
    const mine = reduceRun(ourState({ kind: e.source === 'space' ? 'space' : 'event', event: e }, 40, 'event', theirsBefore.player.maxHealth), { type: 'choose', side: c.side });
    // 羁绊不迁移：原实现结缘时立即加的生命上限要扣掉，其余必须完全一致。
    const src = e.source === 'space' ? o.choices[c.side] : o.choices[c.side];
    const bondHp = src?.effects?.bond ? (BD.bondById(src.effects.bond)?.passive?.maxHealth ?? 0) : 0;
    assert.equal(mine.maxHp, theirs.player.maxHealth - bondHp, `${e.id}.${c.side} 生命上限`);
    assert.equal(mine.hp, theirs.player.currentHealth - bondHp, `${e.id}.${c.side} 生命`);
    assert.deepEqual(mine.deck.slice(10).map(x => CARDS[x.card].name), theirs.deck.slice(10).map((x: any) => x.name), `${e.id}.${c.side} 得卡`);
    assert.deepEqual(mine.rebirth!.treasures, theirs.player.treasures.filter((t: any) => KEEP && TREASURES[t.id] && Object.keys(TREASURES[t.id].passive).some(p => ['atkBonus', 'defBonus', 'hpRegen', 'maxHealth'].includes(p))).map((t: any) => t.id), `${e.id}.${c.side} 法宝`);
    assert.equal(mine.phase, 'map');
    compared++;
  }
  assert.ok(compared > 100, `对照了 ${compared} 个选项`);
});

test('事件抽取：纪年回响优先、会馆支援只给本馆、按深度分档、本局不重复；单一选项补「继续赶路」', () => {
  for (const y of Object.keys(rooms.ROOM_ECHOES).map(Number)) assert.equal(rooms.pickEvent(y, null, [], rand(y))!.source, 'echo');
  const seen = new Set<string>();
  for (let seed = 1; seed <= 300; seed++) {
    const y = 1 + (seed % 10), used = [...seen].slice(-5);
    const e = rooms.pickEvent(y, 'longyou', [...used, ...Object.values(rooms.ROOM_ECHOES).map(x => x.id)], rand(seed));
    if (!e) continue;
    assert.ok(!used.includes(e.id), '不重复');
    if (e.source === 'guild') assert.equal(e.guild, 'longyou');
    if (e.source === 'worldview' || e.source === 'lxz') assert.equal(e.realm, rooms.realmForFloor(y));
    if (e.source === 'relation') assert.ok(e.realm <= rooms.realmForFloor(y));
    assert.ok(e.choices.length >= 2, '至少两个选项');
    if (e.choices.length === 2 && e.choices[1].side === 'leave') assert.deepEqual(e.choices[1].effects, {});
    seen.add(e.id);
  }
  for (let y = 1; y <= 10; y++) { const sp = rooms.pickSpace(y, [], rand(y)); if (sp) assert.equal(sp.realm, rooms.realmForFloor(y)); }
});

test('休憩：休整回复最大生命 30%（向下取整），也可以移除一张卡；区域守门者胜利发守门者金币并掉法宝，继续选卡而不是结束', () => {
  const rest = ourState(null, 10, 'rest'); rest.maxHp = 77;
  assert.equal(reduceRun(rest, { type: 'rest', choice: 'heal' }).hp, 10 + Math.floor(77 * 0.3));
  const removed = reduceRun(rest, { type: 'rest', choice: 'remove', uid: rest.deck[0].uid });
  assert.equal(removed.deck.length, rest.deck.length - 1);
  let s = createRebirthRun({ element: '金', guild: 'liushi' }, 3);
  const guardian = s.nodes.find(n => n.kind === 'guardian')!;
  s.floor = guardian.floor - 1; s.lane = guardian.lane;
  s = reduceRun(s, { type: 'enter', node: guardian.id });
  assert.equal(s.phase, 'battle');
  assert.ok(rooms.regionBossPool(guardian.floor).includes(s.battle!.enemies[0].name));
  s.battle!.enemies.forEach(e => { e.hp = 1; e.block = 0; });
  s.battle!.hand = [{ uid: 'k', card: 'rebirth:雷灵闪', upgraded: false }]; s.battle!.energy = 3;
  const gold = s.gold;
  s = reduceRun(s, { type: 'play', uid: 'k', target: 'e1' });
  assert.equal(s.phase, 'reward');
  assert.ok(s.gold - gold >= 60 && s.gold - gold <= 66, '守门者金币 60 + 0–6');
  assert.equal(s.rebirth!.treasures!.length, 1);
  assert.ok(TREASURES[s.rebirth!.treasures![0]].rarity >= 3 || Object.values(EN.REGION_BOSS_LOOT).includes(s.rebirth!.treasures![0]));
});
