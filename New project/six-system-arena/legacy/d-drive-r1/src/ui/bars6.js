/**
 * 六大系条形图 / 对战对比条（纯函数，零依赖）
 *
 * 说明：本文件为「第 1 轮新增」，不改动本工程任何既有模块，
 *       与 radar6.js / badge.js 保持同一造型基线：
 *       INK #4a4636 · NODE #f8ecca · GRID #e8e0c8 · PAPER #f7f1e1
 *
 * 两个用途：
 *   1) buildBars6SVG  —— 单角色六系横向条形图（对「雷达图看不出的弱项」做线性对照）
 *   2) buildDuelBarsSVG —— 双角色「对镜」对比条，A 向左、B 向右，
 *      直接服务后续「与官方角色甚至自身对战」的战力对照 UI（本轮只做可视化，不做战斗结算）。
 *
 * 轴序默认取 RADAR_AXIS_ORDER，与 shared-ui/lxh-ui.js 的 radar6 一致，
 * 保证同一角色在雷达图与条形图上的扫视顺序相同。
 */

import { RADAR_AXIS_ORDER, SIX_SYSTEMS } from '../world/six-systems.js';
import { scoreTierOf } from '../world/rating.js';

const INK = '#4a4636';
const GRID = '#e8e0c8';
const TRACK = 'rgba(232,224,200,.38)';

