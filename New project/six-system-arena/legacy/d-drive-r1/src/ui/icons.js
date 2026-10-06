/**
 * 六大系 / 五行 inline SVG 图标库
 *
 * 造型基线对齐 shared-ui/lxh-ui.js 的官方复刻配色：
 *   PAPER #f7f1e1 · NODE #f8ecca · STAR #d9cfae · INK #4a4636
 * 全部为 viewBox="0 0 32 32" 的内联 SVG 字符串，可：
 *   - React 端：dangerouslySetInnerHTML 注入（与 LxhIcon.tsx 同套路）
 *   - 原生端：直接 innerHTML / <template> 插入
 * 不依赖任何三方图标库，避免 zszm 的 icons chunk 体积增长。
 */

const PAPER = '#f7f1e1';
const NODE = '#f8ecca';

/** 六系 + 五行 + 占位 图标定义 */
export const ICONS = Object.freeze({
  // ---------- 六大系 ----------
  sys_yuling:
    `<svg viewBox="0 0 32 32" role="img"><circle cx="16" cy="16" r="13" fill="${NODE}" stroke="#c8963c" stroke-width="1.5"/>` +
    `<circle cx="16" cy="16" r="2.4" fill="#c8963c"/>` +
    `<circle cx="16" cy="8.5" r="2.1" fill="#f6d089" stroke="#c8963c"/>` +
    `<circle cx="23.13" cy="13.68" r="2.1" fill="#f6d089" stroke="#c8963c"/>` +
    `<circle cx="20.41" cy="22.07" r="2.1" fill="#f6d089" stroke="#c8963c"/>` +
    `<circle cx="11.59" cy="22.07" r="2.1" fill="#f6d089" stroke="#c8963c"/>` +
    `<circle cx="8.87" cy="13.68" r="2.1" fill="#f6d089" stroke="#c8963c"/></svg>`,

  sys_suoyu:
    `<svg viewBox="0 0 32 32" role="img"><circle cx="16" cy="16" r="13" fill="${NODE}" stroke="#8a7f5c" stroke-width="1.5"/>` +
    `<rect x="10" y="15" width="12" height="10" rx="2" fill="#e3d9bb" stroke="#4a4636" stroke-width="1.4"/>` +
    `<path d="M12.5 15 v-2.5 a3.5 3.5 0 0 1 7 0 V15" fill="none" stroke="#4a4636" stroke-width="1.6"/>` +
    `<circle cx="16" cy="20" r="1.5" fill="#4a4636"/>` +
    `<path d="M14 20 v3 M18 20 v3" stroke="#8a7f5c" stroke-width="1.2"/></svg>`,

  sys_zaowu:
    `<svg viewBox="0 0 32 32" role="img"><circle cx="16" cy="16" r="13" fill="${NODE}" stroke="#7a9a6a" stroke-width="1.5"/>` +
    `<rect x="8.5" y="12" width="10" height="10" rx="1.5" transform="rotate(-12 13.5 17)" fill="#d9e6cf" stroke="#4a4636" stroke-width="1.3"/>` +
    `<rect x="15" y="9.5" width="9" height="9" rx="1.5" transform="rotate(10 19.5 14)" fill="none" stroke="#7a9a6a" stroke-width="1.6"/>` +
    `<path d="M10 9.5 h4 M12 7.5 v4" stroke="#7a9a6a" stroke-width="1.6" stroke-linecap="round"/></svg>`,

  sys_xinling:
    `<svg viewBox="0 0 32 32" role="img"><circle cx="16" cy="16" r="13" fill="${NODE}" stroke="#8f7fb8" stroke-width="1.5"/>` +
    `<circle cx="14.5" cy="15" r="5.5" fill="#e0d8ef" stroke="#4a4636" stroke-width="1.3"/>` +
    `<circle cx="13" cy="14" r="1.1" fill="#4a4636"/>` +
    `<path d="M21.8 12 a7 7 0 0 1 0 8" fill="none" stroke="#8f7fb8" stroke-width="1.5"/>` +
    `<path d="M24.4 9.6 a11 11 0 0 1 0 12.8" fill="none" stroke="#8f7fb8" stroke-width="1.2" opacity=".55"/></svg>`,

  sys_shengling:
    `<svg viewBox="0 0 32 32" role="img"><circle cx="16" cy="16" r="13" fill="${NODE}" stroke="#6f9e7c" stroke-width="1.5"/>` +
    `<path d="M16 24 v-9" stroke="#4a4636" stroke-width="1.5" stroke-linecap="round"/>` +
    `<path d="M16 16 c-5.2 0 -6.4 -5.2 -6.4 -6.4 c4.4 0 6.4 2.2 6.4 6.4 z" fill="#d5e8db" stroke="#6f9e7c" stroke-width="1.2"/>` +
    `<path d="M16 18.4 c5.2 0 6.4 -5.2 6.4 -6.4 c-4.4 0 -6.4 2.2 -6.4 6.4 z" fill="#d5e8db" stroke="#6f9e7c" stroke-width="1.2"/></svg>`,

  sys_kongjian:
    `<svg viewBox="0 0 32 32" role="img"><circle cx="16" cy="16" r="13" fill="${NODE}" stroke="#5b7fa8" stroke-width="1.5"/>` +
    `<rect x="7.5" y="7.5" width="17" height="17" rx="2" fill="none" stroke="#5b7fa8" stroke-width="1.4" stroke-dasharray="3 2"/>` +
    `<rect x="12" y="12" width="8" height="8" rx="1.5" transform="rotate(45 16 16)" fill="#d3e0ef" stroke="#4a4636" stroke-width="1.3"/>` +
    `<circle cx="16" cy="16" r="1.7" fill="#5b7fa8"/></svg>`,

  // ---------- 御灵五行 ----------
  ele_jin:
    `<svg viewBox="0 0 32 32" role="img"><path d="M6 21 h20 l-3 6 H9 z" fill="#f0e2b6" stroke="#c9a227" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M11 21 l2 -6.5 h6 l2 6.5" fill="#f0e2b6" stroke="#c9a227" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<circle cx="16" cy="8.5" r="2.2" fill="#c9a227"/><path d="M9 12 l2 3 M23 12 l-2 3" stroke="#c9a227" stroke-width="1.3"/></svg>`,

  ele_mu:
    `<svg viewBox="0 0 32 32" role="img"><path d="M16 27 v-9" stroke="#4a4636" stroke-width="1.8" stroke-linecap="round"/>` +
    `<circle cx="16" cy="11.5" r="7" fill="#d6ead6" stroke="#5f9e5f" stroke-width="1.5"/>` +
    `<path d="M10.5 22.5 l5.5 -6.5 5.5 6.5" fill="none" stroke="#5f9e5f" stroke-width="1.4" stroke-linejoin="round"/></svg>`,

  ele_shui:
    `<svg viewBox="0 0 32 32" role="img">` +
    `<path d="M4 13 q6 -5.5 12 0 t12 0" fill="none" stroke="#4f86b8" stroke-width="1.9" stroke-linecap="round"/>` +
    `<path d="M4 19 q6 -5.5 12 0 t12 0" fill="none" stroke="#7fb0d6" stroke-width="1.7" stroke-linecap="round"/>` +
    `<path d="M4 25 q6 -5.5 12 0 t12 0" fill="none" stroke="#b3d2e8" stroke-width="1.5" stroke-linecap="round"/></svg>`,

  ele_huo:
    `<svg viewBox="0 0 32 32" role="img">` +
    `<path d="M16 3 c4.5 6.5 8.5 8.5 8.5 14 a8.5 8.5 0 0 1 -17 0 c0 -5.5 4 -7.5 8.5 -14 z" fill="#f2d6cc" stroke="#c85a3c" stroke-width="1.5"/>` +
    `<path d="M16 13 c2.2 3.2 4.2 4.2 4.2 6.8 a4.2 4.2 0 0 1 -8.4 0 c0 -2.6 2 -3.6 4.2 -6.8 z" fill="#c85a3c" opacity=".6"/></svg>`,

  ele_tu:
    `<svg viewBox="0 0 32 32" role="img">` +
    `<path d="M3.5 26 L12 10.5 L17 19 L20 14 L28.5 26 z" fill="#eadfc8" stroke="#a28455" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M12 10.5 L14.6 15.5 L12 19.5 L9.6 15.5 z" fill="#a28455" opacity=".55"/>` +
    `<path d="M3.5 26 h25" stroke="#a28455" stroke-width="1.4" stroke-linecap="round"/></svg>`,

  ele_none:
    `<svg viewBox="0 0 32 32" role="img"><circle cx="16" cy="16" r="11" fill="${NODE}" stroke="#9aa5a0" stroke-width="1.5" stroke-dasharray="3 2"/>` +
    `<path d="M11 16 h10" stroke="#9aa5a0" stroke-width="1.8" stroke-linecap="round"/></svg>`,

  // ---------- 通用 ----------
  grade_star:
    `<svg viewBox="0 0 32 32" role="img"><path d="M16 3 L20 12 L29.5 12 L22 18.5 L25 28 L16 22.5 L7 28 L10 18.5 L2.5 12 L12 12 Z" fill="${NODE}" stroke="#c8963c" stroke-width="1.4"/></svg>`,
  badge_plate: `<svg viewBox="0 0 32 32" role="img"><circle cx="16" cy="16" r="14" fill="${PAPER}"/></svg>`,
});

/** 取图标 SVG 字符串，缺失时回退到 grade_star */
export function icon(name) {
  return ICONS[name] || ICONS.grade_star;
}

/** 取某个系 / 元素的图标名 */
export function systemIconName(systemId) {
  return `sys_${systemId}`;
}
export function elementIconName(elementId) {
  return `ele_${elementId}`;
}

/**
 * 生成带尺寸与额外 class 的图标 HTML。
 * @param {string} name ICONS 键名
 * @param {{size?:number, className?:string, title?:string}} [opts]
 */
export function iconHTML(name, opts = {}) {
  const size = opts.size ?? 24;
  const cls = opts.className ? ` class="${opts.className}"` : '';
  const label = opts.title || '';
  const svg = icon(name).replace(
    '<svg ',
    `<svg width="${size}" height="${size}"${cls}${
      label ? ` aria-label="${label}"` : ' aria-hidden="true"'
    } `,
  );
  return svg;
}

export const ICON_NAMES = Object.freeze(Object.keys(ICONS));
