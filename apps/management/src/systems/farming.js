/**
 * 灵境会馆 - 模拟子系统：种植（farming）
 * 灵田作物生长推进、为空闲小妖分配种植/收获生产工作、完成工作结算。
 * 生产工作优先级高于需求驱动派活（jobAI 中先于需求派活调用）。
 */
import { getCrop, CROPS } from '../content/crops.js';
import { getBuilding } from '../content/buildings.js';
import { COLONIST_STATES } from '../content/colonists.js';
import { EAT_THRESHOLD } from './colonist.js';
import { round2 } from '../core/util.js';

/** 每 tick 作物生长进度 */
const GROW_SPEED = 1;
/** 种植/收获单次工作耗时（tick） */
const FARM_WORK_TIME = 8;

/** 种植作物轮换指针（灵谷/灵草交替） */
let cropCursor = 0;

/** 灵田是否已建成（M7：建造中不推进作物、不可种植/收获） */
function isFarmBuilt(b) {
  return b.construction == null || b.construction >= (b.buildTime ?? 0);
}

/** tick：推进已建成灵田上作物生长进度（未成熟作物 progress 累加，成熟后封顶） */
export function tick(state) {
  const buildings = state.buildings.map((b) => {
    const def = getBuilding(b.buildingId);
    if (!def || def.workType !== 'farm' || !isFarmBuilt(b) || !b.crop) return b;
    const cropDef = getCrop(b.crop.cropId);
    if (!cropDef) return b;
    const progress = Math.min(cropDef.growTime, round2(b.crop.progress + GROW_SPEED));
    return { ...b, crop: { ...b.crop, progress } };
  });
  return { ...state, buildings };
}

/**
 * 为空闲小妖分配农场生产工作：
 * 优先收获成熟作物（harvest），其次在空灵田种植（plant）。
 * occupied / hasSlot 复用 jobAI 的满员/占用判断（防止同 tick 超员）。
 * 返回新的 colonists 数组。
 */
export function assignWork(state, colonists, occupied, hasSlot) {
  const idle = colonists.filter(
    (c) => !c.job && c.state !== COLONIST_STATES.EATING && c.needs.food >= EAT_THRESHOLD
  );
  if (idle.length === 0) return colonists;

  let next = colonists.slice();
  for (const c of idle) {
    // 1) 优先收获：成熟作物
    const ripe = findFarm(state, hasSlot, (b) => !!b.crop && b.crop.progress >= getCrop(b.crop.cropId).growTime);
    if (ripe) {
      occupied.set(ripe.id, (occupied.get(ripe.id) ?? 0) + 1);
      next = giveJob(next, c, { task: 'harvest', cropId: ripe.crop.cropId, buildingId: ripe.id });
      continue;
    }
    // 2) 其次种植：空灵田
    const empty = findFarm(state, hasSlot, (b) => !b.crop);
    if (empty) {
      occupied.set(empty.id, (occupied.get(empty.id) ?? 0) + 1);
      next = giveJob(next, c, { task: 'plant', cropId: nextCropId(), buildingId: empty.id });
    }
  }
  return next;
}

/** 查找符合条件的已建成灵田（可承接且未满员/未占用） */
function findFarm(state, hasSlot, match) {
  return (
    state.buildings.find((b) => {
      const def = getBuilding(b.buildingId);
      if (!def || def.workType !== 'farm') return false;
      if (!isFarmBuilt(b)) return false;
      if (!match(b)) return false;
      return hasSlot(b);
    }) || null
  );
}

/** 给空闲小妖分配农场 job */
function giveJob(colonists, c, job) {
  return colonists.map((cc) =>
    cc.id === c.id
      ? {
          ...cc,
          job: {
            workType: 'farm',
            task: job.task,
            cropId: job.cropId,
            buildingId: job.buildingId,
            progress: 0,
            workTime: FARM_WORK_TIME,
          },
          state: COLONIST_STATES.WORKING,
        }
      : cc
  );
}

/** 轮换选择种植作物（灵谷/灵草交替） */
function nextCropId() {
  const id = CROPS[cropCursor % CROPS.length].id;
  cropCursor++;
  return id;
}

/**
 * 完成一次种植/收获工作（由 colonist 工作完成时调用，灵田专用）。
 * 种植 → 灵田实例记 crop={cropId, progress:0}；
 * 收获 → 按作物 produce 产出资源并清空 crop。
 * 直接修改 resources / stats（与 colonist.tick 同风格），返回更新后的灵田实例。
 */
export function completeWork(state, buildingInst, colonist, resources, stats) {
  const inst = { ...buildingInst };
  const task = colonist.job && colonist.job.task;
  if (task === 'plant') {
    inst.crop = { cropId: colonist.job.cropId, progress: 0 };
  } else if (task === 'harvest') {
    const cropDef = inst.crop ? getCrop(inst.crop.cropId) : null;
    if (cropDef && cropDef.produce) {
      for (const [k, v] of Object.entries(cropDef.produce)) {
        resources[k] = round2((resources[k] ?? 0) + v);
        if (k === 'spirit') stats.totalSpiritProduced += v;
        if (k === 'food') stats.totalFoodProduced += v;
      }
    }
    inst.crop = null;
  }
  return inst;
}