function norm(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/**
 * 单角色六系横向条形图
 * @param {object} opts
 * @param {Record<string,number>|number[]} opts.systems 六系分值
 * @param {string[]} [opts.axisOrder] 轴序，默认 RADAR_AXIS_ORDER
 * @param {number} [opts.width] 画布宽，默认 420
 * @param {number} [opts.rowHeight] 行高，默认 34
 * @param {boolean} [opts.showValues] 是否显示分值（默认 true）
 * @returns {string} SVG 字符串
 */
export function buildBars6SVG(opts = {}) {
  const axis = opts.axisOrder ?? RADAR_AXIS_ORDER;
  const rowH = opts.rowHeight ?? 34;
  const W = opts.width ?? 420;
  const labelW = 66;
  const valueW = 40;
  const trackX = labelW;
  const trackW = W - labelW - valueW;
  const H = axis.length * rowH + 8;

  const rows = axis
    .map((id, i) => {
      const score = norm(Array.isArray(opts.systems) ? opts.systems[i] : opts.systems?.[id]);
      const sys = SIX_SYSTEMS[id];
      const color = sys ? sys.color : GRID;
      const y = i * rowH + 8;
      const barH = 14;
      const w = ((trackW * score) / 100).toFixed(1);
      const tier = scoreTierOf(score);
      return (
        `<text x="${labelW - 10}" y="${(y + barH - 2).toFixed(1)}" text-anchor="end" font-size="15" fill="${INK}" font-family="serif">${esc(
          sys ? sys.name : id,
        )}</text>` +
        `<rect x="${trackX}" y="${y}" width="${trackW}" height="${barH}" rx="7" fill="${TRACK}" stroke="${GRID}" stroke-width="1"/>` +
        `<rect x="${trackX}" y="${y}" width="${w}" height="${barH}" rx="7" fill="${color}" opacity=".82"/>` +
        `<circle cx="${(trackX + Number(w)).toFixed(1)}" cy="${(y + barH / 2).toFixed(1)}" r="3.4" fill="${color}" stroke="#f7f1e1" stroke-width="1"/>` +
        (opts.showValues === false
          ? ''
          : `<text x="${trackX + trackW + 8}" y="${(y + barH - 2).toFixed(1)}" font-size="14" fill="${INK}" font-family="serif">${Math.round(
              score,
            )}</text>` +
            `<text x="${trackX + trackW + 8}" y="${(y + barH + 10).toFixed(1)}" font-size="9" fill="${color}" font-family="serif" opacity=".8">${tier}</text>`)
      );
    })
    .join('');

  return (
    `<svg viewBox="0 0 ${W} ${H}" width="${opts.size ?? '100%'}" role="img" aria-label="六大系分值条形图">` +
    `<line x1="${trackX}" y1="4" x2="${trackX}" y2="${H - 4}" stroke="${GRID}" stroke-width="1" opacity=".7"/>` +
    rows +
    '</svg>'
  );
}

/**
 * 双角色「对镜」对比条：A 向左生长、B 向右生长，中轴为 0。
 * @param {object} opts
 * @param {{name?:string, systems:Record<string,number>}} opts.a 左方
 * @param {{name?:string, systems:Record<string,number>}} opts.b 右方
 * @param {string[]} [opts.axisOrder]
 * @param {number} [opts.width]
 * @param {number} [opts.rowHeight]
 */
export function buildDuelBarsSVG(opts = {}) {
  const axis = opts.axisOrder ?? RADAR_AXIS_ORDER;
  const rowH = opts.rowHeight ?? 36;
  const W = opts.width ?? 460;
  const center = W / 2;
  const labelW = 62;
  const halfMax = center - labelW;
  const H = axis.length * rowH + 26;

  const body = axis
    .map((id, i) => {
      const sys = SIX_SYSTEMS[id];
      const color = sys ? sys.color : GRID;
      const va = norm(opts.a?.systems?.[id] ?? 0);
      const vb = norm(opts.b?.systems?.[id] ?? 0);
      const y = i * rowH + 24;
      const barH = 13;
      const wa = (halfMax * va) / 100;
      const wb = (halfMax * vb) / 100;
      return (
        `<text x="${center}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="13" fill="${INK}" font-family="serif">${esc(
          sys ? sys.name : id,
        )}</text>` +
        `<rect x="${(center - halfMax).toFixed(1)}" y="${y}" width="${halfMax}" height="${barH}" rx="6" fill="${TRACK}"/>` +
        `<rect x="${(center + halfMax - wb).toFixed(1)}" y="${y}" width="${wb.toFixed(1)}" height="${barH}" rx="6" fill="${color}" opacity=".5"/>` +
        `<rect x="${(center - wa).toFixed(1)}" y="${y}" width="${wa.toFixed(1)}" height="${barH}" rx="6" fill="${color}" opacity=".9"/>` +
        `<text x="${(center - wa - 6).toFixed(1)}" y="${(y + barH - 2).toFixed(1)}" text-anchor="end" font-size="11" fill="${INK}" font-family="serif">${Math.round(va)}</text>` +
        `<text x="${(center + halfMax - wb - 6).toFixed(1)}" y="${(y + barH - 2).toFixed(1)}" text-anchor="end" font-size="11" fill="${INK}" font-family="serif">${Math.round(vb)}</text>`
      );
    })
    .join('');

  const nameA = esc(opts.a?.name ?? 'A');
  const nameB = esc(opts.b?.name ?? 'B');

  return (
    `<svg viewBox="0 0 ${W} ${H}" width="${opts.size ?? '100%'}" role="img" aria-label="双角色六系对镜对比条">` +
    `<text x="6" y="14" font-size="13" fill="${INK}" font-family="serif">${nameA}</text>` +
    `<text x="${W - 6}" y="14" text-anchor="end" font-size="13" fill="${INK}" font-family="serif">${nameB}</text>` +
    `<line x1="${center}" y1="20" x2="${center}" y2="${H - 4}" stroke="${GRID}" stroke-width="1.4" opacity=".9"/>` +
    body +
    '</svg>'
  );
}

/** 条形图容器（语义化包装，可直接 innerHTML） */
export function bars6HTML(systems, opts = {}) {
  return `<div class="lxh-bars6">${buildBars6SVG({ systems, ...opts })}</div>`;
}

/** 对镜对比条容器 */
export function duelBarsHTML(a, b, opts = {}) {
  return `<div class="lxh-duel-bars">${buildDuelBarsSVG({ a, b, ...opts })}</div>`;
}
