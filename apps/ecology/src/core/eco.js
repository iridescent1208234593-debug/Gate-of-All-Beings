// stage-12：生态经营指标 + 昼夜光照模型（纯函数，便于无头验证）
// 面板口径：
//   总能量 = 细胞存量能量 + 有机体存量能量 + 植物生物量折算能量
//   种群数 = 细胞 + 有机体 + 植物株（三类个体各计 1）
//   多样性 = 简化 Simpson 指数（1 - Σ(n_i/N)^2），物种划分 = 营养级角色 × 体型档
//   地图温度 = 由当前光照系数在夜晚/白昼温度之间线性插值
import { WORLD } from '../config/index.js';
import { roleOf } from './organism.js';

// 昼夜相位 -> 光照系数：0=午夜(最暗)、0.5=正午(最亮)，用余弦做平滑过渡
export function lightFactor(dayPhase, minLight = WORLD.dayNightMin) {
  const p = ((dayPhase % 1) + 1) % 1;
  const sun = 0.5 - 0.5 * Math.cos(p * Math.PI * 2); // 0..1，正午取 1
  return minLight + (1 - minLight) * sun;
}

// 光照 -> 温度（℃）：把光照系数归一化到「深夜->白昼」区间后再插值，
// 保证午夜（光照=dayNightMin）恰为 tempNightC、正午（光照=1）恰为 tempDayC。
export function temperatureOf(light) {
  const span = 1 - WORLD.dayNightMin;
  const k = span > 0 ? Math.max(0, Math.min(1, (light - WORLD.dayNightMin) / span)) : 1;
  return WORLD.tempNightC + (WORLD.tempDayC - WORLD.tempNightC) * k;
}

// 光照 -> 叶绿体产能倍率：白天全额，夜里压到 photoLightBase
export function photoLightMul(light) {
  return WORLD.photoLightBase + (1 - WORLD.photoLightBase) * light;
}

// 光照 -> 感知（视野）倍率：夜里视野显著变窄，捕食/觅食都更难
export function visionLightMul(light) {
  return WORLD.visionLightBase + (1 - WORLD.visionLightBase) * light;
}

// 相位 -> 时钟串（00:00 ~ 23:59），相位 0 为 00:00
export function formatClock(dayPhase) {
  const p = ((dayPhase % 1) + 1) % 1;
  const minutes = Math.floor(p * 24 * 60) % (24 * 60);
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// 简化 Simpson 多样性指数：入参为各物种个体数数组，空群落记 0
export function simpsonIndex(counts) {
  let total = 0;
  for (const n of counts) total += n;
  if (total <= 0) return 0;
  let sum = 0;
  for (const n of counts) {
    const f = n / total;
    sum += f * f;
  }
  return Math.max(0, 1 - sum);
}

// 体型档（细胞按半径、有机体按模块数分箱），用于划分“物种”维度
function radiusBucket(r) {
  const n = Math.round((r || 0) * 3);
  if (n <= 1) return 0;
  if (n <= 2) return 1;
  if (n <= 3) return 2;
  return 3;
}

function moduleBucket(m) {
  const n = Math.round(m || 0);
  if (n <= 3) return 0;
  if (n <= 5) return 1;
  if (n <= 7) return 2;
  return 3;
}

// 汇总面板所需的全部指标（每帧调用；规模为百级个体，开销可忽略）
export function computeEcoMetrics(state) {
  const cells = state.cells || [];
  const organisms = state.organisms || [];
  const plants = state.plants || [];

  let totalEnergy = 0;
  for (const c of cells) totalEnergy += c.energy || 0;
  for (const o of organisms) totalEnergy += o.energy || 0;
  let biomass = 0;
  for (const p of plants) biomass += p.biomass || 0;
  totalEnergy += biomass * WORLD.plantEnergyPerBiomass;

  // 物种划分：生产者 1 类；单细胞按半径档；有机体按营养级角色 × 模块数档
  const counts = new Map();
  const bump = (key) => counts.set(key, (counts.get(key) || 0) + 1);
  if (plants.length) counts.set('plant', plants.length);
  for (const c of cells) bump(`cell|${radiusBucket(c.radius)}`);
  for (const o of organisms) bump(`${roleOf(o)}|${moduleBucket(o.moduleCount)}`);

  const population = plants.length + cells.length + organisms.length;
  return {
    totalEnergy,
    population,
    cells: cells.length,
    organisms: organisms.length,
    plants: plants.length,
    biomass,
    species: counts.size,
    diversity: simpsonIndex([...counts.values()]),
    temperature: state.temperature ?? temperatureOf(state.light ?? 1),
    light: state.light ?? 1,
    dayPhase: state.dayPhase ?? 0,
  };
}
