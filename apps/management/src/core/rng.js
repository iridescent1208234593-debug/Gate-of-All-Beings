/**
 * 灵境会馆 - 核心层：种子化随机（rng）
 * 架构要求：所有随机走种子化 RNG，保证同种子可复现、便于测试与回放。
 * 基于 mulberry32（32bit 种子，快且分布均匀），提供常用派生函数。
 */
export function createRng(seed) {
  let a = seed >>> 0;
  function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [0, 1) 浮点 */
  function float() {
    return next();
  }

  /** [min, max) 整数 */
  function int(min, max) {
    return Math.floor(next() * (max - min)) + min;
  }

  /** [min, max] 浮点 */
  function range(min, max) {
    return next() * (max - min) + min;
  }

  /** 以概率 p 返回 true */
  function chance(p) {
    return next() < p;
  }

  /** 从数组随机取一个元素（不修改原数组） */
  function pick(arr) {
    return arr[int(0, arr.length)];
  }

  /** 洗牌（Fisher-Yates，返回新数组） */
  function shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i + 1);
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  return { seed, next, float, int, range, chance, pick, shuffle };
}

/** 便捷：从字符串生成稳定种子（用于存档/场景命名） */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
