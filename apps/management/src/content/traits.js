/**
 * 灵境会馆 - 内容数据层：性格特质（M9）
 * 纯数据，无逻辑。贴合罗小黑世界观命名的性格特质，
 * 影响工作速度 / 战斗伤害 / 防御 / 需求衰减。
 * workSpeed: 工作速度修正（±）；combatDamage: 战斗伤害修正（±）；
 * defense: 被攻击时额外减伤（0~1）；moodDecayMul: 心情（需求）衰减倍率；
 * needDecay: 按需求 id 的额外衰减倍率（<1 衰减慢，>1 衰减快）。
 */
export const TRAITS = [
  {
    id: 'qinken',
    name: '勤恳',
    desc: '任劳任怨，干活又快又好',
    workSpeed: 0.15,
  },
  {
    id: 'yonglan',
    name: '慵懒',
    desc: '能躺着绝不坐着，但心境平和',
    workSpeed: -0.15,
    moodDecayMul: 0.9,
  },
  {
    id: 'yongmeng',
    name: '勇猛',
    desc: '冲锋陷阵，出手狠辣',
    combatDamage: 0.15,
  },
  {
    id: 'qienuo',
    name: '怯懦',
    desc: '遇事退缩，但格外惜命',
    combatDamage: -0.15,
    defense: 0.15,
  },
  {
    id: 'qinhe',
    name: '亲和',
    desc: '八面玲珑，广结善缘',
    needDecay: { social: 0.8 },
  },
  {
    id: 'gupi',
    name: '孤僻',
    desc: '不喜热闹，独处时心静如水',
    needDecay: { social: 1.25 },
    moodDecayMul: 0.92,
  },
  {
    id: 'linghui',
    name: '灵慧',
    desc: '心思通透，研习术法事半功倍',
    workSpeed: 0.1,
  },
];

export function getTrait(id) {
  return TRAITS.find((t) => t.id === id) || null;
}

/** 随机 1~2 个不重复特质（M9） */
export function randomTraits() {
  const pool = TRAITS.slice();
  const count = 1 + Math.floor(Math.random() * 2); // 1 或 2
  const out = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
  }
  return out;
}
