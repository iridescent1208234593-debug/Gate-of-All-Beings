/**
 * 灵境会馆 - 内容数据层：作物定义
 * 纯数据。growTime: 成熟所需 tick；produce: 成熟收获时的全局资源产出。
 */
export const CROPS = [
  { id: 'linggu', name: '灵谷', color: '#e0c06a', growTime: 60, produce: { food: 6 } },
  { id: 'lingcao', name: '灵草', color: '#6ac46a', growTime: 45, produce: { spirit: 8 } },
];

export const CROP_MAP = Object.fromEntries(CROPS.map((c) => [c.id, c]));

export function getCrop(id) {
  return CROP_MAP[id] || null;
}
