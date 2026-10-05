/**
 * 灵境会馆 - 模拟子系统：配方合成（crafting）
 *
 * R1 路线A（job 进度式）落地，对齐 CDDA recipes + construction：
 *  - 配方队列存 state.crafting.queue（FIFO，可重复入队）
 *  - jobAI.tick 读取队列为空闲小妖派发 craft job（带 recipeId），
 *    若材料缺采集类材料则派 gather job 采地图资源点补料
 *  - colonist.tick 推进 craft/gather 工作进度（与 farm/forge 同构，吃修为加成）
 *  - 进度到 workTime 后回调本模块 completeWork / completeGather 结算：
 *      材料足额 → 扣料、产出（写 resources）、返回完成日志
 *      材料不足 → 不扣料不产出、返回缺料提示（任务验收路径）
 *  - crafting.tick 置于 jobAI.tick 之后（保证先派活后结算顺序），
 *    职责：结构归一 + 凝神药膏自动医疗闭环
 */
import {
  GATHER_MATERIALS,
  GATHER_MATERIAL_TILE,
  MATERIAL_NAMES,
  getRecipe,
} from '../content/recipes.js';
import { getBuilding } from '../content/buildings.js';
import { COLONIST_STATES } from '../content/colonists.js';
import { EAT_THRESHOLD } from './colonist.js';
import { round2, pushLog } from '../core/util.js';
import * as building from './building.js';

/** 单次采集收获量 */
export const GATHER_GAIN = 3;
/** 单次采集耗时（tick） */
export const GATHER_WORK_TIME = 8;
/** 药膏单次自动医疗回复量 */
export const OINTMENT_HEAL = 25;
/** 触发自动医疗的血量上限（低于则敷药） */
export const OINTMENT_THRESHOLD = 60;
/** 队列长度上限 */
export const QUEUE_MAX = 10;

/** 状态结构归一：旧档/初始 state 无 crafting 时补默认结构 */
export function normCraftState(state) {
  if (state.crafting && Array.isArray(state.crafting.queue)) return state;
  return { ...state, crafting: { queue: [] } };
}

/** 材料是否足额（resources 视角） */
export function hasEnough(resources, materials) {
  for (const [key, need] of Object.entries(materials || {})) {
    if ((resources[key] ?? 0) < need - 1e-9) return false;
  }
  return true;
}

/** 缺失材料键列表（仅供缺料提示/采集补料判断） */
export function missingMaterials(resources, materials) {
  const miss = [];
  for (const [key, need] of Object.entries(materials || {})) {
    if ((resources[key] ?? 0) < need - 1e-9) miss.push(key);
  }
  return miss;
}

function nameOf(key) {
  return MATERIAL_NAMES[key] || key;
}

/** 入队一个配方（UI/action 入口）。同配方可多次排队；满上限时拒绝并提示 */
export function enqueue(state, recipeId) {
  let s = normCraftState(state);
  const recipe = getRecipe(recipeId);
  if (!recipe) return { ...s, eventLog: pushLog(s.eventLog, '未知配方，无法入队') };
  if (s.crafting.queue.length >= QUEUE_MAX) {
    return { ...s, eventLog: pushLog(s.eventLog, `炼制队列已满（上限 ${QUEUE_MAX} 条）`) };
  }
  return {
    ...s,
    crafting: { queue: [...s.crafting.queue, recipeId] },
    eventLog: pushLog(s.eventLog, `「${recipe.name}」已加入炼制队列`),
  };
}

/** 移出队列（取消最近一条同配方） */
export function cancel(state, recipeId) {
  let s = normCraftState(state);
  const q = s.crafting.queue;
  const idx = q.lastIndexOf(recipeId);
  if (idx < 0) return s;
  const queue = q.slice();
  queue.splice(idx, 1);
  const recipe = getRecipe(recipeId);
  return {
    ...s,
    crafting: { queue },
    eventLog: pushLog(s.eventLog, `已将「${recipe ? recipe.name : recipeId}」移出炼制队列`),
  };
}

