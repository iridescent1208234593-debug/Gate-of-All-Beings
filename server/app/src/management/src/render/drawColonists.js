/**
 * 灵境会馆 - 渲染层：小妖绘制
 * 五行色圆身 + 心情脸（红黄绿）+ 选中需求条。
 */
import { NEEDS } from '../content/needs.js';
import { COLONIST_STATES } from '../content/colonists.js';
import { MENTAL_STATES } from '../systems/colonist.js';

const MOOD_FACE = {
  green: { eyes: '^', mouth: '⌒' },
  yellow: { eyes: '-', mouth: '—' },
  red: { eyes: '>', mouth: '︶' },
};

/** 精神状态角标：色底 + 字 */
const MENTAL_MARK = {
  [MENTAL_STATES.HOSTILE]: { bg: '#ff5a5a', text: '敌' },
  [MENTAL_STATES.DEPRESSED]: { bg: '#7fa8ff', text: '郁' },
  [MENTAL_STATES.SICK]: { bg: '#6fcf6f', text: '病' },
};

const STATE_LABEL = {
  [COLONIST_STATES.IDLE]: '',
  [COLONIST_STATES.MOVING]: '走',
  [COLONIST_STATES.WORKING]: '工',
  [COLONIST_STATES.EATING]: '食',
};

/** M6 工作类型 → 显示名（WORKING 角标展示） */
const WORK_NAME = {
  spirit: '采灵',
  cook: '烹饪',
  rest: '休憩',
  social: '外交',
  patrol: '巡逻',
  forge: '锻造',
  diplomacy: '传信',
  research: '研究',
  build: '建造', // M7
};

/** M6 状态角标文字：睡眠显示「睡」，工作中显示工作名 */
function stateLabel(c) {
  if (c.state === COLONIST_STATES.SLEEPING) return '睡';
  if (c.state === COLONIST_STATES.WORKING) {
    return (c.job && WORK_NAME[c.job.workType]) || '工';
  }
  return STATE_LABEL[c.state] || '';
}

export function drawColonists(ctx, state, tileSize, selectedId) {
  for (const c of state.colonists) {
    drawColonist(ctx, c, tileSize, selectedId === c.id);
  }
}

/** 绘制战斗中的敌人标记（顶部红色妖角 + 血条） */
export function drawEnemies(ctx, state, tileSize) {
  const threats = state.combat && state.combat.threats ? state.combat.threats : [];
  for (const t of threats) {
    const px = t.x * tileSize + tileSize / 2;
    const py = t.y * tileSize + tileSize / 2;
    const r = tileSize * 0.32;

    // 红晕光圈
    ctx.fillStyle = 'rgba(255,60,60,0.08)';
    ctx.beginPath();
    ctx.arc(px, py, r + 5, 0, Math.PI * 2);
    ctx.fill();

    // 敌身
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,80,80,0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 妖角标记
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.moveTo(px - 5, py - r + 1);
    ctx.lineTo(px, py - r - 7);
    ctx.lineTo(px + 5, py - r + 1);
    ctx.closePath();
    ctx.fill();

    // 名字
    ctx.font = '9px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#ff9d9d';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.name, px, py + r + 10);

    // 血条
    const barW = tileSize + 4;
    const ratio = Math.max(0, Math.min(1, t.hp / t.maxHp));
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(px, py - r - 12, 0.5, 0, Math.PI * 2);
    ctx.fillRect(px - barW / 2, py - r - 13, barW, 4);
    ctx.beginPath();
    ctx.arc(px, py - r - 12, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ratio > 0.5 ? '#7adb5a' : ratio > 0.25 ? '#ffb84a' : '#ff5a5a';
    ctx.fillRect(px - barW / 2, py - r - 13, Math.max(1, barW * ratio), 4);
  }
}

function drawColonist(ctx, c, tileSize, selected) {
  const px = c.x * tileSize + tileSize / 2;
  const py = c.y * tileSize + tileSize / 2;
  const r = tileSize * 0.3;

  // 选中光环
  if (selected) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 圆身（五行色）
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 心情脸
  const face = MOOD_FACE[c.mood] || MOOD_FACE.green;
  ctx.fillStyle = '#1a1030';
  ctx.font = `bold ${Math.floor(r * 0.9)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(face.eyes, px, py - 2);
  ctx.fillText(face.mouth, px, py + r * 0.55);

  // 名字
  ctx.font = '9px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(c.name, px, py + r + 10);

  // 状态角标（睡眠「睡」/ 工作中工作名 / 走 / 食）
  const label = stateLabel(c);
  if (label) {
    const wide = [...label].length > 1;
    const rad = wide ? 9 : 5.5;
    ctx.fillStyle = c.state === COLONIST_STATES.WORKING ? '#ffe9a8' : '#a8d8ff';
    ctx.beginPath();
    ctx.arc(px + r + 2, py - r - 2, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1030';
    ctx.font = `bold ${wide ? 7 : 7}px sans-serif`;
    ctx.fillText(label, px + r + 2, py - r - 1);
  }

  // 睡眠小妖头顶浮动 zZ
  if (c.state === COLONIST_STATES.SLEEPING) {
    ctx.fillStyle = 'rgba(180,200,255,0.85)';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('zZ', px + r + 10, py - r - 12);
  }

  // 精神状态角标（敌对/抑郁/生病）——画在头顶
  const mark = c.mentalState && MENTAL_MARK[c.mentalState];
  if (mark) {
    const mx = px;
    const my = py - r - 8;
    ctx.fillStyle = mark.bg;
    ctx.beginPath();
    ctx.arc(mx, my, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(mark.text, mx, my + 0.5);
  }

  // 选中时画需求条
  if (selected) {
    drawNeedsBars(ctx, c, px, py - r - 16);
  }
}

function drawNeedsBars(ctx, c, cx, top) {
  const barW = 44;
  const barH = 4;
  const gap = 2;
  const colors = {
    spirit: '#c9a8ff',
    food: '#ffd28a',
    sleep: '#8ab8ff',
    social: '#ffb3c1',
    territory: '#9adba6',
  };
  ctx.font = '8px "Microsoft YaHei", sans-serif';
  ctx.textBaseline = 'alphabetic';
  NEEDS.forEach((n, i) => {
    const y = top + i * (barH + gap);
    const val = c.needs[n.id] ?? 0;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx - barW / 2, y, barW, barH);
    ctx.fillStyle = colors[n.id] || '#fff';
    ctx.fillRect(cx - barW / 2, y, Math.max(1, (barW * val) / 100), barH);
  });
}
