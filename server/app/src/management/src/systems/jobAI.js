/**
 * 灵境会馆 - 模拟子系统：工作 AI（jobAI）
 * 需求驱动的工作分配：为空闲小妖按最低需求匹配建筑，并维护 building.workers。
 */
import { NEED_TO_WORK } from '../content/needs.js';
import { getBuilding } from '../content/buildings.js';
import { COLONIST_STATES } from '../content/colonists.js';
import { MENTAL_STATES } from './colonist.js';
import * as building from './building.js';
import * as farming from './farming.js';
import * as crafting from './crafting.js';
import { WORK_THRESHOLD, EAT_THRESHOLD } from './colonist.js';
import { isNight } from '../core/util.js';

/** tick：清理孤儿 job → 农场生产优先派活 → 需求驱动派活 → 同步 workers */
export function tick(state) {
  // M6 昼夜：夜间不为空闲小妖派发新工作（已有 job 不打断）
  const night = isNight(state.time);

  // 1. 清理指向已不存在建筑的 job，以及负面状态小妖的 job（敌对/抑郁/生病不干活）
  let colonists = state.colonists.map((c) => {
    if (c.job && !state.buildings.some((b) => b.id === c.job.buildingId)) {
      return { ...c, job: null, state: COLONIST_STATES.IDLE };
    }
    if (c.mentalState && c.mentalState !== MENTAL_STATES.NORMAL) {
      return { ...c, job: null, state: COLONIST_STATES.IDLE };
    }
    return c;
  });

  // 同 tick 内占用计数（防止同一建筑单 tick 超员）
  const occupied = new Map();
  const hasSlot = (inst) => {
    const cur = (occupied.get(inst.id) ?? 0) + inst.workers.length;
    return cur < getBuilding(inst.buildingId).maxWorkers;
  };

  // 1.5 M7 建造优先：空闲小妖（白天或夜间均允许）去建造最近的建造中建筑；
  // 建造不限人数、可多人并行加速；已建成建筑不在此列。
  const underConstruction = state.buildings.filter((b) => !building.isBuilt(b));
  if (underConstruction.length > 0) {
    colonists = colonists.map((c) => {
      if (c.job || c.state === COLONIST_STATES.EATING) return c;
      if (c.needs.food < EAT_THRESHOLD) return c;
      const inst = nearestBuilding(c, underConstruction);
      if (!inst) return c;
      const def = getBuilding(inst.buildingId);
      return {
        ...c,
        job: { workType: 'build', buildingId: inst.id, progress: 0, workTime: def.buildTime ?? 8 },
        state: COLONIST_STATES.WORKING,
      };
    });
  }

  // 2. 农场生产优先：收获成熟作物 / 在空灵田种植（复用满员/占用判断）
  if (!night) {
    colonists = farming.assignWork(state, colonists, occupied, hasSlot);
  }

  // 2.5 研究优先：有研究任务时，空闲小妖去研究台工作
  if (!night && state.tech && state.tech.researching) {
    colonists = colonists.map((c) => {
      if (c.job || c.state === COLONIST_STATES.EATING) return c;
      if (c.needs.food < EAT_THRESHOLD) return c;
      const inst = building.findBuildingFor(state, 'research');
      if (!inst || !hasSlot(inst)) return c;
      const def = getBuilding(inst.buildingId);
      occupied.set(inst.id, (occupied.get(inst.id) ?? 0) + 1);
      return {
        ...c,
        job: { workType: 'research', buildingId: inst.id, progress: 0, workTime: def.workTime },
        state: COLONIST_STATES.WORKING,
      };
    });
  }

  // 2.7 特殊工作（M3）：锻造坊产出法器 / 传信塔提升聚落声望。
  // 触发条件：有法器缺口（<5）或聚落声望未满 100 时派活，避免无意义空转。
  if (!night && (anyRepBelow100(state) || (state.resources.faqi ?? 0) < FORGE_GAP)) {
    colonists = assignWorkType(state, colonists, occupied, hasSlot, 'forge');
  }
  if (!night && anyRepBelow100(state)) {
    colonists = assignWorkType(state, colonists, occupied, hasSlot, 'diplomacy');
  }

  // 3. 剩余空闲小妖按需求分配工作（已有 job 的小妖直接跳过，含农场工作）
  if (!night) {
    colonists = colonists.map((c) => {
      if (c.job || c.state === COLONIST_STATES.EATING) return c;
      if (c.needs.food < EAT_THRESHOLD) return c;
      const lowest = lowestNeed(c);
      if (!lowest || lowest.value >= WORK_THRESHOLD) return c;
      const workType = NEED_TO_WORK[lowest.id];
      const inst = building.findBuildingFor(state, workType);
      if (!inst || !hasSlot(inst)) return c;
      const def = getBuilding(inst.buildingId);
      occupied.set(inst.id, (occupied.get(inst.id) ?? 0) + 1);
      return {
        ...c,
        job: { workType, buildingId: inst.id, progress: 0, workTime: def.workTime },
        state: COLONIST_STATES.WORKING,
      };
    });
  }

  // 3.5 R1 配方合成：空闲小妖承接炼制队列（craft 合成 / gather 补料采集）。
  // 置于需求派活之后 → 生存/需求工作优先；队列项缺料或五行不匹配自动跳过不阻塞。
  if (!night) {
    colonists = crafting.assignCraftWork(state, colonists, occupied, hasSlot);
  }

  // 4. 兜底：负面状态小妖不保留 job（防止派活逻辑重新分配）
  colonists = colonists.map((c) =>
    c.mentalState && c.mentalState !== MENTAL_STATES.NORMAL
      ? { ...c, job: null, state: COLONIST_STATES.IDLE }
      : c
  );

  // 4. 从 colonists.job 重新推导 building.workers（保持一致性）
  const buildings = state.buildings.map((b) => {
    const ws = colonists.filter((c) => c.job && c.job.buildingId === b.id).map((c) => c.id);
    if (ws.length === b.workers.length && ws.every((id, i) => id === b.workers[i])) {
      return b;
    }
    return { ...b, workers: ws };
  });

  return { ...state, colonists, buildings };
}

