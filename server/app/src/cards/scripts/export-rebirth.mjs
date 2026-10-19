#!/usr/bin/env node
/**
 * 从重生之门（slay-the-web）原始内容导出共同引擎使用的轮回玩法数据：
 * 卡牌（原生 + 升级定义）、本命五行初始牌组、遭遇/敌人（保留血量区间与伤害浮动）、御灵技效果、区域表。
 * 只读源文件，输出 src/game/data/rebirth.json；相同输入产生相同字节。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../..');
const slay = resolve(root, 'server/app/src/slay-the-web/public');

// 浏览器绝对路径 /shared/... 映射到仓库；敌人构造函数替换为保留原始参数的桩，避免在导入时就把随机区间掷成定值。
const stubs = {
  'dungeon-rooms.js': 'export const Monster=p=>({...p});export const MonsterRoom=(...monsters)=>({type:"monster",monsters});',
  'utils.js': 'export const random=(min,max)=>({min,max});export const shuffle=a=>a;export const range=(n,s=0)=>[...Array(n).keys()].map(i=>i+s);',
  'dungeon.js': 'export default ()=>({});',
};
register('data:text/javascript,' + encodeURIComponent(`
const stubs=${JSON.stringify(stubs)};
export async function resolve(specifier,context,next){
  if(specifier.startsWith('/shared/'))return next(${JSON.stringify(pathToFileURL(root).href)}+specifier,context);
  for(const name of Object.keys(stubs))if(specifier.endsWith('/game/'+name))return {url:'data:text/javascript,'+encodeURIComponent(stubs[name]),shortCircuit:true};
  return next(specifier,context);
}`));

const encounters = await import(pathToFileURL(resolve(slay, 'content/dungeon-encounters.js')).href);
const { skillEffects } = await import(pathToFileURL(resolve(slay, 'content/skill-effects.js')).href);
const mod = name => import(pathToFileURL(resolve(slay, 'content', name)).href);
const mastery = await mod('element-mastery.js');
const { abilityBranches } = await mod('ability-branches.js');
const { guildBranches, guildSupportEvents } = await mod('guild-branches.js');
const { dailyBlessings } = await mod('daily.js');
const { DIFFICULTIES } = await mod('difficulty.js');
const { treasures, realmForFloor } = await mod('cultivation.js');
const { worldviewEventPool, buildCharacterMemoryEvent, buildRelationEvent } = await mod('worldview-events.js');
const { lxzEventPool } = await mod('lxz-events.js');
const { spiritSpacePool } = await mod('spirit-spaces.js');
const { pickTimelineEchoForFloor } = await mod('timeline-echoes.js');
const { characterEvents } = await mod('character-events.js');
const { characterImages } = await mod('character-images.js');
const { relations } = await mod('relations-data.js');
const shopModule = await mod('shop.js');
const catalogue = JSON.parse(readFileSync(resolve(root, 'shared/shared-data/cards.json'), 'utf8'));

const ELEMENT_RESISTANCE = { 土: 12, 金: 9, 水: 6, 木: 3, 火: 0 };
const ELEMENT_POTENCY = { 火: 12, 木: 9, 水: 6, 金: 3, 土: 0 };
const deviations = new Set();
const GLYPH = { 生灵: '生', 心灵: '心', 造物: '造', 空间: '空', 锁御: '锁', 通用: '通' };

/** 原生卡定义 → 共同引擎的声明式效果。遇到未知动作直接报错，不静默丢弃。 */
function convert(def) {
  const effect = {};
  const add = (k, n) => { effect[k] = (effect[k] ?? 0) + n; };
  // 原实现对「攻击牌或有伤害」的牌结算伤害加成；攻击牌的 damage 为 0 时也要保留，没有 damage 字段的攻击牌（金刚撞、咒术化解）不走这一步。
  if (def.damage || (def.type === 'attack' && def.damage === 0)) effect.damage = def.damage;
  if (def.block) effect.block = def.block;
  const self = def.target === 'player';
  for (const [power, stacks] of Object.entries(def.powers ?? {})) {
    if (power === 'regen' || power === 'strength') {
      // 原实现把增益叠到被选中的敌人身上（敌人的 regen 不会生效），卡面写的是「获得回灵」：按卡面迁移并记录差异。
      if (!self) deviations.add(`${def.name.replace(/\+$/, '')}：卡面为自身获得${power === 'regen' ? '回灵' : '力量'}，原实现误加给目标敌人且不生效；迁移后按卡面给自身。`);
      add(power, stacks);
    } else if (!self && (power === 'weak' || power === 'vulnerable')) add(power, stacks);
    else throw new Error(`${def.name}: 不支持的状态 ${power} → ${def.target}`);
  }
  for (const action of def.actions ?? []) {
    const p = action.parameter ?? {};
    const below = action.conditions?.find(c => c.type === 'healthPercentageBelow');
    if (action.conditions && (!below || action.conditions.length > 1)) throw new Error(`${def.name}: 不支持的动作条件`);
    switch (action.type) {
      case 'drawCards': if (below) { effect.drawBelow = (effect.drawBelow ?? 0) + (p.amount ?? 5); effect.drawBelowPct = below.percentage; } else add('draw', p.amount ?? 5); break;
      case 'addHealth': add('heal', p.amount); break;
      case 'addEnergyToPlayer': add('energy', 1); break;
      case 'dealDamageEqualToBlock': effect.damageFromBlock = 1; break;
      case 'addRegenEqualToAllDamage': effect.regenFromAllDamage = 1; break;
      case 'removePlayerDebuffs': effect.clearSelfDebuffs = 1; break;
      case 'removeHealth':
        if (p.target !== 'player') throw new Error(`${def.name}: removeHealth 只支持 player`);
        // 原 useCardActions 会把动作目标改成出牌目标：非自身目标的牌上，「消耗自身生命」实际打在敌人身上。按卡面迁移并记录差异。
        if (def.target !== 'player') deviations.add(`${def.name.replace(/\+$/, '').replace(/^深层/, '')}：卡面为消耗自身生命，原实现把这次扣血改打到出牌目标（敌人）身上且自身不扣；迁移后按卡面扣自身。`);
        add('selfDamage', p.amount); break;
      case 'dealDamageEqualToWeak': effect.loseHpFromWeak = 1; break;
      case 'dealDamageEqualToVulnerable': effect.loseHpFromVulnerable = 1; break;
      case 'reducePower': add(p.power === 'monsterRegen' ? 'reduceTargetRegen' : p.power === 'strength' ? 'reduceTargetStrength' : (() => { throw new Error(`${def.name}: reducePower ${p.power}`); })(), p.amount); break;
      case 'setPower': if (p.amount !== 0 || !['weak', 'vulnerable'].includes(p.power)) throw new Error(`${def.name}: setPower`); effect.clearTargetDebuffs = 1; break;
      default: throw new Error(`${def.name}: 未迁移的动作 ${action.type}`);
    }
  }
  const out = { cost: def.energy, text: def.description, effect };
  for (const c of def.conditions ?? []) {
    if (c.type === 'healthPercentageBelow') out.conditionPct = c.percentage;
    else if (c.type === 'onlyType' && c.cardType === 'attack') out.condition = 'attacksOnly';
    else throw new Error(`${def.name}: 未迁移的出牌条件 ${c.type}`);
  }
  if (out.conditionPct !== undefined) out.condition = 'belowPct';
  return out;
}

