/**
 * 轮回玩法（重生之门）在共同引擎里的内容表：本命五行初始牌组、遭遇、御灵技。
 * 数据由 scripts/export-rebirth.mjs 从原重生之门源码导出；这里只做按楼层挑选与生成敌人，随机数由调用方提供以保持可复现。
 */
import rebirthData from '../data/rebirth.json';
import type { Enemy, Intent, NodeKind, RebirthElement } from './types';
import { regionBossPool } from './rebirthRooms';

interface MonsterDef { name: string; skill: string | null; element: string | null; hp: [number, number]; intents: Intent[]; spread: number; phase2: Intent[] | null; quote: string | null; resistance: number; potency: number }
type Group = Record<string, MonsterDef[]>;
const ENCOUNTERS = rebirthData.encounters as unknown as { easy: Group; normal: Group; elite: Group; boss: Group };
const REGIONS = rebirthData.regions as unknown as { pools: Record<string, string[]>; floors: Record<string, string | null>; finalBoss: string[]; names: Record<string, string> };

export interface SkillEffect { playerWeak?: number; playerVulnerable?: number; selfBlock?: number; selfStrength?: number; selfRegen?: number; selfHeal?: number; desc?: string }
export const REBIRTH_SKILLS = rebirthData.skills as Record<string, SkillEffect>;
export const REBIRTH_STARTERS = rebirthData.starters as Record<RebirthElement, string[]>;
export const REBIRTH_ELEMENTS: RebirthElement[] = ['金', '木', '水', '火', '土'];
export const REBIRTH_STYLE: Record<RebirthElement, string> = { 金: '锋锐 · 高攻与易伤压制', 木: '回春 · 虚弱控制与回灵续航', 水: '流转 · 攻防一体与抽牌', 火: '爆发 · 高费重击与回能', 土: '厚德 · 重防与祛除负面' };

/** 原重生之门的楼层是 1–10，共同引擎是 0–9。 */
export function regionName(floor: number): string | null { const r = REGIONS.floors[String(floor + 1)]; return r ? REGIONS.names[r] ?? null : null; }

function pick(group: Group, rand: () => number, names?: string[]) {
  const preferred = names?.filter(n => group[n]) ?? [];
  const keys = preferred.length ? preferred : Object.keys(group);
  const key = keys[Math.floor(rand() * keys.length)];
  return { key, monsters: group[key] };
}

/** 与原 dungeon.js 的 decideRoomType 一致：前两层新手怪，之后按区域池，精英按区域池，末层最终守门者。 */
export function pickRoom(kind: NodeKind, floor: number, rand: () => number, fallback?: 'event' | 'space') {
  const y = floor + 1, region = REGIONS.floors[String(y)];
  const names = region ? REGIONS.pools[region] : undefined;
  if (kind === 'boss') return { ...pick(ENCOUNTERS.boss, rand, REGIONS.finalBoss), tier: 'boss' as const };
  if (kind === 'guardian') return { ...pick(ENCOUNTERS.boss, rand, regionBossPool(floor)), tier: 'boss' as const };
  // 事件房、灵质空间抽不到内容时退化为战斗：前 3 层新手怪（原实现事件房这时不标档位，金币按普通房算）。
  if (fallback) return y < 3 ? { ...pick(ENCOUNTERS.easy, rand), tier: fallback === 'event' ? 'normal' as const : 'easy' as const } : { ...pick(ENCOUNTERS.normal, rand, names), tier: 'normal' as const };
  if (kind === 'elite') return { ...pick(ENCOUNTERS.elite, rand, names), tier: 'elite' as const };
  // 原实现：普通战斗房只有第 1 层（y < 2）是新手怪；y < 3 只用于事件房等的兜底。
  return y < 2 ? { ...pick(ENCOUNTERS.easy, rand), tier: 'easy' as const } : { ...pick(ENCOUNTERS.normal, rand, names), tier: 'normal' as const };
}

/** 掷出血量与伤害浮动（原 Monster 的 random 字段：伤害取 damage-random 起的 5 个值之一）。 */
export function spawnEnemies(defs: MonsterDef[], rand: () => number, scale: (hp: number) => number = hp => hp): Enemy[] {
  return defs.map((m, i) => {
    const hp = scale(m.hp[0] + Math.floor(rand() * (m.hp[1] - m.hp[0] + 1)));
    const intents = m.intents.map(it => it.damage && m.spread ? { ...it, damage: it.damage - m.spread + Math.floor(rand() * 5) } : { ...it });
    const e: Enemy = { id: `e${i + 1}`, name: m.name, hp, maxHp: hp, block: 0, weak: 0, poison: 0, vulnerable: 0, intent: 'attack', damage: 0,
      intents, next: 0, phase2: m.phase2 ? m.phase2.map(x => ({ ...x })) : null, phase2Active: false, strength: 0, regen: 0,
      skill: m.skill, element: m.element, resistance: m.resistance, potency: m.potency, quote: m.quote };
    return syncIntent(e);
  });
}

/** 把下一步意图同步到通用的 intent/damage 字段，供界面与通用逻辑读取。 */
export function syncIntent(e: Enemy): Enemy {
  const it = e.intents?.[e.next ?? 0];
  if (it) { e.intent = it.damage ? 'attack' : 'guard'; e.damage = it.damage ?? 0; }
  return e;
}

/** 原「统一衰减」：减益每回合减 1 层（抗性越高减得越多），力量/回灵半衰（能力越高减得越少），每次至少减 1。 */
export function decay(stacks: number, kind: 'debuff' | 'half', resistance = 0, potency = 0) {
  if (stacks <= 0) return 0;
  let base = kind === 'half' ? Math.max(1, Math.floor(stacks / 2)) : Math.min(1, stacks);
  base += kind === 'debuff' ? Math.floor(resistance / 10) : -Math.floor(potency / 10);
  return stacks - Math.max(1, Math.min(base, stacks));
}
