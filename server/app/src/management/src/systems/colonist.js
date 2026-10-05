/**
 * 灵境会馆 - 模拟子系统：小妖（colonist）
 * 五行御灵系小妖：需求条（灵质/饱食/睡眠/社交/领地感）衰减、
 * 心情红黄绿脸计算、状态机（idle/moving/working/eating）、工作完成产出。
 */
import { getElement } from '../content/elements.js';
import { NEEDS, createNeeds, getMood } from '../content/needs.js';
import { getBuilding } from '../content/buildings.js';
import { EXTRA_NAMES, COLONIST_STATES } from '../content/colonists.js';
import { LORE_CHARACTERS } from '../content/loreCharacters.js';
import { getTrait, randomTraits } from '../content/traits.js';
import { round2, clamp, pushLog, isNight } from '../core/util.js';
import * as spiritSpace from './spiritSpace.js';
import * as farming from './farming.js';
import * as crafting from './crafting.js';
import * as building from './building.js';
import { boostReputation } from './relations.js';

/** 需求低于该阈值才派活 */
export const WORK_THRESHOLD = 55;
/** 自动进食阈值 */
export const EAT_THRESHOLD = 25;
/** 心情对工作效率的倍率 */
const MOOD_SPEED = { green: 1.2, yellow: 1.0, red: 0.6 };

/** 精神状态：正常 / 敌对 / 抑郁 / 生病（M5 负面状态） */
export const MENTAL_STATES = {
  NORMAL: 'normal',
  HOSTILE: 'hostile',
  DEPRESSED: 'depressed',
  SICK: 'sick',
};

/** 心情红（moodScore < 40）时每 tick 转敌对的概率 */
const HOSTILE_CHANCE = 0.05;
/** 心情红且极低（< 25）时每 tick 转抑郁的概率 */
const DEPRESSED_CHANCE = 0.04;
/** 生病时每 tick 掉血 */
const SICK_DRAIN = 0.6;
/** 心情恢复阈值：>= 60 时敌对/抑郁恢复 */
const MENTAL_RECOVER_SCORE = 60;
/** 生病恢复阈值：hp > 50 时恢复 */
const SICK_RECOVER_HP = 50;
/** 生病触发阈值：hp < 30 */
const SICK_TRIGGER_HP = 30;

// ---------- M9 修为系统 ----------
/** 修为等级上限 */
export const MAX_LEVEL = 10;
/** 升到下一级所需 xp（1→2 需 10，9→10 需 90） */
export function xpForNext(level) {
  return 10 * level;
}
/** 修为等级效果：每级工作产出/进度或战斗伤害 +3% */
export function levelBonus(level) {
  return 1 + 0.03 * ((level || 1) - 1);
}
/** 五行修为称谓：金行一阶 ~ 土行十阶 */
export function cultivationName(element, level) {
  const elName = (getElement(element) || {}).name || element;
  const rank = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][(level || 1) - 1] || String(level);
  return `${elName}行${rank}阶`;
}
/** 工作完成经验（按 workType 结算，未列出的给默认 5） */
export const WORK_XP = {
  build: 6,
  farm: 6,
  research: 8,
  forge: 7,
  diplomacy: 7,
  craft: 8, // R1 合成
  gather: 5, // R1 采集
  spirit: 4,
  cook: 4,
  rest: 1,
  social: 3,
  patrol: 4,
};
/** 特质修正聚合：workSpeed / combatDamage / defense / moodDecayMul / needDecay */
export function traitMods(c) {
  const mods = { workSpeed: 0, combatDamage: 0, defense: 0, moodDecayMul: 1, needDecay: {} };
  for (const id of c.traits || []) {
    const t = getTrait(id);
    if (!t) continue;
    mods.workSpeed += t.workSpeed || 0;
    mods.combatDamage += t.combatDamage || 0;
    mods.defense += t.defense || 0;
    mods.moodDecayMul *= t.moodDecayMul || 1;
    for (const [k, v] of Object.entries(t.needDecay || {})) {
      mods.needDecay[k] = (mods.needDecay[k] || 1) * v;
    }
  }
  return mods;
}
/** 给修为加经验并处理升级（返回 { colonist, upgraded, newLevel }），upgraded 时调用方写日志 */
export function grantXp(c, amount) {
  const cult = c.cultivation || { level: 1, xp: 0 };
  let { level, xp } = cult;
  xp += amount;
  let upgraded = false;
  while (level < MAX_LEVEL && xp >= xpForNext(level)) {
    xp -= xpForNext(level);
    level += 1;
    upgraded = true;
  }
  return { colonist: { ...c, cultivation: { level, xp } }, upgraded, newLevel: level };
}

