// Auto-Evo（stage-04）：每 N 秒结算一代存活者统计
// 记录存活种群的表型均值与平均基因，供 HUD/后续选择压力与模块布局统计复用
// stage-10：扩展有机体（organism）层结算——模块布局构成、体型趋势与环境分区分布
// stage-13：追加气候快照与适应型占比（温度干预的选择压力证据）
import { averageGenome } from './genome.js';
import { zoneOrganismStats } from './environment.js';
import { organismSizeScore, layoutSignature } from './organism.js';
import { adaptationShares } from './climate.js';
import { WORLD } from '../config/index.js';

export function computeGeneration(cells, gen, time) {
  const alive = cells.length;
  if (alive === 0) {
    return {
      gen,
      time,
      alive: 0,
      speedAvg: 0,
      sizeAvg: 0,
      senseAvg: 0,
      colorCount: 0,
      avgGenome: null,
    };
  }
  let speedSum = 0;
  let sizeSum = 0;
  let senseSum = 0;
  const colorSet = new Set();
  for (const c of cells) {
    speedSum += c.speed;
    sizeSum += c.radius;
    senseSum += c.senseRange;
    colorSet.add(c.colorIndex);
  }
  return {
    gen,
    time,
    alive,
    speedAvg: speedSum / alive,
    sizeAvg: sizeSum / alive,
    senseAvg: senseSum / alive,
    colorCount: colorSet.size,
    avgGenome: averageGenome(cells.map((c) => c.genome)),
  };
}

// stage-10：有机体世代结算——模块布局 / 体型 / 分区分布 / 最优势布局签名。
// 返回结构直接喂给趋势图与 HUD：moduleAvg 反映“体型趋势”（模块越多越重），
// zones 数组则给出各营养带里的存活数量与平均模块数（环境分异的证据）。
// stage-13：额外记录当代的气候快照与适应型占比（冷适应=多体细胞保温型 / 暖适应=散热型），
//           调温干预后逐代对比这两项，即可观察到“冷适应占比下降”这类可观测变化。
export function computeOrganismGeneration(organisms, gen, time, env = null) {
  const alive = organisms.length;
  const zones = zoneOrganismStats(organisms, organismSizeScore);
  const climate = computeClimateRecord(organisms, env);
  if (alive === 0) {
    return {
      gen,
      time,
      alive: 0,
      moduleAvg: 0,
      bodyAvg: 0,
      flagAvg: 0,
      mouthAvg: 0,
      chloroAvg: 0,
      sizeAvg: 0,
      signature: '--',
      zones,
      trend: 0,
      climate,
      nnCount: 0, // stage-14：无存活个体时认知谱系计数归零
      nnShare: 0,
    };
  }
  let moduleSum = 0;
  let nnAlive = 0; // stage-14：带神经网络的个体数（认知谱系占比）
  let bodySum = 0;
  let flagSum = 0;
  let mouthSum = 0;
  let chloroSum = 0;
  let sizeSum = 0;
  const sigCount = new Map();
  for (const o of organisms) {
    moduleSum += o.moduleCount || 0;
    bodySum += o.bodyCount || 0;
    flagSum += o.flagCount || 0;
    mouthSum += o.mouthCount || 0;
    chloroSum += o.chloroCount || 0;
    sizeSum += organismSizeScore(o);
    if (o.brain) nnAlive += 1; // stage-14：带脑个体计数
    const sig = layoutSignature(o.layout);
    sigCount.set(sig, (sigCount.get(sig) || 0) + 1);
  }
  // 最优势布局（出现次数最多，同票取体细胞更少者 —— 小体型更易维持）
  let signature = '--';
  let bestN = -1;
  for (const [sig, n] of sigCount) {
    if (n > bestN) {
      bestN = n;
      signature = sig;
    }
  }
  return {
    gen,
    time,
    alive,
    moduleAvg: moduleSum / alive,
    bodyAvg: bodySum / alive,
    flagAvg: flagSum / alive,
    mouthAvg: mouthSum / alive,
    chloroAvg: chloroSum / alive,
    sizeAvg: sizeSum / alive,
    signature,
    sigShare: bestN / alive,
    zones,
    trend: 0, // 由 reducer 与上一代对比后填充
    climate,  // stage-13：当代气候快照 + 适应型占比
    // ---- stage-14：带神经网络的个体数与占比（认知谱系随世代扩散/衰减的直接证据）----
    nnCount: nnAlive,
    nnShare: nnAlive / alive,
  };
}

// stage-13：当代气候快照——基线气候温度、温度偏移、昼夜地图温度与初级生产力倍率，
// 外加种群适应型占比（冷适应 / 暖适应 / 平均最适温度），供逐代对比干预效果。
function computeClimateRecord(organisms, env) {
  const shares = adaptationShares(organisms);
  return {
    climateTemp: env && Number.isFinite(env.climateTemp) ? env.climateTemp : WORLD.climateTempBase,
    tempOffset: env && Number.isFinite(env.tempOffset) ? env.tempOffset : 0,
    mapTemp: env && Number.isFinite(env.temperature) ? env.temperature : WORLD.climateTempBase,
    plantMul: env && Number.isFinite(env.plantMul) ? env.plantMul : 1,
    cold: shares.cold,
    warm: shares.warm,
    coldShare: shares.coldShare,
    warmShare: shares.warmShare,
    optimalTempAvg: shares.optimalTempAvg,
  };
}

