// stage-13：气候与环境干预模型（纯函数，便于无头验证）
//
// 职责：
//   1) 基线气候温度：由玩家干预的“温度偏移”推出。昼夜波动只影响面板读数（地图温度），
//      选择压力看基线气候——否则每夜全体受寒，玩家调温的效果会被昼夜涨落淹没。
//   2) 温度胁迫：每个个体有自己的“最适温度”，由体细胞（body 模块）数量决定——
//      体细胞越多，体积/表面积比越小、越保温，最适温度越低（多体细胞 = 冷适应保温型）；
//      偏离最适温度超出耐受带的部分，折算成额外维持耗能（可维持秒数缩短 -> 先被淘汰）。
//   3) 初级生产力温度倍率：过冷/过热都让草地减产，这是“播种植物”干预的意义所在。
import { WORLD } from '../config/index.js';
import { temperatureOf } from './eco.js';

// 温度偏移夹取（干预的硬边界：不能一键冰封或蒸干整张图）
export function clampTempOffset(v) {
  const lim = WORLD.tempOffsetLimit;
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-lim, Math.min(lim, n));
}

// 地图温度（℃）：昼夜波动 + 玩家温度偏移。TICK 与 HUD 读数共用同一口径，
// 于是“升温”干预后地图温度整体抬升、读数立刻可见；
// 而选择压力仍看基线气候温度（baseTemperatureOf），不受昼夜涨落干扰。
export function mapTemperatureOf(light, tempOffset = 0) {
  return temperatureOf(light) + clampTempOffset(tempOffset);
}

// 基线气候温度（℃）：玩家调温直接作用于它
export function baseTemperatureOf(tempOffset = 0) {
  return WORLD.climateTempBase + clampTempOffset(tempOffset);
}

// 个体最适温度（℃）：单细胞个体 climateOptimalBase 起，
// 每多一个体细胞保温效应下移 climateInsulationPerBody（大块头耐寒）
export function optimalTempOf(organism) {
  const bodies = organism && organism.bodyCount ? organism.bodyCount : 1;
  return WORLD.climateOptimalBase - Math.max(0, bodies - 1) * WORLD.climateInsulationPerBody;
}

// 温度胁迫（0 = 舒适）：偏离最适温度、超出耐受带的那部分温差
export function tempStressOf(organism, temperature) {
  const t = Number.isFinite(temperature) ? temperature : WORLD.climateTempBase;
  const d = Math.abs(t - optimalTempOf(organism));
  return Math.max(0, d - WORLD.climateToleranceC);
}

// 温度胁迫 -> 维持耗能倍率（1 = 无额外开销）
export function tempDrainMul(organism, temperature) {
  return 1 + tempStressOf(organism, temperature) * WORLD.climateDrainPerStress;
}

// 适应型判定：体细胞多 = 保温型（冷适应）；体细胞少 = 散热型（暖适应）
export function isColdAdapted(organism) {
  return (organism && organism.bodyCount ? organism.bodyCount : 1) >= WORLD.climateColdBodyMin;
}

export function isWarmAdapted(organism) {
  return (organism && organism.bodyCount ? organism.bodyCount : 1) <= WORLD.climateWarmBodyMax;
}

// 种群适应型占比统计——stage-13 的验收口径：
// 「调高温度后，冷适应（多体细胞保温型）种群占比可观测变化」。
export function adaptationShares(organisms = []) {
  const list = Array.isArray(organisms) ? organisms : [];
  const total = list.length;
  const out = { total: 0, cold: 0, warm: 0, coldShare: 0, warmShare: 0, optimalTempAvg: 0 };
  if (!total) return out;
  let optSum = 0;
  for (const o of list) {
    if (isColdAdapted(o)) out.cold += 1;
    if (isWarmAdapted(o)) out.warm += 1;
    optSum += optimalTempOf(o);
  }
  out.total = total;
  out.coldShare = out.cold / total;
  out.warmShare = out.warm / total;
  out.optimalTempAvg = optSum / total;
  return out;
}

// 温度对初级生产力的影响：适宜区间内满产，偏离越远越减产（下限兜底，不至于绝收）
export function plantTempMul(temperature) {
  const t = Number.isFinite(temperature) ? temperature : WORLD.climateTempBase;
  const lo = WORLD.climatePlantMinC;
  const hi = WORLD.climatePlantMaxC;
  const d = t < lo ? lo - t : t > hi ? t - hi : 0;
  if (d <= 0) return 1;
  return Math.max(WORLD.climatePlantMinMul, 1 - d * WORLD.climatePlantDecayPerC);
}

// 气候带名（HUD 读数用；只返回语义名，色值仍由 theme token 决定）
export function climateBandOf(temperature) {
  const t = Number.isFinite(temperature) ? temperature : WORLD.climateTempBase;
  if (t < 0) return '严寒';
  if (t < WORLD.climatePlantMinC) return '寒冷';
  if (t <= WORLD.climatePlantMaxC) return '温和';
  if (t <= 38) return '炎热';
  return '酷热';
}

// 温度读数串（统一一位小数）
export function formatTemp(temperature) {
  const t = Number.isFinite(temperature) ? temperature : WORLD.climateTempBase;
  return `${t.toFixed(1)}℃`;
}
