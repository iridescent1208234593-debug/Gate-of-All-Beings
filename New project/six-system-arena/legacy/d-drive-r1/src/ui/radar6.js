/**
 * 六维雷达图（纯函数，零依赖）
 *
 * 造型基线对齐 shared-ui/lxh-ui.js 的 radar6：
 *   网格 #e8e0c8 · 数据面 rgba(216,207,174,.35) + STAR #d9cfae 描边 · 节点 NODE #f8ecca
 * 差异点（本工程扩展）：
 *   - 轴序可配置，默认 RADAR_AXIS_ORDER（与 shared-ui radar6 一致）
 *   - 支持在轴上标注分值（showValues）
 *   - 支持中心显示评级徽记（grade / power）
 *   - 接收系统 id 对象（{yuling: 88}）或数组，便于直接吃 schema 数据
 */

import { RADAR_AXIS_ORDER, SIX_SYSTEMS } from '../world/six-systems.js';
import { gradeColorOf } from '../world/rating.js';

const NODE = '#f8ecca';
const STAR = '#d9cfae';
const GRID = '#e8e0c8';

/**
 * @param {object} opts
 * @param {Record<string, number>|number[]} opts.systems 六系分值
 * @param {string[]} [opts.axisOrder] 轴序，默认 RADAR_AXIS_ORDER
 * @param {number} [opts.size] 边长 px
 * @param {boolean} [opts.showValues] 轴端显示分值
 * @param {boolean} [opts.showCenter] 中心显示评级
 * @param {string} [opts.grade] 评级 id（S/A/B/C/D/E）
 * @param {number} [opts.power] 综合战力
 * @param {boolean} [opts.compact] 紧凑模式（无轴标签、无分值）
 * @returns {string} SVG 字符串
 */
export function buildRadar6SVG(opts = {}) {
  const axis = opts.axisOrder ?? RADAR_AXIS_ORDER;
  const compact = Boolean(opts.compact);
  const values = axis.map((id) => {
    const raw = Array.isArray(opts.systems) ? opts.systems[axis.indexOf(id)] : opts.systems?.[id];
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n / 100));
  });

  const W = compact ? 220 : 400;
  const H = compact ? 200 : 360;
  const cx = W / 2;
  const cy = compact ? H / 2 + 4 : H / 2 - 4;
  const R = compact ? 78 : 118;

  const ringPoly = (k) => {
    const pts = [];
    for (let i = 0; i < 6; i += 1) {
      const a = (-90 + i * 60) * (Math.PI / 180);
      pts.push(`${(cx + ((R * k) / 3) * Math.cos(a)).toFixed(1)},${(cy + ((R * k) / 3) * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(' ');
  };

  let grid = '';
  for (let k = 1; k <= 3; k += 1) {
    grid += `<polygon points="${ringPoly(k)}" fill="none" stroke="${GRID}" stroke-width="1" opacity="${(0.25 + k * 0.15).toFixed(2)}"/>`;
  }

  let axes = '';
  let nodes = '';
  const dataPts = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (-90 + i * 60) * (Math.PI / 180);
    const vx = cx + R * Math.cos(a);
    const vy = cy + R * Math.sin(a);
    axes += `<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${vx.toFixed(1)}" y2="${vy.toFixed(1)}" stroke="${GRID}" stroke-width="1" opacity=".45"/>`;
    dataPts.push(
      `${(cx + R * values[i] * Math.cos(a)).toFixed(1)},${(cy + R * values[i] * Math.sin(a)).toFixed(1)}`,
    );
    nodes += `<circle cx="${vx.toFixed(1)}" cy="${vy.toFixed(1)}" r="${compact ? 3 : 4.5}" fill="${NODE}" stroke="${SIX_SYSTEMS[axis[i]]?.color ?? GRID}" stroke-width="1.2"/>`;
    if (!compact) {
      const lx = cx + (R + 36) * Math.cos(a);
      const ly = cy + (R + 26) * Math.sin(a);
      const sys = SIX_SYSTEMS[axis[i]];
      nodes += `<text x="${lx.toFixed(1)}" y="${(ly + 6).toFixed(1)}" font-size="17" text-anchor="middle" fill="${NODE}" font-family="serif">${sys ? sys.name : axis[i]}</text>`;
      if (opts.showValues) {
        const pv = values[i] * 100;
        nodes += `<text x="${lx.toFixed(1)}" y="${(ly + 24).toFixed(1)}" font-size="12" text-anchor="middle" fill="${STAR}" font-family="serif" opacity=".9">${Math.round(pv)}</text>`;
      }
    }
  }

  let center = `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${compact ? 4 : 6}" fill="#8ea06a"/>`;
  if (opts.showCenter && !compact) {
    const color = opts.grade ? gradeColorOf(opts.grade) : '#8ea06a';
    center =
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="24" fill="none" stroke="${color}" stroke-width="1.6" opacity=".85"/>` +
      `<text x="${cx.toFixed(1)}" y="${(cy + 1).toFixed(1)}" font-size="19" text-anchor="middle" fill="${color}" font-family="serif">${opts.grade ?? ''}</text>` +
      (opts.power != null
        ? `<text x="${cx.toFixed(1)}" y="${(cy + 16).toFixed(1)}" font-size="10" text-anchor="middle" fill="${NODE}" font-family="serif">战力 ${opts.power}</text>`
        : '');
  }

  return (
    `<svg viewBox="0 0 ${W} ${H}" width="${opts.size ?? '100%'}" role="img" aria-label="六大系六维雷达图">` +
    grid +
    axes +
    `<polygon points="${dataPts.join(' ')}" fill="rgba(216,207,174,.35)" stroke="${STAR}" stroke-width="2" stroke-linejoin="round"/>` +
    nodes +
    center +
    '</svg>'
  );
}

/** 生成完整的雷达图容器（含语义化包装，可直接 innerHTML） */
export function radar6HTML(systems, opts = {}) {
  return `<div class="lxh-radar6 lxh six-radar6">${buildRadar6SVG({ systems, ...opts })}</div>`;
}
