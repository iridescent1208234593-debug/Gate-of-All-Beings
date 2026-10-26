import { unifiedStorage } from '@lxh/shared-session/kv.js';
const localStorage = unifiedStorage('ui');
/**
 * 灵境会馆 - 主题系统（参照 huiguan 站 COLOR_SCHEMES 机制）
 * 主色 primary / primaryDark 与辅色 accent 分开命名，内置多套中国古色方案。
 * drawBackground 及全局 UI 均从主题取色，禁止硬编码色值。
 * 支持 localStorage 持久化；Node 环境可注入内存 storage 以便验证。
 */
const STORAGE_KEY = 'lingjing-theme';

/** 可注入存储（浏览器默认 localStorage，Node 验证用内存 Map） */
let storage = typeof localStorage !== 'undefined' ? localStorage : null;
export function setThemeStorage(s) {
  storage = s || null;
}

/**
 * 内置主题列表（深色游戏底 + 中国古色辅色）。
 * 字段对齐 huiguan COLOR_SCHEMES：primary/primaryDark/accent/accentLight/accentPale/text/dim/line。
 * 默认主题「松绿×暖金」取西木会馆 design-system 的松绿主色（--qc-accent #5a9e8f）。
 */
export const COLOR_SCHEMES = [
  {
    name: '松绿×暖金',
    primary: '#1e4638',
    primaryDark: '#122a21',
    accent: '#5a9e8f',
    accentLight: '#8fc5b5',
    accentPale: '#cde8de',
    text: '#e8efe9',
    dim: '#8aa39a',
    line: 'rgba(90,158,143,0.28)',
  },
  {
    name: '深绿×暖黄',
    primary: '#1b4d3e',
    primaryDark: '#103428',
    accent: '#e8c050',
    accentLight: '#f0d878',
    accentPale: '#f8e8a8',
    text: '#e4efe0',
    dim: '#8a9e80',
    line: 'rgba(232,192,80,0.25)',
  },
  {
    name: '罗小黑·漆黑×翠绿',
    primary: '#1A1F2E',
    primaryDark: '#10131C',
    accent: '#0EB83A',
    accentLight: '#86DB9C',
    accentPale: '#B6E9C3',
    text: '#DFDBD8',
    dim: '#72707D',
    line: 'rgba(14,184,58,0.25)',
  },
  {
    name: '鹿野·黛蓝×缟白',
    primary: '#3B3561',
    primaryDark: '#242042',
    accent: '#F0EFEB',
    accentLight: '#F6F5F2',
    accentPale: '#FBFAF8',
    text: '#E6E4F0',
    dim: '#8B87A6',
    line: 'rgba(240,239,235,0.25)',
  },
  {
    name: '哪吒·品红×橙黄',
    primary: '#8B1942',
    primaryDark: '#560F28',
    accent: '#FFA400',
    accentLight: '#FFD17F',
    accentPale: '#FFE3B2',
    text: '#F0DADB',
    dim: '#B06C88',
    line: 'rgba(255,164,0,0.25)',
  },
  {
    name: '绛紫×月白',
    primary: '#8C4356',
    primaryDark: '#542833',
    accent: '#D6ECF0',
    accentLight: '#eaf5f7',
    accentPale: '#f2f9fa',
    text: '#f1e1de',
    dim: '#b18393',
    line: 'rgba(214,236,240,0.25)',
  },
  {
    name: '鸦青×酡颜',
    primary: '#424C50',
    primaryDark: '#272d30',
    accent: '#F9906F',
    accentLight: '#fcc7b7',
    accentPale: '#fdddd3',
    text: '#e5e2de',
    dim: '#888890',
    line: 'rgba(249,144,111,0.25)',
  },
  {
    name: '玄青×赤金',
    primary: '#3D3B4F',
    primaryDark: '#24232f',
    accent: '#F2BE45',
    accentLight: '#f8dea2',
    accentPale: '#fbebc7',
    text: '#e5dfdd',
    dim: '#857f8f',
    line: 'rgba(242,190,69,0.25)',
  },
  {
    name: '黛绿×珊瑚赫',
    primary: '#2F4A4A',
    primaryDark: '#1D2D2D',
    accent: '#C12C1F',
    accentLight: '#e0958f',
    accentPale: '#ecbfbb',
    text: '#e3e2dd',
    dim: '#7d878c',
    line: 'rgba(193,44,31,0.25)',
  },
  {
    name: '紫檀×松花',
    primary: '#4C221B',
    primaryDark: '#2d1410',
    accent: '#FFEE6F',
    accentLight: '#fff6b7',
    accentPale: '#fff9d3',
    text: '#e7dcd6',
    dim: '#8d7172',
    line: 'rgba(255,238,111,0.25)',
  },
  {
    name: '水绿×葱青',
    primary: '#3E6E4E',
    primaryDark: '#27473a',
    accent: '#D4F2E7',
    accentLight: '#e8f8f2',
    accentPale: '#f0faf6',
    text: '#e2ede6',
    dim: '#8fb0a1',
    line: 'rgba(212,242,231,0.25)',
  },
  {
    name: '苍黄×丁香色',
    primary: '#2E5C48',
    primaryDark: '#1C392C',
    accent: '#CCA4E3',
    accentLight: '#e5d1f1',
    accentPale: '#efe3f6',
    text: '#e2e4dc',
    dim: '#7d918b',
    line: 'rgba(204,164,227,0.25)',
  },
  {
    name: '紫夜·灵质（原配色）',
    primary: '#241a3e',
    primaryDark: '#181030',
    accent: '#7a5af0',
    accentLight: '#9d86ff',
    accentPale: '#c9b8ff',
    text: '#e8e2f7',
    dim: '#9a8fc0',
    line: 'rgba(122,90,240,0.25)',
  },
];

