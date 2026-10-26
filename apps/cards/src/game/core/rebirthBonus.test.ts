/**
 * 加成体系与开局选择：直接加载原重生之门模块，与共同引擎逐项对照。
 * 只对照已迁移的攻击 / 格挡 / 每回合回复 / 生命上限；福缘、道心、羁绊不在本次范围。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CARDS, rebirthPool } from './content';
import { createRebirthRun, reduceRun } from './engine';
import * as ours from './rebirthBonus';
import type { RebirthElement, RunState } from './types';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){return s.startsWith('/shared/')?n(${JSON.stringify(pathToFileURL(repo).href)}+'/packages/'+s.slice(8),c):n(s,c);}`));
const slay = (p: string) => import(pathToFileURL(resolve(repo, 'apps/slay/public', p)).href);
/* eslint-disable @typescript-eslint/no-explicit-any */
const M: any = await slay('content/element-mastery.js');
const D: any = await slay('content/daily.js');
const AB: any = await slay('content/ability-branches.js');
const G: any = await slay('content/guild-branches.js');
const DF: any = await slay('content/difficulty.js');
const CU: any = await slay('content/cultivation.js');
const EN: any = await slay('content/dungeon-encounters.js');
const LZ: any = await slay('content/lingzhi-bonus.js');
const all: any = (await slay('game/actions.js')).default;
const { createCard }: any = await slay('game/cards.js');

const ELEMENTS: RebirthElement[] = ['金', '木', '水', '火', '土'];
const ANY = [...ELEMENTS, '生灵', '心灵', '空间', null, undefined];
const KINDS = [{}, { attack: false }, { block: false }, { attack: true, block: false }, { attack: false, block: true }];
const KEYS = ['atkBonus', 'defBonus', 'hpRegen'] as const;
const today = D.dateStrOf(new Date());

test('五行关系、本命共鸣、敌我克制与天时、灵机共振：所有输入组合与原函数一致', () => {
  for (const a of ANY) for (const b of ANY) {
    assert.equal(ours.elementRelation(a, b), M.elementRelation(a, b), `${a}/${b}`);
    for (const k of KINDS) assert.deepEqual(ours.elementCardBonus(a, b, k), M.elementCardBonus(a, b, k));
    assert.equal(ours.playerVsMonsterBonus(a, b), M.playerVsMonsterBonus(a, b));
    assert.equal(ours.monsterVsPlayerBonus(a, b), M.monsterVsPlayerBonus(a, b));
    assert.equal(ours.weatherMonsterBonus(a, b), M.weatherMonsterBonus(a, b) ? 1 : 0);
    for (const k of KINDS) assert.deepEqual(ours.weatherCardBonus(a, b, k), M.weatherCardBonus(a, b, k));
    for (const c of ANY) {
      assert.equal(ours.resonanceMonsterBonus(a, b, c), M.resonanceMonsterBonus(a, b, c));
      for (const k of KINDS) assert.deepEqual(ours.resonanceCardBonus(a, b, c, k), M.resonanceCardBonus(a, b, c, k));
    }
  }
  for (let y = -7; y <= 40; y++) assert.equal(ours.weatherForFloor(y), M.weatherForFloor(y));
  for (const el of ELEMENTS) for (const key of KEYS) assert.equal(ours.passiveTotal({ element: el, treasures: [] }, key), M.elementPassiveTotal({ element: el }, key));
});

test('今日灵机：同一日期键得到与原 todayDaily 相同的当值五行和祝福', () => {
  const start = new Date(2026, 0, 1);
  for (let i = 0; i < 500; i++) {
    const date = new Date(start); date.setDate(start.getDate() + i);
    const theirs = D.todayDaily(date), mine = ours.dailyFor(D.dateStrOf(date));
    assert.equal(mine.seed, theirs.seed);
    assert.equal(mine.element.element, theirs.element.element);
    assert.equal(mine.blessing.id, theirs.blessing.id);
  }
});

