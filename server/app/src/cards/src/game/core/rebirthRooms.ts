/**
 * 轮回玩法的房间：地图节点类型、区域守门者、商店（卡牌 / 法宝 / 疗伤）、事件、灵质空间。
 * 规则对照原重生之门 game/dungeon.js、content/shop.js、actions.js（buyItem / makeEventChoice / makeSpiritChoice）。
 * 事件与灵质空间只保留与众生之门相关、且效果已迁移的选择（生命、生命上限、得卡、法宝）；修仙事件池、境界修为、道心、福缘、羁绊不迁移。
 */
import rebirthData from '../data/rebirth.json';
import { CARDS } from './content';
import { TREASURES } from './rebirthBonus';
import type { NodeKind } from './types';

export interface RoomEffects { health?: number; maxHealth?: number; addCard?: string; treasure?: string }
export interface RoomChoice { side: string; text: string; effects: RoomEffects; branch?: string[] }
export interface RoomEvent { id: string; source: 'worldview' | 'lxz' | 'guild' | 'echo' | 'relation' | 'memory' | 'space'; realm: number; title: string; description: string; owner?: string | null; theme?: string | null; portrait?: string | null; choices: RoomChoice[]; guild?: string }
export interface ShopItem { id: string; kind: 'card' | 'treasure' | 'heal'; card?: string; treasure?: string; name: string; price: number; desc: string; ratio?: number; sold?: boolean }
export interface Shop { theme: { name: string; owner: string; desc: string }; items: ShopItem[] }
export type RebirthRoom = { kind: 'shop'; shop: Shop } | { kind: 'event' | 'space'; event: RoomEvent };

const R = rebirthData.rooms as unknown as {
  nodeTypes: { lowFloors: number; early: { below: number; types: string }; late: { above: number; types: string }; middle: string };
  roomKind: Record<string, NodeKind>; regionBossFloors: number[]; regionBossPools: string[][]; realmByFloor: Record<string, number>;
  events: RoomEvent[]; relations: RoomEvent[]; echoes: Record<string, RoomEvent>; spaces: RoomEvent[];
  memory: { title: string; description: string; entries: { name: string; text: string }[]; choices: Record<string, { realm: number; choices: RoomChoice[] }> };
  shop: { themes: Record<string, Shop['theme']>; cardPrice: Record<string, number>; treasurePrice: Record<string, number>; heal: ShopItem; treasures: string[] };
};
export const REGION_BOSS_FLOORS = R.regionBossFloors;
export const ROOM_EVENTS = R.events;
export const ROOM_SPACES = R.spaces;
export const ROOM_RELATIONS = R.relations;
export const ROOM_ECHOES = R.echoes;
export const MEMORY = R.memory;
export const SHOP_DATA = R.shop;
/** 原 realmForFloor：只用作「越深的楼层出越深的事件」的分档，界面上不显示境界。 */
export const realmForFloor = (y: number) => R.realmByFloor[String(Math.max(0, Math.min(12, y)))] ?? 4;

type Rand = () => number;
const pickFrom = <T,>(list: T[], rand: Rand) => list[Math.floor(rand() * list.length)];

/** 原 decideNodeType：楼层 i（0 起）前两层只有战斗，第 3 层、中层、高层各用一组房型字母。 */
export function nodeTypeFor(i: number, rand: Rand): string {
  const t = R.nodeTypes;
  if (i < t.lowFloors) return 'M';
  if (i < t.early.below) return pickFrom([...t.early.types], rand);
  if (i > t.late.above) return pickFrom([...t.late.types], rand);
  return pickFrom([...t.middle], rand);
}
export const roomKindFor = (letter: string): NodeKind => R.roomKind[letter] ?? 'battle';
/** 原地图：每个房间层（y = 楼层 + 1）若在区域守门者楼层，随机一个房间换成区域守门者。 */
export const isRegionBossFloor = (floor: number) => R.regionBossFloors.includes(floor + 1);
export const regionBossPool = (floor: number) => R.regionBossPools[R.regionBossFloors.indexOf(floor + 1)] ?? [];

