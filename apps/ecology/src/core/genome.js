import { random } from './random.js';
// 基因数据模型（stage-03）：0..1 归一化基因 + 随机变异 + 表型推导
// 基因：{ speed, size, perception, metabolism, color }
// 颜色基因不存具体色值，只决定取调色板第几档（禁止硬编码色值）
import { COLORS, GENOME } from '../config/index.js';

export const GENE_KEYS = ['speed', 'size', 'perception', 'metabolism', 'color'];

// 随机初始基因（用于第一代细胞）
export function createRandomGenome() {
  const g = {};
  for (const k of GENE_KEYS) g[k] = random();
  return g;
}

// 子代继承父基因：每个基因以 rate 概率发生 ±amount 相对突变，并夹回 [0,1]
export function mutate(genome, rate = GENOME.mutationRate, amount = GENOME.mutationAmount) {
  const g = { ...genome };
  for (const k of GENE_KEYS) {
    if (random() < rate) {
      const v = g[k] + (random() * 2 - 1) * amount;
      g[k] = Math.min(1, Math.max(0, v));
    }
  }
  return g;
}

// 一组基因的均值（灭绝重播种的父本基因池来源；亦可作简单存活倾向统计）
export function averageGenome(genomes) {
  const out = {};
  for (const k of GENE_KEYS) out[k] = 0;
  if (!genomes || genomes.length === 0) return out;
  for (const g of genomes) for (const k of GENE_KEYS) out[k] += g[k];
  for (const k of GENE_KEYS) out[k] /= genomes.length;
  return out;
}

function lerpGene(range, v) {
  return range[0] + (range[1] - range[0]) * v;
}

// 基因 -> 行为/外观表型（供 state 落细胞字段、渲染/寻路直接消费）
export function deriveTraits(genome) {
  return {
    speed: lerpGene(GENOME.speed, genome.speed),
    radius: lerpGene(GENOME.size, genome.size),
    senseRange: lerpGene(GENOME.perception, genome.perception),
    metabolismMul: lerpGene(GENOME.metabolism, genome.metabolism),
    colorIndex: Math.min(COLORS.cell.length - 1, Math.floor(genome.color * GENOME.colorCount)),
  };
}
