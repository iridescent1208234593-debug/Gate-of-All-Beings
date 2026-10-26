/*
 * 主题系统端到端验证（手动工具，不在 unittest discover 范围内）。
 * 用法：先起服务（PORT=18099 python services/platform/portal_server.py）和无头 Edge：
 *   msedge --headless=new --remote-debugging-port=9223 --user-data-dir=<临时目录> about:blank
 * 然后 node services/platform/tests/test_theme_e2e.mjs（覆盖 cookie 三态、防闪烁、跟随系统、tone 联动）。
 */
/* 端到端验证主题系统：CDP 驱动无头 Edge 访问本地 connections 页。 */
const CDP = 'http://127.0.0.1:9223';

async function cdp(wsUrl, calls) {
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  };
  const send = (method, params = {}) => new Promise((ok) => {
    const mid = ++id;
    pending.set(mid, ok);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const result = await calls(send);
  ws.close();
  return result;
}

const evalJs = async (send, expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true });
  if (res.result?.exceptionDetails) throw new Error('page error: ' + JSON.stringify(res.result.exceptionDetails.exception?.description || res.result.exceptionDetails.text));
  return res.result?.result?.value;
};

const assert = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + ' | got=' + JSON.stringify(got) + (ok ? '' : ' want=' + JSON.stringify(want)));
  if (!ok) process.exitCode = 1;
};

const page = (await (await fetch(CDP + '/json/new?about:blank', { method: 'PUT' })).json()).webSocketDebuggerUrl;
await cdp(page, async (send) => {
  await send('Page.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Network.clearBrowserCookies');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:18099/connections.html' });
  await new Promise((ok) => setTimeout(ok, 3000));

  // 1. 初始：无 cookie → auto → 跟随系统（无头默认 light）
  assert('初始 data-theme 跟随系统(auto)', await evalJs(send, 'document.documentElement.dataset.theme'), 'light');
  assert('nav 挂载了主题控件', await evalJs(send, "!!document.querySelector('#qc-nav .qc-theme button')"), true);
  assert('跟随系统开关初始勾选', await evalJs(send, "document.querySelector('.qc-theme-follow input').checked"), true);

  // 2. 点"深色" → 脱离 auto，写 cookie
  await evalJs(send, "document.querySelectorAll('.qc-theme-opt')[1].click()");
  await new Promise((ok) => setTimeout(ok, 300));
  assert('切深色后 data-theme', await evalJs(send, 'document.documentElement.dataset.theme'), 'dark');
  assert('cookie hx_theme=dark', await evalJs(send, "document.cookie.includes('hx_theme=dark')"), true);
  assert('跟随系统开关自动取消勾选', await evalJs(send, "document.querySelector('.qc-theme-follow input').checked"), false);
  assert('nav tone 自动切暗', await evalJs(send, "document.getElementById('qc-nav').dataset.tone === undefined"), true);

  // 3. 勾回"跟随系统"
  await evalJs(send, "document.querySelector('.qc-theme-follow input').click()");
  await new Promise((ok) => setTimeout(ok, 300));
  assert('回 auto 后 cookie', await evalJs(send, "document.cookie.includes('hx_theme=auto')"), true);

  // 4. 固定深色 → 刷新验证防闪烁 + 跨页 cookie
  await evalJs(send, "document.querySelectorAll('.qc-theme-opt')[1].click()");
  await new Promise((ok) => setTimeout(ok, 200));
  await send('Page.reload');
  await new Promise((ok) => setTimeout(ok, 4000));
  assert('刷新后防闪烁保持 dark', await evalJs(send, 'document.documentElement.dataset.theme'), 'dark');

  // 5. matchMedia 系统变化跟随（emulate）；reload 后等 theme.js 就绪再 set
  for (let i = 0; i < 20 && !(await evalJs(send, '!!window.XTheme')); i++) await new Promise((ok) => setTimeout(ok, 250));
  await evalJs(send, "window.XTheme.set('auto')");
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await new Promise((ok) => setTimeout(ok, 300));
  assert('auto 下系统切深色实时跟随', await evalJs(send, 'window.XTheme.resolved()'), 'dark');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await new Promise((ok) => setTimeout(ok, 300));
  assert('auto 下系统切回浅色实时跟随', await evalJs(send, 'window.XTheme.resolved()'), 'light');
});
