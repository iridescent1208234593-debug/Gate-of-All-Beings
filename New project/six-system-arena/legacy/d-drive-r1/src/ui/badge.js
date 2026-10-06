/**
 * 徽章组件（纯函数，零依赖）
 *
 * 三类徽章：
 *   1) 六系徽章   buildSystemBadge  —— 图标 + 系名 + 分值 + 档位色
 *   2) 五行徽章   buildElementBadge —— 五行图标 + 属性名 + 生克提示
 *   3) 评级徽章   buildGradeBadge   —— S/A/B/C/D/E 五角星牌
 */

import { SIX_SYSTEMS } from '../world/six-systems.js';
import { FIVE_ELEMENTS, NO_ELEMENT } from '../world/elements.js';
import { GRADES, scoreTierOf } from '../world/rating.js';
import { iconHTML } from './icons.js';

function tierColor(score) {
  const tier = scoreTierOf(score);
  return gradeColor(tier);
}

function gradeColor(gradeId) {
  const g = GRADES.find((x) => x.id === gradeId);
  return g ? g.color : '#9aa5a0';
}

/**
 * 六系徽章
 * @param {{systemId:string, score:number, size?:number, showScore?:boolean, title?:string}} opts
 */
export function buildSystemBadge(opts = {}) {
  const sys = SIX_SYSTEMS[opts.systemId];
  const score = Math.max(0, Math.min(100, Math.round(Number(opts.score) || 0)));
  const color = opts.color || tierColor(score);
  const size = opts.size ?? 56;
  const name = sys ? sys.name : opts.systemId;
  return (
    `<span class="six-badge" data-system="${opts.systemId}" title="${opts.title || `${name} ${score}`}"` +
    ` style="--badge-color:${color};--badge-wash:${sys ? sys.wash : '#e6e9e5'};width:${size}px">` +
    iconHTML(`sys_${opts.systemId}`, { size: Math.round(size * 0.5), title: name }) +
    `<b class="six-badge__name">${name}</b>` +
    (opts.showScore === false ? '' : `<i class="six-badge__score">${score}</i>`) +
    '</span>'
  );
}

/** 六系徽章墙 */
export function buildSystemBadgeRow(systems, opts = {}) {
  const order = opts.axisOrder || ['yuling', 'suoyu', 'zaowu', 'xinling', 'shengling', 'kongjian'];
  return `<div class="six-badge-row">${order
    .map((id) => buildSystemBadge({ systemId: id, score: systems?.[id] ?? 0, size: opts.size }))
    .join('')}</div>`;
}

/** 五行徽章 */
export function buildElementBadge(elementId, opts = {}) {
  const el = elementId === 'none' || !FIVE_ELEMENTS[elementId] ? NO_ELEMENT : FIVE_ELEMENTS[elementId];
  const size = opts.size ?? 40;
  const relation = opts.relationText ? `<em>${opts.relationText}</em>` : '';
  return (
    `<span class="ele-badge" data-element="${el.id}" title="${el.name}·${el.trait}"` +
    ` style="--badge-color:${el.color};--badge-wash:${el.wash};width:${size}px">` +
    iconHTML(`ele_${el.id}`, { size: Math.round(size * 0.6), title: el.name }) +
    `<b class="ele-badge__name">${el.name}</b>${relation}</span>`
  );
}

/** 评级徽章（星牌） */
export function buildGradeBadge(gradeId, opts = {}) {
  const g = GRADES.find((x) => x.id === gradeId) || GRADES[GRADES.length - 1];
  const size = opts.size ?? 64;
  const stars = Array.from({ length: 5 }, (_, i) => {
    const on = i < g.stars;
    return `<span class="grade-star${on ? ' is-on' : ''}" style="--star-color:${g.color}">★</span>`;
  }).join('');
  return (
    `<span class="grade-badge" data-grade="${g.id}" title="${g.name}"` +
    ` style="--grade-color:${g.color};width:${size}px">` +
    `<b class="grade-badge__id">${g.id}</b>` +
    `<span class="grade-badge__name">${g.name}</span>` +
    `<span class="grade-badge__stars">${stars}</span>` +
    (opts.power != null ? `<i class="grade-badge__power">战力 ${opts.power}</i>` : '') +
    '</span>'
  );
}

/** 注入所需的最小样式（幂等，可重复调用） */
export function injectBadgeStyles(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc || doc.getElementById('six-systems-badge-style')) return;
  const style = doc.createElement('style');
  style.id = 'six-systems-badge-style';
  style.textContent = `
.six-badge,.ele-badge,.grade-badge{display:inline-flex;flex-direction:column;align-items:center;gap:2px;
  padding:6px 4px;border-radius:12px;background:var(--badge-wash,#f7f1e1);
  border:1px solid var(--badge-color,#c8963c);font-family:serif;line-height:1.1}
.six-badge__name,.ele-badge__name{font-size:12px;color:#4a4636}
.six-badge__score{font-style:normal;font-size:11px;color:var(--badge-color)}
.six-badge-row{display:flex;gap:8px;flex-wrap:wrap}
.ele-badge em{font-style:normal;font-size:10px;color:var(--badge-color)}
.grade-badge__id{font-size:22px;color:var(--grade-color)}
.grade-badge__name{font-size:11px;color:#4a4636}
.grade-badge__stars{font-size:10px;letter-spacing:1px}
.grade-star{color:#d9cfae}.grade-star.is-on{color:var(--star-color)}
.grade-badge__power{font-style:normal;font-size:10px;color:#8a7f5c}
`;
  doc.head.appendChild(style);
}
