/**
 * 灵境会馆 - 内容数据层：五行相克
 * 纯数据。金克木、木克土、土克水、水克火、火克金。
 * 用于战斗伤害倍率计算（content 内独立存放，供 systems/combat.js 复用）。
 */
export const ELEMENTS_FIVE = ['jin', 'mu', 'shui', 'huo', 'tu'];

/** 相克表：key 克制 value */
export const ELEMENT_COUNTERS = {
  jin: 'mu', // 金克木
  mu: 'tu', // 木克土
  tu: 'shui', // 土克水
  shui: 'huo', // 水克火
  huo: 'jin', // 火克金
};

/** 克制/被克 的伤害倍率（克制放大，被克缩小） */
export const COUNTER_MULT = 1.5;

/**
 * 计算攻击者对防御者的五行伤害倍率：
 * 攻击者克制防御者 → 1.5x；攻击者被防御者克制 → 1/1.5 ≈ 0.67；否则 1.0。
 */
export function damageMultiplier(attackerElement, defenderElement) {
  if (ELEMENT_COUNTERS[attackerElement] === defenderElement) return COUNTER_MULT;
  if (ELEMENT_COUNTERS[defenderElement] === attackerElement) return 1 / COUNTER_MULT;
  return 1;
}

/** 判断 attacker 是否克制 defender */
export function isCounterOf(attackerElement, defenderElement) {
  return ELEMENT_COUNTERS[attackerElement] === defenderElement;
}

/**
 * 五行御兽诀 —— 小妖战斗技能（M8 五行御灵战斗）
 * 每个五行属性一个技能，由 systems/combat.js 在小妖出手时按 c.element 选取。
 * 效果字段：mult 伤害倍率 / healSelf 攻击后回复自身 hp / freezeChance 对敌人冰冻忽略本回合攻击 / burnTicks+burnDmg 灼烧dot / shield 全队减伤
 */
export const SKILLS = {
  jin: {
    name: '金芒斩',
    mult: 1.3,
    desc: '锐利金光化为刀芒，贯穿防御，破防有力。',
  },
  mu: {
    name: '青木缠',
    mult: 1.0,
    healSelf: 6,
    desc: '青藤缠身而上，汲取木行元气，回春疗愈自身。',
  },
  shui: {
    name: '玄水箭',
    mult: 1.2,
    freezeChance: 0.4,
    desc: '极寒玄水化为箭射，有机会将敌人冻结在原地。',
  },
  huo: {
    name: '赤焰灼',
    mult: 1.2,
    burnTicks: 3,
    burnDmg: 2,
    desc: '赤焰浑身体而上，除了瞬间爆发，还会灼烧敌人。',
  },
  tu: {
    name: '磐石护',
    mult: 0.8,
    shield: 0.3,
    desc: '土行符化为山岩护体，队伍在本回合免受部分伤害。',
  },
};

/** 获取小妖的战斗技能（无找到返回空值） */
export function getSkill(element) {
  return SKILLS[element] || null;
}
