import { random } from '../core/random.js';
// 网格地形（stage-11）：草地 / 水域 / 沙地
//
// 设计：
//   1) 用「同种子可复现」的乘法同余 PRNG 生成一张粗网格随机高度场，
//      再做双线性插值得到平滑地形（无三方依赖，纯 JS）。
//   2) 不直接用固定阈值切分，而是按高度场的**分位数**切分——这样任意种子下
//      水域/沙地/草地的占比都恒定（验收时地形分布稳定，不会因为种子抽到"全水图"）。
//   3) 地图是**不可变**数据：一次生成后只读，因此各 tick 直接共享同一引用，无需复制。
//   4) stage-13：环境干预会改写地表（排水/注水），仍走不可变更新——withTileChanged
//      返回新地图对象并递增 rev（渲染层按 rev 重建瓦片实例），草地索引表同步重建。
//
// 对外能力：瓦片查询（世界坐标 / 网格坐标）、网格<->世界换算、草地格列表、按营养带加权的
// 随机草地取点（供植物萌发用）、单格地表改写（环境干预）。
import { WORLD } from '../config/index.js';
import { zoneIndexAt, zoneRichness } from '../core/environment.js';

export const TILE = {
  GRASS: 0, // 草地：可生长植物（生产者基底）
  WATER: 1, // 水域：不产植物
  SAND: 2,  // 沙地：岸线贫瘠地，不产植物
};

// 瓦片 -> 中文名 / 主题 token 键（禁硬编码色值，颜色统一取 COLORS.tile[key]）
export const TILE_CN = { 0: '草地', 1: '水域', 2: '沙地' };
export const TILE_KEY = { 0: 'grass', 1: 'water', 2: 'sand' };

// mulberry32：小而稳的种子 PRNG（同种子 -> 同序列）
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 粗网格随机值 + 双线性插值 -> 平滑高度场（0..1）
function heightField(cols, rows, rng, coarse) {
  const c = Math.max(2, coarse | 0);
  const grid = [];
  for (let y = 0; y <= c; y++) {
    const row = new Array(c + 1);
    for (let x = 0; x <= c; x++) row[x] = rng();
    grid.push(row);
  }
  const field = new Float32Array(cols * rows);
  for (let y = 0; y < rows; y++) {
    const fy = (y / Math.max(1, rows - 1)) * c;
    const y0 = Math.min(c, Math.floor(fy));
    const y1 = Math.min(c, y0 + 1);
    const ty = fy - y0;
    for (let x = 0; x < cols; x++) {
      const fx = (x / Math.max(1, cols - 1)) * c;
      const x0 = Math.min(c, Math.floor(fx));
      const x1 = Math.min(c, x0 + 1);
      const tx = fx - x0;
      const a = grid[y0][x0] * (1 - tx) + grid[y0][x1] * tx;
      const b = grid[y1][x0] * (1 - tx) + grid[y1][x1] * tx;
      field[y * cols + x] = a * (1 - ty) + b * ty;
    }
  }
  return field;
}

// 生成地图：{ cols, rows, seed, tiles:Uint8Array, cellSize, half }
export function createMap(opts = {}) {
  const cols = Math.max(4, opts.cols ?? WORLD.mapCols);
  const rows = Math.max(4, opts.rows ?? WORLD.mapRows);
  const seed = opts.seed ?? WORLD.mapSeed;
  const rng = makeRng(seed);

  const field = heightField(cols, rows, rng, opts.coarse ?? WORLD.mapCoarse);

  // 按分位数定阈值 -> 各类瓦片占比恒定（水域最低、沙地次之、草地最多）
  const sorted = Float32Array.from(field).sort();
  const n = sorted.length;
  const waterFrac = Math.max(0, Math.min(0.8, opts.waterFrac ?? WORLD.mapWaterFrac));
  const sandFrac = Math.max(0, Math.min(0.8 - waterFrac, opts.sandFrac ?? WORLD.mapSandFrac));
  const waterCut = sorted[Math.min(n - 1, Math.floor(waterFrac * n))];
  const sandCut = sorted[Math.min(n - 1, Math.floor((waterFrac + sandFrac) * n))];

  const tiles = new Uint8Array(cols * rows);
  const grassList = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const h = field[gy * cols + gx];
      const t = h <= waterCut ? TILE.WATER : h <= sandCut ? TILE.SAND : TILE.GRASS;
      tiles[gy * cols + gx] = t;
      if (t === TILE.GRASS) grassList.push({ gx, gy });
    }
  }

  const half = WORLD.bounds;
  const cellSize = (half * 2) / cols;
  // rev：地表改写版本号（stage-13 环境干预每次改格 +1，渲染层据此重建瓦片实例）
  return { cols, rows, seed, tiles, cellSize, half, grassList, heightField: field, rev: 0 };
}

// 瓦片尺寸（x/z 同宽；世界为 [−bounds, bounds] 正方形）
export function cellSizeOf(map) {
  return map.cellSize;
}