const cards = catalogue.cards.filter(c => c.mode === 'slay').map(c => {
  const n = c.native, base = convert(n);
  const card = {
    id: `rebirth:${c.sourceId}`, name: n.name, owner: 'all', type: n.type === 'attack' ? '攻击' : '技能',
    glyph: GLYPH[n.element] ?? n.element, target: n.target === 'allEnemies' ? 'all' : n.target === 'enemy' ? 'single' : 'self',
    school: c.school ?? undefined, element: c.element ?? undefined, source: '重生之门', ...base,
  };
  if (c.upgrade) { const u = convert(c.upgrade); card.upgrade = { name: c.upgrade.name, ...u }; }
  return card;
});

// 本命五行初始牌组（原 game/actions.js 的 STARTER_DECKS，非导出常量，按源文本读取）。
const actionsSource = readFileSync(resolve(slay, 'game/actions.js'), 'utf8');
const block = actionsSource.match(/const STARTER_DECKS = \{([\s\S]*?)\n\}/);
if (!block) throw new Error('找不到 STARTER_DECKS');
const starters = Object.fromEntries([...block[1].matchAll(/([金木水火土]):\s*\[([^\]]*)\]/g)].map(([, el, list]) => [el, [...list.matchAll(/'([^']+)'/g)].map(m => `rebirth:${m[1]}`)]));
for (const [el, deck] of Object.entries(starters)) for (const id of deck) if (!cards.some(c => c.id === id)) throw new Error(`初始牌组 ${el} 引用了不存在的卡 ${id}`);

// —— 加成体系与开局选择（本命五行 / 天时 / 今日灵机 / 天赋 / 出身分馆 / 难度 / 法宝）。福缘、道心、羁绊与众生之门关联度低，暂不迁移。——
const plain = o => JSON.parse(JSON.stringify(o));
const dailySource = readFileSync(resolve(slay, 'content/daily.js'), 'utf8');
const dailyElements = [...(dailySource.match(/const DAILY_ELEMENTS = \[([\s\S]*?)\n\]/)?.[1] ?? '').matchAll(/element: '([^']+)', name: '([^']+)', flavor: '([^']+)'/g)].map(([, element, name, flavor]) => ({ element, name, flavor }));
if (dailyElements.length !== 5) throw new Error('今日灵机五行表读取失败');
const reward = actionsSource.match(/const base = \{easy: (\d+), normal: (\d+), elite: (\d+), boss: (\d+)\}/);
if (!reward) throw new Error('找不到战斗金币基数');
const basePlayer = { maxHealth: +actionsSource.match(/maxHealth: (\d+) \+ diff\.startingHealthBonus/)[1], maxEnergy: +actionsSource.match(/maxEnergy: (\d+),/)[1], daoHeart: +actionsSource.match(/daoHeart: (\d+), \/\/ 道心/)[1], fortune: +actionsSource.match(/fortune: (\d+), \/\/ 福缘/)[1] };
const cardIds = new Set(cards.map(c => c.id));
const needCard = (name, from) => { if (name && !cardIds.has(`rebirth:${name}`)) throw new Error(`${from} 引用了不存在的卡 ${name}`); return name ? `rebirth:${name}` : null; };
const branches = abilityBranches.map(b => ({
  id: b.id, name: b.name, title: b.title, element: b.element, flavor: b.flavor, representative: b.representative ?? null, passive: b.passive ?? {},
  starterCard: needCard(b.starterCard, b.id), dualSkill: needCard(b.dualSkill, b.id),
  branchCards: b.branchCards ? Object.fromEntries(Object.entries(b.branchCards).map(([el, n]) => [el, needCard(n, b.id)])) : null,
  starterTreasure: b.starterTreasure ?? null,
}));
for (const b of branches) if (b.starterTreasure && !treasures[b.starterTreasure]) throw new Error(`${b.id} 的开局法宝不存在`);
const bonus = {
  base: basePlayer,
  rewardBase: { easy: +reward[1], normal: +reward[2], elite: +reward[3], boss: +reward[4] },
  masteries: plain(mastery.elementMasteries), sheng: plain(mastery.SHENG), ke: plain(mastery.KE),
  weatherOrder: plain(mastery.WEATHER_ORDER), weatherPhases: plain(mastery.weatherPhases),
  daily: { elements: dailyElements, blessings: plain(dailyBlessings()) },
  branches, guilds: plain(guildBranches), difficulties: plain(DIFFICULTIES),
  treasures: plain(Object.values(treasures)), bossLoot: plain(encounters.REGION_BOSS_LOOT),
};
for (const id of Object.values(bonus.bossLoot)) if (!treasures[id]) throw new Error(`Boss 掉落 ${id} 不存在`);

// —— 房间：地图节点类型、区域守门者、商店、事件、灵质空间。境界/修为/道心/福缘/羁绊/灵偶/聚灵/魂灵种子等修仙内容不迁移。——
const dungeonSource = readFileSync(resolve(slay, 'game/dungeon.js'), 'utf8');
const need = (re, what) => { const m = dungeonSource.match(re); if (!m) throw new Error('dungeon.js 里找不到 ' + what); return m; };
const nodeTypes = {
  lowFloors: +need(/if \(floor < (\d+)\) return 'M'/, '低层只出战斗')[1],
  early: { below: +need(/if \(floor < (\d+)\) return pick\('([A-Z]+)'\)/, '早期房型')[1], types: need(/if \(floor < \d+\) return pick\('([A-Z]+)'\)/, '早期房型')[1] },
  late: { above: +need(/if \(floor > (\d+)\) return pick\('([A-Z]+)'\)/, '高层房型')[1], types: need(/if \(floor > \d+\) return pick\('([A-Z]+)'\)/, '高层房型')[1] },
  middle: need(/roomTypes: '([A-Z]+)'/, '默认房型')[1],
};
const regionBossFloors = JSON.parse(need(/const REGION_BOSS_FLOORS = (\[[\d, ]+\])/, '区域守门者楼层')[1]);
const ROOM_KIND = { M: 'battle', E: 'elite', C: 'rest', S: 'shop', V: 'event', Z: 'space', T: 'battle' };
for (const t of nodeTypes.early.types + nodeTypes.late.types + nodeTypes.middle) if (!ROOM_KIND[t]) throw new Error('未知房型 ' + t);

const keepTreasure = id => treasures[id] && Object.keys(treasures[id].passive ?? {}).some(k => ['atkBonus', 'defBonus', 'hpRegen', 'maxHealth'].includes(k));
const KEEP_EFFECT = { health: v => v, maxHealth: v => v, addCard: v => needCard(v, '事件'), treasure: v => keepTreasure(v) ? v : undefined };
/** 只留下已迁移的效果；必须至少有一项正向收益（生命、生命上限、得卡、法宝），否则整项选择不迁移。 */
function keepEffects(effects = {}) {
  const out = {};
  for (const [k, v] of Object.entries(effects)) if (KEEP_EFFECT[k]) { const x = KEEP_EFFECT[k](v); if (x !== undefined && x !== 0) out[k] = x; }
  const positive = (out.health ?? 0) > 0 || (out.maxHealth ?? 0) > 0 || out.addCard || out.treasure;
  return positive ? out : null;
}
function normalize(e, source) {
  const choices = [];
  for (const [side, c] of Object.entries(e.choices ?? {})) { const effects = keepEffects(c.effects); if (effects) choices.push({ side, text: c.text, effects }); }
  if (e.branchChoice) { const effects = keepEffects(e.branchChoice.effects); if (effects) choices.push({ side: 'branch', text: e.branchChoice.text, effects, branch: [].concat(e.branchChoice.branch) }); }
  if (!choices.length) return null;
  return { id: e.id, source, realm: e.realm ?? 0, title: e.title ?? e.name, description: e.description ?? e.desc, owner: e.owner ?? null, theme: e.theme ?? null, portrait: e.portrait ?? null, choices };
}
const guildIds = new Set(guildBranches.filter(g => Object.keys(g.passive ?? {}).some(k => ['atkBonus', 'defBonus', 'hpRegen', 'maxHealth'].includes(k))).map(g => g.id));
const echoes = {};
for (let y = 0; y <= 12; y++) { const e = pickTimelineEchoForFloor(y, new Set()); const n = e && normalize(e, 'echo'); if (n) echoes[y] = n; }
const memoryTemplate = buildCharacterMemoryEvent('{name}', '{text}', 0);
const roomData = {
  nodeTypes, roomKind: ROOM_KIND, regionBossFloors, regionBossPools: plain(encounters.regionBossPools),
  realmByFloor: Object.fromEntries([...Array(13).keys()].map(y => [y, realmForFloor(y)])),
  events: [
    ...worldviewEventPool.map(e => normalize(e, 'worldview')),
    ...lxzEventPool.map(e => normalize(e, 'lxz')),
    ...guildSupportEventsFor(),
  ].filter(Boolean),
  relations: relations.map(r => normalize(buildRelationEvent(r), 'relation')).filter(Boolean),
  echoes,
  memory: {
    title: memoryTemplate.title, description: memoryTemplate.description,
    entries: characterEvents.filter(c => characterImages[c.name]).flatMap(c => c.events.map(text => ({ name: c.name, text }))),
    choices: Object.fromEntries([0, 1, 2, 3, 4, 5].map(r => { const ev = buildCharacterMemoryEvent('x', 'y', r); return [r, { realm: ev.realm, choices: Object.entries(ev.choices).map(([side, c]) => ({ side, text: c.text, effects: keepEffects(c.effects) })).filter(c => c.effects) }]; })),
  },
  spaces: spiritSpacePool.map(sp => normalize(sp, 'space')).filter(Boolean),
  shop: {
    themes: Object.fromEntries([...Array(11).keys()].map(y => [y, plain(shopModule.shopThemeForFloor(y))])),
    cardPrice: Object.fromEntries([0, 1, 2, 3, 4, 5].map(e => [e, shopModule.cardPrice({ energy: e })])),
    treasurePrice: Object.fromEntries([1, 2, 3, 4, 5, 6].map(r => [r, shopModule.treasurePrice({ rarity: r })])),
    heal: plain(shopModule.HEAL_OPTION),
    treasures: Object.keys(treasures).filter(keepTreasure).filter(id => !Object.values(encounters.REGION_BOSS_LOOT).includes(id)),
  },
};
function guildSupportEventsFor() { return guildSupportEvents.filter(e => guildIds.has(e.guildId)).map(e => { const n = normalize(e, 'guild'); return n && { ...n, guild: e.guildId }; }); }

const range = v => typeof v === 'object' && v ? [v.min, v.max] : [v, v];
const monster = m => ({
  name: m.name, skill: m.skill ?? null, element: m.element ?? null, hp: range(m.hp ?? m.currentHealth ?? 42),
  intents: m.intents, spread: m.random ?? 0, phase2: m.phase2 ?? null, quote: m.quote ?? null, phase2Quote: m.phase2Quote ?? null,
  resistance: m.resistance ?? ELEMENT_RESISTANCE[m.element] ?? 0, potency: m.potency ?? ELEMENT_POTENCY[m.element] ?? 0,
});
const rooms = group => Object.fromEntries(Object.entries(group).map(([k, room]) => [k, room.monsters.map(monster)]));
const out = {
  source: 'server/app/src/slay-the-web/public (content/cards.js via shared cards.json, content/dungeon-encounters.js, content/skill-effects.js, game/actions.js STARTER_DECKS)',
  cards, starters,
  encounters: { easy: rooms(encounters.easyMonsters), normal: rooms(encounters.monsters), elite: rooms(encounters.elites), boss: rooms(encounters.bosses) },
  regions: { pools: encounters.MONSTER_REGIONS, floors: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(y => [y, encounters.REGION_FOR_FLOOR(y)])), finalBoss: encounters.finalBossPool, names: Object.fromEntries(Object.entries(encounters.REGION_NAMES).map(([k, v]) => [k, v.name])) },
  skills: Object.fromEntries(Object.entries(skillEffects).map(([k, v]) => [k, v])),
  bonus,
  rooms: roomData,
  deviations: [...deviations].sort(),
};
const file = resolve(here, '../src/game/data/rebirth.json');
writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({ events: roomData.events.length, relations: roomData.relations.length, echoes: Object.keys(roomData.echoes).length, memories: roomData.memory.entries.length, spaces: roomData.spaces.length, shopTreasures: roomData.shop.treasures.length, branches: branches.length, guilds: bonus.guilds.length, treasures: bonus.treasures.length, difficulties: bonus.difficulties.length, cards: cards.length, starters: Object.keys(starters).length, easy: Object.keys(out.encounters.easy).length, normal: Object.keys(out.encounters.normal).length, elite: Object.keys(out.encounters.elite).length, boss: Object.keys(out.encounters.boss).length, skills: Object.keys(out.skills).length }));