// —— 商店（原 createShop / buyItem）——
export function createShop(y: number, rand: Rand): Shop {
  const theme = R.shop.themes[String(Math.max(0, Math.min(10, y)))];
  const items: ShopItem[] = [];
  const rebirthCards = Object.values(CARDS).filter(c => c.id.startsWith('rebirth:'));
  const cards = shuffle(rebirthCards.filter(c => y >= 3 || c.cost <= 1), rand).slice(0, 3);
  for (const c of cards) items.push({ id: `shop_card_${c.name}`, kind: 'card', card: c.id, name: c.name, price: R.shop.cardPrice[String(c.cost)] ?? 24, desc: c.text });
  const pool = R.shop.treasures.filter(id => y >= 3 || TREASURES[id].rarity <= 3);
  const count = rand() < 0.5 ? 1 : 2;
  for (const id of shuffle(pool, rand).slice(0, count)) items.push({ id: `shop_treasure_${id}`, kind: 'treasure', treasure: id, name: id, price: R.shop.treasurePrice[String(TREASURES[id].rarity)] ?? 46, desc: TREASURES[id].desc });
  items.push({ ...R.shop.heal });
  return { theme, items };
}
function shuffle<T>(list: T[], rand: Rand): T[] { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// —— 事件与灵质空间（原 decideRoomType 的 V / Z 分支）——
const withLeave = (e: RoomEvent): RoomEvent => e.choices.length >= 2 ? e : { ...e, choices: [...e.choices, { side: 'leave', text: '继续赶路', effects: {} }] };
function memoryEvent(realm: number, used: string[], rand: Rand): RoomEvent | null {
  if (!MEMORY.entries.length) return null;
  const fresh = MEMORY.entries.filter(m => !used.includes(memoryId(m)));
  const entry = pickFrom(fresh.length ? fresh : MEMORY.entries, rand);
  const reward = MEMORY.choices[String(Math.min(realm, 5))];
  if (!reward?.choices.length) return null;
  return { id: memoryId(entry), source: 'memory', realm: reward.realm, title: MEMORY.title.replace('{name}', entry.name), description: MEMORY.description.replace('{name}', entry.name).replace('{text}', entry.text), portrait: entry.name, choices: reward.choices };
}
const memoryId = (m: { name: string; text: string }) => `e_mem_${m.name}_${m.text.slice(0, 12)}`;
function relationEvent(realm: number, used: string[], rand: Rand): RoomEvent | null {
  const pool = R.relations.filter(r => r.realm <= realm);
  if (!pool.length) return null;
  const fresh = pool.filter(r => !used.includes(r.id));
  return pickFrom(fresh.length ? fresh : pool, rand);
}
/**
 * 原事件房：纪年回响优先；出身分馆 30% 先触发本馆支援（每局一次）；其余在世界观事件与蓝溪镇篇章间抽取。
 * 原实现还有 25% 的修仙事件池，此池不迁移，世界观与篇章按原 45 : 30 的比例分摊为 60% / 40%。
 * 世界观事件内部沿用原规则：20% 角色回忆，静态池为空时退到因缘事件，否则 30% 因缘事件。
 */
export function pickEvent(y: number, guild: string | null | undefined, used: string[], rand: Rand): RoomEvent | null {
  const echo = R.echoes[String(y)];
  if (echo && !used.includes(echo.id)) return withLeave(echo);
  const realm = realmForFloor(y);
  if (guild && rand() < 0.3) {
    const g = R.events.find(e => e.source === 'guild' && e.guild === guild && !used.includes(e.id));
    if (g) return withLeave(g);
  }
  const worldview = (): RoomEvent | null => {
    if (rand() < 0.2) { const m = memoryEvent(realm, used, rand); if (m) return m; }
    const pool = R.events.filter(e => e.source === 'worldview' && e.realm === realm && !used.includes(e.id));
    if (!pool.length) return relationEvent(realm, used, rand);
    if (rand() < 0.3) { const r = relationEvent(realm, used, rand); if (r) return r; }
    return pickFrom(pool, rand);
  };
  const lxz = (): RoomEvent | null => { const pool = R.events.filter(e => e.source === 'lxz' && e.realm === realm && !used.includes(e.id)); return pool.length ? pickFrom(pool, rand) : null; };
  const first = rand() < 0.6 ? worldview : lxz, second = first === worldview ? lxz : worldview;
  const event = first() ?? second();
  return event ? withLeave(event) : null;
}
/** 原 pickSpiritSpaceForRealm：同档且本局未进过的灵质空间。 */
export function pickSpace(y: number, used: string[], rand: Rand): RoomEvent | null {
  const pool = R.spaces.filter(s => s.realm === realmForFloor(y) && !used.includes(s.id));
  return pool.length ? withLeave(pickFrom(pool, rand)) : null;
}
/** 天赋专属选项只对对应天赋显示。 */
export const choicesFor = (e: RoomEvent, branch?: string | null) => e.choices.filter(c => !c.branch || (branch && c.branch.includes(branch)));

export function effectsText(e: RoomEffects): string {
  return [e.health && `生命 ${e.health > 0 ? '+' : ''}${e.health}`, e.maxHealth && `生命上限 ${e.maxHealth > 0 ? '+' : ''}${e.maxHealth}`, e.addCard && `获得灵卡「${CARDS[e.addCard]?.name ?? e.addCard}」`, e.treasure && `获得法宝「${e.treasure}」`].filter(Boolean).join(' · ') || '什么也不带走';
}
