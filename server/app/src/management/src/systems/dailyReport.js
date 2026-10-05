/**
 * 灵境会馆 - 模拟子系统：信息中枢日报（dailyReport）
 * xinxizhongshu（信息中枢）建成后，每 REPORT_INTERVAL_TICKS tick 汇总一条灵境要闻
 * （灵质/食物/法器、小妖心情分布、建筑数、声望、进行中远征状态）写入 eventLog。
 * 由 tickReducer 驱动（relations/expedition 之后、randomEvents 之前）。
 */
import { pushLog } from '../core/util.js';
import { hasActiveParty, phaseDuration } from './expedition.js';

export const MODULE = { id: 'dailyReport', name: '信息中枢日报', milestone: 'M3 时代跃迁', enabled: true };

/** 日报生成周期（tick） */
export const REPORT_INTERVAL_TICKS = 100;

/** 信息中枢是否已建成（M7：建造中不触发日报） */
export function hasInfoHub(state) {
  return (state.buildings || []).some(
    (b) => b.buildingId === 'xinxizhongshu' && (b.construction == null || b.construction >= (b.buildTime ?? 0))
  );
}

/** 小妖心情分布：{ green, yellow, red } */
export function moodDistribution(state) {
  const dist = { green: 0, yellow: 0, red: 0 };
  for (const c of state.colonists || []) {
    const m = c.mood || 'yellow';
    if (dist[m] !== undefined) dist[m]++;
  }
  return dist;
}

/** 人类聚落最高声望 */
export function bestReputation(state) {
  const ss = state.relations && state.relations.settlements;
  if (!Array.isArray(ss) || ss.length === 0) return 0;
  return Math.max(...ss.map((s) => s.reputation || 0));
}

/** 进行中远征状态文本（无队/阶段+进度+成员数） */
export function expeditionStatusText(state) {
  const parties = state.expedition?.parties || [];
  if (parties.length === 0) return '无远征队';
  const p = parties[0];
  const phaseName = p.phase === 'travel' ? '行路' : p.phase === 'event' ? '目标事件' : '归途';
  const dur = phaseDuration(p);
  const pct = dur > 0 ? Math.round((p.phaseTicks / dur) * 100) : 0;
  return `「${p.target}」${phaseName} ${pct}%（${p.colonistIds.length} 妖）`;
}

/** 组装日报文本（纯函数，供 UI/验证复用） */
export function buildReport(state) {
  const mood = moodDistribution(state);
  const rep = bestReputation(state);
  return (
    `📋 信息中枢日报：灵质 ${Math.floor(state.resources.spirit)}｜食物 ${Math.floor(state.resources.food)}｜` +
    `法器 ${Math.floor(state.resources.faqi || 0)}｜小妖心情 愉快${mood.green}·一般${mood.yellow}·糟糕${mood.red}` +
    `（共${state.colonists.length}）｜建筑 ${state.buildings.length} 座｜最高声望 ${Math.floor(rep)}｜远征：${expeditionStatusText(state)}`
  );
}

/** tick：仅在有信息中枢时，每 100 tick 生成一条日报 */
export function tick(state) {
  if (!hasInfoHub(state)) return state;
  if (state.tick <= 0 || state.tick % REPORT_INTERVAL_TICKS !== 0) return state;
  return { ...state, eventLog: pushLog(state.eventLog, buildReport(state)) };
}