/**
 * 完成一次合成（由 colonist.tick 的 craft 分支回调）。
 * 结算规则：材料足额 → 扣料 + 产出 + 返回完成日志；
 *          材料不足 → 不扣料不产出 + 返回缺料提示（ok=false）。
 * 直接修改 resources / stats（与 colonist.tick 同风格）。
 */
export function completeWork(state, buildingInst, colonist, resources, stats) {
  const job = colonist.job || {};
  const recipe = getRecipe(job.recipeId);
  if (!recipe) {
    return { ok: false, log: '配方已失效，合成中止' };
  }
  const miss = missingMaterials(resources, recipe.materials);
  if (miss.length > 0) {
    const names = miss.map(nameOf).join('、');
    return { ok: false, log: `灵材不足（缺${names}），「${recipe.name}」暂缓合成` };
  }
  for (const [key, need] of Object.entries(recipe.materials)) {
    resources[key] = round2(Math.max(0, (resources[key] ?? 0) - need));
  }
  const outId = recipe.result.id;
  const amount = recipe.result.amount || 1;
  resources[outId] = round2((resources[outId] ?? 0) + amount);
  // totalWorkDone 由 colonist.tick 统一 +1（与 farm/forge 分支同构），此处不重复计数
  return { ok: true, recipe, log: `「${recipe.name}」合成完成：${nameOf(outId)}+${amount}` };
}

/**
 * 完成一次采集（由 colonist.tick 的 gather 分支回调）：
 * 把资源点材料收为资源库存（灵木/草药/石料/矿料）。
 * 不写日志（采集为高频低反馈操作，进度见合成面板与资源条）。
 */
export function completeGather(resources, job) {
  const key = job.gainKey;
  if (!key || !GATHER_MATERIALS.includes(key)) return;
  resources[key] = round2((resources[key] ?? 0) + GATHER_GAIN);
}

/**
 * tick：jobAI 派活之后、colonist 结算之前调用。
 * 职责：① crafting 结构归一；② 凝神药膏自动医疗（一次至多治疗一位最重伤者）。
 */
export function tick(state) {
  let s = normCraftState(state);
  const resources = { ...s.resources };
  const haveOintment = (resources.yaogao ?? 0) >= 1;
  if (!haveOintment) return s;
  // 找最重伤者（hp 低于阈值）
  let patient = null;
  for (const c of s.colonists) {
    const hp = c.hp ?? 100;
    if (hp >= OINTMENT_THRESHOLD) continue;
    if (!patient || hp < (patient.hp ?? 100)) patient = c;
  }
  if (!patient) return s;
  const colonists = s.colonists.map((c) =>
    c.id === patient.id
      ? { ...c, hp: Math.min(c.maxHp ?? 100, round2((c.hp ?? 100) + OINTMENT_HEAL)) }
      : c
  );
  resources.yaogao = round2(resources.yaogao - 1);
  return {
    ...s,
    colonists,
    resources,
    eventLog: pushLog(s.eventLog, `💊 ${patient.name} 敷用凝神药膏，回复 ${OINTMENT_HEAL} 气血`),
  };
}

/**
 * 为空闲小妖派发合成/采集工作（jobAI.tick 调用，白天）。
 * 逐个小妖按队列顺序寻找能承接的任务：
 *  1. 对应五行小妖 + 建筑可用 + 材料足额 → craft job
 *  2. 对应五行小妖 + 建筑可用 + 缺采集材料且地图有源 → gather job（自动补料）
 * 队列不满足条件项跳过（不阻塞其它项/其它小妖）。
 */
