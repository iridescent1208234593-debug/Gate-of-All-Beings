import siteDomains from '../../../../packages/site-domains/index.mjs';
import { unifiedStorage } from '@lxh/shared-session/kv.js';
const localStorage = unifiedStorage('management');
/**
 * 灵境会馆 - 账号系统
 * 对接 huiguan 站点账号（/api/auth 注册登录、/api/user 会话、/api/game/save|load 云存档）。
 * 跨域：开发环境 localhost:5179 → 本地 8089；其他域名 → 同一根域下的会馆（见 packages/site-domains/domains.json）
 */
const DEV_ORIGIN = typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname);
export const ACCOUNT_API = DEV_ORIGIN ? 'http://localhost:8089' : siteDomains.url('huiguan', '');

const SESSION_KEY = 'lingjing-huiguan-account';

/** 当前登录会话（本地缓存，uid 用于存档隔离） */
export function currentUser() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistUser(user) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
}

async function api(path, options = {}) {
  const resp = await fetch(`${ACCOUNT_API}${path}`, {
    credentials: 'include',
    signal: AbortSignal.timeout(6000),
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  let data = null;
  try {
    data = await resp.json();
  } catch {
    /* 非 JSON 响应 */
  }
  if (!resp.ok) {
    const err = new Error((data && data.error) || `请求失败(${resp.status})`);
    err.status = resp.status;
    throw err;
  }
  return data;
}

/** 登录或注册（用户名不存在时自动注册），成功返回用户信息 */
export async function login(username, password, turnstile = '') {
  const data = await api('/api/auth', {
    method: 'POST',
    body: JSON.stringify({ username, password, turnstile }),
  });
  const user = data.user || null;
  persistUser(user);
  return { user, registered: !!data.registered };
}

/** 检查当前会话（cookie 是否仍有效），有效则同步用户信息 */
export async function restoreSession() {
  const cached = currentUser();
  try {
    const data = await api('/api/user');
    if (data && data.logged_in) {
      const user = {
        uid: data.user_id,
        kind: data.kind,
        name: data.nickname || data.username || data.user_id,
        is_admin: !!data.is_admin,
        role: data.role,
      };
      persistUser(user);
      return user;
    }
  } catch {
    /* 网络失败时退回本地缓存 */
  }
  return cached;
}

/** 退出登录 */
export async function logout() {
  try {
    await api('/api/logout');
  } catch {
    /* 忽略 */
  }
  persistUser(null);
}

/** 云存档：上传当前 GameState */
export async function saveCloud(state) {
  const data = await api('/api/game/save', {
    method: 'POST',
    body: JSON.stringify({ state }),
  });
  return data;
}

/** 云存档：读取当前用户存档，无存档返回 null */
export async function loadCloud() {
  const data = await api('/api/game/load');
  return data && data.state ? data.state : null;
}
