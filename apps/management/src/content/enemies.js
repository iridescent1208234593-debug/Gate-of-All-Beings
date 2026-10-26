/**
 * 灵境会馆 - 内容数据层：敌方妖精
 * 纯数据。闯入会馆的妖物，五行属性参与相克伤害计算。
 * 注意：土克木、火克金…伤害倍率由 src/content/wuxing.js 统一结算。
 */
export const ENEMIES = [
  {
    id: 'mushi',
    name: '木兕',
    element: 'mu',
    hp: 60,
    attack: 6,
    color: '#4f9d5a',
    desc: '凶悍的木系妖兕，皮糙肉厚，误食灵质苔藓后发狂，土行可镇',
  },
  {
    id: 'shiyaohuan',
    name: '石妖獾',
    element: 'tu',
    hp: 80,
    attack: 5,
    color: '#b3a58a',
    desc: '身披岩甲的獾妖，厚重难破，据说是被灵质浸染的山石所化',
  },
  {
    id: 'yaomianzhu',
    name: '妖面蛛',
    element: 'shui',
    hp: 40,
    attack: 8,
    color: '#6aa7d9',
    desc: '背生妖脸的巨蛛，迅捷带毒，藏身灵质水潭边伺机偷袭',
  },
  {
    id: 'langyao',
    name: '狼妖',
    element: 'jin',
    hp: 70,
    attack: 7,
    color: '#c9c9c9',
    desc: '人妖共存的乱世中啸月修行的银狼妖，爪牙锋利如刀',
  },
  {
    id: 'chiyanmei',
    name: '赤焰魅',
    element: 'huo',
    hp: 55,
    attack: 9,
    color: '#e66a5a',
    desc: '灵质污染中诞生的火魅，通体赤焰，灼人灵脉，越战越烈',
  },
  {
    id: 'liujinhu',
    name: '鎏金虎',
    element: 'jin',
    hp: 75,
    attack: 8,
    color: '#e8c96a',
    desc: '披着鎏金纹路的虎妖，金行灵质淬体，爪下生风，百兽辟易',
  },
];

export const ENEMY_MAP = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

export function getEnemy(id) {
  return ENEMY_MAP[id] || null;
}
