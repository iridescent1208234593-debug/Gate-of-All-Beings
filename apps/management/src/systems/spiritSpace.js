/**
 * 灵境会馆 - 模拟子系统：灵质空间（spiritSpace）
 * 负责基地本体：网格、灵质池自然再生、地块占用校验、地块扩展与资源点。
 */
import { round2, clamp, pushLog } from '../core/util.js';
import { getBuilding } from '../content/buildings.js';

/** 每 tick 基础灵质再生 */
const BASE_REGEN = 0.3;
/** 每座祭坛每 tick 自动产出 */
const ALTAR_AUTO = 0.4;

/** 难度系数：影响灵质再生（easy 1.3 / normal 1.0 / hard 0.8） */
const DIFF_REGEN = { easy: 1.3, normal: 1.0, hard: 0.8 };

/** 资源点定义（type → 产出与间隔） */
export const RESOURCE_TYPES = {
  tree: { name: '树木', icon: '🌳', color: '#4a9a5a', interval: 12, produce: { food: 1 }, desc: '结出灵果，定期产出食物' },
  herb: { name: '草药', icon: '🌿', color: '#6ac46a', interval: 10, produce: { food: 1 }, healAll: 2, desc: '灵草药圃，产出食物并缓慢治愈全馆小妖' },
  stone: { name: '石头', icon: '🪨', color: '#9a9a8a', interval: 8, produce: { spirit: 1 }, desc: '灵石矿藏，定期产出灵质' },
  ore: { name: '矿产', icon: '⛏️', color: '#c9a86a', interval: 16, produce: { faqi: 1 }, desc: '稀有矿脉，定期产出法器' },
};

/** 扩展地块花费：每格 8 灵质 */
export const EXPAND_COST_PER_TILE = 8;

/** tick：灵质池再生（受难度与聚灵工业加成） */
export function tick(state) {
  const settings = state.settings || {};
  const diffMul = DIFF_REGEN[settings.difficulty] ?? 1.0;
  const regen = BASE_REGEN * state.space.spiritDensity * diffMul;
  // M7：仅已建成祭坛自动产出（建造中不产）
  const altars = state.buildings.filter(
    (b) => b.buildingId === 'altar' && (b.construction == null || b.construction >= (b.buildTime ?? 0))
  ).length;
  const auto = altars * ALTAR_AUTO;
  let gain = regen + auto;
  if (state.tech && Array.isArray(state.tech.unlocked) && state.tech.unlocked.includes('julinggongye')) {
    gain *= 1.2;
  }
  const spirit = round2(clamp(state.resources.spirit + gain, 0, 99999));
  let s = { ...state, resources: { ...state.resources, spirit } };

  // 资源点被动产出
  s = tickResourceHarvest(s);
  return s;
}

/** tick：资源点按间隔产出资源，存量耗尽后消失 */
function tickResourceHarvest(state) {
  let tiles = state.space.tiles;
  let resources = { ...state.resources };
  let eventLog = state.eventLog;
  const stats = { ...state.stats };
  const heal = { amount: 0 };

  for (const t of tiles) {
    // 再生：树木/草药采尽后可重新生长
    if (!t.resource) {
      if (t.regenAfter && state.tick >= t.regenAfter) {
        const rt = t.regenType;
        if (rt && (rt === 'tree' || rt === 'herb') && Math.random() < 0.5) {
          tiles = tiles.map((tt) => (tt === t ? { ...tt, resource: { type: rt, amount: 8 + Math.floor(Math.random() * 6) }, regenAfter: null, regenType: null } : tt));
          eventLog = pushLog(eventLog, `${RESOURCE_TYPES[rt].icon} ${RESOURCE_TYPES[rt].name}重新生长出来`);
        } else {
          tiles = tiles.map((tt) => (tt === t ? { ...tt, regenAfter: state.tick + 400 + Math.floor(Math.random() * 400) } : tt));
        }
      }
      continue;
    }
    const def = RESOURCE_TYPES[t.resource.type];
    if (!def) continue;
    const acc = (t.resource.acc || 0) + 1;
    let amount = t.resource.amount;
    let resource = null;

    if (acc >= def.interval) {
      for (const [k, v] of Object.entries(def.produce)) {
        resources[k] = round2((resources[k] ?? 0) + v);
        if (k === 'spirit') stats.totalSpiritProduced = (stats.totalSpiritProduced || 0) + v;
        if (k === 'food') stats.totalFoodProduced = (stats.totalFoodProduced || 0) + v;
      }
      if (def.healAll) heal.amount += def.healAll;
      amount -= 1;
      if (amount <= 0) {
        // 采尽：树/草药可再生长，石头/矿脉不再生（需扩展寻新矿）
        tiles = tiles.map((tt) => (tt === t
          ? { ...tt, resource: null, regenAfter: state.tick + 400 + Math.floor(Math.random() * 400), regenType: t.resource.type }
          : tt));
        eventLog = pushLog(eventLog, `${def.icon} ${def.name}采尽了`);
      } else {
        tiles = tiles.map((tt) => (tt === t ? { ...tt, resource: { ...t.resource, acc: 0, amount } } : tt));
      }
    } else {
      tiles = tiles.map((tt) => (tt === t ? { ...tt, resource: { ...tt.resource, acc } } : tt));
    }
  }

  let colonists = state.colonists;
  if (heal.amount > 0) {
    colonists = colonists.map((c) => ({
      ...c,
      hp: Math.min(c.maxHp || 100, round2((c.hp || 100) + heal.amount)),
    }));
  }

  return {
    ...state,
    resources,
    stats,
    eventLog,
    space: { ...state.space, tiles },
    colonists,
  };
}

