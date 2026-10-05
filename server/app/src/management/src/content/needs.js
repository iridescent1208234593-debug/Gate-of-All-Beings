/**
 * 灵境会馆 - 内容数据层：需求定义
 * 小妖的五条需求条：灵质 / 饱食 / 睡眠 / 社交 / 领地感
 * decay: 每 tick 衰减值（基准，受五行 decayBonus 修正）
 * weight: 心情计算权重
 */
export const NEEDS = [
  { id: 'spirit', name: '灵质', icon: '✦', decay: 0.10, weight: 1.0 },
  { id: 'food', name: '饱食', icon: '🍙', decay: 0.16, weight: 1.2 },
  { id: 'sleep', name: '睡眠', icon: '🌙', decay: 0.13, weight: 1.1 },
  { id: 'social', name: '社交', icon: '💬', decay: 0.09, weight: 0.9 },
  { id: 'territory', name: '领地感', icon: '🏔', decay: 0.08, weight: 0.8 },
];

export const NEED_MAP = Object.fromEntries(NEEDS.map((n) => [n.id, n]));

/** 需求 -> 对应工作类型（无建筑匹配时） */
export const NEED_TO_WORK = {
  spirit: 'spirit',
  food: 'cook',
  sleep: 'rest',
  social: 'social',
  territory: 'patrol',
};

/**
 * 心情分档：红黄绿脸
 * moodScore = 需求加权平均（0-100）
 */
export const MOOD_LEVELS = [
  { max: 40, mood: 'red', label: '糟糕' },
  { max: 70, mood: 'yellow', label: '一般' },
  { max: Infinity, mood: 'green', label: '愉快' },
];

export function getMood(score) {
  for (const lv of MOOD_LEVELS) {
    if (score < lv.max) return lv;
  }
  return MOOD_LEVELS[MOOD_LEVELS.length - 1];
}

export function createNeeds(initial = 90) {
  const needs = {};
  for (const n of NEEDS) needs[n.id] = initial;
  return needs;
}
