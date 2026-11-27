/* Real browser installation on the Gate origin. Never caches account/OC data. */
(() => {
  'use strict';
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const mobile = ios || /Android/i.test(ua);
  const embedded = /MicroMessenger|\bQQ\//i.test(ua);
  const standalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const key = 'zszm:install-reminder:v2';
  const hostService = window.IridescentlyDomains?.service(location.hostname);
  const gateHost = hostService === 'zszm' || ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
  let promptEvent = null, busy = false, dialog = null, expanded = false, automatic = false, timer, guidePromise;
  // The Shell runs this script again on every mount of the Gate: everything registered on window,
  // document or body is tied to this mount and released by the dispose hook at the end (#94).
  const lifetime = new AbortController();
  const signal = lifetime.signal;
  let observer = null;
  let installed = standalone();
  const page = document.querySelector('[data-install-guide]');
  function remember() { try { localStorage.setItem(key, 'seen'); } catch (_) {} }
  function seen() { try { return localStorage.getItem(key) === 'seen'; } catch (_) { return true; } }
  const canInstall = () => !ios && !embedded && !installed && !standalone() && !!promptEvent;
  function status(message) {
    const output = dialog?.open ? dialog.querySelector('[data-install-status]') : page?.querySelector('#install-status');
    if (output) output.textContent = message;
  }
  function refresh() {
    const label = installed || standalone() ? '已安装' : busy ? '正在打开安装确认…' : '点击下载桌面快捷打开方式';
    for (const button of [page?.querySelector('#install-now'), dialog?.querySelector('[data-install-primary]')]) {
      if (button) {
        button.hidden = false;
        button.disabled = busy || installed || standalone();
        button.textContent = label;
      }
    }
    if (dialog) dialog.querySelector('[data-install-expand]').hidden = expanded;
  }
  async function requestInstall() {
    if (canInstall()) return install();
    if (installed || standalone()) return;
    status(ios ? 'iPhone / iPad 请按下方图文，通过分享菜单添加到主屏幕。'
      : embedded ? '当前应用内无法直接安装，请按教程在系统浏览器中打开。'
      : '当前浏览器尚未提供一键安装，请使用下方教程中的浏览器安装入口。');
    if (dialog?.open) await expand();
  }
  async function install() {
    if (!canInstall() || busy) return;
    const event = promptEvent;
    promptEvent = null; busy = true; refresh();
    try {
      // Called synchronously from the user's click, using the real browser event.
      await event.prompt();
      const choice = await event.userChoice;
      status(choice.outcome === 'accepted' ? '已确认安装请求，请按浏览器提示完成添加。' : '已取消安装，你可以查看添加步骤手动添加。');
    } catch (_) { status('暂时无法调起安装，请查看添加步骤手动添加。'); }
    finally { busy = false; refresh(); }
  }
  window.addEventListener('beforeinstallprompt', event => {
    if (!gateHost || ios || embedded) return;
    event.preventDefault(); promptEvent = event; refresh();
  }, { signal });
  window.addEventListener('appinstalled', () => {
    promptEvent = null; installed = true; remember(); status(mobile ? '已添加，请到手机主屏幕查看图标。' : '应用已安装，可从系统的应用列表中打开。'); refresh();
  }, { signal });
  matchMedia('(display-mode: standalone)').addEventListener('change', () => {
    if (standalone()) { installed = true; if (dialog?.open) dialog.close(); status('当前已在独立窗口中打开，无需再次添加。'); }
    refresh();
  }, { signal });
  function bindGuide(root) {
    const select = platform => {
      root.querySelectorAll('[data-platform]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.platform === platform)));
      for (const name of ['ios', 'android', 'desktop']) root.querySelector('#install-' + name).hidden = platform !== name;
    };
    select(ios ? 'ios' : mobile ? 'android' : 'desktop');
    root.querySelectorAll('[data-platform]').forEach(button => button.addEventListener('click', () => select(button.dataset.platform)));
    root.querySelector('#install-embedded').hidden = !embedded;
    const browserSelect = root.querySelector('[data-android-browser]');
    if (browserSelect) {
      const choices = [[/baiduboxapp/i, 'baidu'], [/Quark/i, 'quark'], [/UCBrowser|UCWEB/i, 'uc'], [/MQQBrowser|QQBrowser/i, 'qq'],
        [/HuaweiBrowser/i, 'huawei'], [/HONORBrowser/i, 'honor'], [/MiuiBrowser/i, 'xiaomi'], [/HeyTapBrowser|OppoBrowser/i, 'oppo'],
        [/VivoBrowser/i, 'vivo'], [/SamsungBrowser/i, 'samsung'], [/EdgA/i, 'edge'], [/Firefox|Fennec/i, 'firefox'], [/Chrome/i, 'chrome']];
      browserSelect.value = choices.find(([pattern]) => pattern.test(ua))?.[1] || 'system';
      const showBrowserHelp = () => root.querySelectorAll('[data-android-help]').forEach(panel => { panel.hidden = panel.dataset.androidHelp !== browserSelect.value; });
      browserSelect.addEventListener('change', showBrowserHelp);
      showBrowserHelp();
    }

    root.querySelector('#install-copy').addEventListener('click', async () => {
      const output = root.querySelector('#install-copy-status');
      const url = new URL('/install.html', location.origin).href;
      try { await navigator.clipboard.writeText(url); output.textContent = '网址已复制，请粘贴到浏览器中打开。'; }
      catch (_) { output.textContent = '请长按复制此网址：' + url; }
    });
    root.querySelector('#install-now')?.addEventListener('click', requestInstall);
  }
  function placeInstallButton() {
    const slot = dialog.querySelector('[data-install-slot]');
    if (expanded && slot) slot.appendChild(dialog.querySelector('[data-install-primary]'));
  }
  async function expand() {
    if (!dialog) return;
    const content = dialog.querySelector('[data-install-tutorial]');
    expanded = true; dialog.classList.add('is-expanded'); content.hidden = false; dialog.querySelector('.gate-install-scroll').scrollTop = 0; refresh();
    if (content.dataset.loaded) { placeInstallButton(); return; }
    content.textContent = '正在加载图文步骤…';
    try {
      if (!guidePromise) guidePromise = fetch('/install.html', { credentials: 'same-origin' }).then(response => {
        if (!response.ok) throw new Error('guide unavailable');
        return response.text();
      }).catch(error => { guidePromise = null; throw error; });
      const source = new DOMParser().parseFromString(await guidePromise, 'text/html');
      const original = source.querySelector('[data-install-guide]');
      if (!original) throw new Error('missing guide');
      const fragment = document.createDocumentFragment();
      for (const selector of ['#install-embedded', '.install-platforms', '[data-install-slot]', '#install-ios', '#install-android', '#install-desktop']) {
        const section = original.querySelector(selector);
        if (!section) throw new Error('missing guide section');
        const clone = document.importNode(section, true);
        if (clone.matches('[data-install-slot]')) clone.replaceChildren();
        fragment.appendChild(clone);
      }
      content.replaceChildren(fragment); content.dataset.loaded = 'true'; bindGuide(content); placeInstallButton();
    } catch (_) {
      content.textContent = '教程暂时无法加载，请检查网络后重试。';
      const retry = document.createElement('button');
      retry.type = 'button'; retry.textContent = '重新加载教程'; retry.addEventListener('click', expand); content.appendChild(retry);
    }
  }
  function createDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog'); dialog.className = 'gate-install-dialog';
    dialog.setAttribute('aria-labelledby', 'gate-install-title');
    dialog.setAttribute('aria-describedby', 'gate-install-description');
    dialog.innerHTML = '<header class="gate-install-head"><h2 id="gate-install-title">添加到桌面</h2><button type="button" data-install-close aria-label="关闭添加到桌面窗口">关闭</button></header>' +
      '<div class="gate-install-scroll"><div class="gate-install-welcome"><img src="/pwa/icon-192.png" width="72" height="72" alt="众生之门">' +
      '<h3>把众生之门添加到桌面</h3><p id="gate-install-description">无需应用商店下载，添加后可从手机桌面打开。</p></div>' +
      '<p data-install-status role="status" aria-live="polite"></p>' +
      '<div class="gate-install-actions"><button type="button" class="gate-install-primary" data-install-primary>点击下载桌面快捷打开方式</button>' +
      '<button type="button" data-install-expand>展开图文教程</button><button type="button" data-install-later>稍后再说</button></div>' +
      '<div class="install-guide gate-install-tutorial" data-install-tutorial hidden></div>' +
      '<p class="gate-install-hint">可在「设置 → 添加到桌面」再次查看教程。</p></div>';
    document.body.appendChild(dialog);
    dialog.querySelector('[data-install-close]').addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-install-later]').addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-install-expand]').addEventListener('click', expand);
    dialog.querySelector('[data-install-primary]').addEventListener('click', requestInstall);
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => document.body.classList.remove('gate-install-open'));
  }
  function open(tutorial = false, auto = false) {
    if (!gateHost) return;
    createDialog(); automatic = auto; expanded = false; dialog.classList.remove('is-expanded');
    dialog.querySelector('.gate-install-actions').prepend(dialog.querySelector('[data-install-primary]'));
    dialog.querySelector('[data-install-tutorial]').hidden = true;
    dialog.querySelector('[data-install-later]').hidden = tutorial;
    dialog.querySelector('[data-install-status]').textContent = standalone() ? '当前已在独立窗口中打开，无需再次添加。' : '';
    refresh(); if (!dialog.open) dialog.showModal();
    document.body.classList.add('gate-install-open'); remember(); if (tutorial) void expand();
  }
  function ready() { return document.documentElement.dataset.gateInstallReady === 'true'; }
  function tryAutomatic() {
    if (!ready()) { if (automatic && dialog?.open) dialog.close(); return; }
    if (!gateHost || page || !mobile || standalone() || seen() || dialog?.open || document.hidden) return;
    if ([...document.querySelectorAll('dialog[open], [aria-modal="true"], .orientation-guard')]
      .some(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden')) return;
    open(false, true);
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(tryAutomatic, 300); };
  if (page) {
    bindGuide(page);
    if (!mobile) status('电脑可安装为独立窗口应用；是否能一键安装由当前浏览器决定。');
    if (standalone()) status('当前已在独立窗口中打开，无需再次添加。');
    refresh();
    // Reuse the game's worker; never replace its asset-cache registration.
    if (gateHost && !embedded && 'serviceWorker' in navigator && isSecureContext) navigator.serviceWorker.register('/zszm-sw.js', { scope: '/' }).catch(() => {});
  } else if (gateHost) {
    window.addEventListener('gate:install-ready', schedule, { signal });
    window.addEventListener('gate:open-install', () => setTimeout(() => open(true), 0), { signal });
    document.addEventListener('visibilitychange', schedule, { signal });
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'open', 'aria-modal'] });
    schedule();
  }
  window.__iridescentlyDispose = () => {
    lifetime.abort();
    observer?.disconnect();
    clearTimeout(timer);
    if (dialog) { if (dialog.open) dialog.close(); dialog.remove(); dialog = null; }
    document.body.classList.remove('gate-install-open');
  };
})();
