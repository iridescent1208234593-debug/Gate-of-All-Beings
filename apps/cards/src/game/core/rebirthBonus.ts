/**
 * 轮回玩法的加成体系：本命五行共鸣、天时、今日灵机、天赋、出身分馆、难度、法宝。
 * 规则与原重生之门 content/element-mastery.js、daily.js、ability-branches.js、guild-branches.js、difficulty.js 一致，
 * 函数名也保持一致，便于逐项对照。只迁移攻击 / 格挡 / 每回合回复 / 生命上限四类效果；福缘、道心、羁绊暂不迁移。
 */
import rebirthData from '../data/rebirth.json';

export type PassiveKey = 'atkBonus' | 'defBonus' | 'hpRegen' | 'maxHealth';
export const PASSIVE_KEYS: PassiveKey[] = ['atkBonus', 'defBonus', 'hpRegen', 'maxHealth'];
type Passive = Partial<Record<string, number>>;
export interface Branch { id: string; name: string; title: string; element: string; flavor: string; representative: string | null; passive: Passive; starterCard: string | null; dualSkill: string | null; branchCards: Record<string, string> | null; starterTreasure: string | null }
export interface Guild { id: string; name: string; title: string; flavor: string; desc: string; representative: string; passive: Passive }
export interface Difficulty { id: 'trial' | 'normal' | 'rebirth'; name: string; desc: string; hpMult: number; bossHpMult: number; rewardMult: number; startingHealthBonus: number }
export interface Treasure { id: string; type: string; rarity: number; realm: number; passive: Passive; desc: string }
export interface Daily { key: string; seed: number; element: { element: string; name: string; flavor: string }; blessing: { id: string; name: string; desc: string; passive: Passive } }
export type RoomTier = 'easy' | 'normal' | 'elite' | 'boss';

const B = rebirthData.bonus as unknown as {
  base: { maxHealth: number; maxEnergy: number }; rewardBase: Record<RoomTier, number>;
  masteries: { element: string; title: string; role: string; flavor: string; passive: Passive }[]; sheng: Record<string, string>; ke: Record<string, string>;
  weatherOrder: string[]; weatherPhases: { element: string; name: string; flavor: string }[];
  daily: { elements: Daily['element'][]; blessings: Daily['blessing'][] };
  branches: Branch[]; guilds: Guild[]; difficulties: Difficulty[]; treasures: Treasure[]; bossLoot: Record<string, string>;
};
export const BASE_PLAYER = B.base;
export const REWARD_BASE = B.rewardBase;
export const MASTERIES = B.masteries;
export const BRANCHES = B.branches;
export const DIFFICULTIES = B.difficulties;
export const TREASURES: Record<string, Treasure> = Object.fromEntries(B.treasures.map(t => [t.id, t]));
export const WEATHER_PHASES = B.weatherPhases;
export const BOSS_LOOT = B.bossLoot;

const CARD_ELEMENT: Record<string, string> = { jin: '金', mu: '木', shui: '水', huo: '火', tu: '土' };
/** 卡牌五行（共同卡牌用 jin/mu/…）对应原实现的中文五行；能力系卡（生灵、心灵等）没有五行。 */
export const cardElementName = (element?: string | null) => (element ? CARD_ELEMENT[element] ?? null : null);

/** 只保留已迁移的四类效果。 */
export const supported = (p: Passive = {}) => Object.fromEntries(Object.entries(p).filter(([k, v]) => PASSIVE_KEYS.includes(k as PassiveKey) && v)) as Partial<Record<PassiveKey, number>>;
const hasSupported = (p: Passive = {}) => Object.keys(supported(p)).length > 0;
/** 出身分馆：只列出有已迁移效果的分馆（只加福缘/道心的分馆暂时隐藏）。 */
export const GUILDS = B.guilds.filter(g => hasSupported(g.passive));
export const guildById = (id?: string | null) => B.guilds.find(g => g.id === id);
export const branchById = (id?: string | null) => B.branches.find(b => b.id === id);

// —— 五行关系与本命共鸣 ——
export type Relation = 'same' | 'sheng' | 'ke' | 'beKe' | 'beSheng' | 'none';
export function elementRelation(cardElement?: string | null, playerElement?: string | null): Relation {
  if (!cardElement || !playerElement) return 'none';
  if (cardElement === playerElement) return 'same';
  if (B.sheng[cardElement] === playerElement) return 'beSheng';
  if (B.sheng[playerElement] === cardElement) return 'sheng';
  if (B.ke[playerElement] === cardElement) return 'ke';
  if (B.ke[cardElement] === playerElement) return 'beKe';
  return 'none';
}
interface Kind { attack?: boolean; block?: boolean }
export function elementCardBonus(cardElement?: string | null, playerElement?: string | null, kind: Kind = {}) {
  const relation = elementRelation(cardElement, playerElement);
  const atk = kind.attack === false ? 0 : 1, def = kind.block === false ? 0 : 1;
  switch (relation) {
    case 'same': return { atkBonus: 2 * atk, defBonus: 2 * def };
    case 'sheng': case 'beSheng': return { atkBonus: atk, defBonus: def };
    case 'ke': return { atkBonus: atk, defBonus: 0 };
    default: return { atkBonus: 0, defBonus: 0 };
  }
}
export const masteryByElement = (element?: string | null) => B.masteries.find(m => m.element === element);
export function playerVsMonsterBonus(playerElement?: string | null, monsterElement?: string | null) {
  if (!playerElement || !monsterElement) return 0;
  return playerElement === monsterElement || B.ke[playerElement] === monsterElement ? 1 : 0;
}
export function monsterVsPlayerBonus(monsterElement?: string | null, playerElement?: string | null) {
  if (!monsterElement || !playerElement) return 0;
  return B.ke[monsterElement] === playerElement ? 1 : 0;
}

