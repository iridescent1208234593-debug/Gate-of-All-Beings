import { random } from './random.js';
// 环境分区系统（stage-10）：
// 把场地沿 x 轴均分为若干“营养带”（富营养 -> 过渡 -> 贫瘠），各区营养丰度
// 决定食物池配额与再生速度，从而形成“食物稀缺压力”：
//   富营养区 —— 食物多、再生快，能供养模块多（体型大、耗能高）的有机体；
//   贫瘠区   —— 食物少、再生慢，只有模块少（体型小、耗能低）的个体撑得住。
// 此外提供按区取点、按存活比例派生的 spawn 权重与分区统计，供 auto-evo 使用。
import { WORLD } from '../config/index.js';

export const ZONE_COUNT = WORLD.envZoneCount;

export const ZONE_CN = ['富营养区', '过渡区', '贫瘠区'];

// 第 i 个区在 x 轴上的区间 [x0, x1]
export function zoneSpan(i) {
  const w = (WORLD.bounds * 2) / ZONE_COUNT;
  const x0 = -WORLD.bounds + i * w;
  return [x0, x0 + w];
}

// 第 i 个区在 x 轴上的中心（stage-10：个体归巢/区域统计用）
export function zoneCenterX(i) {
  const [x0, x1] = zoneSpan(i);
  return (x0 + x1) / 2;
}

// 某世界 x 坐标落在哪个区
export function zoneIndexAt(x) {
  const t = (x + WORLD.bounds) / (WORLD.bounds * 2);
  const i = Math.floor(t * ZONE_COUNT);
  return Math.max(0, Math.min(ZONE_COUNT - 1, i));
}

// 第 i 区营养丰度（0..1）
export function zoneRichness(i) {
  const idx = Math.max(0, Math.min(ZONE_COUNT - 1, i | 0));
  return WORLD.envZoneRichness[idx] ?? 0;
}

// 任意 x 处的营养丰度
export function richnessAt(x) {
  return zoneRichness(zoneIndexAt(x));
}

// 第 i 区的模块数承载力上限（stage-10）：低产区供养不起太多细胞模块，
// 因此该区谱系的体型被环境硬性约束在较小范围（富营养 9 / 过渡 7 / 贫瘠 5）。
export function zoneModuleCap(i) {
  const idx = Math.max(0, Math.min(ZONE_COUNT - 1, i | 0));
  const cap = WORLD.orgZoneModuleCap[idx];
  return Number.isFinite(cap) ? cap : WORLD.orgGridSize * WORLD.orgGridSize;
}

const RICHNESS_SUM =
  WORLD.envZoneRichness.reduce((s, r) => s + r, 0) || 1;

// 丰度偏置权重：pow = 1 时按丰度线性分摊；pow > 1 时富营养带独占更大份额，
// 让“本区供给能否养得起这种体型”的差异被显著放大（stage-10 体型分异标定用）。
function quotaWeight(i) {
  const r = Math.max(0, zoneRichness(i));
  const pow = Number.isFinite(WORLD.envZoneQuotaPow) ? WORLD.envZoneQuotaPow : 1;
  return Math.pow(r, pow);
}

// 各区食物池配额：按营养丰度分摊全局 foodTarget，并乘全局稀缺系数
// （envFoodScarcity < 1 -> 总供给略低于需求，形成竞争压力）
export function zoneFoodQuota(i) {
  let sum = 0;
  for (let k = 0; k < ZONE_COUNT; k++) sum += quotaWeight(k);
  const share = quotaWeight(i) / (sum || 1);
  return Math.max(1, Math.round(WORLD.foodTarget * WORLD.envFoodScarcity * share));
}

// 按权重选一个区（默认均分）；权重通常来自上一代各区存活比例
export function pickZone(weights, rng = random) {
  const w =
    Array.isArray(weights) && weights.length === ZONE_COUNT
      ? weights.map((x) => Math.max(0.001, Number(x) || 0))
      : new Array(ZONE_COUNT).fill(1 / ZONE_COUNT);
  const sum = w.reduce((s, x) => s + x, 0);
  let r = rng() * sum;
  for (let i = 0; i < ZONE_COUNT; i++) {
    r -= w[i];
    if (r <= 0) return i;
  }
  return ZONE_COUNT - 1;
}

// 在第 i 区带内取随机 xz 坐标（margin 收拢到场内，避免贴边）
export function randomPosInZone(i, rng = random, margin = 1) {
  const [x0, x1] = zoneSpan(i);
  const span = Math.max(0.001, x1 - x0 - margin * 2);
  const x = x0 + margin + rng() * span;
  const b = WORLD.bounds - margin;
  const z = -b + rng() * b * 2;
  return [x, z];
}

// 分区统计：各区有机体数量 / 平均模块数 / 平均体型分 / 存活占比
// stage-10：以“出生带归属”(o.zone) 归属统计，衡量各营养带本地谱系的体型结构；
// 位置统计（“当前活动在该带”）另存为 inPlaceCount，供 HUD 观察个体迁移。
export function zoneOrganismStats(organisms, sizeScoreFn) {
  const rows = [];
  for (let i = 0; i < ZONE_COUNT; i++) {
    rows.push({
      zone: i,
      name: ZONE_CN[i] || `区${i}`,
      richness: zoneRichness(i),
      count: 0,
      inPlaceCount: 0,
      moduleAvg: 0,
      sizeAvg: 0,
      ratio: 0,
    });
  }
  for (const o of organisms) {
    const home = Number.isInteger(o.zone) ? o.zone : zoneIndexAt(o.pos[0]);
    const row = rows[home];
    const here = rows[zoneIndexAt(o.pos[0])];
    if (here) here.inPlaceCount += 1;
    if (!row) continue;
    row.count += 1;
    row.moduleAvg += o.moduleCount || 0;
    row.sizeAvg += sizeScoreFn ? sizeScoreFn(o) : o.bodyCount || 0;
  }
  for (const row of rows) {
    if (row.count > 0) {
      row.moduleAvg /= row.count;
      row.sizeAvg /= row.count;
    }
    row.ratio = organisms.length ? row.count / organisms.length : 0;
  }
  return rows;
}
