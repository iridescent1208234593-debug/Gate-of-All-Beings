/**
 * 灵境会馆 - 模拟子系统：袭击战斗（combat）
 * 敌人潮逐敌人与全员小妖轮战，五行相克结算伤害（见 content/wuxing.js）。
 * M8：小妖出手时按五行释放御灵技能（金芒斩/青木缠/玄水箭/赤焰灼/磐石护），
 *     胜利按敌人 element 掉落不同战利品（食物/法器/灵质）。
 * 小妖 hp 受损但不死亡（最低 1），保证基地持续可玩。
 */
import { ENEMIES } from '../content/enemies.js';
import { damageMultiplier, getSkill } from '../content/wuxing.js';
import { getElement } from '../content/elements.js';
import { traitMods, levelBonus, cultivationName, grantXp } from './colonist.js';
import { round2, pushLog } from '../core/util.js';

export const MODULE = { id: 'combat', name: '战斗', milestone: 'M2 袭击战斗', enabled: true };

/** 小妖基础攻击力 */
const COLONIST_ATTACK = 8;
/** 小妖减伤比例（敌人对小妖的伤害折减） */
const COLONIST_DEFENSE = 0.25;
/** 战斗超时回合：超过仍未清敌 → 判定劫掠失败 */
const MAX_BATTLE_TICKS = 20;
/** 失败（劫掠）损失资源 */
const LOSE_RESOURCES = { spirit: 20, food: 10 };

/** M8 按元素战利品：木掉食物+草药（草药归入食物）、金掉法器碎片、水掉灵质+食物、土掉灵质、火掉法器 */
const LOOT_BY_ELEMENT = {
  mu: { food: 12 },
  jin: { faqi: 3 },
  shui: { spirit: 15, food: 8 },
  tu: { spirit: 20 },
  huo: { faqi: 2 },
};

