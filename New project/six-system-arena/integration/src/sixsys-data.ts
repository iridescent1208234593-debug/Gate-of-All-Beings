/* ============================================================================
   sixsys-data.ts — 数据桥（R3）
   ----------------------------------------------------------------------------
   加载站点静态数据（public/sixsys/data/*.json）并提供查询能力：
     · 488 角色六系数值（character_stats.json）
     · 488 套卡组（decks.json）
     · 15 条收集类成就（achievements.json）
     · 六系定义（six-systems.json）

   两种数据来源，优先级：window.SIXSYS_DATA 预注入 > fetch 静态目录。
   全程只读，不写任何数据。
   ============================================================================ */

import {
  SIX_SYSTEM_ORDER,
  TIER_ORDER,
  type AchievementDoc,
  type AnySystemKey,
  type DeckDoc,
  type SixSystemCharacter,
  type SixSystemKey,
  type SixSystemStatsDoc,
  type TierKey,
} from './sixsys-types';

export const SIXSYS_DATA_BASE = '/sixsys/data/';

export interface SixSystemDataBridge {
  stats: SixSystemStatsDoc;
  decks: DeckDoc | null;
  achievements: AchievementDoc | null;
  systems: Record<string, unknown> | null;
  /** 六系 → 角色列表 */
  byElement(key: AnySystemKey): SixSystemCharacter[];
  /** id → 角色 */
  byId(id: number): SixSystemCharacter | undefined;
  /** 战力降序全量 */
  all(): SixSystemCharacter[];
  /** 档位比较（未知档位按 F 处理） */
  tierAtLeast(id: number, min: TierKey): boolean;
  /** 六维取值 [金,木,水,火,土,空间]（0~100，供雷达使用） */
  systemValues(c: SixSystemCharacter): number[];
  /** 主属性计数 */
  elementCounter(): Record<string, number>;
  /** 某角色的卡组 */
  deckOf(id: number): DeckDoc['decks'][number] | undefined;
}

let cache: Promise<SixSystemDataBridge> | null = null;

function fetchJson<T>(name: string): Promise<T | null> {
  if (typeof fetch !== 'function') return Promise.resolve(null);
  return fetch(SIXSYS_DATA_BASE + name, { credentials: 'same-origin' })
    .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
    .catch(() => null);
}

function tierIndex(t: string | undefined): number {
  const i = TIER_ORDER.indexOf((t || 'F') as TierKey);
  return i < 0 ? 0 : i;
}

export function buildBridge(
  stats: SixSystemStatsDoc,
  decks: DeckDoc | null,
  achievements: AchievementDoc | null,
  systems: Record<string, unknown> | null,
): SixSystemDataBridge {
  const byIdMap = new Map<number, SixSystemCharacter>();
  const byElementMap = new Map<string, SixSystemCharacter[]>();
  const ordered = stats.characters.slice().sort((a, b) => b.power - a.power);

  ordered.forEach((c) => {
    byIdMap.set(c.id, c);
    const key = c.element || 'none';
    const bucket = byElementMap.get(key);
    if (bucket) bucket.push(c);
    else byElementMap.set(key, [c]);
  });

  const deckMap = new Map<number, DeckDoc['decks'][number]>();
  (decks?.decks || []).forEach((d) => deckMap.set(d.character_id, d));

  const elementCounter: Record<string, number> = {};
  stats.characters.forEach((c) => {
    const k = c.element || 'none';
    elementCounter[k] = (elementCounter[k] || 0) + 1;
  });

  return {
    stats,
    decks,
    achievements,
    systems,
    all: () => ordered,
    byId: (id) => byIdMap.get(id),
    byElement: (key) => (byElementMap.get(key) || []).slice(),
    tierAtLeast: (id, min) => {
      const c = byIdMap.get(id);
      if (!c) return false;
      return tierIndex(c.tier) >= tierIndex(min);
    },
    systemValues: (c) => systemValuesOf(c),
    elementCounter: () => ({ ...elementCounter }),
    deckOf: (id) => deckMap.get(id),
  };
}

