/**
 * 灵境会馆 - 104×104 地形生成器（独立模块，暂不替换主循环 GRID 24×16）
 * 用自实现值噪声（value noise）+ 分形叠加（fbm）生成高度图，
 * 分类产出 山地(mountain) / 平原(plain) / 高山雪(highMountain) / 河流(river)。
 * 支持随机种子与可配置参数（频率/阈值/河流数量等），同种子同参数结果完全一致（纯函数）。
 */
export const TERRAIN_TYPES = {
  plain: { id: 'plain', name: '平原', color: '#6fa872', order: 0 },
  mountain: { id: 'mountain', name: '山地', color: '#8a7f6a', order: 1 },
  highMountain: { id: 'highMountain', name: '高山雪', color: '#e8eef5', order: 2 },
  river: { id: 'river', name: '河流', color: '#4a90d9', order: 3 },
};

export const DEFAULT_CONFIG = {
  frequency: 0.05, // 基础噪声频率（越小地形越平缓）
  octaves: 4, // 分形叠加层数
  persistence: 0.5, // 每层振幅衰减
  lacunarity: 2.0, // 每层频率增长
  mountainThreshold: 0.62, // 高度超过则归为山地
  snowThreshold: 0.78, // 高度超过则归为高山雪（在 mountain 之后判断）
  riverCount: 4, // 河流条数
  riverWidth: 1, // 河流宽度（格子数，1 为中心河床）
  riverStartBias: 0.3, // 河流起点集中在画面上部比例
};

/** 确定性伪随机数生成器（mulberry32），返回 [0,1) 函数 */
export function mulberry32(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 字符串种子 → 32 位整数种子（稳定可复现） */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 二维值噪声（value noise）。
 * 返回 (x, y) => [0,1]，平滑插值（smoothstep），周期性 256 格子采样值表由种子生成。
 */
export function makeValueNoise2D(seed) {
  const rand = mulberry32(hashSeed(`vnoise-${seed}`));
  const SIZE = 256;
  const perm = new Uint8Array(SIZE * 2);
  const table = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    perm[i] = i;
    table[i] = rand();
  }
  for (let i = SIZE - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }
  for (let i = 0; i < SIZE; i++) perm[SIZE + i] = perm[i];

  const fade = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;

  return function noise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = fade(xf);
    const v = fade(yf);
    const x0 = xi & (SIZE - 1);
    const y0 = yi & (SIZE - 1);
    const p00 = perm[x0 + perm[y0]];
    const p10 = perm[x0 + 1 + perm[y0]];
    const p01 = perm[x0 + perm[y0 + 1]];
    const p11 = perm[x0 + 1 + perm[y0 + 1]];
    const n00 = table[p00];
    const n10 = table[p10];
    const n01 = table[p01];
    const n11 = table[p11];
    const nx = lerp(n00, n10, u);
    const ny = lerp(n01, n11, u);
    return lerp(nx, ny, v);
  };
}

/** 分形叠加噪声（fbm），返回 [0,1] */
export function fbm2D(noise, x, y, cfg) {
  const octaves = cfg.octaves || DEFAULT_CONFIG.octaves;
  const persistence = cfg.persistence ?? DEFAULT_CONFIG.persistence;
  const lacunarity = cfg.lacunarity || DEFAULT_CONFIG.lacunarity;
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** 按高度阈值分类（河流在最后覆盖） */
export function classifyTerrain(height, cfg) {
  if (height >= cfg.snowThreshold) return TERRAIN_TYPES.highMountain.id;
  if (height >= cfg.mountainThreshold) return TERRAIN_TYPES.mountain.id;
  return TERRAIN_TYPES.plain.id;
}

/** 河流：从上部随机起点向下随机游走，标记 riverWidth 宽的连续河段 */
function carveRivers(grid, width, height, cfg, rand) {
  const riverCount = cfg.riverCount ?? DEFAULT_CONFIG.riverCount;
  const riverWidth = Math.max(1, Math.floor(cfg.riverWidth ?? DEFAULT_CONFIG.riverWidth));
  for (let r = 0; r < riverCount; r++) {
    let x = Math.floor(rand() * width);
    let y = Math.floor(rand() * height * (cfg.riverStartBias ?? DEFAULT_CONFIG.riverStartBias));
    let step = 0;
    const maxStep = width + height;
    while (y < height && step < maxStep) {
      // 中心河床
      for (let dx = -riverWidth; dx <= riverWidth; dx++) {
        const cx = x + dx;
        if (cx >= 0 && cx < width) {
          const idx = y * width + cx;
          grid[idx].terrain = TERRAIN_TYPES.river.id;
          grid[idx].height = Math.min(grid[idx].height, 0.25); // 河流处压低高度
        }
      }
      // 随机游走：主要向下，横向小幅摆动（偶尔分支感）
      y += 1;
      const sway = rand() < 0.35 ? (rand() < 0.5 ? -1 : 1) : 0;
      x = Math.max(0, Math.min(width - 1, x + sway));
      step++;
    }
  }
}

/**
 * 生成地形网格。
 * @param {object} [options]
 * @param {number} [options.width=104]
 * @param {number} [options.height=104]
 * @param {number|string} [options.seed] 数字或字符串种子；默认固定种子保证可复现
 * @param {object} [options.config] 覆盖 DEFAULT_CONFIG 的可选参数
 * @returns {{ width, height, seed, config, cells: Array<{x,y,height,terrain}>, get(x,y), stats }}
 */
export function generateTerrain(options = {}) {
  const width = Math.floor(options.width ?? 104);
  const height = Math.floor(options.height ?? 104);
  const seed = options.seed ?? 'lingjing-terrain-default';
  const cfg = { ...DEFAULT_CONFIG, ...(options.config || {}) };

  const numericSeed = typeof seed === 'number' ? seed >>> 0 : hashSeed(String(seed));
  const rand = mulberry32(numericSeed);
  const noise = makeValueNoise2D(numericSeed ^ 0x5bd1e995);

  const cells = new Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 噪声输入带轻微坐标偏移 + 频率缩放
      const nx = x * cfg.frequency;
      const ny = y * cfg.frequency;
      const heightValue = fbm2D(noise, nx, ny, cfg);
      const idx = y * width + x;
      cells[idx] = {
        x,
        y,
        height: Math.max(0, Math.min(1, heightValue)),
        terrain: classifyTerrain(heightValue, cfg),
      };
    }
  }

  // 河流最后覆盖（独立随机游走，与高度图分类不冲突）
  carveRivers(cells, width, height, cfg, rand);

  const stats = summarize(cells);
  return {
    width,
    height,
    seed,
    config: cfg,
    cells,
    get(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return null;
      return cells[y * width + x];
    },
    stats,
  };
}

/** 各地形统计：{ plain: n, mountain: n, highMountain: n, river: n } */
export function summarize(cells) {
  const stats = { plain: 0, mountain: 0, highMountain: 0, river: 0 };
  for (const c of cells) {
    if (stats[c.terrain] !== undefined) stats[c.terrain]++;
  }
  return stats;
}

/** 二维数组视图 grid[y][x] = cell（可选，便于直接取用） */
export function to2D(terrain) {
  const grid = [];
  for (let y = 0; y < terrain.height; y++) {
    grid.push(terrain.cells.slice(y * terrain.width, (y + 1) * terrain.width));
  }
  return grid;
}