export const DEFAULT_THEME_NAME = COLOR_SCHEMES[0].name;

/** 主题名列表 */
export function getThemeNames() {
  return COLOR_SCHEMES.map((s) => s.name);
}

/** 按名称取主题；未知名称回退默认主题 */
export function getTheme(name) {
  const found = COLOR_SCHEMES.find((s) => s.name === name);
  return found || COLOR_SCHEMES[0];
}

/** 读取当前生效主题（持久化优先，无记录用默认主题） */
export function getCurrentTheme() {
  let name = null;
  if (storage) {
    try {
      name = storage.getItem(STORAGE_KEY);
    } catch {
      name = null;
    }
  }
  return getTheme(name);
}

/** 切换并持久化主题，返回新主题；未知名称回退默认主题且不覆盖已保存偏好 */
export function setTheme(name) {
  const found = COLOR_SCHEMES.find((s) => s.name === name);
  const theme = found || COLOR_SCHEMES[0];
  if (found && storage) {
    try {
      storage.setItem(STORAGE_KEY, theme.name);
    } catch {
      /* 持久化失败不影响本次切换 */
    }
  }
  return theme;
}

/* ---------- 颜色工具 ---------- */

/** hex 转 rgb 分量 */
export function hexToRgb(hex) {
  let h = String(hex || '').trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 亮度（WCAG 近似），0~255 */
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 颜色明暗处理：hex + 亮度倍率（ratio>1 提亮，<1 压暗） */
export function shade(hex, ratio) {
  const [r, g, b] = hexToRgb(hex);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clamp(r * ratio)},${clamp(g * ratio)},${clamp(b * ratio)})`;
}

/** 压暗：返回新 hex */
export function darken(hex, ratio) {
  const [r, g, b] = hexToRgb(hex);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r * ratio), clamp(g * ratio), clamp(b * ratio)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

/** hex 转 rgba 字符串 */
export function hexA(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ---------- 场景取色（画布用，全部源自主题） ---------- */

/** 背景渐变：白天 primaryDark→primary；夜晚整体压暗 */
export function gradientColors(theme, night) {
  if (!theme) theme = getCurrentTheme();
  if (night) {
    return { top: darken(theme.primaryDark, 0.72), bottom: darken(theme.primary, 0.72) };
  }
  return { top: theme.primaryDark, bottom: theme.primary };
}

/** 星星 rgb 分量（白天用 pale 提亮，夜晚用 accentLight） */
export function starRgb(theme, night) {
  if (!theme) theme = getCurrentTheme();
  return hexToRgb(night ? theme.accentLight : theme.accentPale);
}

/** 地面灵质雾气 rgb 分量（源自辅色 accent） */
export function fogRgb(theme) {
  if (!theme) theme = getCurrentTheme();
  return hexToRgb(theme.accent);
}

/** 夜晚整体变暗遮罩（源自主色压暗，统一透明度 0.32） */
export function nightOverlay(theme) {
  if (!theme) theme = getCurrentTheme();
  return hexA(darken(theme.primaryDark, 0.55), 0.32);
}

/** 月亮三色：光晕 / 月体 / 月牙阴影（均从主题推导） */
export function moonColors(theme) {
  if (!theme) theme = getCurrentTheme();
  return {
    halo: hexA(theme.accentLight, 0.14),
    body: theme.accentPale,
    shadow: darken(theme.primaryDark, 0.62),
  };
}

/** 网格线：使用主题 line（已带透明度），无 line 时退化为主色淡线 */
export function gridLine(theme) {
  if (!theme) theme = getCurrentTheme();
  return theme.line || hexA(theme.primary, 0.22);
}

/* ---------- DOM 主题应用（参照 huiguan applyFormTheme 机制） ---------- */

/**
 * 将主题写入 document.documentElement 的 CSS 变量。
 * styles.css 的 :root 默认值保留作为首帧兜底，启动后立即调用本函数覆盖。
 */
export function applyThemeToDom(theme) {
  if (typeof document === 'undefined') return;
  if (!theme) theme = getCurrentTheme();
  const root = document.documentElement.style;
  root.setProperty('--bg', theme.primaryDark);
  root.setProperty('--panel', theme.primary);
  root.setProperty('--panel-deep', darken(theme.primaryDark, 0.82));
  root.setProperty('--panel-raise', shade(theme.primary, 1.35));
  root.setProperty('--panel-border', theme.line);
  root.setProperty('--text', theme.text);
  root.setProperty('--text-dim', theme.dim);
  root.setProperty('--accent', theme.accent);
  root.setProperty('--accent-bright', theme.accentLight);
  root.setProperty('--accent-pale', theme.accentPale);
  root.setProperty('--accent-glow', hexA(theme.accent, 0.16));
  root.setProperty('--accent-weak', hexA(theme.accent, 0.12));
  root.setProperty('--accent-faint', hexA(theme.accent, 0.08));
  root.setProperty('--accent-strong', hexA(theme.accent, 0.45));
  // 按钮/强调文字色自适应：accent 偏亮用深字，偏暗用白字
  root.setProperty('--btn-text', luminance(theme.accent) > 140 ? '#161823' : '#ffffff');
}
