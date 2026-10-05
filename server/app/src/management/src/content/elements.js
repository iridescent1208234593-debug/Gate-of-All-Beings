/**
 * 灵境会馆 - 内容数据层：五行御灵系
 * 纯数据，无逻辑。金木水火土，影响小妖的工作效率与需求衰减。
 */
export const ELEMENTS = [
  { id: 'jin', name: '金', color: '#e8c96a', desc: '锐利攻伐，工作效率提升', workBonus: 1.15, decayBonus: 1.05, restoreBonus: 1.0 },
  { id: 'mu', name: '木', color: '#6ac46a', desc: '生生不息，恢复效率提升', workBonus: 1.0, decayBonus: 1.0, restoreBonus: 1.2 },
  { id: 'shui', name: '水', color: '#5aa9e6', desc: '柔韧变化，灵质汲取增强', workBonus: 1.0, decayBonus: 1.0, restoreBonus: 1.1 },
  { id: 'huo', name: '火', color: '#e66a5a', desc: '炽烈爆发，工作极快但消耗更快', workBonus: 1.3, decayBonus: 1.25, restoreBonus: 1.0 },
  { id: 'tu', name: '土', color: '#c9a86a', desc: '厚重稳固，需求衰减更慢', workBonus: 0.95, decayBonus: 0.8, restoreBonus: 1.0 },
];

export function getElement(id) {
  return ELEMENTS.find((e) => e.id === id) || null;
}