test('天赋、分馆、法宝的被动与难度倍率与原数据一致；只加福缘/道心的分馆在选择列表中隐藏', () => {
  for (const b of AB.abilityBranches) for (const key of KEYS) assert.equal(ours.passiveTotal({ element: '', branch: b.id, treasures: [] }, key), AB.branchPassiveTotal({ branch: b.id }, key), `${b.id}.${key}`);
  for (const g of G.guildBranches) for (const key of KEYS) assert.equal(ours.passiveTotal({ element: '', guild: g.id, treasures: [] }, key), G.guildPassiveTotal({ guild: g.id }, key), `${g.id}.${key}`);
  for (const t of Object.values(CU.treasures) as any[]) for (const key of KEYS) assert.equal(ours.passiveTotal({ element: '', treasures: [t.id] }, key), t.passive?.[key] ?? 0);
  assert.deepEqual(ours.GUILDS.map(g => g.id), ['longyou', 'liushi', 'dongqiao', 'hanmu']);
  for (const id of ['trial', 'normal', 'rebirth', 'bogus', undefined]) {
    assert.deepEqual({ ...ours.difficultyById(id) }, { ...DF.difficultyById(id) });
    for (const tier of ['easy', 'normal', 'elite', 'boss'] as const) for (const hp of [1, 7, 13, 42, 99, 160]) {
      const dungeon = { graph: [[{ room: { type: 'monster', difficulty: tier, monsters: [{ maxHealth: hp, currentHealth: hp }] } }]] };
      assert.equal(ours.scaleHp(hp, tier, id), DF.applyDifficultyToDungeon(dungeon, id).graph[0][0].room.monsters[0].maxHealth);
    }
  }
  for (const name of Object.keys(EN.bosses)) assert.equal(ours.BOSS_LOOT[name] ?? null, EN.bossLootFor(name));
});

test('开局：生命上限、初始牌组（含天赋卡/五行分支卡/双系合技）、开局法宝与原 createNewGame + addStarterDeck 一致', () => {
  const branches = [undefined, ...AB.abilityBranches.map((b: any) => b.id)];
  for (const element of ELEMENTS) for (const branch of branches) for (const guild of G.guildBranches.map((g: any) => g.id)) for (const difficulty of ['trial', 'normal', 'rebirth'] as const) {
    const theirs = all.addStarterDeck(all.createNewGame(element, branch, difficulty, guild));
    const mine = createRebirthRun({ element, branch, guild, difficulty, dailyKey: today }, 1);
    const label = `${element}/${branch}/${guild}/${difficulty}`;
    assert.equal(mine.maxHp, theirs.player.maxHealth, label);
    assert.equal(mine.hp, theirs.player.currentHealth, label);
    assert.deepEqual(mine.deck.map(c => CARDS[c.card].name), theirs.deck.map((c: any) => c.name), label);
    assert.deepEqual(mine.rebirth!.treasures, theirs.player.treasures.map((t: any) => t.id), label);
  }
});

/** 原实现的战斗现场：一个怪物房，指定楼层 y 与怪物五行。 */
function theirBattle(element: RebirthElement, branch: string | undefined, guild: string, y: number, monsterElement: string | null) {
  const s = JSON.parse(JSON.stringify(all.createNewGame(element, branch, 'normal', guild)));
  const graph: any[][] = Array.from({ length: y + 1 }, () => [{ room: { type: 'start' } }]);
  graph[y] = [{ room: { type: 'monster', monsters: [{ name: '敌', currentHealth: 200, maxHealth: 200, block: 0, powers: {}, element: monsterElement, resistance: 0, potency: 0, intents: [{ damage: 10 }], nextIntent: 0 }] } }];
  s.dungeon = { graph, x: 0, y };
  s.player.currentEnergy = 10;
  return s;
}
function ourBattle(element: RebirthElement, branch: string | undefined, guild: string, y: number, monsterElement: string | null, card?: string, upgraded = false): RunState {
  const s = createRebirthRun({ element, branch, guild, difficulty: 'normal', dailyKey: today }, 1);
  s.floor = y - 1; s.phase = 'battle';
  s.battle = { turn: 1, energy: 10, block: 0, strength: 0, summon: 0, domain: 0, regen: 0, weak: 0, vulnerable: 0, hand: card ? [{ uid: 'c1', card, upgraded }] : [], draw: [], discard: [], exhaust: [],
    enemies: [{ id: 'e1', name: '敌', hp: 200, maxHp: 200, block: 0, weak: 0, poison: 0, vulnerable: 0, intent: 'attack', damage: 10, intents: [{ damage: 10 }], next: 0, strength: 0, regen: 0, element: monsterElement, resistance: 0, potency: 0 }] };
  return s;
}