export function createColonist(state, { name, element, x, y }) {
  const el = getElement(element);
  // 未显式指定名字时走世界观角色池取名（M4），命中池则携带角色简介 desc
  const finalName = name || pickLoreName(element, state.colonists);
  const loreRec = name ? undefined : LORE_CHARACTERS.find((c) => c.name === finalName);
  return {
    id: `c${state.nextIds.colonist}`,
    name: finalName,
    desc: loreRec ? loreRec.desc : '',
    element,
    x,
    y,
    needs: createNeeds(88),
    moodScore: 88,
    mood: 'green',
    state: COLONIST_STATES.IDLE,
    mentalState: MENTAL_STATES.NORMAL,
    job: null,
    eatTimer: 0,
    workCount: 0,
    hp: 100,
    maxHp: 100,
    color: el.color,
    // M9 修为与性格特质
    cultivation: { level: 1, xp: 0 },
    traits: randomTraits(),
  };
}

let extraNameIdx = 0;
function pickExtraName() {
  const name = EXTRA_NAMES[extraNameIdx % EXTRA_NAMES.length];
  extraNameIdx++;
  return name;
}

/**
 * 从世界观角色池取名（M4）：
 * 1) 同 element 且未被占用 -> 随机取；
 * 2) 同 element 用尽 -> 退回全池未占用名字随机取；
 * 3) 全池占用 -> 循环使用角色名加序号（保证不重名）；
 * 4) 角色池为空（数据缺失）-> EXTRA_NAMES 兜底。
 */
export function pickLoreName(element, colonists) {
  if (LORE_CHARACTERS.length === 0) return pickExtraName();
  const used = new Set(colonists.map((c) => c.name));
  const byElement = LORE_CHARACTERS.filter((c) => c.element === element && !used.has(c.name));
  const pool =
    byElement.length > 0
      ? byElement
      : LORE_CHARACTERS.filter((c) => !used.has(c.name));
  if (pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)].name;
  }
  // 全池已被占用：循环使用 + 序号（2, 3, ...）保证不重名
  const base = LORE_CHARACTERS[Math.floor(Math.random() * LORE_CHARACTERS.length)].name;
  let idx = 2;
  let candidate = `${base}${idx}`;
  while (used.has(candidate)) {
    idx++;
    candidate = `${base}${idx}`;
  }
  return candidate;
}

/** ADD_COLONIST reducer 入口 */
export function add(state, payload) {
  const near = spiritSpace.findFreeTileNear(state, state.space.width / 2, state.space.height / 2, 8);
  const x = near ? near.x : Math.floor(state.space.width / 2);
  const y = near ? near.y : Math.floor(state.space.height / 2);
  const c = createColonist(state, {
    name: payload.name,
    element: payload.element || 'tu',
    x,
    y,
  });
  return {
    ...state,
    colonists: [...state.colonists, c],
    nextIds: { ...state.nextIds, colonist: state.nextIds.colonist + 1 },
    eventLog: pushLog(state.eventLog, `${c.name} 加入了会馆`),
  };
}

