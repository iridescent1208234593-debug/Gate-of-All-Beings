/**
 * Cloudflare Turnstile for the in-game account form. The account server says whether it is
 * enabled (GET /api/turnstile → public site key or null); the secret never reaches the page.
 */
import { ACCOUNT_API } from './account.js';

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let config = null;
let loading = null;
let widget = null;
let current = '';

function siteKey() {
  if (!config) {
    config = fetch(`${ACCOUNT_API}/api/turnstile`, { credentials: 'include', signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => d.siteKey || '', () => '');
  }
  return config;
}

function loadScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCRIPT;
      s.async = true;
      s.onload = () => resolve(window.turnstile);
      s.onerror = () => { loading = null; reject(new Error('人机验证加载失败，请检查网络后重试')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

/** Render once into container; later calls only reset the existing widget. */
export async function mountTurnstile(container, action) {
  const key = await siteKey();
  if (!key) { container.hidden = true; return false; }
  container.hidden = false;
  if (widget !== null) { resetTurnstile(); return true; }
  const ts = await loadScript();
  widget = ts.render(container, {
    sitekey: key,
    action,
    callback: (token) => { current = token; },
    'expired-callback': () => { current = ''; },
    'error-callback': () => { current = ''; },
  });
  return true;
}

export function turnstileToken() {
  return current;
}

/** Tokens are single-use: reset after every submission. */
export function resetTurnstile() {
  current = '';
  if (widget !== null && window.turnstile) window.turnstile.reset(widget);
}
