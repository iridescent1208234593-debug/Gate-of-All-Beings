// stage-10：有机体世代趋势图（DOM Canvas2D 覆盖层）
// 数据源：state.autoEvo.orgRecords —— 每 orgAutoEvoSeconds 秒由 auto-evo 结算一代，
// 每条记录含全体平均模块数 moduleAvg 与各营养带的 zones[]（数量/平均模块数）。
// 图上画三条线：全体（金）、富营养区（绿）、贫瘠区（灰），用于观察“体型分异”趋势。
// 全部颜色取自 theme.js 的 COLORS.chart token，不在本文件硬编码色值。
import { COLORS, WORLD, cssHex } from './theme.js';

const PAD = { l: 30, r: 8, t: 8, b: 16 };

export class TrendChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cssW = 0;
    this.cssH = 0;
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.cssW = Math.max(120, Math.round(rect.width || 260));
    this.cssH = Math.max(80, Math.round(rect.height || 120));
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // state.autoEvo.orgRecords -> 三条折线的点集（每点 {x: 世代序号, y: 平均模块数}）
  _series(state) {
    const recs = (state.autoEvo && state.autoEvo.orgRecords) || [];
    const win = recs.slice(-WORLD.orgEvoHistoryMax);
    const all = [];
    const rich = [];
    const poor = [];
    win.forEach((r, i) => {
      all.push({ x: i, y: r.moduleAvg });
      const z = r.zones || [];
      const first = z[0];
      const last = z[z.length - 1];
      // 某代该区无存活个体时不记点（折线断开），避免用 0 拉低趋势
      if (first && first.count > 0) rich.push({ x: i, y: first.moduleAvg });
      else rich.push(null);
      if (last && last.count > 0) poor.push({ x: i, y: last.moduleAvg });
      else poor.push(null);
    });
    return { all, rich, poor, n: win.length, latest: win[win.length - 1] || null };
  }

  update(state) {
    const ctx = this.ctx;
    const W = this.cssW;
    const H = this.cssH;
    const s = this._series(state);

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = cssHex(COLORS.chart.bg);
    ctx.fillRect(0, 0, W, H);

    const plotW = Math.max(10, W - PAD.l - PAD.r);
    const plotH = Math.max(10, H - PAD.t - PAD.b);

    // Y 轴范围：所有有效点最小/最大 ±0.5，下限夹到 0
    let lo = Infinity;
    let hi = -Infinity;
    for (const arr of [s.all, s.rich, s.poor]) {
      for (const p of arr) {
        if (!p) continue;
        if (p.y < lo) lo = p.y;
        if (p.y > hi) hi = p.y;
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      lo = 0;
      hi = 8;
    }
    const padY = Math.max(0.5, (hi - lo) * 0.15);
    lo = Math.max(0, lo - padY);
    hi = hi + padY;
    if (hi - lo < 1) hi = lo + 1;

    const xOf = (i) => PAD.l + (s.n <= 1 ? plotW / 2 : (i / (s.n - 1)) * plotW);
    const yOf = (v) => PAD.t + plotH - ((v - lo) / (hi - lo)) * plotH;

    // 网格线 + Y 轴刻度（0 / 中值 / 上界）
    ctx.strokeStyle = cssHex(COLORS.chart.grid);
    ctx.lineWidth = 1;
    for (const v of [lo, (lo + hi) / 2, hi]) {
      const y = Math.round(yOf(v)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(PAD.l, y);
      ctx.lineTo(PAD.l + plotW, y);
      ctx.stroke();
    }
    ctx.fillStyle = cssHex(COLORS.chart.frame);
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(hi.toFixed(1), PAD.l - 3, yOf(hi));
    ctx.fillText(lo.toFixed(1), PAD.l - 3, yOf(lo));

    // 三条折线
    const line = (arr, color) => {
      ctx.strokeStyle = cssHex(color);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      let started = false;
      arr.forEach((p, i) => {
        if (!p) {
          started = false;
          return;
        }
        const x = xOf(p.x);
        const y = yOf(p.y);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    };
    line(s.rich, COLORS.chart.rich);
    line(s.poor, COLORS.chart.poor);
    line(s.all, COLORS.chart.all);

    // 图例（左上）：全体 / 富营养区 / 贫瘠区
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const legend = [
      [COLORS.chart.all, '全体'],
      [COLORS.chart.rich, '富营养'],
      [COLORS.chart.poor, '贫瘠'],
    ];
    let lx = PAD.l + 2;
    for (const [color, label] of legend) {
      ctx.fillStyle = cssHex(color);
      ctx.fillRect(lx, PAD.t + 2, 6, 6);
      ctx.fillStyle = cssHex(COLORS.chart.frame);
      ctx.fillText(label, lx + 9, PAD.t + 1);
      lx += 9 + ctx.measureText(label).width + 8;
    }

    // 无数据时给出提示
    if (s.n === 0) {
      ctx.fillStyle = cssHex(COLORS.chart.frame);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('等待第一代结算…', W / 2, H / 2);
    }
  }
}