export function assignCraftWork(state, colonists, occupied, hasSlot) {
  const queue = (state.crafting && state.crafting.queue) || [];
  if (queue.length === 0) return colonists;

  const idle = colonists.filter(
    (c) =>
      !c.job &&
      c.state !== COLONIST_STATES.EATING &&
      (c.needs.food ?? 100) >= EAT_THRESHOLD &&
      (!c.mentalState || c.mentalState === 'normal')
  );
  if (idle.length === 0) return colonists;

  let next = colonists.slice();
  const busyTiles = new Set(); // 同 tick 已被采集占用的资源点格
  for (const c of idle) {
    const task = pickTask(state, c, occupied, hasSlot, busyTiles);
    if (!task) continue;
    if (task.kind === 'craft') {
      occupied.set(task.inst.id, (occupied.get(task.inst.id) ?? 0) + 1);
      const def = getBuilding(task.inst.buildingId);
      next = next.map((cc) =>
        cc.id === c.id
          ? {
              ...cc,
              job: {
                workType: 'craft',
                recipeId: task.recipe.id,
                buildingId: task.inst.id,
                progress: 0,
                workTime: task.recipe.timeTicks,
              },
              state: COLONIST_STATES.WORKING,
            }
          : cc
      );
    } else {
      busyTiles.add(task.tx * 10000 + task.ty);
      next = next.map((cc) =>
        cc.id === c.id
          ? {
              ...cc,
              job: {
                workType: 'gather',
                tx: task.tx,
                ty: task.ty,
                gainKey: task.key,
                progress: 0,
                workTime: GATHER_WORK_TIME,
              },
              state: COLONIST_STATES.WORKING,
            }
          : cc
      );
    }
  }
  return next;
}

/** 为单个空闲小妖挑选任务（队列顺序遍历，队首优先） */
function pickTask(state, c, occupied, hasSlot, busyTiles) {
  const queue = (state.crafting && state.crafting.queue) || [];
  for (const recipeId of queue) {
    const recipe = getRecipe(recipeId);
    if (!recipe) continue;
    const buildingId = recipe.requires && recipe.requires.building;
    const skill = (recipe.requires && recipe.requires.skill) || null;
    const inst = buildingId
      ? state.buildings.find((b) => b.buildingId === buildingId && building.isBuilt(b) && hasSlot(b))
      : null;
    // 五行技能门槛：需对应元素小妖且修为等级达标（不满足则本小妖不能承接，看下一项）
    const elementOk = !skill || !skill.element || skill.element === c.element;
    const levelOk = !skill || !skill.minLevel || ((c.cultivation && c.cultivation.level) || 1) >= skill.minLevel;
    if (!inst || !elementOk || !levelOk) continue;

    if (hasEnough(state.resources, recipe.materials)) {
      return { kind: 'craft', recipe, inst };
    }
    // 材料不足：优先补料 —— 若缺的是可采集材料且地图存在空闲资源点 → gather
    const miss = missingMaterials(state.resources, recipe.materials);
    const gatherable = miss.find((k) => GATHER_MATERIALS.includes(k));
    if (gatherable) {
      const spot = findGatherSpot(state, gatherable, c, busyTiles);
      if (spot) return { kind: 'gather', key: gatherable, tx: spot.x, ty: spot.y };
    }
    // 缺 spirit/food/faqi 等不可采集料：本项暂无法推进（等祭坛/灵田产出），跳过
  }
  return null;
}

/** 找离小妖最近的匹配材料资源点（未被占用、未被建筑占据） */
function findGatherSpot(state, materialKey, c, busyTiles) {
  const wantType = GATHER_MATERIAL_TILE[materialKey];
  if (!wantType) return null;
  let best = null;
  let bestD = Infinity;
  for (const t of state.space.tiles) {
    if (t.buildingId) continue;
    if (!t.resource || t.resource.type !== wantType) continue;
    if (busyTiles.has(t.x * 10000 + t.y)) continue;
    const d = Math.abs(t.x - c.x) + Math.abs(t.y - c.y);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}
