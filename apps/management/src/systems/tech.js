/**
 * 灵境会馆 - 模拟子系统：技术（tech）
 * 聚落时代研究：小妖在研究台工作推进研究进度，完成后解锁新建筑。
 */
import { getResearch } from '../content/research.js';
import { round2, pushLog } from '../core/util.js';

export const MODULE = { id: 'tech', name: '研究', milestone: 'M2 研究科技', enabled: true };

/** 开始研究（RESEARCH_START reducer 入口） */
export function start(state, payload) {
  const def = getResearch(payload.researchId);
  if (!def) return state;
  if (state.tech.unlocked.includes(def.id)) return state;
  if (state.tech.researching) return state;
  if (!def.requires.every((rid) => state.tech.unlocked.includes(rid))) return state;

  const resources = { ...state.resources };
  for (const [k, v] of Object.entries(def.cost)) {
    if ((resources[k] ?? 0) < v) return state;
    resources[k] = round2(resources[k] - v);
  }

  return {
    ...state,
    resources,
    tech: { ...state.tech, researching: def.id, progress: 0 },
    eventLog: pushLog(state.eventLog, `开始研究「${def.name}」`),
  };
}

/** 取消研究（CANCEL_RESEARCH reducer 入口，退还 50% 灵质） */
export function cancel(state) {
  if (!state.tech.researching) return state;
  const def = getResearch(state.tech.researching);
  if (!def) return state;

  const resources = { ...state.resources };
  for (const [k, v] of Object.entries(def.cost)) {
    resources[k] = round2((resources[k] ?? 0) + v * 0.5);
  }

  return {
    ...state,
    resources,
    tech: { ...state.tech, researching: null, progress: 0 },
    eventLog: pushLog(state.eventLog, `中止了研究「${def.name}」`),
  };
}

/** tick：有 worker 在研究台时推进研究进度，完成则解锁 */
export function tick(state) {
  if (!state.tech.researching) return state;
  const def = getResearch(state.tech.researching);
  if (!def) return state;

  // 研究台是否已建成且有人工作（M7：建造中研究台不推进研究）
  const table = state.buildings.find(
    (b) => b.buildingId === 'researchTable' && (b.construction == null || b.construction >= (b.buildTime ?? 0))
  );
  const working = table && table.workers && table.workers.length > 0;
  if (!working) return state;

  const progress = state.tech.progress + 1;
  if (progress < def.durationTicks) {
    return { ...state, tech: { ...state.tech, progress } };
  }

  // 完成研究：解锁建筑
  const unlocked = [...state.tech.unlocked, def.id];
  const unlockNames = def.unlocks
    .map((bid) => {
      // 建筑名由 UI 查询，这里直接记研究名即可
      return bid;
    })
    .join('、');
  const logMsg = unlockNames
    ? `研究完成「${def.name}」，解锁：${unlockNames}`
    : `研究完成「${def.name}」`;
  return {
    ...state,
    tech: { unlocked, researching: null, progress: 0 },
    eventLog: pushLog(state.eventLog, logMsg),
  };
}