/** 生成单个地块（含随机资源点） */
export function makeTile(x, y) {
  const resource = resourceForTile();
  return { x, y, type: 'empty', buildingId: null, resource };
}

/** 按概率生成资源点（初始与扩展地块通用） */
export function resourceForTile() {
  const roll = Math.random();
  if (roll < 0.12) return { type: 'tree', amount: 18 + Math.floor(Math.random() * 12) };
  if (roll < 0.19) return { type: 'herb', amount: 12 + Math.floor(Math.random() * 8) };
  if (roll < 0.28) return { type: 'stone', amount: 22 + Math.floor(Math.random() * 12) };
  if (roll < 0.35) return { type: 'ore', amount: 10 + Math.floor(Math.random() * 8) };
  return null;
}

/** 获取网格地块（动态尺寸） */
export function tileAt(state, x, y) {
  const w = state.space.width;
  const h = state.space.height;
  if (x < 0 || y < 0 || x >= w || y >= h) return null;
  return state.space.tiles[y * w + x];
}

/** 检查能否在 (gx, gy) 放置建筑（跳过资源检查；可选忽略资源点） */
export function canPlace(state, buildingId, gx, gy, ignoreResource = false) {
  const def = getBuilding(buildingId);
  if (!def) return { ok: false, reason: '未知建筑' };
  for (const [k, v] of Object.entries(def.cost)) {
    if ((state.resources[k] ?? 0) < v) return { ok: false, reason: `${k}不足` };
  }
  const w = state.space.width;
  const h = state.space.height;
  if (gx < 0 || gy < 0 || gx + def.size.w > w || gy + def.size.h > h) {
    return { ok: false, reason: '超出边界' };
  }
  for (let y = gy; y < gy + def.size.h; y++) {
    for (let x = gx; x < gx + def.size.w; x++) {
      const t = tileAt(state, x, y);
      if (!t || t.buildingId) return { ok: false, reason: '地块被占用' };
      if (!ignoreResource && t.resource) return { ok: false, reason: '地块有资源点' };
    }
  }
  return { ok: true, def };
}

/**
 * 扩展地块：dir = 'east'（右扩一列）| 'south'（下扩一行）
 * 花费 = 每格 8 灵质 × 新增格数。新地块随机生成资源点。
 */
export function expand(state, dir) {
  const { width, height, tiles } = state.space;
  const costPer = EXPAND_COST_PER_TILE;

  if (dir === 'east') {
    const cost = costPer * height;
    if ((state.resources.spirit ?? 0) < cost) {
      return { ...state, eventLog: pushLog(state.eventLog, `灵质不足，无法扩展（需 ${cost}）`) };
    }
    const newTiles = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) newTiles.push(tiles[y * width + x]);
      newTiles.push(makeTile(width, y));
    }
    const resCount = newTiles.filter((t) => t.x === width && t.resource).length;
    return {
      ...state,
      resources: { ...state.resources, spirit: round2(state.resources.spirit - cost) },
      space: { ...state.space, width: width + 1, tiles: newTiles },
      eventLog: pushLog(state.eventLog, `灵质空间向东扩展了一列（-${cost} 灵质，发现 ${resCount} 处资源）`),
    };
  }
  if (dir === 'south') {
    const cost = costPer * width;
    if ((state.resources.spirit ?? 0) < cost) {
      return { ...state, eventLog: pushLog(state.eventLog, `灵质不足，无法扩展（需 ${cost}）`) };
    }
    const newTiles = tiles.slice();
    for (let x = 0; x < width; x++) newTiles.push(makeTile(x, height));
    const resCount = newTiles.filter((t) => t.y === height && t.resource).length;
    return {
      ...state,
      resources: { ...state.resources, spirit: round2(state.resources.spirit - cost) },
      space: { ...state.space, height: height + 1, tiles: newTiles },
      eventLog: pushLog(state.eventLog, `灵质空间向南扩展了一行（-${cost} 灵质，发现 ${resCount} 处资源）`),
    };
  }
  return state;
}

/** 寻找 (x,y) 附近 radius 范围内第一个空地块（可选排除资源点） */
export function findFreeTileNear(state, x, y, radius = 4, excludeResource = true) {
  for (let r = 0; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const t = tileAt(state, x + dx, y + dy);
        if (t && !t.buildingId && (!excludeResource || !t.resource)) return { x: t.x, y: t.y };
      }
    }
  }
  return null;
}