// 世界坐标 -> 网格坐标（夹在界内，越界时贴边）
export function worldToGrid(map, x, z) {
  const gx = Math.min(map.cols - 1, Math.max(0, Math.floor((x + map.half) / map.cellSize)));
  const gy = Math.min(map.rows - 1, Math.max(0, Math.floor((z + map.half) / map.cellSize)));
  return { gx, gy };
}

// 网格坐标 -> 世界坐标（格心；rng 传入时在格内做轻微抖动，避免植物排成行列）
export function gridToWorld(map, gx, gy, rng = null) {
  const cx = -map.half + (gx + 0.5) * map.cellSize;
  const cz = -map.half + (gy + 0.5) * map.cellSize;
  if (!rng) return [cx, cz];
  const jx = (rng() * 2 - 1) * map.cellSize * 0.3;
  const jz = (rng() * 2 - 1) * map.cellSize * 0.3;
  return [cx + jx, cz + jz];
}

export function tileAtGrid(map, gx, gy) {
  if (gx < 0 || gy < 0 || gx >= map.cols || gy >= map.rows) return TILE.WATER;
  return map.tiles[gy * map.cols + gx];
}

// 世界坐标处的瓦片类型
export function tileAt(map, x, z) {
  const { gx, gy } = worldToGrid(map, x, z);
  return tileAtGrid(map, gx, gy);
}

export function isWaterAt(map, x, z) {
  return tileAt(map, x, z) === TILE.WATER;
}

export function isGrassAt(map, x, z) {
  return tileAt(map, x, z) === TILE.GRASS;
}

export function grassTiles(map) {
  return map.grassList || [];
}

// 瓦片统计：{ grass, water, sand, total, grassFrac }
export function tileCounts(map) {
  let grass = 0;
  let water = 0;
  let sand = 0;
  for (let i = 0; i < map.tiles.length; i++) {
    const t = map.tiles[i];
    if (t === TILE.GRASS) grass += 1;
    else if (t === TILE.WATER) water += 1;
    else sand += 1;
  }
  const total = map.tiles.length || 1;
  return { grass, water, sand, total, grassFrac: grass / total };
}

// 世界坐标 -> 最近的可通行陆地（草地/沙地）格心；本身已在陆地则原样返回。
// stage-11 用途：有机体出生/分裂/补播时落位，避免「水域不可通行」的规则把个体
// 一出生就困在水里（水域对陆地生物是硬障碍，见 core/behaviors.js 的 isBlocked）。
export function nearestLandPos(map, x, z) {
  const { gx, gy } = worldToGrid(map, x, z);
  if (tileAtGrid(map, gx, gy) !== TILE.WATER) return [x, z];
  const maxR = Math.max(map.cols, map.rows);
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // 只扫当前这一圈的边框，保证按「距离递增」找到的就是最近陆地
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = gx + dx;
        const ny = gy + dy;
        if (tileAtGrid(map, nx, ny) === TILE.WATER) continue;
        return gridToWorld(map, nx, ny);
      }
    }
  }
  return [x, z];
}

// 按「本营养带初级生产力」加权随机取一个草地格：
// 富营养带草地更肥、植物萌发概率更高，贫瘠带草地稀薄——与 stage-10 的丰度梯度一致。
// 拒绝采样，最多尝试 tries 次；全部失败则退化为均匀取一格（保证不会取不到）。
export function randomGrassTile(map, rng = random, tries = 8) {
  const list = grassTiles(map);
  if (!list.length) return null;
  for (let i = 0; i < tries; i++) {
    const t = list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
    const [x] = gridToWorld(map, t.gx, t.gy);
    const richness = zoneRichness(zoneIndexAt(x));
    const p = WORLD.plantZoneBase + (1 - WORLD.plantZoneBase) * richness;
    if (rng() <= p) return t;
  }
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

// 单格地表改写（stage-13 环境干预：排水成陆 / 注水成湖）：
//   - 仍走不可变更新：返回新地图对象，tiles 为新副本，原对象不动（单向数据流）；
//   - 高度场保持不变（只改地表类型），草地索引表 grassList 按新瓦片表整体重建；
//   - rev 递增，渲染层据此重建瓦片实例。
// 非法格 / 类型未变时原样返回原对象（调用方据此判定“无效操作”）。
export function withTileChanged(map, gx, gy, tile) {
  if (!map) return map;
  const x = Math.floor(gx);
  const y = Math.floor(gy);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return map;
  if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) return map;
  if (tile !== TILE.GRASS && tile !== TILE.WATER && tile !== TILE.SAND) return map;
  const idx = y * map.cols + x;
  if (map.tiles[idx] === tile) return map;

  const tiles = Uint8Array.from(map.tiles);
  tiles[idx] = tile;
  const grassList = [];
  for (let gy2 = 0; gy2 < map.rows; gy2++) {
    for (let gx2 = 0; gx2 < map.cols; gx2++) {
      if (tiles[gy2 * map.cols + gx2] === TILE.GRASS) grassList.push({ gx: gx2, gy: gy2 });
    }
  }
  return { ...map, tiles, grassList, rev: (map.rev || 0) + 1 };
}
