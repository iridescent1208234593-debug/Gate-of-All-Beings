/**
 * 灵境会馆 - 时代体系（eras）纯数据层
 * 三个时代：聚落时代 → 结盟时代 → 会馆时代。
 * 跃迁条件 = 关键研究 + 聚落规模（建筑数） + 叙事/声望达标。
 */
import { getResearch } from './research.js';

/** 时代定义 */
export const ERAS = {
  tribal: {
    id: 'tribal',
    name: '聚落时代',
    desc: '初辟的灵质空间 + 山洞聚落，聚灵阵、灵植种植、土系建筑、木系治疗。',
    keyResearch: null,
    minBuildings: 0,
    minEvents: 0,
    minReputation: 0,
  },
  alliance: {
    id: 'alliance',
    name: '结盟时代',
    desc: '灵质空间扩张，会馆雏形：结界、法器、妖灵传信、人妖外交。',
    keyResearch: 'renyaowaijiao',
    minBuildings: 8,
    minEvents: 5,
    minReputation: 0,
  },
  hall: {
    id: 'hall',
    name: '会馆时代',
    desc: '正式分馆：现代办公 + 传送枢纽：传送阵、信息中枢、全息结界、聚灵工业化。',
    keyResearch: 'chuansongzhen',
    minBuildings: 12,
    minEvents: 0,
    minReputation: 60,
  },
};

export const ERA_MAP = ERAS;

/** 按 id 取时代定义 */
export function getEra(id) {
  return ERAS[id] || null;
}

/** 时代序号（tribal=0, alliance=1, hall=2），用于跃迁判断 */
export function eraIndex(id) {
  const idx = Object.keys(ERAS).indexOf(id);
  return idx < 0 ? 0 : idx;
}

/** 声望上限（0-100） */
export const maxReputation = 100;

/** 时代跃迁条件是否满足（不含前置时代检查） */
export function eraConditionMet(state, eraId) {
  const era = getEra(eraId);
  if (!era) return false;

  if (era.keyResearch && !(state.tech.unlocked || []).includes(era.keyResearch)) return false;
  if (state.buildings.length < era.minBuildings) return false;
  if ((state.stats.eventCount || 0) < era.minEvents) return false;

  if (era.minReputation > 0) {
    const ss = state.relations && state.relations.settlements;
    if (!Array.isArray(ss) || ss.length === 0) return false;
    const best = Math.max(...ss.map((s) => s.reputation || 0));
    if (best < era.minReputation) return false;
  }
  return true;
}

/** 是否可从当前时代跃迁到下一时代（顺次 + 条件） */
export function canAdvance(state) {
  const keys = Object.keys(ERAS);
  const cur = eraIndex(state.era || 'tribal');
  const next = keys[cur + 1];
  if (!next) return false;
  return eraConditionMet(state, next);
}

/** 下一时代 id；无则返回 null */
export function nextEra(state) {
  const keys = Object.keys(ERAS);
  const cur = eraIndex(state.era || 'tribal');
  return keys[cur + 1] || null;
}

/**
 * 时代面板条件明细：返回 [{ key, label, done }]。
 * 供 UI 展示跃迁条件（满足打勾 / 缺失列出），也用于验证脚本纯逻辑校验。
 */
export function eraStatusList(state, eraId) {
  const era = getEra(eraId);
  if (!era) return [];
  const list = [];
  if (era.keyResearch) {
    const r = getResearch(era.keyResearch);
    list.push({
      key: 'research',
      label: `研究「${r ? r.name : era.keyResearch}」`,
      done: (state.tech.unlocked || []).includes(era.keyResearch),
    });
  }
  list.push({
    key: 'buildings',
    label: `建筑数 ≥ ${era.minBuildings}`,
    done: state.buildings.length >= era.minBuildings,
  });
  if (era.minEvents > 0) {
    list.push({
      key: 'events',
      label: `经历事件 ≥ ${era.minEvents}`,
      done: (state.stats && state.stats.eventCount || 0) >= era.minEvents,
    });
  }
  if (era.minReputation > 0) {
    const ss = state.relations && state.relations.settlements;
    const best = Array.isArray(ss) && ss.length ? Math.max(...ss.map((s) => s.reputation || 0)) : 0;
    list.push({
      key: 'reputation',
      label: `人类聚落声望 ≥ ${era.minReputation}`,
      done: best >= era.minReputation,
    });
  }
  return list;
}