/** 生成一波敌人（数量随小妖人数增长：1 + ⌊小妖数/3⌋，上限 4；难度影响数量与强度） */
export function spawnWave(state) {
  const settings = state.settings || {};
  const diff = settings.difficulty || 'normal';
  const countMul = diff === 'hard' ? 1 : diff === 'easy' ? -1 : 0;
  const count = Math.min(5, Math.max(1, 1 + Math.floor(state.colonists.length / 3) + countMul));
  const pool = ENEMIES.slice();
  const picked = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

/** 难度系数：敌人 hp/attack 倍率与缴获倍率 */
export function difficultyMods(state) {
  const diff = (state.settings && state.settings.difficulty) || 'normal';
  if (diff === 'easy') return { enemy: 0.8, loot: 0.8 };
  if (diff === 'hard') return { enemy: 1.25, loot: 1.5 };
  return { enemy: 1.0, loot: 1.0 };
}

/** 触发袭击：生成敌人潮，写入 state.combat.threats，进入战斗 */
export function trigger(state) {
  const wave = spawnWave(state);
  const mods = difficultyMods(state);
  const threats = wave.map((ed, i) => ({
    id: `threat-${state.tick}-${i}`,
    enemyId: ed.id,
    name: ed.name,
    element: ed.element,
    hp: Math.round(ed.hp * mods.enemy),
    maxHp: Math.round(ed.hp * mods.enemy),
    attack: Math.round(ed.attack * mods.enemy),
    color: ed.color,
    x: state.space.width / 2,
    y: 1 + i * 2,
    // M8 战斗状态字段：冻结回合数（>0 时跳过攻击）、灼烧剩余 tick 与每 tick 伤害
    freezeTicks: 0,
    burnTicks: 0,
    burnDmg: 0,
  }));
  const combat = {
    threats,
    battles: state.combat ? state.combat.battles : [],
    active: threats.length > 0,
    battleTicks: 0,
    cooldown: state.combat ? state.combat.cooldown : 0,
    // M8 磐石护：盾值 + 剩余生效轮数（>0 时抵挡一轮敌人攻击后清空）
    shieldValue: 0,
    shieldTicks: 0,
  };
  return {
    ...state,
    combat,
    eventLog: pushLog(
      state.eventLog,
      `妖灵滋扰！${threats.map((t) => t.name).join('、')} 冲进了灵质空间`
    ),
  };
}

/** tick：推进战斗（无敌人时仅递减冷却） */
export function tick(state) {
  const cur = state.combat || { threats: [], battles: [], cooldown: 0 };
  let combat = { ...cur, cooldown: Math.max(0, (cur.cooldown || 0) - 1) };
  if (!combat.threats || combat.threats.length === 0) {
    if (combat.active && combat.battleTicks > 0) {
      // 敌人已清空但胜利结算未发生（理论上不会出现，兜底）
      combat = { ...combat, active: false };
    }
    return { ...state, combat };
  }
  return runBattle(state, combat);
}

/** 执行一轮战斗：灼烧结算 → 敌人先手伤小妖 → 小妖以五行御灵技合击敌人 */
function runBattle(state, combat) {
  const battleTicks = combat.battleTicks + 1;
  let resources = { ...state.resources };
  let stats = { ...state.stats };
  let threats = combat.threats.slice();
  let colonists = state.colonists.slice();
  let eventLog = state.eventLog;

  // 0) 灼烧结算：赤焰灼 dot 每 tick 掉血
  let burnLog = null;
  threats = threats.map((t) => {
    if (t.hp <= 0 || t.burnTicks <= 0) return t;
    const hp = round2(Math.max(0, t.hp - (t.burnDmg || 0)));
    burnLog = `「${t.name}」被赤焰灼烧，-${t.burnDmg}`;
    return { ...t, hp, burnTicks: t.burnTicks - 1 };
  });
  if (burnLog) eventLog = pushLog(eventLog, burnLog);
  // 灼烧后死亡的敌人直接计入击杀
  const burnedDead = threats.filter((t) => t.hp <= 0);
  if (burnedDead.length > 0) {
    stats = { ...stats, enemiesSlain: (stats.enemiesSlain || 0) + burnedDead.length };
    threats = threats.filter((t) => t.hp > 0);
  }

  // 1) 每个存活敌人攻击一只小妖（冻结则跳过；磐石护减伤）
  let shieldLog = null;
  for (const t of threats) {
    if (t.hp <= 0) continue;
    if (t.freezeTicks > 0) {
      eventLog = pushLog(eventLog, `「${t.name}」被玄水箭冻结，本回合无法攻击`);
      threats = threats.map((tt) =>
        tt.id === t.id ? { ...tt, freezeTicks: tt.freezeTicks - 1 } : tt
      );
      continue;
    }
    const target = pickTarget(colonists);
    if (!target) continue;
    const mul = damageMultiplier(t.element, target.element);
    let dmg = Math.max(1, Math.round(t.attack * mul * (1 - COLONIST_DEFENSE)));
    // M9 怯懦等特质防御：被攻击时额外减伤
    const tmodsT = traitMods(target);
    if (tmodsT.defense > 0) {
      dmg = Math.max(1, Math.round(dmg * (1 - tmodsT.defense)));
    }
    // 土系磐石护：本回合全队减伤（挡一轮后清空）
    if (combat.shieldTicks > 0 && combat.shieldValue > 0) {
      dmg = Math.max(1, Math.round(dmg * (1 - combat.shieldValue)));
      shieldLog = '磐石护 化为山岩护住全队，伤害减免';
    }
    colonists = colonists.map((c) =>
      c.id === target.id ? { ...c, hp: Math.max(1, round2(c.hp - dmg)) } : c
    );
  }
  if (shieldLog) {
    eventLog = pushLog(eventLog, shieldLog);
    combat = { ...combat, shieldTicks: 0, shieldValue: 0 };
  }

  // 2) 小妖以五行御灵技对每个存活敌人合击
  let hasShieldThisRound = false;
  for (const t of threats) {
    if (t.hp <= 0) continue;
    let dmg = 0;
    let skillNames = [];
    for (const c of colonists) {
      const el = getElement(c.element);
      const skill = getSkill(c.element);
      const moodMul = c.mood === 'green' ? 1.2 : c.mood === 'yellow' ? 1.0 : 0.7;
      const mul = damageMultiplier(c.element, t.element);
      const skillMult = skill ? skill.mult : 1;
      // M9 修为等级（每级 +3%）与特质 combatDamage 影响战斗伤害
      const tmodsC = traitMods(c);
      const lvBonus = levelBonus((c.cultivation && c.cultivation.level) || 1);
      dmg += COLONIST_ATTACK * el.workBonus * moodMul * mul * skillMult * lvBonus * (1 + tmodsC.combatDamage);
      // M9 参与回合结算经验 +1
      const grant1 = grantXp(c, 1);
      colonists = colonists.map((cc) => (cc.id === c.id ? grant1.colonist : cc));
      if (grant1.upgraded) {
        eventLog = pushLog(
          eventLog,
          `${c.name} 修为突破至 ${cultivationName(c.element, grant1.newLevel)}`
        );
      }
      if (skill) skillNames.push(skill.name);
      // 木系青木缠：回复自身 hp
      if (skill && skill.healSelf) {
        colonists = colonists.map((cc) =>
          cc.id === c.id
            ? { ...cc, hp: Math.min(cc.maxHp ?? 100, round2(cc.hp + skill.healSelf)) }
            : cc
        );
      }
      // 水系玄水箭：概率冻结敌人（令其下一次攻击跳过）
      if (skill && skill.freezeChance && Math.random() < skill.freezeChance) {
        threats = threats.map((tt) =>
          tt.id === t.id ? { ...tt, freezeTicks: Math.max(tt.freezeTicks || 0, 1) } : tt
        );
        eventLog = pushLog(eventLog, `玄水箭 冻结了「${t.name}」！`);
      }
      // 火系赤焰灼：附加灼烧 dot（不叠加，仅刷新）
      if (skill && skill.burnTicks) {
        threats = threats.map((tt) =>
          tt.id === t.id && (!tt.burnTicks || tt.burnTicks <= 0)
            ? { ...tt, burnTicks: skill.burnTicks, burnDmg: skill.burnDmg || 0 }
            : tt
        );
      }
      // 土系磐石护：为全队本回合减伤（下一轮敌人攻击时生效）
      if (skill && skill.shield) {
        hasShieldThisRound = true;
      }
    }
    threats = threats.map((tt) =>
      tt.id === t.id ? { ...tt, hp: round2(Math.max(0, tt.hp - dmg)) } : tt
    );
    // 击杀日志：带技能名（取最先出手的小妖）
    const killed = threats.find((tt) => tt.id === t.id && tt.hp <= 0);
    if (killed) {
      const killer = colonists[0];
      if (killer && skillNames.length > 0) {
        const skillName = skillNames[0];
        eventLog = pushLog(eventLog, `${killer.name} 以${skillName} 击退 ${t.name}`);
      }
      // M9 击杀结算经验 +3
      if (killer) {
        const g = grantXp(killer, 3);
        colonists = colonists.map((cc) => (cc.id === killer.id ? g.colonist : cc));
        if (g.upgraded) {
          eventLog = pushLog(
            eventLog,
            `${killer.name} 修为突破至 ${cultivationName(killer.element, g.newLevel)}`
          );
        }
      }
    }
  }
  if (hasShieldThisRound) {
    combat = { ...combat, shieldValue: 0.3, shieldTicks: 1 };
  }

  const dead = threats.filter((t) => t.hp <= 0);
  const alive = threats.filter((t) => t.hp > 0);
  if (dead.length > 0) {
    stats = { ...stats, enemiesSlain: (stats.enemiesSlain || 0) + dead.length };
  }

  if (alive.length === 0) {
    // 胜利结算：按敌人 element 掉落战利品（受难度倍率影响）
    const mods = difficultyMods(state);
    const loots = {};
    for (const t of dead) {
      const table = LOOT_BY_ELEMENT[t.element] || {};
      for (const [k, v] of Object.entries(table)) {
        loots[k] = (loots[k] || 0) + v;
      }
    }
    let lootLogParts = [];
    for (const [k, v] of Object.entries(loots)) {
      const amount = Math.round(v * mods.loot);
      if (amount <= 0) continue;
      resources[k] = round2((resources[k] || 0) + amount);
      stats.loot = { ...(stats.loot || {}), [k]: (stats.loot?.[k] || 0) + amount };
      const label = k === 'spirit' ? '灵质' : k === 'food' ? '食物' : k === 'faqi' ? '法器' : k;
      lootLogParts.push(`${label}+${amount}`);
    }
    const lootDesc = lootLogParts.length > 0 ? `，战利品：${lootLogParts.join('、')}` : '';
    stats = { ...stats, battlesWon: (stats.battlesWon || 0) + 1 };
    combat = { ...combat, threats: [], active: false, battleTicks, cooldown: 40, shieldTicks: 0, shieldValue: 0 };
    eventLog = pushLog(eventLog, `击退了妖灵！${lootDesc}`);
    return { ...state, combat, resources, stats, colonists, eventLog };
  }

  // 超时仍未清敌 → 妖灵劫掠（失败）：扣资源，敌人撤退
  if (battleTicks >= MAX_BATTLE_TICKS) {
    for (const [k, v] of Object.entries(LOSE_RESOURCES)) {
      resources[k] = round2(Math.max(0, resources[k] - v));
    }
    stats = { ...stats, battlesLost: (stats.battlesLost || 0) + 1 };
    combat = { ...combat, threats: [], active: false, battleTicks, cooldown: 0, shieldTicks: 0, shieldValue: 0 };
    eventLog = pushLog(eventLog, '妖灵劫掠一番后撤退，损失灵质20、食粮10！');
    return { ...state, combat, resources, stats, colonists, eventLog };
  }

  return { ...state, combat: { ...combat, threats: alive, battleTicks }, resources, stats, colonists, eventLog };
}

/** 选取被攻击的小妖（优先挑 hp 最高的，分摊伤害） */
function pickTarget(colonists) {
  if (colonists.length === 0) return null;
  let best = colonists[0];
  for (const c of colonists) {
    if ((c.hp ?? 100) > (best.hp ?? 100)) best = c;
  }
  return best;
}
