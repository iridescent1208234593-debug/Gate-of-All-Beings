/**
 * 评级规则（六大系数值 → 评级 / 综合战力）
 *
 * 设计约束（见 docs/01-六大系数值方案.md）：
 *  1) 单系分值域固定 0..100，便于跨角色比较与 UI 归一化。
 *  2) 评级不看「六系总分」，避免「多修一系白送分」；改用加权基准分
 *     composite = peak*0.5 + average*0.3 + secondary*0.2（见 POWER_WEIGHTS）。
 *  3) 专精度（focus）与均衡度（balance）作为独立维度保留，
 *     让「老君式全能」与「小黑式双专精」在对战、卡组分配中呈现不同风味。
 */

import { SIX_SYSTEM_IDS } from './six-systems.js';
import { realmOrder } from './realms.js';

/** 单系分值上下限 */
export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

/** 评级表：按六系均分判定 */
export const GRADES = Object.freeze([
  Object.freeze({ id: 'S', name: '绝品', min: 85, color: '#b03a2e', stars: 5 }),
  Object.freeze({ id: 'A', name: '上品', min: 70, color: '#c8963c', stars: 4 }),
  Object.freeze({ id: 'B', name: '良品', min: 55, color: '#7a9a6a', stars: 3 }),
  Object.freeze({ id: 'C', name: '中品', min: 38, color: '#5b7fa8', stars: 2 }),
  Object.freeze({ id: 'D', name: '下品', min: 20, color: '#8a7f5c', stars: 1 }),
  Object.freeze({ id: 'E', name: '微末', min: 0, color: '#9aa5a0', stars: 0 }),
]);

/** 综合战力权重 */
export const POWER_WEIGHTS = Object.freeze({
  peak: 0.42, // 最强一系：决定上限
  average: 0.38, // 六系均分：决定稳定性
  secondary: 0.2, // 次强一系：决定第二手牌
});

export function clampScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(n)));
}

/** 由「评级基准分」取评级 */
export function gradeOf(composite) {
  for (const g of GRADES) {
    if (composite >= g.min) return g;
  }
  return GRADES[GRADES.length - 1];
}

/** 评级基准分：composite = peak*0.5 + average*0.3 + secondary*0.2 */
export function compositeOf(systems) {
  const list = SIX_SYSTEM_IDS.map((id) => clampScore(systems?.[id] ?? 0));
  const total = list.reduce((s, x) => s + x, 0);
  const average = total / SIX_SYSTEM_IDS.length;
  const sorted = [...list].sort((a, b) => b - a);
  return sorted[0] * POWER_WEIGHTS.peak + average * POWER_WEIGHTS.average + sorted[1] * POWER_WEIGHTS.secondary;
}

/** 单系分值的档位（用于徽章着色） */
export function scoreTierOf(score) {
  if (score >= 85) return 'S';
  if (score >= 70) return 'A';
  if (score >= 55) return 'B';
  if (score >= 38) return 'C';
  if (score >= 20) return 'D';
  return 'E';
}

/**
 * 由六系分值计算完整评级。
 * @param {Record<string, number>} systems 形如 {yuling: 88, ...}
 * @param {{realm?: string}} [options]
 */
export function computeRating(systems, options = {}) {
  const list = SIX_SYSTEM_IDS.map((id) => ({ id, score: clampScore(systems?.[id] ?? 0) }));
  const total = list.reduce((s, x) => s + x.score, 0);
  const average = total / SIX_SYSTEM_IDS.length;
  const sorted = [...list].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const peak = sorted[0];
  const secondary = sorted[1];
  const variance =
    list.reduce((s, x) => s + (x.score - average) ** 2, 0) / SIX_SYSTEM_IDS.length;
  const stdev = Math.sqrt(variance);
  // 均衡度：标准差 0 → 1.0；标准差 ≥ 40 → 0
  const balance = Math.max(0, Math.min(1, 1 - stdev / 40));
  const focus = peak.score - average;
  const realmBonus = Math.max(0, realmOrder(options.realm)) * 2;
  const composite =
    peak.score * POWER_WEIGHTS.peak +
    average * POWER_WEIGHTS.average +
    secondary.score * POWER_WEIGHTS.secondary;
  const power = Math.min(150, Math.round(composite + realmBonus));
  const grade = gradeOf(composite);

  return Object.freeze({
    total,
    average: Math.round(average * 10) / 10,
    peak: peak.score,
    peakSystem: peak.id,
    secondary: secondary.score,
    secondarySystem: secondary.id,
    stdev: Math.round(stdev * 10) / 10,
    balance: Math.round(balance * 100) / 100,
    focus: Math.round(focus * 10) / 10,
    composite: Math.round(composite * 10) / 10,
    power,
    realmBonus,
    grade: grade.id,
    gradeName: grade.name,
    gradeColor: grade.color,
    stars: grade.stars,
    systems: Object.freeze(list),
  });
}

/** 供 UI 使用的评级色 */
export function gradeColorOf(gradeId) {
  const g = GRADES.find((x) => x.id === gradeId);
  return g ? g.color : GRADES[GRADES.length - 1].color;
}