/**
 * 六维取值（站点侧口径，与 arena 的 SixSystemPanel.renderFromRecord 同源简化）：
 *   主系 100 → 第 2 系 78 → 第 3 系 56，其余中性 40；
 *   再按档位（F..A）整体加权 0.72 ~ 1.0，保证强弱角色在雷达上有可见差异。
 */
export function systemValuesOf(c: SixSystemCharacter): number[] {
  const values = SIX_SYSTEM_ORDER.map(() => 40);
  const rank = [100, 78, 56];
  (c.systems || []).forEach((key: SixSystemKey, i: number) => {
    const idx = SIX_SYSTEM_ORDER.indexOf(key);
    if (idx >= 0) values[idx] = rank[Math.min(i, rank.length - 1)];
  });
  const weight = 0.72 + tierIndex(c.tier) * (0.28 / (TIER_ORDER.length - 1));
  return values.map((v) => Math.min(100, Math.round(v * weight)));
}

/** 加载数据（带缓存）。站点可先用 window.SIXSYS_DATA 预注入以避免首屏抖动 */
export function loadSixSystemData(): Promise<SixSystemDataBridge> {
  if (cache) return cache;

  const injected = typeof window !== 'undefined' ? window.SIXSYS_DATA : undefined;
  if (injected?.character_stats) {
    cache = Promise.resolve(
      buildBridge(
        injected.character_stats,
        injected.decks ?? null,
        injected.achievements ?? null,
        null,
      ),
    );
    return cache;
  }

  cache = Promise.all([
    fetchJson<SixSystemStatsDoc>('character_stats.json'),
    fetchJson<DeckDoc>('decks.json'),
    fetchJson<AchievementDoc>('achievements.json'),
    fetchJson<Record<string, unknown>>('six-systems.json'),
  ]).then(([stats, decks, achievements, systems]) => {
    if (!stats) {
      throw new Error('[sixsys] 数据加载失败：/sixsys/data/character_stats.json 不可用');
    }
    return buildBridge(stats, decks, achievements, systems);
  });

  return cache;
}

/** 仅清理内存缓存（不影响任何磁盘数据），用于热更新场景 */
export function resetSixSystemData(): void {
  cache = null;
}

/** 成就进度计算（站点侧展示用；与 achievement-system.js 的判定口径一致） */
export function achievementProgress(
  ach: AchievementDoc,
  owned: Iterable<number>,
  bridge: SixSystemDataBridge,
): { id: string; current: number; target: number; done: boolean }[] {
  const ownedSet = new Set(owned);
  const gate = ach.element_gate || {};
  const minTier = (gate.min_tier || 'D') as TierKey;
  const orCollect = gate.or_collect_per_element || 3;
  const five: SixSystemKey[] = ['jin', 'mu', 'shui', 'huo', 'tu'];

  const gateCovered = five.filter((sys) => {
    const hitTier = [...ownedSet].some((id) => {
      const c = bridge.byId(id);
      return !!c && c.element === sys && tierIndex(c.tier) >= tierIndex(minTier);
    });
    if (hitTier) return true;
    const ownedCount = [...ownedSet].filter((id) => bridge.byId(id)?.element === sys).length;
    return ownedCount >= orCollect;
  }).length;

  return (ach.achievements || []).map((a) => {
    let current = 0;
    if (a.progress.metric === 'elements_c_covered' || a.progress.metric === 'element_tier_gate_met') {
      current = gateCovered;
    } else if (a.condition.type === 'collection_count') {
      current = ownedSet.size;
    } else if (a.condition.type === 'rarity_complete') {
      const rarity = a.condition.rarity as string;
      current = [...ownedSet].filter((id) => bridge.byId(id)?.rarity === rarity).length;
    }
    return { id: a.id, current, target: a.progress.target, done: current >= a.progress.target };
  });
}
