/**
 * 已验收原型的视觉素材索引。坐标、分类和编号用于重现图标及头像选择。
 * 这不是账户/OC 的种族枚举；真实玩家种族单独确认后写入 species_name。
 * 素材编号 r01–r23 只写入 avatar_frame_id。
 */

/** 分类（对应图二顶部那 5 个方块，顺序与设计稿一致） */
export const CATEGORIES = [
  { id: 'mammal', name: '哺乳动物', icon: 'cat-mammal.png' },
  { id: 'bird', name: '鸟类', icon: 'cat-bird.png' },
  { id: 'fish', name: '鱼类', icon: 'cat-fish.png' },
  { id: 'reptile', name: '爬行类', icon: 'cat-reptile.png' },
  { id: 'amphibian', name: '两栖类', icon: 'cat-amphibian.png' },
];

/**
 * 层级配色（从设计稿实测的精确色值）。
 * tier 1 = 浅灰绿，2 = 中灰绿，3 = 橙，4 = 浅米
 */
export const TIER_COLORS = {
  1: '#d1dbd6',
  2: '#a1b89e',
  3: '#f3a82b',
  4: '#faebb1',
};

/** 设计稿画布尺寸，坐标单位为设计稿像素 */
export const TREE_CANVAS = { w: 1064, h: 798 };
export const LIST_CANVAS = { w: 1341, h: 863 };

/**
 * 23 个种族。tree 坐标来自 tools/find-cards.mjs 对图一.png 的实测结果。
 * 顺序按设计稿从上到下、从左到右。
 */
export const RACES = [
  { id: 'r01', name: '种族01', category: 'mammal', tier: 2, icon: 'r01.png', tree: { x: 119, y: 58, w: 100, h: 100 } },
  { id: 'r02', name: '种族02', category: 'mammal', tier: 2, icon: 'r02.png', tree: { x: 233, y: 58, w: 100, h: 100 } },
  { id: 'r03', name: '种族03', category: 'mammal', tier: 2, icon: 'r03.png', tree: { x: 348, y: 58, w: 99, h: 100 } },
  { id: 'r04', name: '种族04', category: 'mammal', tier: 1, icon: 'r04.png', tree: { x: 462, y: 58, w: 99, h: 100 } },
  { id: 'r05', name: '种族05', category: 'mammal', tier: 2, icon: 'r05.png', tree: { x: 576, y: 58, w: 156, h: 157 } },
  { id: 'r06', name: '种族06', category: 'bird', tier: 4, icon: 'r06.png', tree: { x: 747, y: 58, w: 100, h: 100 } },
  { id: 'r07', name: '种族07', category: 'bird', tier: 3, icon: 'r07.png', tree: { x: 861, y: 58, w: 100, h: 100 } },
  { id: 'r08', name: '种族08', category: 'mammal', tier: 1, icon: 'r08.png', tree: { x: 119, y: 172, w: 100, h: 100 } },
  { id: 'r09', name: '种族09', category: 'fish', tier: 1, icon: 'r09.png', tree: { x: 462, y: 172, w: 99, h: 100 } },
  { id: 'r10', name: '种族10', category: 'bird', tier: 3, icon: 'r10.png', tree: { x: 746, y: 172, w: 215, h: 214 } },
  { id: 'r11', name: '种族11', category: 'fish', tier: 1, icon: 'r11.png', tree: { x: 290, y: 201, w: 157, h: 156 } },
  { id: 'r12', name: '种族12', category: 'amphibian', tier: 2, icon: 'r12.png', tree: { x: 576, y: 229, w: 99, h: 100 } },
  { id: 'r13', name: '种族13', category: 'reptile', tier: 1, icon: 'r13.png', tree: { x: 119, y: 286, w: 100, h: 100 } },
  { id: 'r14', name: '种族14', category: 'amphibian', tier: 2, icon: 'r14.png', tree: { x: 576, y: 343, w: 99, h: 100 } },
  { id: 'r15', name: '种族15', category: 'reptile', tier: 2, icon: 'r15.png', tree: { x: 119, y: 400, w: 100, h: 100 } },
  { id: 'r16', name: '种族16', category: 'reptile', tier: 2, icon: 'r16.png', tree: { x: 233, y: 400, w: 100, h: 100 } },
  { id: 'r17', name: '种族17', category: 'reptile', tier: 2, icon: 'r17.png', tree: { x: 348, y: 400, w: 99, h: 100 } },
  { id: 'r18', name: '种族18', category: 'bird', tier: 4, icon: 'r18.png', tree: { x: 747, y: 400, w: 214, h: 214 } },
  { id: 'r19', name: '种族19', category: 'fish', tier: 1, icon: 'r19.png', tree: { x: 519, y: 457, w: 156, h: 157 } },
  { id: 'r20', name: '种族20', category: 'amphibian', tier: 1, icon: 'r20.png', tree: { x: 119, y: 514, w: 157, h: 157 } },
  { id: 'r21', name: '种族21', category: 'amphibian', tier: 2, icon: 'r21.png', tree: { x: 348, y: 514, w: 99, h: 100 } },
  { id: 'r22', name: '种族22', category: 'amphibian', tier: 2, icon: 'r22.png', tree: { x: 348, y: 628, w: 99, h: 100 } },
  { id: 'r23', name: '种族23', category: 'bird', tier: 3, icon: 'r23.png', tree: { x: 860, y: 628, w: 101, h: 100 } },
];

/** 按 id 取种族 */
export function getRace(id) {
  return RACES.find((r) => r.id === id) ?? null;
}

/** 按 id 取分类 */
export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id) ?? null;
}

export default { CATEGORIES, TIER_COLORS, RACES, TREE_CANVAS, LIST_CANVAS, getRace, getCategory };
