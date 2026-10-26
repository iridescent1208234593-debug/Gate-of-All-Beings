/**
 * 灵境会馆 - 内容数据层：小妖定义与初始模板
 * 纯数据。初始小妖按五行各一只。
 */
export const COLONIST_TEMPLATES = [
  { name: '阿金', element: 'jin', maxHp: 100 },
  { name: '小木', element: 'mu', maxHp: 100 },
  { name: '流流', element: 'shui', maxHp: 100 },
  { name: '焰仔', element: 'huo', maxHp: 100 },
  { name: '垚垚', element: 'tu', maxHp: 100 },
];

export const EXTRA_NAMES = ['阿土', '灵灵', '眠眠', '团团', '豆豆', '滚滚'];

export const INITIAL_COLONISTS = 5;

/** 小妖状态机状态 */
export const COLONIST_STATES = {
  IDLE: 'idle',
  WORKING: 'working',
  EATING: 'eating',
  MOVING: 'moving',
  SLEEPING: 'sleeping',
};