test('出牌伤害与格挡：本命 × 天赋 × 分馆 × 天时楼层 × 怪物五行 × 每张卡（含升级）都与原 playCard 一致', () => {
  // 金刚撞、咒术化解在原实现里会因缺少 damage 字段算出 NaN，单独记录为差异，不参与对照。
  const cards = rebirthPool().filter(c => !['金刚撞', '咒术化解'].includes(c.name) && !c.condition);
  // 默认抽样：每种本命各配一种天时（五层轮转，五种本命正好覆盖五种天时的全部组合）；REBIRTH_PARITY=full 时跑完整组合。
  const full = process.env.REBIRTH_PARITY === 'full';
  let compared = 0;
  for (const element of ELEMENTS) for (const branch of full ? [undefined, 'yuling', 'qianghua', 'zaowu'] : [undefined, 'yuling', 'qianghua']) for (const guild of full ? ['liushi', 'dongqiao', 'hanmu'] : ['liushi', 'dongqiao']) for (const y of [1, 2, 3, 4, 5]) for (const monsterElement of full ? ['金', '木', '水', '火', '土', null] : ['金', '土', null]) {
    if (full ? (y + ELEMENTS.indexOf(element)) % 3 !== 0 : (y + ELEMENTS.indexOf(element)) % 5 !== 0) continue;
    for (const card of cards) for (const upgraded of [false, true]) {
      const theirCard = createCard(card.name); if (upgraded) theirCard.upgrade();
      const target = card.target === 'all' ? 'allEnemies' : card.target === 'self' ? 'player' : 'enemy0';
      const before = theirBattle(element, branch, guild, y, monsterElement);
      before.hand = [theirCard];
      const after = all.playCard(before, { card: theirCard, target });
      const theirMonster = after.dungeon.graph[y][0].room.monsters[0];
      const mine = reduceRun(ourBattle(element, branch, guild, y, monsterElement, card.id, upgraded), { type: 'play', uid: 'c1', target: 'e1' });
      const ourEnemy = mine.battle?.enemies[0] ?? { hp: 0, block: 0 };
      const label = `${card.name}${upgraded ? '+' : ''} 本命${element} ${branch ?? '-'} ${guild} y${y} 怪${monsterElement}`;
      // 摄魂术：原实现把「消耗自身生命」打到了敌人身上（易伤已生效）；迁移按卡面扣自身，差值正好是这一下。
      const selfCost = card.name === '摄魂术' ? (upgraded ? 4 : 3) : 0;
      assert.equal(ourEnemy.hp - Math.floor(selfCost * 1.5), theirMonster.currentHealth, `${label} 敌人生命`);
      if (selfCost) assert.equal(after.player.currentHealth - selfCost, mine.hp, `${label} 自身生命按卡面扣除`);
      assert.equal(mine.battle?.block ?? 0, after.player.block, `${label} 格挡`);
      compared++;
    }
  }
  assert.ok(compared > 2000, `对照了 ${compared} 次出牌`);
});

test('回合结束：回灵、每回合回复与怪物攻击（含五行压制、应时之妖、灵机共振）与原 endTurn 一致', () => {
  const lingzhi = LZ.applyLingzhiBonus({ player: { maxHealth: 0, currentHealth: 0, fortune: 0, daoHeart: 0, treasures: [] } }).player;
  assert.equal(lingzhi.maxHealth, 0, '灵质修行加成在空进度下不改生命，可以直接对照');
  for (const element of ELEMENTS) for (const branch of [undefined, 'shengling', 'zhiyu']) for (const guild of ['hanmu', 'longyou']) for (const y of [1, 2, 3, 4, 5, 6]) for (const monsterElement of ['金', '木', '水', '火', '土']) {
    const theirs = theirBattle(element, branch, guild, y, monsterElement);
    theirs.player.currentHealth = 40; theirs.player.powers = { regen: 3 }; theirs.drawPile = []; theirs.discardPile = []; theirs.hand = [];
    const after = all.endTurn(theirs);
    const mine = ourBattle(element, branch, guild, y, monsterElement);
    mine.hp = 40; mine.battle!.regen = 3;
    const ended = reduceRun(mine, { type: 'end' });
    assert.equal(ended.hp, after.player.currentHealth, `本命${element} ${branch ?? '-'} ${guild} y${y} 怪${monsterElement}`);
  }
});

test('战斗金币与守门者法宝：按房间档位与难度；专属掉落优先，已持有则抽稀有度 ≥4', () => {
  assert.equal(ours.battleGold('easy', 0, 'normal'), 14);
  assert.equal(ours.battleGold('boss', 6, 'trial'), Math.round(66 * 1.3));
  assert.equal(ours.battleGold('normal', 3, 'rebirth'), Math.round(25 * 0.75));
  const owned: string[] = [];
  const id = ours.pickBossTreasure(owned, 4, () => 0)!;
  assert.ok(ours.TREASURES[id].rarity >= 4);
  assert.equal(ours.pickBossTreasure(Object.keys(ours.TREASURES), 4, () => 0), null);
});
