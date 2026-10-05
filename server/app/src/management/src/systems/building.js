/**
 * 灵境会馆 - 模拟子系统：建造（building）
 * 放置建筑（校验 + 扣资源 + 占用地块）、查询建筑、取消/拆除。
 */
import { round2, pushLog } from '../core/util.js';
import { getBuilding } from '../content/buildings.js';
import { buildingUnlocked } from '../content/research.js';
import * as spiritSpace from './spiritSpace.js';

/** 放置建筑（BUILD_PLACE reducer 入口） */
export function place(state, payload) {
  // 研究未解锁的建筑不可建造
  if (!buildingUnlocked(state, payload.buildingId)) {
    return { ...state, eventLog: pushLog(state.eventLog, '尚未研究解锁该建筑') };
  }
  const check = spiritSpace.canPlace(state, payload.buildingId, payload.x, payload.y);
  if (!check.ok) return state;

  const def = check.def;
  const resources = { ...state.resources };
  for (const [k, v] of Object.entries(def.cost)) {
    resources[k] = round2((resources[k] ?? 0) - v);
  }

  const tiles = state.space.tiles.slice();
  const inst = {
    id: `b${state.nextIds.building}`,
    buildingId: def.id,
    x: payload.x,
    y: payload.y,
    w: def.size.w,
    h: def.size.h,
    hp: 100,
    workers: [],
    builtAt: state.tick,
    construction: 0, // M7：建造工作量进度（0 起步）
    buildTime: def.buildTime ?? 0, // M7：总建造工作量
  };
  for (let y = payload.y; y < payload.y + def.size.h; y++) {
    for (let x = payload.x; x < payload.x + def.size.w; x++) {
      const idx = y * state.space.width + x;
      tiles[idx] = { ...tiles[idx], buildingId: inst.id };
    }
  }

  return {
    ...state,
    resources,
    space: { ...state.space, tiles },
    buildings: [...state.buildings, inst],
    nextIds: { ...state.nextIds, building: state.nextIds.building + 1 },
    eventLog: pushLog(state.eventLog, `开始建造 ${def.name}，等待小妖施工`),
  };
}

/**
 * M7 建造需要时间：判断建筑是否已建成。
 * construction===null（历史构造实例）视为已建成；否则需 construction>=buildTime。
 */
export function isBuilt(b) {
  if (b.construction == null) return true;
  return b.construction >= (b.buildTime ?? 0);
}

/** 取消/拆除建筑（M1：释放地块与资源返还 50%） */
export function cancel(state, payload) {
  const inst = state.buildings.find((b) => b.id === payload.buildingId);
  if (!inst) return state;
  const def = getBuilding(inst.buildingId);
  if (!def) return state;

  const tiles = state.space.tiles.map((t) =>
    t.buildingId === inst.id ? { ...t, buildingId: null } : t
  );
  const buildings = state.buildings.filter((b) => b.id !== inst.id);

  const resources = { ...state.resources };
  for (const [k, v] of Object.entries(def.cost)) {
    resources[k] = round2((resources[k] ?? 0) + v * 0.5);
  }

  return {
    ...state,
    resources,
    space: { ...state.space, tiles },
    buildings,
    eventLog: pushLog(state.eventLog, `拆除了 ${def.name}`),
  };
}

/** 移动建筑（BUILD_MOVE reducer 入口）：免费，校验目标格合法后释放旧格、占用新格 */
export function move(state, payload) {
  const inst = state.buildings.find((b) => b.id === payload.buildingId);
  if (!inst) return state;
  const def = getBuilding(inst.buildingId);
  if (!def) return state;

  const gx = payload.x;
  const gy = payload.y;
  const w = state.space.width;
  const h = state.space.height;

  // 越界
  if (gx < 0 || gy < 0 || gx + def.size.w > w || gy + def.size.h > h) {
    return { ...state, eventLog: pushLog(state.eventLog, `${def.name} 无法移动到该位置（超出边界）`) };
  }

  // 原位置未变 → 直接返回
  if (gx === inst.x && gy === inst.y) return state;

  // 目标格校验：不能与其它建筑重叠、不能占用资源点；允许自己占用的旧格
  for (let y = gy; y < gy + def.size.h; y++) {
    for (let x = gx; x < gx + def.size.w; x++) {
      const idx = y * w + x;
      const t = state.space.tiles[idx];
      if (!t) return { ...state, eventLog: pushLog(state.eventLog, `${def.name} 无法移动到该位置`) };
      if (t.buildingId && t.buildingId !== inst.id) {
        return { ...state, eventLog: pushLog(state.eventLog, `${def.name} 无法移动到该位置（地块被占用）`) };
      }
      if (t.resource) {
        return { ...state, eventLog: pushLog(state.eventLog, `${def.name} 无法移动到该位置（地块有资源点）`) };
      }
    }
  }

  const tiles = state.space.tiles.map((t) => {
    if (t.buildingId === inst.id) return { ...t, buildingId: null };
    return t;
  });
  for (let y = gy; y < gy + def.size.h; y++) {
    for (let x = gx; x < gx + def.size.w; x++) {
      const idx = y * w + x;
      tiles[idx] = { ...tiles[idx], buildingId: inst.id };
    }
  }

  return {
    ...state,
    space: { ...state.space, tiles },
    buildings: state.buildings.map((b) => (b.id === inst.id ? { ...b, x: gx, y: gy } : b)),
    eventLog: pushLog(state.eventLog, `移动了 ${def.name}`),
  };
}

/** tick：建筑无被动逻辑（祭坛被动产出在 spiritSpace），保留扩展位 */
export function tick(state) {
  return state;
}

/** 获取某格上的建筑实例 */
export function getBuildingAt(state, x, y) {
  const t = spiritSpace.tileAt(state, x, y);
  if (!t || !t.buildingId) return null;
  return state.buildings.find((b) => b.id === t.buildingId) || null;
}

/** 查找可服务指定工作类型的建筑（已建成且未满员） */
export function findBuildingFor(state, workType) {
  return (
    state.buildings.find((b) => {
      const def = getBuilding(b.buildingId);
      return def && isBuilt(b) && def.workType === workType && b.workers.length < def.maxWorkers;
    }) || null
  );
}