/** DEBUG_FILL_NEEDS reducer 入口 */
export function fillNeeds(state, payload) {
  const colonists = state.colonists.map((c) =>
    c.id === payload.colonistId
      ? { ...c, needs: createNeeds(100), moodScore: 100, mood: 'green' }
      : c
  );
  return { ...state, colonists };
}

/** tick：驱动全部小妖（含散灵移除） */
export function tick(state) {
  const ctx = {
    resources: { ...state.resources },
    stats: { ...state.stats },
    buildings: state.buildings,
    relations: state.relations,
  };

  let eventLog = state.eventLog;
  const kept = [];
  let builtLog = null;
  for (const c of state.colonists) {
    const out = tickColonist(state, c, ctx);
    if (out._scatter) {
      // 散灵：移除小妖并记录
      eventLog = pushLog(
        eventLog,
        `${out.name} ${out._scatter === 'hunger' ? '食物耗尽，灵体消散了' : '病重不治，灵体消散了'}`
      );
      continue;
    }
    if (out._builtName) {
      builtLog = out._builtName;
      delete out._builtName;
    }
    if (out._cultivationLog) {
      eventLog = pushLog(eventLog, out._cultivationLog);
      delete out._cultivationLog;
    }
    if (out._craftLog) {
      // R1 合成完成/缺料提示（由 crafting.completeWork 返回）
      eventLog = pushLog(eventLog, out._craftLog);
      delete out._craftLog;
    }
    kept.push(out);
  }
  // M7：本 tick 有建筑刚建造完成 → 写一条完成日志
  if (builtLog) {
    eventLog = pushLog(eventLog, `${builtLog} 建造完成，开始运转`);
  }

  return {
    ...state,
    colonists: kept,
    resources: ctx.resources,
    stats: ctx.stats,
    buildings: ctx.buildings,
    relations: ctx.relations,
    eventLog,
  };
}

