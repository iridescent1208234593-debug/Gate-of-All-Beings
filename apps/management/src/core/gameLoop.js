/**
 * 灵境会馆 - 游戏主循环
 * 固定 tick 模拟（默认 4 tick/秒）+ 每帧渲染（requestAnimationFrame）。
 * 支持倍速（1x/2x/3x）与暂停：通过累加器按速度加速推进 tick。
 */
export class GameLoop {
  /**
   * @param {object} opts
   * @param {number} [opts.tickIntervalMs=250] 固定 tick 间隔
   * @param {() => void} opts.tickFn 执行一次模拟 tick
   * @param {(dt: number) => void} opts.renderFn 每帧渲染回调
   * @param {() => number} [opts.getSpeed] 当前倍速
   * @param {() => boolean} [opts.isPaused] 是否暂停
   * @param {number} [opts.maxSteps=10] 单帧最多补偿 tick（防 spiral of death）
   */
  constructor(opts) {
    this.tickIntervalMs = opts.tickIntervalMs ?? 250;
    this.tickFn = opts.tickFn;
    this.renderFn = opts.renderFn;
    this.getSpeed = opts.getSpeed ?? (() => 1);
    this.isPaused = opts.isPaused ?? (() => false);
    this.maxSteps = opts.maxSteps ?? 10;
    this._raf = 0;
    this._last = 0;
    this._acc = 0;
    this._running = false;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    this._acc = 0;
    const loop = (now) => {
      if (!this._running) return;
      let dt = now - this._last;
      this._last = now;
      if (dt > 1000) dt = 1000; // 切后台恢复时防止大跳变

      if (!this.isPaused()) {
        this._acc += dt * (this.getSpeed() || 1);
        let steps = 0;
        while (this._acc >= this.tickIntervalMs && steps < this.maxSteps) {
          this.tickFn();
          this._acc -= this.tickIntervalMs;
          steps++;
        }
        if (this._acc >= this.tickIntervalMs) this._acc = 0; // 积压过多直接丢弃
      } else {
        this._acc = 0;
      }

      this.renderFn(dt);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._raf);
  }

  get running() {
    return this._running;
  }
}