/** 找出最低需求项 */
export function lowestNeed(c) {
  let lowest = null;
  for (const [id, value] of Object.entries(c.needs)) {
    if (!lowest || value < lowest.value) lowest = { id, value };
  }
  return lowest;
}

/** 法器缺口阈值：低于该数量时安排锻造坊生产 */
export const FORGE_GAP = 5;

/** 从建造中建筑列表里找离小妖最近的（曼哈顿距离，取建筑中心格） */
export function nearestBuilding(c, list) {
  let best = null;
  let bestD = Infinity;
  for (const b of list) {
    const cx = b.x + Math.floor((b.w ?? 2) / 2);
    const cy = b.y + Math.floor((b.h ?? 2) / 2);
    const d = Math.abs(cx - c.x) + Math.abs(cy - c.y);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

/** 是否存在声望未满 100 的人类聚落（外交工作条件） */
export function anyRepBelow100(state) {
  const ss = state.relations && state.relations.settlements;
  if (!Array.isArray(ss) || ss.length === 0) return false;
  return ss.some((s) => s.reputation < 100);
}

/** 按 workType 给空闲小妖派发特殊工作（锻造坊 / 传信塔） */
function assignWorkType(state, colonists, occupied, hasSlot, workType) {
  return colonists.map((c) => {
    if (c.job || c.state === COLONIST_STATES.EATING) return c;
    if (c.needs.food < EAT_THRESHOLD) return c;
    const inst = building.findBuildingFor(state, workType);
    if (!inst || !hasSlot(inst)) return c;
    const def = getBuilding(inst.buildingId);
    occupied.set(inst.id, (occupied.get(inst.id) ?? 0) + 1);
    return {
      ...c,
      job: { workType, buildingId: inst.id, progress: 0, workTime: def.workTime },
      state: COLONIST_STATES.WORKING,
    };
  });
}