function tickColonist(state, c, ctx) {
  const el = getElement(c.element);

  // 0. 散灵判定：食物需求归零 → 灵体消散（M5）
  if (c.needs.food <= 0) {
    return { ...c, _scatter: 'hunger' };
  }

  // 五行碑被动：存在已建成五行碑时全员需求衰减放缓（×0.92）
  const hasWuxingbei = ctx.buildings.some((b) => b.buildingId === 'wuxingbei' && building.isBuilt(b));
  const decayMul = hasWuxingbei ? 0.92 : 1;

  // M6 昼夜：夜间 + 无战斗 + 空闲（无 job、精神正常）+ 不饿时入睡；
  // 饥饿小妖夜间保持清醒先去进食，避免睡眠抢占吃饭导致饿死。
  // 睡眠中 sleep 每 tick +1.0，其余需求衰减放缓至一半。
  const night = isNight(state.time);
  const combatActive = !!(state.combat && state.combat.active);
  const wasSleeping = c.state === COLONIST_STATES.SLEEPING;
  const sleepNow =
    night &&
    !combatActive &&
    !c.job &&
    c.mentalState === MENTAL_STATES.NORMAL &&
    c.needs.food > EAT_THRESHOLD &&
    (wasSleeping || c.state === COLONIST_STATES.IDLE) &&
    c.needs.sleep < 100;

  // 1. 需求衰减 + 心情（睡眠时特殊处理）
  // M9 特质修正：moodDecayMul（心情/需求整体衰减）与 needDecay（按需求 id 的衰减）
  const tmods = traitMods(c);
  const needs = {};
  let weighted = 0;
  let weightSum = 0;
  for (const n of NEEDS) {
    let v;
    const needMul = tmods.needDecay[n.id] || 1;
    if (sleepNow) {
      v =
        n.id === 'sleep'
          ? Math.min(100, round2(c.needs[n.id] + 1.0))
          : Math.max(0, round2(c.needs[n.id] - n.decay * el.decayBonus * decayMul * tmods.moodDecayMul * needMul * 0.5));
    } else {
      v = Math.max(0, round2(c.needs[n.id] - n.decay * el.decayBonus * decayMul * tmods.moodDecayMul * needMul));
    }
    needs[n.id] = v;
    weighted += v * n.weight;
    weightSum += n.weight;
  }
  const moodScore = round2(weighted / weightSum);
  const moodLevel = getMood(moodScore);
  let next = { ...c, needs, moodScore, mood: moodLevel.mood };

  // 2. 精神状态更新（M5）：敌对 / 抑郁 / 生病 / 恢复
  next = updateMentalState(state, next, ctx);

  // 负面状态小妖：取消工作、乱转、不进食不工作（mentalState 缺失视为正常）
  if (next.mentalState && next.mentalState !== MENTAL_STATES.NORMAL) {
    const ms = next.mentalState;
    const pos = randomStep(state, next);
    next = {
      ...next,
      job: null,
      state: COLONIST_STATES.MOVING,
      x: pos.x,
      y: pos.y,
    };
    // 生病持续掉血，hp 归零 → 散灵
    if (ms === MENTAL_STATES.SICK) {
      const hp = round2((next.hp ?? 100) - SICK_DRAIN);
      if (hp <= 0) return { ...next, hp: 0, _scatter: 'sick' };
      next = { ...next, hp };
    }
    return next;
  }

  // M6 睡眠状态：入睡后本 tick 结束（不进食不工作）；
  // 白天来临 / sleep 满 / 战斗激活时唤醒回 IDLE。
  if (sleepNow) {
    return { ...next, state: COLONIST_STATES.SLEEPING };
  }
  if (wasSleeping) {
    next = { ...next, state: COLONIST_STATES.IDLE };
  }

  // 3. 自动进食（优先级高于工作：jobAI 不会给饿肚子的小妖派活）
  // 仅"进入进食"时重置 eatTimer；已在进食中的小妖不重置，否则 3 tick 永远吃不完。
  if (!next.job && next.state !== COLONIST_STATES.EATING && needs.food < EAT_THRESHOLD && ctx.resources.food >= 1) {
    next = { ...next, state: COLONIST_STATES.EATING, eatTimer: 3 };
  }
  if (next.state === COLONIST_STATES.EATING) {
    next = { ...next, eatTimer: next.eatTimer - 1 };
    if (next.eatTimer <= 0) {
      ctx.resources.food = round2(ctx.resources.food - 1);
      ctx.stats.mealsEaten += 1;
      next = {
        ...next,
        state: COLONIST_STATES.IDLE,
        eatTimer: 0,
        needs: { ...next.needs, food: Math.min(100, round2(next.needs.food + 45)) },
      };
    }
    return next;
  }

  // 3. 执行当前工作
  if (next.job) {
    // R1 采集（gather）：无建筑归属，目标为地图资源点格（job.tx/job.ty）
    if (next.job.workType === 'gather') {
      const gx = next.job.tx;
      const gy = next.job.ty;
      if (next.x !== gx || next.y !== gy) {
        next = {
          ...next,
          state: COLONIST_STATES.MOVING,
          x: stepToward(next.x, gx),
          y: stepToward(next.y, gy),
        };
      } else {
        next = { ...next, state: COLONIST_STATES.WORKING };
        // M9 修为等级与特质同样作用于采集速度
        const lvBonus = levelBonus((next.cultivation && next.cultivation.level) || 1);
        const speedMul = MOOD_SPEED[next.mood] * el.workBonus * lvBonus * (1 + tmods.workSpeed);
        const progress = round2(next.job.progress + speedMul);
        if (progress >= next.job.workTime) {
          crafting.completeGather(ctx.resources, next.job);
          ctx.stats.totalWorkDone += 1;
          next = { ...next, job: null, state: COLONIST_STATES.IDLE, workCount: next.workCount + 1 };
          next = withWorkXp(next, 'gather');
        } else {
          next = { ...next, job: { ...next.job, progress } };
        }
      }
    } else {
      const buildingInst = ctx.buildings.find((b) => b.id === next.job.buildingId);
      if (!buildingInst) {
        next = { ...next, job: null, state: COLONIST_STATES.IDLE };
      } else {
        const def = getBuilding(buildingInst.buildingId);
        const tx = buildingInst.x + Math.floor(def.size.w / 2);
        const ty = buildingInst.y + Math.floor(def.size.h / 2);

        if (next.x !== tx || next.y !== ty) {
          // 移动：每 tick 1 格
          next = {
            ...next,
            state: COLONIST_STATES.MOVING,
            x: stepToward(next.x, tx),
            y: stepToward(next.y, ty),
          };
        } else {
          // 工作中
          next = { ...next, state: COLONIST_STATES.WORKING };
          // M9 修为等级（每级 +3%）与特质 workSpeed 影响工作速度
          const lvBonus = levelBonus((next.cultivation && next.cultivation.level) || 1);
          const speedMul = MOOD_SPEED[next.mood] * el.workBonus * lvBonus * (1 + tmods.workSpeed);
          const progress = round2(next.job.progress + speedMul);
          if (next.job.workType === 'build') {
            if (building.isBuilt(buildingInst)) {
              // 建筑已建成（他人完工或初始即建成）：撤销残留 build 工作，避免重复建造
              next = { ...next, job: null, state: COLONIST_STATES.IDLE };
            } else {
              // M7 建造：推进建造中建筑 construction；多人可并行加速；完工转建成
              const bt = buildingInst.buildTime ?? next.job.workTime;
              const cur = buildingInst.construction ?? 0;
              const newConst = Math.min(bt, round2(cur + speedMul));
              const done = newConst >= bt;
              ctx.buildings = ctx.buildings.map((b) =>
                b.id === buildingInst.id ? { ...b, construction: done ? bt : newConst } : b
              );
              ctx.stats.totalWorkDone += 1;
              if (done) {
                const wt = next.job.workType;
                next = {
                  ...next,
                  job: null,
                  state: COLONIST_STATES.IDLE,
                  workCount: next.workCount + 1,
                  _builtName: def.name,
                };
                next = withWorkXp(next, wt);
              } else {
                next = { ...next, job: { ...next.job, progress } };
              }
            }
          } else if (progress >= next.job.workTime) {
            if (def.workType === 'farm') {
              // 灵田：种植/收获由 farming 子系统结算（跳过默认 produce/restore）
              const inst = farming.completeWork(state, buildingInst, next, ctx.resources, ctx.stats);
              ctx.buildings = ctx.buildings.map((b) => (b.id === inst.id ? inst : b));
              ctx.stats.totalWorkDone += 1;
              const wt = def.workType || next.job.workType;
              next = {
                ...next,
                job: null,
                state: COLONIST_STATES.IDLE,
                workCount: next.workCount + 1,
              };
              next = withWorkXp(next, wt);
            } else if (def.workType === 'diplomacy') {
              // 传信塔：完成工作提升人类聚落声望 +2
              const [settlements, gained] = boostReputation({ relations: ctx.relations }, 2);
              ctx.relations = { ...ctx.relations, settlements };
              ctx.stats.totalWorkDone += 1;
              const wt = def.workType || next.job.workType;
              next = {
                ...next,
                job: null,
                state: COLONIST_STATES.IDLE,
                workCount: next.workCount + 1,
              };
              next = withWorkXp(next, wt);
            } else if (def.workType === 'craft') {
              // R1 合成（craft）：进度到 workTime 后由 crafting.completeWork 结算
              // 材料足额 → 扣料产出；材料不足 → 不扣料不产出，缺料提示经 _craftLog 写日志
              const res = crafting.completeWork(state, buildingInst, next, ctx.resources, ctx.stats);
              ctx.stats.totalWorkDone += 1;
              const wt = def.workType || next.job.workType;
              next = {
                ...next,
                job: null,
                state: COLONIST_STATES.IDLE,
                workCount: next.workCount + 1,
                _craftLog: res.log,
              };
              next = withWorkXp(next, wt);
            } else {
              // 完成工作：产出资源 / 恢复需求
              if (def.produce) {
                for (const [k, v] of Object.entries(def.produce)) {
                  ctx.resources[k] = round2((ctx.resources[k] ?? 0) + v);
                  if (k === 'spirit') ctx.stats.totalSpiritProduced += v;
                  if (k === 'food') ctx.stats.totalFoodProduced += v;
                }
              }
              const needs2 = { ...next.needs };
              if (def.restore) {
                for (const [k, v] of Object.entries(def.restore)) {
                  needs2[k] = Math.min(100, round2(needs2[k] + v * el.restoreBonus));
                }
              }
              ctx.stats.totalWorkDone += 1;
              const wt = def.workType || next.job.workType;
              next = {
                ...next,
                job: null,
                state: COLONIST_STATES.IDLE,
                workCount: next.workCount + 1,
                needs: needs2,
              };
              next = withWorkXp(next, wt);
            }
          } else {
            next = { ...next, job: { ...next.job, progress } };
        }
      }
      }
    }
  }

  return next;
}

