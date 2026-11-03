// 账户积分 / 排行榜上报：所有玩法共用，走同源 /api/progress/*（portal_server 在每个站点都挂载）。
// 身份只认会馆签发的共享登录（kind, uid）；访客可以照常玩，服务器不记录、不上榜。
// 上报失败只在控制台提示，从不打断游戏。
export const LEADERBOARD_URL = '/shared/shared-ui/leaderboard/index.html';
const API = '/api/progress/';
const lastSent = new Map();

function runRef(game) {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now();
  return game + ':' + rand;
}

async function post(body) {
  if (typeof fetch === 'undefined' || typeof location === 'undefined') return null; // Node 测试 / 非页面环境
  try {
    const res = await fetch(API + 'report', {
      method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) { console.warn('[progress] 上报未被接受：', data && data.error || res.status); return null; }
    return data;
  } catch (error) {
    console.warn('[progress] 上报失败：', error && error.message);
    return null;
  }
}

/**
 * 一局结束：finished=true 计入完成局数；won=true 计入胜利。ref 是这一局的稳定编号（重试不重复计分），
 * 缺省时自动生成。返回服务器结果（访客为 {ranked:false}），失败返回 null。
 */
export async function reportResult(game, { score = 0, won = false, finished = true, ref, toast = true } = {}) {
  const body = { game, score: Math.max(0, Math.floor(Number(score) || 0)), finished: !!finished, won: !!won };
  if (body.finished || body.won) body.ref = String(ref || runRef(game)).slice(0, 120);
  const result = await post(body);
  if (toast && result) showProgressToast(result);
  return result;
}

/**
 * 持续型玩法的阶段进度（经营、生态、AEON、灵体）：同一玩法默认至少间隔 minIntervalMs 才上报一次，
 * 分数变高时立刻上报。不计完成局数，只更新个人最佳与“今日游玩”。
 */
export function reportProgress(game, score, { minIntervalMs = 5 * 60 * 1000, toast = false } = {}) {
  const value = Math.max(0, Math.floor(Number(score) || 0));
  const prev = lastSent.get(game);
  const now = Date.now();
  if (prev && value <= prev.score && now - prev.at < minIntervalMs) return Promise.resolve(null);
  lastSent.set(game, { score: Math.max(value, prev ? prev.score : 0), at: now });
  return post({ game, score: value, finished: false, won: false }).then(result => {
    if (toast && result) showProgressToast(result);
    return result;
  });
}

export async function fetchMyProgress() {
  const res = await fetch(API + 'me', { credentials: 'same-origin' });
  return res.json();
}

export async function fetchLeaderboard(board = 'level', limit = 50) {
  const res = await fetch(API + 'leaderboard?board=' + encodeURIComponent(board) + '&limit=' + limit, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('排行榜暂时打不开');
  return res.json();
}

export async function fetchBoards() {
  const res = await fetch(API + 'boards', { credentials: 'same-origin' });
  return (await res.json()).boards;
}

/** 跨玩法任务链：登录返回各链实时进度，访客返回目录（无进度）。 */
export async function fetchChains() {
  const res = await fetch(API + 'chains', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('任务链暂时打不开');
  return res.json();
}

/** 领取已完成任务链的一次性积分奖励；失败时抛出服务器给的原因。 */
export async function claimChain(chain) {
  const res = await fetch(API + 'chains/claim', {
    method: 'POST', credentials: 'same-origin', keepalive: true,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chain }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || '领取失败，稍后再试');
  return data;
}

export function leaderboardUrl(board) {
  return LEADERBOARD_URL + (board ? '?board=' + encodeURIComponent(board) : '');
}

/** 局末小提示：获得的积分 + 去排行榜的入口。只用内联样式，不依赖各玩法的样式表。 */
export function showProgressToast(result) {
  if (typeof document === 'undefined' || !result) return;
  const earned = (result.awarded || []).reduce((sum, a) => sum + a.amount, 0);
  let text;
  if (!result.ranked) text = '登录会馆账号后，成绩才会记入排行榜';
  else if (earned > 0) text = `+${Math.round(earned * 10) / 10} 积分 · Lv.${result.level}` + (result.new_best ? ' · 新纪录' : '');
  else if (result.new_best) text = `新纪录 ${result.best} · Lv.${result.level}`;
  if (result.held_for_review) text = (earned > 0 ? `+${Math.round(earned * 10) / 10} 积分 · ` : '') + '这次成绩提升较大，复核后上榜';
  if (!text) return;
  const el = document.createElement('a');
  el.href = leaderboardUrl(result.game);
  el.target = '_top';
  el.textContent = text + ' · 排行榜 →';
  el.setAttribute('role', 'status');
  el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483000;'
    + 'padding:10px 16px;border-radius:999px;background:rgba(40,52,44,.92);color:#f6f1e3;font:14px/1.4 system-ui,sans-serif;'
    + 'text-decoration:none;box-shadow:0 6px 20px rgba(0,0,0,.25);max-width:calc(100vw - 32px);text-align:center;';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}
