// 统一会话：从统一入口读取当前登录用户（SSO），跨模块共享。
export async function fetchSession() {
  try {
    const r = await fetch('/api/sso-user', { credentials: 'same-origin' });
    if (!r.ok) return { logged_in: false };
    return await r.json();
  } catch {
    return { logged_in: false };
  }
}

let cached = null;
export function getSession() {
  return cached;
}
export async function refreshSession() {
  cached = await fetchSession();
  return cached;
}
