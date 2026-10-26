/* Shared navigation recovery. Manual switching only: no redirect/retry loop. */
(function () {
  // nginx serves this file alone while the app is down, so the shared domain map may be absent:
  // without it the page stays on its own host and offers no alternate entry.
  const domains = () => window.IridescentlyDomains || null;
  const pcHost = host => {
    const map = domains();
    const candidate = map.service(host) === 'main' ? 'pc.' + host : 'pc-' + host;
    return map.config.previewHosts.includes(candidate) ? candidate : null;
  };
  function render(container, options = {}) {
    const map = domains();
    const hosts = map ? map.allowedHosts.filter(host => map.service(host)) : [];
    if (!document.getElementById('ir-recovery-style')) {
      const style = document.createElement('style');style.id = 'ir-recovery-style';
      style.textContent = '.ir-recovery{box-sizing:border-box;max-width:760px;margin:5vh auto;padding:clamp(20px,5vw,40px);color:var(--qc-text,#3a4a3e);background:var(--qc-panel,#fbf8f2);border:1px solid var(--qc-border,#d4cfbe);border-radius:12px;font:16px/1.8 system-ui;text-align:left}.ir-recovery h1{font-size:clamp(22px,4vw,30px)}.ir-recovery-actions{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}.ir-recovery a,.ir-recovery button{box-sizing:border-box;display:inline-block;min-height:44px;padding:10px 16px;font:inherit;text-decoration:none;border:1px solid var(--qc-accent,#5a9e8f);border-radius:6px;background:var(--qc-panel,#fbf8f2);color:var(--qc-text,#3a4a3e);cursor:pointer}.ir-recovery a:first-child{background:var(--qc-accent,#5a9e8f);color:#fff}.ir-recovery :focus-visible{outline:3px solid var(--qc-gold,#d4a840);outline-offset:3px}.ir-recovery small{display:block;color:var(--qc-dim,#657368)}';
      document.head.appendChild(style);
    }
    const canonical = hosts.find(host => host === location.hostname || pcHost(host) === location.hostname);
    const isPC = canonical && pcHost(canonical) === location.hostname;
    const alternate = canonical && (isPC ? canonical : pcHost(canonical));
    let path = options.path || location.pathname + location.search + location.hash;
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) path = '/#home';
    const box = document.createElement('section');box.className = 'ir-recovery';box.setAttribute('role','alert');
    const title = document.createElement('h1');title.textContent = options.title || '暂时无法打开游戏';
    const message = document.createElement('p');message.textContent = options.message || '当前入口的文件或服务暂不可用。请选择一种方式继续。';
    const actions = document.createElement('div');actions.className = 'ir-recovery-actions';
    const swap = document.createElement('a');swap.textContent = '换服务器重试';swap.setAttribute('data-server-choice','');
    swap.href = alternate ? 'https://' + alternate + path : '/__server/select?return=' + encodeURIComponent(path);
    const reload = document.createElement('button');reload.type = 'button';reload.textContent = '重新加载';reload.onclick = () => location.reload();
    const home = document.createElement('a');home.textContent = '返回众生之门游戏页面';home.href = canonical?.includes('zszm') || !canonical ? '/#home' : map.url('zszm', '/#home', canonical);
    actions.append(swap,reload,home);
    const state = document.createElement('p');state.textContent = '切换由你点击后执行，不会自动反复跳转。';
    const note = document.createElement('small');note.textContent = '两边共用香港账户与云端接口；浏览器内尚未上传的进度不会自动跨域搬迁。';
    box.append(title,message,actions,state,note);container.replaceChildren(box);
    if (alternate) fetch('https://' + alternate + '/__server/status', {cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(4000)})
      .then(response => {if (!response.ok) throw Error();return response.json();})
      .then(data => {if (!['hk-stable','pc-latest'].includes(data.node)) throw Error();state.textContent = (isPC ? '香港稳定版' : '本机新版') + '入口在线，可以点击换服务器重试。';})
      .catch(() => {state.textContent = '暂时无法确认另一入口是否在线；可以手动尝试切换或稍后重新加载。';});
    return box;
  }
  window.IridescentlyRecovery = {render};
  const start = () => document.querySelectorAll('[data-server-recovery]').forEach(container => render(container));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
