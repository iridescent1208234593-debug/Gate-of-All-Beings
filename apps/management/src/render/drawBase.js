/**
 * 灵境会馆 - 渲染层：基地绘制
 * Canvas 2D：灵质空间氛围背景、网格、建筑、建造预览。
 */
import { getBuilding } from '../content/buildings.js';
import * as building from '../systems/building.js';
import { getCrop } from '../content/crops.js';
import { RESOURCE_TYPES } from '../systems/spiritSpace.js';
import { isNight } from '../core/util.js';
import { getCurrentTheme, gradientColors, starRgb, fogRgb, nightOverlay, moonColors, gridLine } from '../core/theme.js';

/** 确定性伪随机（避免每帧闪烁） */
function pseudoRand(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function drawBase(ctx, state, tileSize) {
  const night = isNight(state.time);
  drawBackground(ctx, state, tileSize, night);
  drawGrid(ctx, state, tileSize);
  drawResources(ctx, state, tileSize);
  drawBuildings(ctx, state, tileSize);

  // 夜晚整体变暗遮罩（建筑与资源一并压暗；颜色源自当前主题）
  if (night) {
    ctx.fillStyle = nightOverlay();
    ctx.fillRect(0, 0, state.space.width * tileSize, state.space.height * tileSize);
  }
}

/** 绘制资源点：树木/草药/石头/矿产（图标 + 剩余存量条） */
function drawResources(ctx, state, tileSize) {
  for (const t of state.space.tiles) {
    if (!t.resource) continue;
    const def = RESOURCE_TYPES[t.resource.type];
    if (!def) continue;
    const x = t.x * tileSize;
    const y = t.y * tileSize;

    // 微光底色
    ctx.fillStyle = hexA(def.color, 0.16);
    roundRect(ctx, x + 1, y + 1, tileSize - 2, tileSize - 2, 4);
    ctx.fill();

    // 图标
    ctx.font = `${Math.floor(tileSize * 0.52)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, x + tileSize / 2 - 1, y + tileSize / 2 - 3);

    // 剩余存量条（按 35 满值参考）
    const ratio = Math.max(0, Math.min(1, (t.resource.amount || 0) / 35));
    const bw = tileSize - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, x + 4, y + tileSize - 6, bw, 3, 1.5);
    ctx.fill();
    if (ratio > 0) {
      ctx.fillStyle = def.color;
      roundRect(ctx, x + 4, y + tileSize - 6, Math.max(2, bw * ratio), 3, 1.5);
      ctx.fill();
    }
  }
}

function drawBackground(ctx, state, tileSize, night) {
  const theme = getCurrentTheme();
  const w = state.space.width * tileSize;
  const h = state.space.height * tileSize;
  const { top, bottom } = gradientColors(theme, night);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 灵质星点（夜间更亮更多；颜色源自主题辅色）
  const [sr, sg, sb] = starRgb(theme, night);
  const starCount = night ? 150 : 90;
  for (let i = 0; i < starCount; i++) {
    const sx = pseudoRand(i, 7) * w;
    const sy = pseudoRand(i, 13) * h;
    const r = pseudoRand(i, 29) * 1.2 + 0.3;
    const a = night ? pseudoRand(i, 41) * 0.7 + 0.3 : pseudoRand(i, 41) * 0.5 + 0.2;
    ctx.fillStyle = `rgba(${sr},${sg},${sb},${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 夜晚：右上角月亮（圆 + 月牙阴影 + 光晕；颜色源自主题）
  if (night) {
    const { halo, body, shadow } = moonColors(theme);
    const mx = w * 0.82;
    const my = h * 0.16;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(mx, my, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(mx, my, 25, 0, Math.PI * 2);
    ctx.fill();
    // 月牙阴影
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(mx + 11, my - 6, 21, 0, Math.PI * 2);
    ctx.fill();
  }

  // 地面灵质雾气（颜色源自主题辅色 accent）
  const [fr, fg, fb] = fogRgb(theme);
  const fog = ctx.createRadialGradient(w / 2, h * 0.75, 40, w / 2, h * 0.75, w * 0.7);
  fog.addColorStop(0, night ? `rgba(${fr},${fg},${fb},0.14)` : `rgba(${fr},${fg},${fb},0.16)`);
  fog.addColorStop(1, `rgba(${fr},${fg},${fb},0)`);
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, w, h);
}

function drawGrid(ctx, state, tileSize) {
  ctx.strokeStyle = gridLine();
  ctx.lineWidth = 1;
  for (let x = 0; x <= state.space.width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * tileSize, 0);
    ctx.lineTo(x * tileSize, state.space.height * tileSize);
    ctx.stroke();
  }
  for (let y = 0; y <= state.space.height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * tileSize);
    ctx.lineTo(state.space.width * tileSize, y * tileSize);
    ctx.stroke();
  }
}

function drawBuildings(ctx, state, tileSize) {
  for (const b of state.buildings) {
    const def = getBuilding(b.buildingId);
    if (!def) continue;
    const built = building.isBuilt(b);
    const x = b.x * tileSize;
    const y = b.y * tileSize;
    const w = b.w * tileSize;
    const h = b.h * tileSize;

    // 底座
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 6);
    ctx.fill();

    // M7 建造中：整栋半透明绘制成骨架，不显示功能信息
    if (!built) ctx.globalAlpha = 0.45;

    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, shade(def.color, 1.25));
    grad.addColorStop(1, shade(def.color, 0.8));
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, w - 2, h - 2, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w - 2, h - 2, 6);
    ctx.stroke();

    // 图标
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = `${Math.floor(h * 0.55)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, x + w / 2 - 1, y + h / 2 - 2);

    ctx.globalAlpha = 1;

    if (!built) {
      // 建造中：底部进度条 + 顶部「建造中」标记
      const pct = Math.max(0, Math.min(1, (b.construction ?? 0) / (b.buildTime || 1)));
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(ctx, x + 4, y + h - 12, w - 12, 5, 2.5);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      roundRect(ctx, x + 4, y + h - 12, Math.max(2, (w - 12) * pct), 5, 2.5);
      ctx.fill();
      ctx.font = '9px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(255,235,170,0.95)';
      ctx.fillText(`建造中 ${Math.round(pct * 100)}%`, x + w / 2 - 1, y - 3);
      continue;
    }

    // 名称
    ctx.font = '10px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(def.name, x + w / 2 - 1, y + h - 6);

    // 灵田作物进度色块
    if (def.workType === 'farm' && b.crop) {
      const cropDef = getCrop(b.crop.cropId);
      if (cropDef) {
        const ratio = Math.max(0, Math.min(1, b.crop.progress / cropDef.growTime));
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        roundRect(ctx, x + 8, y + h - 18, w - 20, 5, 2.5);
        ctx.fill();
        ctx.fillStyle = cropDef.color;
        roundRect(ctx, x + 8, y + h - 18, Math.max(2, (w - 20) * ratio), 5, 2.5);
        ctx.fill();
      }
    }

    // 锻造坊 / 传信塔工作进度（读取首位工人的 job.progress）
    if ((def.workType === 'forge' || def.workType === 'diplomacy') && b.workers.length > 0) {
      const first = state.colonists.find((c) => c.id === b.workers[0]);
      const job = first && first.job;
      const ratio = job && job.workTime > 0 ? Math.max(0, Math.min(1, job.progress / job.workTime)) : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      roundRect(ctx, x + 8, y + h - 18, w - 20, 5, 2.5);
      ctx.fill();
      ctx.fillStyle = def.workType === 'forge' ? '#ffd166' : '#8fd6ff';
      roundRect(ctx, x + 8, y + h - 18, Math.max(2, (w - 20) * ratio), 5, 2.5);
      ctx.fill();
    }

    // 使用中的小点
    if (b.workers.length > 0) {
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(x + w - 8, y + 8, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawPlacementGhost(ctx, state, placement, mouse, tileSize) {
  const def = getBuilding(placement.buildingId);
  if (!def || !mouse.inside || mouse.gx < 0) return;

  // 校验
  let ok = true;
  const gx = mouse.gx;
  const gy = mouse.gy;
  if (gx < 0 || gy < 0 || gx + def.size.w > state.space.width || gy + def.size.h > state.space.height) {
    ok = false;
  } else {
    for (let y = gy; y < gy + def.size.h; y++) {
      for (let x = gx; x < gx + def.size.w; x++) {
        const t = state.space.tiles[y * state.space.width + x];
        if (!t || t.buildingId || t.resource) ok = false;
      }
    }
    // 资源检查
    for (const [k, v] of Object.entries(def.cost)) {
      if ((state.resources[k] ?? 0) < v) ok = false;
    }
  }

  ctx.fillStyle = ok ? 'rgba(120,220,150,0.35)' : 'rgba(240,100,100,0.35)';
  ctx.strokeStyle = ok ? 'rgba(120,220,150,0.9)' : 'rgba(240,100,100,0.9)';
  ctx.lineWidth = 2;
  roundRect(ctx, gx * tileSize, gy * tileSize, def.size.w * tileSize - 2, def.size.h * tileSize - 2, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '12px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.icon, gx * tileSize + (def.size.w * tileSize) / 2, gy * tileSize + (def.size.h * tileSize) / 2);
}

/** 颜色明暗处理：hex + 亮度倍率 */
export function shade(hex, ratio) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * ratio));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * ratio));
  const b = Math.min(255, Math.round((n & 255) * ratio));
  return `rgb(${r},${g},${b})`;
}

/** hex 颜色转 rgba（透明度 0~1） */
export function hexA(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