// —— 天时（按原楼层 y 五层一轮转）——
export function weatherForFloor(floor: number) {
  const n = B.weatherOrder.length, i = ((Math.floor(floor || 0) % n) + n) % n;
  return B.weatherOrder[i];
}
export function weatherCardBonus(weatherElement?: string | null, cardElement?: string | null, kind: Kind = {}) {
  if (!weatherElement || !cardElement || weatherElement !== cardElement) return { atkBonus: 0, defBonus: 0 };
  return { atkBonus: kind.attack === false ? 0 : 1, defBonus: kind.block === false ? 0 : 1 };
}
export function weatherMonsterBonus(weatherElement?: string | null, monsterElement?: string | null) {
  return weatherElement && monsterElement && weatherElement === monsterElement ? 1 : 0;
}

// —— 今日灵机：当值五行与天时同向时共振 ——
export function resonanceCardBonus(weatherElement?: string | null, dailyElement?: string | null, cardElement?: string | null, kind: Kind = {}) {
  if (!weatherElement || !dailyElement || weatherElement !== dailyElement || !cardElement || cardElement !== weatherElement) return { atkBonus: 0, defBonus: 0 };
  return { atkBonus: kind.attack === false ? 0 : 1, defBonus: kind.block === false ? 0 : 1 };
}
export function resonanceMonsterBonus(weatherElement?: string | null, dailyElement?: string | null, monsterElement?: string | null) {
  return weatherElement && dailyElement && weatherElement === dailyElement && monsterElement && monsterElement === weatherElement ? 1 : 0;
}
export function dailySeed(key: string) {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return h;
}
/** 原实现以日历日期为种子；这里接受任意键（众生牌录用游戏日），同一个键得到同一份灵机。 */
export function dailyFor(key: string): Daily {
  const seed = dailySeed(key);
  return { key, seed, element: B.daily.elements[seed % B.daily.elements.length], blessing: B.daily.blessings[Math.floor(seed / 7) % B.daily.blessings.length] };
}

// —— 难度 ——
export function difficultyById(id?: string | null): Difficulty {
  return B.difficulties.find(d => d.id === id) ?? B.difficulties.find(d => d.id === 'normal')!;
}
/** 与原 applyDifficultyToDungeon 相同：四舍五入、至少 1 点。 */
export function scaleHp(hp: number, tier: RoomTier, difficulty?: string | null) {
  const d = difficultyById(difficulty), mult = tier === 'boss' ? d.hpMult * d.bossHpMult : d.hpMult;
  return mult === 1 ? hp : Math.max(1, Math.round(hp * mult));
}
/** 战斗金币：房间档位基数 + 0–6 随机，乘难度倍率（福缘加成暂不迁移）。 */
export function battleGold(tier: RoomTier, roll: number, difficulty?: string | null) {
  return Math.max(1, Math.round((REWARD_BASE[tier] + roll) * difficultyById(difficulty).rewardMult));
}

const PASSIVE_LABEL: Record<PassiveKey, (n: number) => string> = { atkBonus: n => `攻击 +${n}`, defBonus: n => `格挡 +${n}`, hpRegen: n => `每回合回复 ${n}`, maxHealth: n => `生命上限 +${n}` };
/** 只显示已迁移的效果；没有可显示的效果时返回空串。 */
export function formatPassive(p: Passive = {}) { return Object.entries(supported(p)).map(([k, v]) => PASSIVE_LABEL[k as PassiveKey](v!)).join('、'); }

/** 局内修行者的加成来源（只存 id，数值从数据表查）。 */
export interface SeekerBonus { element: string; branch?: string | null; guild?: string | null; daily?: Daily | null; treasures: string[] }
/** 对应原 treasure/element/branch/guild/daily PassiveTotal 之和（羁绊、灵偶、灵质觉醒暂不迁移）。 */
export function passiveTotal(p: SeekerBonus, key: PassiveKey) {
  const part = (passive?: Passive) => passive?.[key] ?? 0;
  return part(masteryByElement(p.element)?.passive) + part(branchById(p.branch)?.passive) + part(guildById(p.guild)?.passive)
    + part(p.daily?.blessing.passive) + p.treasures.reduce((sum, id) => sum + part(TREASURES[id]?.passive), 0);
}

/** 原 pickBossTreasure：稀有度不低于门槛、尚未拥有；没有就退回任意未拥有的法宝。 */
export function pickBossTreasure(owned: string[], minRarity: number, rand: () => number): string | null {
  const free = B.treasures.filter(t => !owned.includes(t.id));
  const pool = free.filter(t => t.rarity >= minRarity);
  const candidates = pool.length ? pool : free;
  return candidates.length ? candidates[Math.floor(rand() * candidates.length)].id : null;
}
