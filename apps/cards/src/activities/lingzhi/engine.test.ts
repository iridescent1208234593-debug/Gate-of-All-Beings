/**
 * 灵质修行：直接加载原 slay-the-web 灵质修行模块对照。数据、地图结构、战斗数值、守门者二阶段、奖励池、结算。
 * 原引擎开局会叠加出身分馆、势力与今日灵机的随机加成，对照时把它们清空，只比较这一版已迁移的核心规则。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { availableNodes, createLingzhiRun, LINGZHI, LINGZHI_CARDS, reduceLingzhi } from './engine';
import { lingzhiResult, LINGZHI_REWARD, startLingzhi, type LingzhiSession } from './adapter';
import type { LingzhiRun } from './types';
import type { WorldState } from '../../world/types';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../../..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){return s.startsWith('/shared/')?n(${JSON.stringify(pathToFileURL(repo).href)}+s,c):n(s,c);}`));
const slay = (p: string) => import(pathToFileURL(resolve(repo, 'apps/slay/public', p)).href);
/* eslint-disable @typescript-eslint/no-explicit-any */
const XI: any = await slay('content/lingzhi-xiuxing.js');
const MO: any = await slay('content/lingzhi-monsters.js');
const EN: any = await slay('game/lingzhi-engine.js');

test('数据：角色起始牌组、灵术卡、敌人与原内容一致', () => {
  for (const c of XI.lingzhiCharacters) {
    const mine = LINGZHI.characters.find(x => x.id === c.id)!;
    assert.deepEqual(mine.starter.map(id => LINGZHI_CARDS[id].name), c.starterCards);
    assert.equal(mine.cost, c.cost);
  }
  for (const c of XI.lingzhiCards) {
    const mine = LINGZHI_CARDS[c.cardId];
    for (const k of ['name', 'type', 'energy', 'target', 'damage', 'block', 'exhaust', 'cost']) assert.deepEqual((mine as any)[k], c[k], `${c.name}.${k}`);
    assert.deepEqual(mine.actions ?? [], c.actions ?? []);
  }
  assert.deepEqual(LINGZHI.monsters.map(m => [m.id, m.maxHealth, m.intents, m.phase2Intents]), MO.lingzhiMonsterPool.map((m: any) => [m.id, m.maxHealth, m.intents, m.phase2Intents]));
});

test('地图：与原 buildLingzhiDungeon 同构（起点、5 层三选一、第 5 层精英、第 6 层守门者），每层都能走到下一层任一节点', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = createLingzhiRun({ character: 'walker' }, seed);
    assert.deepEqual(s.nodes.filter(n => n.floor === 0).map(n => n.kind), ['start']);
    assert.deepEqual(s.nodes.filter(n => n.floor === 6).map(n => n.kind), ['boss']);
    for (let f = 1; f <= 5; f++) {
      const kinds = s.nodes.filter(n => n.floor === f).map(n => n.kind).sort();
      const want = f === 5 ? ['elite', 'event', 'rest'] : kinds.includes('space') ? ['battle', 'rest', 'space'] : ['battle', 'event', 'rest'];
      assert.deepEqual(kinds, want.sort());
    }
    assert.equal(availableNodes(s).length, 3);
  }
});

/** 原引擎：进入一间战斗房，清掉分馆/势力/灵机加成，并把手牌换成指定的牌。 */
function theirs(floor: number, monsters: any[], hand: string[]) {
  const st = EN.createLingzhiGame({ characterId: 'walker' });
  const graph = st.dungeon.graph.map((row: any[]) => row.map(n => ({ ...n })));
  graph[floor][0] = { ...graph[floor][0], room: { type: 'monster', monsters, difficulty: monsters[0].difficulty } };
  const game = new EN.LingzhiGame({ ...st, dungeon: { ...st.dungeon, graph }, player: { ...st.player, guild: null, faction: null, relics: [], maxHealth: 72, currentHealth: 72 }, daily: { passive: {} } });
  game.enqueue({ type: 'move', move: { x: 0, y: floor } });
  game.dequeue();
  game.state = { ...game.state, hand: hand.map(id => EN.createLingzhiCard(id)) };
  return game;
}
function mine(floor: number, hand: string[], boss = false): LingzhiRun {
  const s = createLingzhiRun({ character: 'walker' }, 7);
  s.floor = floor - 1;
  const lane = boss ? 1 : 0;
  s.nodes = s.nodes.map(n => n.floor === floor && n.lane === lane ? { ...n, kind: boss ? 'boss' : floor === 5 ? 'elite' : 'battle' } : n);
  let r = reduceLingzhi(s, { type: 'enter', node: `${floor}-${lane}` });
  r = structuredClone(r);
  r.battle!.hand = hand.map((card, i) => ({ uid: `h${i}`, card }));
  return r;
}
const snap = (hp: number, block: number, powers: any, ms: { hp: number; block: number; powers: any }[]) => ({ hp, block, powers: clean(powers), ms: ms.map(m => [m.hp, m.block, clean(m.powers)]) });
const clean = (p: any) => Object.fromEntries(Object.entries(p ?? {}).filter(([, v]) => v));
const snapTheirs = (g: any) => { const st = g.state, room = st.dungeon.graph[st.dungeon.y][st.dungeon.x].room; return snap(st.player.currentHealth, st.player.block, st.player.powers, room.monsters.map((m: any) => ({ hp: m.currentHealth, block: m.block, powers: m.powers }))); };
const snapMine = (r: LingzhiRun) => snap(r.hp, r.battle?.block ?? 0, r.battle?.powers, (r.battle?.monsters ?? []).map(m => ({ hp: m.hp, block: m.block, powers: m.powers })));

