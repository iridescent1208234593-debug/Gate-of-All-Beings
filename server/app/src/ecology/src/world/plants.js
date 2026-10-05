import { random } from '../core/random.js';
// 生产者：草地植物（stage-11）
//
// 生态金字塔的底座——植物只在**草地瓦片**上萌发，靠时间恢复生物量（植物量而非能量单位）；
// 草食者取食时按生物量收割，能量 = 摄取的生物量 × 本带初级生产力系数。
//
// 数据：{ id, gx, gy, pos:[x,z], biomass, maxBiomass }
// 所有函数均返回新数组（单向数据流：reducer 内替换 state.plants，不在原地改）。
import { WORLD } from '../config/index.js';
import { randomGrassTile, gridToWorld, TILE } from './map.js';
import { zoneIndexAt, zoneRichness } from '../core/environment.js';

// 单株植物：生物量决定可被收割的能量池，也决定渲染大小/颜色档位
export function makePlant(id, map, tile, rng = random, biomass = WORLD.plantStartBiomass) {
  const [x, z] = gridToWorld(map, tile.gx, tile.gy, rng);
  return {
    id,
    gx: tile.gx,
    gy: tile.gy,
    tile: TILE.GRASS,
    pos: [x, z],
    biomass: Math.min(WORLD.plantMaxBiomass, Math.max(1, biomass)),
    maxBiomass: WORLD.plantMaxBiomass,
  };
}

// 初始植被覆盖：在草地上撒 plantTarget 株（生物量随机，开局就有得吃）
export function createInitialPlants(map, startId, rng = random) {
  const plants = [];
  let id = startId;
  const grass = map.grassList || [];
  if (!grass.length) return { plants, nextId: id };
  for (let i = 0; i < WORLD.plantTarget; i++) {
    const tile = randomGrassTile(map, rng);
    if (!tile) break;
    const b = 4 + rng() * (WORLD.plantMaxBiomass - 4);
    plants.push(makePlant(id++, map, tile, rng, b));
  }
  return { plants, nextId: id };
}

// 每 tick 植物生长：
//   1) 已有植株恢复生物量（+plantGrowPerSec，封顶 maxBiomass）
//   2) 存量低于 plantTarget 时按 plantRegenPerSec 萌发新株（只在草地、按本带丰度加权取点）
// stage-13：growthMul 为初级生产力温度倍率（climate.plantTempMul）——过冷/过热整图减产，
//           使「播种植物」成为可以救急的环境干预手段。
// 返回 { plants, nextId, acc, spawned, biomassGain }
export function growPlants(plants, map, dt, acc = 0, nextId = 0, rng = random, growthMul = 1) {
  const mul = Number.isFinite(growthMul) && growthMul > 0 ? growthMul : 1;
  let biomassGain = 0;
  const next = plants.map((p) => {
    if (p.biomass >= p.maxBiomass) return p;
    const added = Math.min(p.maxBiomass - p.biomass, WORLD.plantGrowPerSec * mul * dt);
    if (added <= 0) return p;
    biomassGain += added;
    return { ...p, biomass: p.biomass + added };
  });

  let spawned = 0;
  let acc2 = acc + WORLD.plantRegenPerSec * mul * dt;
  let id = nextId;
  while (acc2 >= 1 && next.length < WORLD.plantTarget) {
    acc2 -= 1;
    const tile = randomGrassTile(map, rng);
    if (!tile) break;
    next.push(makePlant(id++, map, tile, rng, 2 + rng() * 4));
    spawned += 1;
  }
  // 已满员时不再累积，避免存量下降瞬间"补偿性爆发"
  if (next.length >= WORLD.plantTarget) acc2 = 0;
  return { plants: next, nextId: id, acc: acc2, spawned, biomassGain };
}

// 本带初级生产力：贫瘠带草地极瘦（plantZoneBase 兜底），富营养带牧草丰美。
// 取食能量与植物萌发权重共用同一口径，保证梯度一致。
export function plantZoneMul(x) {
  const r = zoneRichness(zoneIndexAt(x));
  return WORLD.plantZoneBase + (1 - WORLD.plantZoneBase) * r;
}

// 全部植物的生物量总和（HUD 观测口径：生产者存量）
export function totalBiomass(plants) {
  let s = 0;
  for (const p of plants) s += p.biomass;
  return s;
}

// 植物成熟度 0..1（渲染色档位：幼株 -> 成熟）
export function biomassRatio(p) {
  return Math.min(1, Math.max(0, p.biomass / p.maxBiomass));
}
