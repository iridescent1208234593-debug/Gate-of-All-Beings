/**
 * 灵境会馆 - 模拟子系统：随机事件（randomEvents）
 * 每 tick 按 weight 概率触发世界事件：buff/debuff/attack/neutral。
 * 事件触发后写入 state.events（带剩余 duration 的驻留列表），持续型 debuff 逐 tick 结算；
 * attack 型直接调起 systems/combat.js 的 trigger 生成敌人潮。
 */
import { EVENTS, getEvent } from '../content/events.js';
import { NEEDS } from '../content/needs.js';
import { getElement } from '../content/elements.js';
import { round2, clamp, pushLog } from '../core/util.js';
import * as combat from './combat.js';

/** 每 tick 事件触发概率（4 tick/秒 * 0.012 ≈ 每 20s 约一次事件） */
const TRIGGER_CHANCE = 0.012;
/** attack 型事件触发后需要等待的冷却 tick（避免袭击叠加） */
const ATTACK_COOLDOWN = 40;
/** 事件频率系数：low 0.5x / normal 1x / high 2x（M5） */
const FREQ_MULT = { low: 0.5, normal: 1.0, high: 2.0 };

export const MODULE = { id: 'randomEvents', name: '随机事件', milestone: 'M2 随机事件', enabled: true };

/** 派发事件（供 Action / 测试：强制定点触发某事件） */
export function trigger(state, payload) {
  const def = getEvent(payload && payload.eventId);
  if (!def) return state;
  return applyEvent(state, def);
}

/** tick：结算驻留事件 + 概率触发新事件 */
export function tick(state) {
  let s = { ...state };

  // 1) 结算已在 state.events 中驻留的事件（持续型 debuff），逐 tick 递减 duration
  if (s.events && s.events.length > 0) {
    const survivors = [];
    for (const ev of s.events) {
      const def = getEvent(ev.id);
      if (def && def.effect && def.effect.needMulAll) {
        s = applyEveryTick(s, def);
      }
      const left = ev.duration - 1;
      if (left > 0) {
        survivors.push({ ...ev, duration: left });
      } else if (def) {
        s = withLog(s, `「${def.name}」的影响消散了`);
      }
    }
    s = { ...s, events: survivors };
  }

  // 2) 概率触发新事件（attack 需等待冷却；已建成结界石/结界塔降低袭击概率；受频率设置影响）
  const hasJieshishi = s.buildings.some(
    (b) => b.buildingId === 'jieshishi' && (b.construction == null || b.construction >= (b.buildTime ?? 0))
  );
  const hasJietata = s.buildings.some(
    (b) => b.buildingId === 'jietata' && (b.construction == null || b.construction >= (b.buildTime ?? 0))
  );
  const freqMult = FREQ_MULT[(s.settings && s.settings.eventFrequency) || 'normal'] ?? 1.0;
  let chance = TRIGGER_CHANCE * freqMult;
  if (hasJieshishi) chance *= 0.5;
  if (hasJietata) chance *= 0.5;
  if (Math.random() < chance) {
    const cooldown = (s.combat && s.combat.cooldown) || 0;
    const def = pickEvent(cooldown <= 0);
    if (def) s = applyEvent(s, def);
  }

  return s;
}

/** 按权重从事件池抽一个（attackOnly === false 时允许 attack 型） */
function pickEvent(allowAttack) {
  const pool = allowAttack
    ? EVENTS
    : EVENTS.filter((e) => e.type !== 'attack');
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  for (const e of pool) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return pool[pool.length - 1];
}

/** 触发 / 应用一个事件 */
function applyEvent(state, def) {
  let s = withLog(state, `【${def.name}】${def.desc}`);
  s.stats = { ...s.stats, eventCount: (s.stats.eventCount || 0) + 1 };

  if (def.type === 'attack' || (def.effect && def.effect.triggerAttack)) {
    return combat.trigger({ ...s, combat: { ...s.combat, cooldown: ATTACK_COOLDOWN } });
  }

  if (def.duration > 0) {
    // 持续型：写入 state.events 驻留，并立即生效首个 tick
    s = { ...s, events: [...(s.events || []), { id: def.id, duration: def.duration }] };
    s = applyEveryTick(s, def);
  } else {
    // 一次性：立即结算
    s = applyOnce(s, def);
  }
  return s;
}

/** 一次性结算：资源增减 / 全员需求增减 */
function applyOnce(state, def) {
  let s = { ...state };
  const resources = { ...s.resources };
  if (def.effect.resource) {
    for (const [k, v] of Object.entries(def.effect.resource)) {
      resources[k] = round2((resources[k] || 0) + v);
    }
  }
  let mutatedNeeds = false;
  const colonists = s.colonists.map((c) => {
    if (!def.effect.needAll) return c;
    mutatedNeeds = true;
    const needs = { ...c.needs };
    for (const [k, v] of Object.entries(def.effect.needAll)) {
      needs[k] = clamp(round2(needs[k] + v), 0, 100);
    }
    return { ...c, needs };
  });
  return { ...s, resources, colonists: mutatedNeeds ? colonists : s.colonists };
}

/** 持续型结算（tick 级）：需求衰减倍率——如睡眠衰减翻倍，即每 tick 额外扣一次衰减量 */
function applyEveryTick(state, def) {
  const mulAll = def.effect && def.effect.needMulAll;
  if (!mulAll) return state;
  const colonists = state.colonists.map((c) => {
    const el = getElement(c.element);
    const needs = { ...c.needs };
    for (const [k, mul] of Object.entries(mulAll)) {
      const nd = NEEDS.find((n) => n.id === k);
      if (!nd || mul <= 1) continue;
      const extra = round2(nd.decay * el.decayBonus * (mul - 1));
      needs[k] = Math.max(0, round2(needs[k] - extra));
    }
    return { ...c, needs };
  });
  return { ...state, colonists };
}

/** 追加日志（纯函数） */
function withLog(state, msg) {
  return { ...state, eventLog: pushLog(state.eventLog, msg) };
}