test('战斗：出牌伤害、虚弱、连击、群体、消耗抽牌、怪物意图、能力衰减与原引擎逐步一致', () => {
  const defs = MO.lingzhiMonstersForFloor(1);
  const hand = ['tengji', 'lianji', 'yanji', 'lingmai', 'liexi'];
  const g = theirs(1, defs.map((d: any) => ({ ...d, currentHealth: d.maxHealth, block: 0, powers: {}, nextIntent: 0, bossPhase: 1 })), hand);
  let r = mine(1, hand);
  assert.equal(r.battle!.monsters.length, defs.length, '同层整组敌人一起出现');
  assert.deepEqual(snapMine(r), snapTheirs(g), '开战：行者被动力量 1');
  // 每回合把双方手牌换成同样三张，各打满 3 点灵力，再结束回合让敌人行动。
  const turns: [string, string][][] = [
    [['tengji', 'enemy0'], ['lianji', 'enemy0'], ['yanji', 'enemy1']],
    [['lingmai', 'allEnemies'], ['lianji', 'enemy2'], ['liexi', 'enemy2']],
    [['tengji', 'enemy3'], ['yanji', 'enemy3'], ['lianji', 'enemy0']],
    [['liexi', 'enemy1'], ['tengji', 'enemy2'], ['yanji', 'enemy3']],
  ];
  let cleared = false;
  turns.forEach((plays, turn) => {
    if (r.phase !== 'battle') return;
    g.state = { ...g.state, hand: plays.map(([id]) => EN.createLingzhiCard(id)) };
    r = structuredClone(r);
    r.battle!.hand = plays.map(([card], i) => ({ uid: `t${turn}-${i}`, card }));
    plays.forEach(([id, target], i) => {
      if (r.phase !== 'battle') return;
      const card = g.state.hand.find((c: any) => c.cardId === id);
      g.enqueue({ type: 'playCard', card, target }); g.dequeue();
      r = reduceLingzhi(r, { type: 'play', uid: `t${turn}-${i}`, target });
      // 清场后本引擎直接进入奖励（battle 置空），只比对生命与原引擎「全部倒下」。
      if (r.phase === 'reward') { assert.equal(r.hp, snapTheirs(g).hp); assert.ok(snapTheirs(g).ms.every(m => m[0] === 0)); cleared = true; return; }
      assert.deepEqual(snapMine(r), snapTheirs(g), `第 ${turn + 1} 回合打出 ${LINGZHI_CARDS[id].name}`);
    });
    if (r.phase !== 'battle') return;
    g.enqueue({ type: 'endTurn' }); g.dequeue();
    r = reduceLingzhi(r, { type: 'end' });
    assert.deepEqual(snapMine(r), snapTheirs(g), `第 ${turn + 2} 回合开始`);
  });
  assert.ok(cleared, '这组出牌应当在四回合内清场');
});