/** M9 工作完成结算修为经验；升级时标记 _cultivationLog 由 tick 写入 eventLog */
function withWorkXp(c, workType) {
  const amt = WORK_XP[workType] ?? 5;
  const { colonist, upgraded, newLevel } = grantXp(c, amt);
  if (upgraded) {
    return {
      ...colonist,
      _cultivationLog: `${colonist.name} 修为突破至 ${cultivationName(colonist.element, newLevel)}`,
    };
  }
  return colonist;
}

function stepToward(from, to) {
  if (from === to) return from;
  return from < to ? from + 1 : from - 1;
}

/** 随机走一格（边界内）—— 负面状态小妖乱转 */
function randomStep(state, c) {
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  const d = dirs[Math.floor(Math.random() * dirs.length)];
  return {
    x: clamp(c.x + d[0], 0, state.space.width - 1),
    y: clamp(c.y + d[1], 0, state.space.height - 1),
  };
}

/** 精神状态更新（M5）：敌对 / 抑郁 / 生病 / 恢复 */
function updateMentalState(state, c, ctx) {
  const cur = c.mentalState || MENTAL_STATES.NORMAL;

  // 生病（优先级最高）：hp 低触发；hp 恢复后痊愈
  if (cur === MENTAL_STATES.SICK) {
    if ((c.hp ?? 100) > SICK_RECOVER_HP) return { ...c, mentalState: MENTAL_STATES.NORMAL };
    return c;
  }
  if ((c.hp ?? 100) < SICK_TRIGGER_HP) {
    if (cur !== MENTAL_STATES.SICK) {
      ctx.stats.sickEvents = (ctx.stats.sickEvents || 0) + 1;
    }
    return { ...c, mentalState: MENTAL_STATES.SICK };
  }

  // 敌对 / 抑郁：心情红时概率触发，心情回升后恢复
  if (cur === MENTAL_STATES.HOSTILE || cur === MENTAL_STATES.DEPRESSED) {
    if (c.moodScore >= MENTAL_RECOVER_SCORE) return { ...c, mentalState: MENTAL_STATES.NORMAL };
    return c;
  }
  if (c.mood === 'red') {
    if (c.moodScore < 25 && Math.random() < DEPRESSED_CHANCE) {
      ctx.stats.depressedEvents = (ctx.stats.depressedEvents || 0) + 1;
      return { ...c, mentalState: MENTAL_STATES.DEPRESSED };
    }
    if (Math.random() < HOSTILE_CHANCE) {
      ctx.stats.hostileEvents = (ctx.stats.hostileEvents || 0) + 1;
      return { ...c, mentalState: MENTAL_STATES.HOSTILE };
    }
  }
  return c;
}
