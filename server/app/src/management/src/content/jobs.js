/**
 * 灵境会馆 - 内容数据层：工作定义
 * 需求 → 工作 → 建筑 的映射关系（纯数据）。
 */
export const JOBS = [
  { id: 'spirit', label: '汲取灵质', workAt: ['altar'], need: 'spirit' },
  { id: 'cook', label: '烹制灵食', workAt: ['kitchen'], need: 'food' },
  { id: 'rest', label: '回窝睡觉', workAt: ['hut'], need: 'sleep' },
  { id: 'social', label: '围炉夜谈', workAt: ['campfire'], need: 'social' },
  { id: 'patrol', label: '巡视领地', workAt: ['totem'], need: 'territory' },
];

export const JOB_MAP = Object.fromEntries(JOBS.map((j) => [j.id, j]));

export function getJob(id) {
  return JOB_MAP[id] || null;
}