test('守门者：生命降到阈值时觉醒（力量 +3、格挡 +10、换二阶段意图），觉醒回合不行动', () => {
  const def = MO.lingzhiMonsterPool.find((m: any) => m.id === LINGZHI.monsters.find(x => x.difficulty === 'boss')!.id);
  const low = Math.ceil(def.maxHealth * (def.phase2Threshold ?? 0.4));
  const g = theirs(6, [{ ...def, currentHealth: low, block: 0, powers: {}, nextIntent: 0, bossPhase: 1 }], []);
  let r = mine(6, [], true);
  r.battle!.monsters = [{ ...r.battle!.monsters[0], def: def.id, name: def.name, hp: low, maxHp: def.maxHealth, intents: def.intents }];
  r.battle!.powers = { ...g.state.player.powers };
  g.enqueue({ type: 'endTurn' }); g.dequeue();
  r = reduceLingzhi(r, { type: 'end' });
  assert.deepEqual(snapMine(r), snapTheirs(g));
  assert.equal(r.battle!.monsters[0].bossPhase, 2);
  g.enqueue({ type: 'endTurn' }); g.dequeue();
  r = reduceLingzhi(r, { type: 'end' });
  assert.deepEqual(snapMine(r), snapTheirs(g), '二阶段意图');
});

test('胜负与奖励：清场后三选一（精英四选一）只出默认解锁卡；击败守门者通关；生命归零散灵', () => {
  let r = mine(1, ['liexi']);
  r.battle!.monsters.forEach(m => { m.hp = 1; });
  r.battle!.monsters = r.battle!.monsters.slice(0, 1);
  r = reduceLingzhi(r, { type: 'play', uid: 'h0', target: 'enemy0' });
  assert.equal(r.phase, 'reward');
  assert.equal(r.offers.length, 3);
  for (const id of r.offers) assert.ok(LINGZHI.defaultCards.includes(id));
  const before = r.deck.length;
  r = reduceLingzhi(r, { type: 'reward', card: r.offers[0] });
  assert.equal(r.deck.length, before + 1);
  assert.equal(r.phase, 'map');

  let e = mine(5, ['liexi']);
  e.battle!.monsters = e.battle!.monsters.slice(0, 1).map(m => ({ ...m, hp: 1 }));
  e = reduceLingzhi(e, { type: 'play', uid: 'h0', target: 'enemy0' });
  assert.equal(e.offers.length, 4);

  let b = mine(6, ['liexi'], true);
  b.battle!.monsters[0].hp = 1;
  b = reduceLingzhi(b, { type: 'play', uid: 'h0', target: 'enemy0' });
  assert.equal(b.phase, 'victory');

  let d = mine(1, []);
  d.hp = 1;
  d = reduceLingzhi(d, { type: 'end' });
  assert.equal(d.phase, 'defeat');
});

test('休整：回复 30% 生命上限（向下取整）或舍去一张牌；事件/灵质空间节点只停留不结算', () => {
  const s = createLingzhiRun({ character: 'walker' }, 3);
  s.nodes = s.nodes.map(n => n.floor === 1 ? { ...n, kind: n.lane === 0 ? 'rest' : n.lane === 1 ? 'event' : 'battle' } : n);
  s.hp = 30;
  let r = reduceLingzhi(s, { type: 'enter', node: '1-0' });
  r = reduceLingzhi(r, { type: 'rest', choice: 'heal' });
  assert.equal(r.hp, 30 + Math.floor(72 * 0.3));
  const q = reduceLingzhi(s, { type: 'enter', node: '1-1' });
  assert.equal(q.phase, 'quiet');
  const back = reduceLingzhi(q, { type: 'continue' });
  assert.deepEqual([back.phase, back.hp, back.deck.length], ['map', 30, s.deck.length]);
});

test('结算：通关灵质 +30 并记地点；散灵灵质 +5；中途离开不给奖励；只能清晨开始', () => {
  const world = { day: 3, daypart: 'morning' } as WorldState;
  const session = startLingzhi(world, { character: 'walker' }, 11);
  assert.equal(session.activity, 'lingzhi');
  const win: LingzhiSession = { ...session, state: { ...session.state, phase: 'victory', floor: 6 } };
  assert.deepEqual(lingzhiResult(win).changes, [
    { kind: 'resource', key: 'spirit', amount: LINGZHI_REWARD.victory.spirit },
    { kind: 'place', place: 'lingzhi-circuit', state: 'cleared' },
  ]);
  const lose: LingzhiSession = { ...session, state: { ...session.state, phase: 'defeat', floor: 3 } };
  assert.deepEqual(lingzhiResult(lose).changes, [{ kind: 'resource', key: 'spirit', amount: 5 }]);
  assert.deepEqual(lingzhiResult(session, true).changes, []);
  assert.equal(lingzhiResult(win).id, lingzhiResult(win).id, '同一局结算 ID 稳定，提交可去重');
  assert.throws(() => lingzhiResult(session), /还没有结束/);
  assert.throws(() => startLingzhi({ ...world, daypart: 'evening' }, { character: 'walker' }, 1), /天色已晚/);
  assert.throws(() => startLingzhi(world, { character: 'summoner' }, 1), /还没有解锁/);
});
