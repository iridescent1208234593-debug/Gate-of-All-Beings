/**
 * @file tick 契约：统一三系统的推进（帧）语义。
 * 纯 JS ES Modules + JSDoc，零依赖。
 */

/**
 * tick 函数签名：接收状态与时间增量，返回新状态。
 * @typedef {(state: any, dt: number) => any} TickFn
 */

/**
 * Ticker 实例：可推进、可重置、可查询余量。
 * @typedef {Object} Ticker
 * @property {(state: any, dt: number) => any} tick 推进一个时间增量
 * @property {() => void} reset 清空累积余量
 * @property {() => number} pendingDt 返回当前累积但未消费的时间余量
 */

/**
 * 契约默认实现：等价 no-op，原样返回 `state`。
 * @param {any} state 当前状态
 * @param {number} dt 时间增量（未使用，保留以对齐 TickFn 签名）
 * @returns {any} 原样返回入参 `state`
 * @example
 * const s = { t: 0 };
 * tick(s, 1 / 60) === s; // true
 */
export function tick(state, dt) {
  void dt;
  return state;
}

/**
 * 创建 Ticker。
 * - `fixedDt = null`：直接转发 `tickFn(state, dt)`，不做拆帧。
 * - `fixedDt > 0`：按固定步长拆帧，余量累积；单次最多 `maxSubSteps` 步，
 *   达到上限仍未追平（如卡顿后的大 dt）时**丢弃余量**，防死循环。
 * @param {TickFn} tickFn 每步调用的推进函数；必须为函数
 * @param {{fixedDt?: number|null, maxSubSteps?: number}} [options] 选项
 * @param {number|null} [options.fixedDt=null] 固定步长（秒）；null 表示不拆帧
 * @param {number} [options.maxSubSteps=5] 单次 tick 最大子步数（正整数）
 * @returns {Ticker} Ticker 实例
 * @throws {TypeError} tickFn 非函数、fixedDt 非正有限数（且非 null）、maxSubSteps 非正整数时抛出
 * @example
 * const ticker = createTicker((s, dt) => ({ t: s.t + dt }), { fixedDt: 0.25 });
 * ticker.tick({ t: 0 }, 1.0); // 调用 4 次，余量 0
 */
export function createTicker(tickFn, { fixedDt = null, maxSubSteps = 5 } = {}) {
  if (typeof tickFn !== 'function') {
    throw new TypeError('createTicker: tickFn 必须是函数');
  }
  if (fixedDt !== null && (typeof fixedDt !== 'number' || !Number.isFinite(fixedDt) || fixedDt <= 0)) {
    throw new TypeError('createTicker: fixedDt 必须为正有限数或 null');
  }
  if (!Number.isInteger(maxSubSteps) || maxSubSteps < 1) {
    throw new TypeError('createTicker: maxSubSteps 必须为正整数');
  }

  /** @type {number} 累积未消费的时间余量 */
  let pending = 0;

  return {
    tick(state, dt) {
      if (fixedDt === null) return tickFn(state, dt);
      if (typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return state;

      pending += dt;
      let steps = 0;
      let next = state;

      while (pending >= fixedDt && steps < maxSubSteps) {
        next = tickFn(next, fixedDt);
        pending -= fixedDt;
        steps += 1;
      }

      // 浮点噪声归零，避免 0.9999999999 一类残值长期累积
      if (Math.abs(pending) < 1e-12) pending = 0;
      // 达到子步上限仍未追平：丢弃余量，防死循环
      if (steps >= maxSubSteps && pending >= fixedDt) pending = 0;

      return next;
    },
    reset() {
      pending = 0;
    },
    pendingDt() {
      return pending;
    },
  };
}

/**
 * 断言 tick 结果合法：必须为非 null 对象。
 * @param {*} result tick 的返回值
 * @returns {any} 原样返回 `result`
 * @throws {TypeError} result 为 null / undefined / 原始值时抛出
 * @example
 * assertTickResult({ t: 1 }); // 通过
 * assertTickResult(null);     // 抛 TypeError
 */
export function assertTickResult(result) {
  if (result === null || result === undefined || typeof result !== 'object') {
    throw new TypeError(
      `tick 结果必须为非 null 对象，实际收到：${result === null ? 'null' : typeof result}`,
    );
  }
  return result;
}

/**
 * 三系统时间单位约定（冻结）。以「秒」为基准：经营模拟一步 = 0.25s，卡牌一回合 = 1s。
 * @type {Readonly<{SECOND:number, MANAGEMENT_STEP:number, CARD_TURN:number}>}
 */
export const TICK_UNITS = Object.freeze({
  SECOND: 1,
  MANAGEMENT_STEP: 0.25,
  CARD_TURN: 1,
});
