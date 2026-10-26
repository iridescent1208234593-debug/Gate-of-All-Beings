// 统一会话：从统一入口读取当前登录用户（SSO），跨模块共享。
// 同一页面里 site-nav.js、本模块与首页图廊共用一个 /api/sso-user 请求：
// window.__iridescentlySsoUser 是解析为用户 JSON（失败为 null）的 Promise，site-nav.js 用同名全局。
const SHARED_KEY = '__iridescentlySsoUser';
const REUSE_MS = 10000;
let sharedAt = 0;

function requestSsoUser() {
  return fetch('/api/sso-user', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

// 复用页面里已发出或刚完成的请求；fresh 时（例如窗口重新获得焦点）重新请求并替换共享结果。
export function loadSsoUser({ fresh = false } = {}) {
  if (typeof window === 'undefined') return requestSsoUser();
  if (!window[SHARED_KEY] || (fresh && Date.now() - sharedAt > REUSE_MS)) {
    window[SHARED_KEY] = requestSsoUser();
    sharedAt = Date.now();
  } else if (!sharedAt) {
    sharedAt = Date.now();
  }
  return window[SHARED_KEY];
}

export async function fetchSession(options) {
  return (await loadSsoUser(options)) || { logged_in: false };
}

let cached = null;
export function getSession() {
  return cached;
}
export async function refreshSession() {
  cached = await fetchSession({ fresh: cached !== null });
  return cached;
}
