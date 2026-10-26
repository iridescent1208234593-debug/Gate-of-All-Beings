/**
 * 灵境会馆 - 核心工具函数
 */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function round2(v) {
  return Math.round(v * 100) / 100;
}

/** 追加事件日志（保留最近 max 条） */
export function pushLog(log, msg, max = 40) {
  const entry = `[t${log._tick ?? ''}] ${msg}`;
  const next = [...log, entry];
  return next.length > max ? next.slice(next.length - max) : next;
}

/**
 * 昼夜判定（M6）：游戏 1 天 = 480 分钟，1 分钟 = 3 现实秒。
 * 夜晚：20:00（minute>=400）至 06:00（minute<120）。
 */
export function isNight(time) {
  if (!time || typeof time.minute !== 'number') return false;
  const m = time.minute;
  return m >= 400 || m < 120;
}
