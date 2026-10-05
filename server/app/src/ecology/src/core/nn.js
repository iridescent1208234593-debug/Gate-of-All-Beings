import { random } from './random.js';
// 简易神经网络个体（stage-14）：让一部分有机体长出「极简大脑」
// 拓扑固定为 [6,4,4] 的纯前向网络：
//   6 输入 -> 4 隐层(tanh) -> 4 输出(tanh)，输出得分最大者即所选动作
//   输入：食物接近度 / 食物方向 x / 食物方向 z / 威胁接近度 / 自身能量比 / 当前光照
//   输出：见 NN_ACTIONS（觅食 / 逃离 / 捕猎 / 光合）——「巡游」不占输出位，
//         当网络选中的动作在本帧不可执行时由 behaviors.js 回退到规则决策。
// 无脑个体继续走 behaviors.js 的规则决策；有脑个体的权重随繁殖变异
// （子代 = 父代权重 + 概率扰动），于是「会思考」的谱系可被选择压力筛选。
// 纯 JS 实现，不依赖 three.js / 任何框架；权重用普通数组，便于复制、变异与无头测试。

export const NN_SHAPE = [6, 4, 4];
export const NN_INPUTS = NN_SHAPE[0];  // 感知输入维度
export const NN_HIDDEN = NN_SHAPE[1];  // 隐层神经元数
export const NN_OUTPUTS = NN_SHAPE[2]; // 输出（可选动作）维度

// 输出索引 -> 动作名（与 behaviors.BEHAVIOR 的取值同名，便于直接构造行为对象）
export const NN_ACTIONS = ['seek', 'flee', 'chase', 'photo'];

function uniform(rng, scale) {
  return (rng() * 2 - 1) * scale;
}

function clampLimit(v, limit) {
  return v > limit ? limit : v < -limit ? -limit : v;
}

// 随机初始大脑：小权重初始化（避免一上来就饱和在 tanh 两端、所有动作得分相同）
export function createBrain(rng = random) {
  const s1 = 1 / Math.sqrt(NN_INPUTS);
  const w1 = [];
  const b1 = [];
  for (let j = 0; j < NN_HIDDEN; j++) {
    const row = [];
    for (let i = 0; i < NN_INPUTS; i++) row.push(uniform(rng, s1));
    w1.push(row);
    b1.push(uniform(rng, 0.1));
  }
  const s2 = 1 / Math.sqrt(NN_HIDDEN);
  const w2 = [];
  const b2 = [];
  for (let k = 0; k < NN_OUTPUTS; k++) {
    const row = [];
    for (let j = 0; j < NN_HIDDEN; j++) row.push(uniform(rng, s2));
    w2.push(row);
    b2.push(uniform(rng, 0.1));
  }
  return { shape: [...NN_SHAPE], w1, b1, w2, b2 };
}

export function cloneBrain(brain) {
  return {
    shape: [...(brain.shape || NN_SHAPE)],
    w1: brain.w1.map((r) => r.slice()),
    b1: brain.b1.slice(),
    w2: brain.w2.map((r) => r.slice()),
    b2: brain.b2.slice(),
  };
}

// 前向传播：返回 { hidden, out }（out 为 4 个动作得分，取值 -1..1）
export function forward(brain, input) {
  const hidden = new Array(NN_HIDDEN);
  for (let j = 0; j < NN_HIDDEN; j++) {
    const row = brain.w1[j];
    let s = brain.b1[j];
    for (let i = 0; i < NN_INPUTS; i++) s += (input[i] || 0) * row[i];
    hidden[j] = Math.tanh(s);
  }
  const out = new Array(NN_OUTPUTS);
  for (let k = 0; k < NN_OUTPUTS; k++) {
    const row = brain.w2[k];
    let s = brain.b2[k];
    for (let j = 0; j < NN_HIDDEN; j++) s += hidden[j] * row[j];
    out[k] = Math.tanh(s);
  }
  return { hidden, out };
}

// 感知 -> 输入向量：距离折算成「接近度」（1 = 贴脸，0 = 视野外/无目标）
export function encodeSenses({
  foodDist = Infinity,
  foodDir = null,
  threatDist = Infinity,
  threatDir = null,
  energyFrac = 0.5,
  light = 1,
  senseRange = 1,
} = {}) {
  const inv = 1 / Math.max(0.001, senseRange);
  const prox = (d) => (Number.isFinite(d) ? Math.max(0, 1 - Math.min(1, d * inv)) : 0);
  return [
    prox(foodDist),
    foodDir ? foodDir[0] : 0,
    foodDir ? foodDir[1] : 0,
    prox(threatDist),
    Math.max(0, Math.min(1, energyFrac)),
    Math.max(0, Math.min(1, light)),
  ];
}

// 决策：argmax(输出) -> 动作名 / 索引 / 原始得分（得分供调试与无头验证读取）
export function decideBrain(brain, input, opts = {}) {
  const { out } = forward(brain, input);
  // stage-14：觅食先验偏置——随机初始权重 + 有限世代的变异，不足以让网络自己
  // 学出「该吃就吃」的偏好；因此在决策层给「觅食」输出叠加一个可配置偏置，
  // 使带脑个体在食物进入视野时优先取食，个体的权重差异仍决定其它情境下的取舍。
  const scores = out.slice();
  const seekBias = Number.isFinite(opts.seekBias) ? opts.seekBias : 0;
  if (seekBias) scores[NN_ACTIONS.indexOf('seek')] += seekBias;
  let best = 0;
  for (let k = 1; k < scores.length; k++) {
    if (scores[k] > scores[best]) best = k;
  }
  return { action: NN_ACTIONS[best], index: best, out: scores, raw: out };
}

// 繁殖变异：每个权重以 rate 的概率叠加 ±amount 的均匀扰动，并夹在 ±limit（防数值爆炸）
export function mutateBrain(brain, rng = random, rate = 0.25, amount = 0.35, limit = 3) {
  if (!brain) return null;
  const next = cloneBrain(brain);
  const tweak = (v) => (rng() < rate ? clampLimit(v + uniform(rng, amount), limit) : v);
  next.w1 = next.w1.map((row) => row.map(tweak));
  next.b1 = next.b1.map(tweak);
  next.w2 = next.w2.map((row) => row.map(tweak));
  next.b2 = next.b2.map(tweak);
  return next;
}

// 权重总数（HUD / 调试用）
export function countWeights(brain) {
  if (!brain) return 0;
  let n = 0;
  for (const row of brain.w1) n += row.length;
  for (const row of brain.w2) n += row.length;
  return n + brain.b1.length + brain.b2.length;
}

// 大脑摘要（无头验证 / 日志用）：拓扑、权重总数、平均绝对权重、最近一次输出
export function brainSummary(brain, input = null) {
  if (!brain) return null;
  let sum = 0;
  let n = 0;
  for (const row of brain.w1) for (const v of row) { sum += Math.abs(v); n += 1; }
  for (const row of brain.w2) for (const v of row) { sum += Math.abs(v); n += 1; }
  const summary = {
    shape: [...(brain.shape || NN_SHAPE)],
    weights: countWeights(brain),
    meanAbs: n ? sum / n : 0,
  };
  if (input) {
    const { action, out } = decideBrain(brain, input);
    summary.action = action;
    summary.out = out.map((v) => Number(v.toFixed(4)));
  }
  return summary;
}
