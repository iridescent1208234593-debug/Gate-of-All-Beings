/* Iridescently site navigation — the one global bar shared by 节气画廊, 西木会馆 and 众生之门.
 *
 * Classic <script src=".../shared/shared-ui/site-nav.js"> mounts it immediately.
 *   data-variant="overlay"  lighter glass over an immersive first screen (gallery, hero)
 *   data-tone="light"       cream glass with ink text for light pages (connections)
 *   data-manual             do not mount; call IridescentlyNav.mount() yourself
 * Imported as a module (React / Vite) nothing mounts until IridescentlyNav.mount({...}).
 *
 * Page code can put its own controls into IridescentlyNav.slot() (left of the account).
 * Pages that own their account UI set window.__HUIGUAN_OWN_AUTH and render into #authBar.
 * Inside the 众生之门 module shell (window.__iridescentlyEmbed) the shell already owns the bar.
 * Spec and do/don't: portal/huiguan/design-system/design-system.md「站点导航」.
 */
(function () {
  'use strict';
  if (window.IridescentlyNav) return;
  var ORIGIN = 'https://iridescently.xyz';
  var MARK = ORIGIN + '/shared/shared-ui/brand/iridescently-mark.svg';
  var SITES = [
    { host: 'iridescently.xyz', label: '节气画廊', path: '/' },
    { host: 'huiguan.iridescently.xyz', label: '西木会馆', path: '/' },
    { host: 'zszm.iridescently.xyz', label: '众生之门', path: '/', beta: true }
  ];
  var MORE = [
    { host: 'oc.iridescently.xyz', label: '佳霖馆长设定', path: '/' },
    { host: 'huiguan.iridescently.xyz', label: '配色海报工坊', path: '/haibao/' },
    { host: 'zszm.iridescently.xyz', label: '灵境会馆 · 据点经营', path: '/', hash: '#management' },
    { host: 'zszm.iridescently.xyz', label: '聚灵', path: '/app/shell/m/juling' },
    { host: 'psyche.iridescently.xyz', label: '心理档案云', path: '/', unpublished: true },
    { host: 'iridescently.xyz', label: '连接与鸣谢', path: '/connections.html' }
  ];
  var LEGAL = '<summary>版权与免责声明</summary><p class="qc-copy">罗小黑战记相关 IP 版权归寒木春华动画工作室所有。</p>' +
    '<p class="qc-copy">本站为非商业性粉丝社区项目，用于信息交流与角色创作。罗小黑战记相关角色、形象与作品的知识产权归原作者及寒木春华动画工作室所有。本站未获官方授权，如有侵权请通过连接与鸣谢页面联系管理员删除。</p>';

  var CSS = [
    ':root{--qc-nav-h:48px;--qc-nav-ink:#13241e;--qc-nav-paper:#f4eedf;--qc-nav-gold:#e6c06a}',
    // Frosted glass, the same recipe as the gallery's corner controls: translucent tint, blur, hairline edge, soft top highlight.
    '#qc-nav{--qc-fg:var(--qc-nav-paper);--qc-fg-soft:#f4eedfcc;--qc-sub:#c3d2bf;--qc-mark:var(--qc-nav-gold);--qc-glass:rgba(18,34,28,.58);--qc-edge:rgba(246,248,248,.16);--qc-hi:rgba(255,255,255,.07);--qc-panel:rgba(20,36,30,.86);--qc-hover:rgba(246,248,248,.08)}',
    '#qc-nav[data-variant="overlay"]{--qc-glass:rgba(12,19,26,.3);--qc-panel:rgba(14,22,28,.84)}',
    '#qc-nav[data-tone="light"]{--qc-fg:#17372e;--qc-fg-soft:#17372ec4;--qc-sub:#5d6a70;--qc-mark:#b07a22;--qc-glass:rgba(250,246,237,.6);--qc-edge:rgba(34,49,58,.12);--qc-hi:rgba(255,255,255,.7);--qc-panel:rgba(251,248,241,.92);--qc-hover:rgba(34,49,58,.06)}',
    '#qc-nav{position:fixed;top:0;left:0;right:0;z-index:9999;box-sizing:border-box;height:var(--qc-nav-h);display:flex;align-items:center;gap:clamp(10px,2vw,22px);padding:0 clamp(12px,3vw,32px);background:linear-gradient(180deg,var(--qc-hi),transparent 70%),var(--qc-glass);border-bottom:1px solid var(--qc-edge);box-shadow:inset 0 1px 0 var(--qc-hi),0 6px 22px rgba(6,14,12,.08);-webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3);color:var(--qc-fg);font:14px/1.2 "LXGW WenKai","Noto Serif SC","Source Han Serif SC",serif;letter-spacing:.03em}',
    '@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){#qc-nav{--qc-glass:rgba(18,34,28,.92)}#qc-nav[data-tone="light"]{--qc-glass:rgba(250,246,237,.96)}}',
    '#qc-nav *{box-sizing:border-box}',
    '#qc-nav a,#qc-nav summary,#qc-nav button{color:inherit;text-decoration:none;font:inherit}',
    '#qc-nav .qc-brand{display:inline-flex;align-items:center;gap:9px;flex:none;white-space:nowrap;font-weight:600}',
    '#qc-nav .qc-brand img{width:28px;height:28px;padding:3px;border-radius:6px;background:var(--qc-nav-paper);image-rendering:pixelated}',
    '#qc-nav .qc-mobile-toggle{display:none}',
    '#qc-nav .qc-mobile-panel{display:contents}',
    '#qc-nav .qc-links{display:flex;align-items:stretch;align-self:stretch;gap:2px;min-width:0}',
    '#qc-nav .qc-links>a,#qc-nav .qc-more>summary{position:relative;display:inline-flex;align-items:center;height:100%;padding:0 10px;white-space:nowrap;color:var(--qc-fg-soft);transition:color .15s}',
    '#qc-nav .qc-links>a:hover,#qc-nav .qc-more>summary:hover{color:var(--qc-fg)}',
    '#qc-nav .qc-links>a.is-site{color:var(--qc-fg)}',
    '#qc-nav .qc-links>a.is-site::after{content:"";position:absolute;left:10px;right:10px;bottom:0;height:2px;border-radius:2px 2px 0 0;background:var(--qc-mark)}',
    '#qc-nav .qc-beta{margin-left:3px;font:10px/1 system-ui,sans-serif;color:var(--qc-mark);transform:translateY(-6px)}',
    '#qc-nav .qc-more{position:relative;display:flex;align-items:stretch}',
    '#qc-nav details>summary{cursor:pointer;list-style:none}',
    '#qc-nav summary::-webkit-details-marker{display:none}',
    '#qc-nav .qc-more>summary::after{content:"";width:6px;height:6px;margin:-3px 0 0 7px;border:solid currentColor;border-width:0 1.5px 1.5px 0;transform:rotate(45deg);opacity:.7}',
    '#qc-nav .qc-more-panel{position:absolute;left:0;top:calc(100% + 6px);display:grid;min-width:220px;max-width:min(320px,calc(100vw - 24px));max-height:72svh;overflow:auto;padding:8px;background:var(--qc-panel);border:1px solid var(--qc-edge);border-radius:12px;box-shadow:inset 0 1px 0 var(--qc-hi),0 14px 34px rgba(4,16,11,.22);-webkit-backdrop-filter:blur(16px) saturate(1.3);backdrop-filter:blur(16px) saturate(1.3)}',
    '#qc-nav .qc-more-panel>a,#qc-nav .qc-more-panel>details>summary{display:flex;align-items:center;gap:8px;padding:10px;border-radius:5px}',
    '#qc-nav .qc-more-panel>a:hover{background:var(--qc-hover)}',
    '#qc-nav .qc-more-panel>small{padding:8px 10px;color:var(--qc-sub);font-size:11px}',
    '#qc-nav .qc-copy{margin:6px 10px 8px;white-space:normal;font-size:12px;line-height:1.8;color:var(--qc-sub)}',
    '#qc-nav .qc-status{display:inline-block;width:6px;height:6px;margin-left:6px;border-radius:50%;background:#7c8b7f}',
    '#qc-nav .qc-status[data-state="up"]{background:#7fd38a}',
    '#qc-nav .qc-status[data-state="down"],#qc-nav .qc-status[data-state="unpublished"]{background:#e4645e}',
    '#qc-nav .qc-right{margin-left:auto;display:flex;align-items:center;gap:10px;min-width:0;white-space:nowrap}',
    '#qc-nav .qc-nav-slot{display:flex;align-items:center;gap:8px}',
    '#qc-nav .qc-nav-slot:empty{display:none}',
    '#qc-nav .auth-bar{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden}',
    '#qc-nav .auth-bar>a,#qc-nav .auth-bar>button,#qc-nav .auth-bar>span{display:inline-flex;align-items:center;min-height:32px;white-space:nowrap}',
    '#qc-nav .auth-bar>a:first-child:last-child{padding:0 12px;border:1px solid var(--qc-edge);border-radius:999px;background:var(--qc-hover);color:var(--qc-mark)}',
    '#qc-nav .site-language-toggle{min-height:30px;padding:0 10px;border:1px solid var(--qc-edge);border-radius:999px;background:transparent;color:inherit;font:12px/1 system-ui,sans-serif;cursor:pointer}',
    '#qc-nav :where(a,button,summary):focus-visible{outline:2px solid var(--qc-mark);outline-offset:2px;border-radius:4px}',
    '@media(max-width:720px){',
    '#qc-nav{gap:8px;padding:0 10px;font-size:13px}',
    '#qc-nav .qc-brand span{display:none}',
    '#qc-nav .qc-brand img{width:26px;height:26px}',
    '#qc-nav .qc-mobile-toggle{display:inline-flex;align-items:center;gap:8px;min-height:36px;margin-left:auto;padding:0 12px;border:1px solid var(--qc-edge);border-radius:999px;background:var(--qc-hover);cursor:pointer}',
    '#qc-nav .qc-mobile-toggle::after{content:"";width:7px;height:7px;margin-top:-4px;border:solid currentColor;border-width:0 1.5px 1.5px 0;transform:rotate(45deg);transition:transform .18s ease,margin .18s ease}',
    '#qc-nav[data-mobile-open="true"] .qc-mobile-toggle::after{margin-top:4px;transform:rotate(225deg)}',
    '#qc-nav .qc-mobile-panel{position:absolute;left:8px;right:8px;top:calc(100% + 6px);display:none;max-height:calc(100svh - var(--qc-nav-h) - 14px);overflow:auto;overscroll-behavior:contain;padding:10px;background:var(--qc-panel);border:1px solid var(--qc-edge);border-radius:14px;box-shadow:inset 0 1px 0 var(--qc-hi),0 16px 38px rgba(4,16,11,.3);-webkit-backdrop-filter:blur(18px) saturate(1.35);backdrop-filter:blur(18px) saturate(1.35)}',
    '#qc-nav[data-mobile-open="true"] .qc-mobile-panel{display:grid;gap:10px}',
    '#qc-nav .qc-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-self:auto;gap:4px}',
    '#qc-nav .qc-links>a,#qc-nav .qc-more>summary{min-height:42px;height:auto;padding:8px 10px;border-radius:8px}',
    '#qc-nav .qc-links>a.is-site{background:var(--qc-hover)}',
    '#qc-nav .qc-links>a.is-site::after{left:10px;right:10px;bottom:3px}',
    '#qc-nav .qc-more{display:block;grid-column:1/-1}',
    '#qc-nav .qc-more>summary{justify-content:space-between}',
    '#qc-nav .qc-more-panel{position:static;min-width:0;max-width:none;max-height:none;margin-top:4px;padding:4px;background:var(--qc-hover);border-color:transparent;border-radius:8px;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none}',
    '#qc-nav .qc-right{margin:0;display:grid;gap:8px;padding-top:10px;border-top:1px solid var(--qc-edge);white-space:normal}',
    '#qc-nav .qc-nav-slot{flex-wrap:wrap}',
    '#qc-nav .auth-bar{width:100%;flex-wrap:wrap;gap:6px;overflow:visible}',
    '#qc-nav .auth-bar .user-badge{max-width:100%;min-height:36px;padding:0 10px;border-radius:8px;background:var(--qc-hover)}',
    '#qc-nav .auth-bar .user-badge>span:first-of-type{max-width:min(58vw,240px);overflow:hidden;text-overflow:ellipsis}',
    '#qc-nav .auth-bar :is(.sync-status,.email-reminder){display:none}',
    '#qc-nav .site-language-toggle{min-height:36px;padding:0 11px}',
    '#qc-nav .qc-beta{display:none}',
    '#qc-nav .auth-bar>a:first-child:last-child{padding:0 10px}',
    '}',
    'body:has(#qc-nav) #QcAccountBar{display:none}',
    '@media(prefers-reduced-motion:reduce){#qc-nav *{transition:none}}'
  ].join('\n');

  var state = null;
  var host = location.hostname.replace(/^www\./, '');
  function href(item) { return 'https://' + item.host + item.path + (item.hash || ''); }
  function canonicalPath(path) { return path.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/'; }
  function samePage(link) {
    var target = new URL(link.href, location.href);
    return target.hostname.replace(/^www\./, '') === host && canonicalPath(target.pathname) === canonicalPath(location.pathname) &&
      (!target.hash || target.hash === location.hash);
  }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function mount(options) {
    options = options || {};
    if (state) return state.nav;
    if (window.__iridescentlyEmbed && !options.force) return null;
    if (!document.getElementById('qc-nav-style')) {
      var style = el('style'); style.id = 'qc-nav-style'; style.textContent = CSS; document.head.appendChild(style);
    }
    // Older pages shipped their own bars; the global bar replaces them.
    document.querySelectorAll('.topnav, .ip-footer').forEach(function (node) { node.remove(); });
    var nav = el('nav'); nav.id = 'qc-nav'; nav.setAttribute('aria-label', '站点导航');
    if (options.variant === 'overlay') nav.dataset.variant = 'overlay';
    if (options.tone === 'light') nav.dataset.tone = 'light';
    var brand = el('a', 'qc-brand'); brand.href = ORIGIN + '/'; brand.setAttribute('aria-label', 'Iridescently 节气画廊');
    brand.innerHTML = '<img src="' + MARK + '" width="26" height="26" alt=""><span>Iridescently</span>';
    nav.appendChild(brand);
    var activeSite = SITES.find(function (site) { return site.host === host; });
    var mobileToggle = el('button', 'qc-mobile-toggle', (activeSite ? activeSite.label + ' · ' : '') + '菜单');
    mobileToggle.type = 'button'; mobileToggle.setAttribute('aria-expanded', 'false'); mobileToggle.setAttribute('aria-controls', 'qc-mobile-panel');
    nav.appendChild(mobileToggle);
    var mobilePanel = el('div', 'qc-mobile-panel'); mobilePanel.id = 'qc-mobile-panel';

    var links = el('div', 'qc-links');
    SITES.forEach(function (site) {
      var link = el('a', '', site.label); link.href = href(site); link.dataset.site = site.host;
      if (site.host === host) link.classList.add('is-site');
      if (site.beta) link.appendChild(el('small', 'qc-beta', 'beta'));
      links.appendChild(link);
    });
    var menu = el('details', 'qc-more');
    menu.innerHTML = '<summary aria-label="更多去处">更多</summary>';
    var panel = el('div', 'qc-more-panel');
    MORE.forEach(function (item) {
      var link = el('a', '', item.label); link.href = href(item);
      if (item.unpublished) {
        var dot = el('span', 'qc-status'); dot.dataset.state = 'unpublished'; dot.title = '尚未并入本站';
        dot.setAttribute('role', 'img'); dot.setAttribute('aria-label', '尚未并入本站'); link.appendChild(dot);
      }
      panel.appendChild(link);
    });
    var legal = el('details'); legal.innerHTML = LEGAL; panel.appendChild(legal);
    panel.appendChild(el('small', '', '© ' + new Date().getFullYear() + ' Iridescently'));
    menu.appendChild(panel); links.appendChild(menu); mobilePanel.appendChild(links);

    var right = el('div', 'qc-right');
    var slot = el('div', 'qc-nav-slot qc-slot'); right.appendChild(slot);
    var auth = document.getElementById('authBar');
    if (!auth) { auth = el('div', 'auth-bar'); auth.id = 'authBar'; }
    else auth.classList.add('auth-bar');
    right.appendChild(auth); mobilePanel.appendChild(right); nav.appendChild(mobilePanel);
    document.body.prepend(nav);
    document.body.classList.remove('has-topnav');

    nav.querySelectorAll('a[href]').forEach(function (link) {
      if (samePage(link)) link.setAttribute('aria-current', 'page');
    });
    function click(event) {
      var link = event.target.closest('a[href]');
      if (link && link.getAttribute('aria-current') === 'page' && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) event.preventDefault();
      if (link) setMobileOpen(false);
    }
    function setMobileOpen(open, restoreFocus) {
      if (open) nav.dataset.mobileOpen = 'true'; else delete nav.dataset.mobileOpen;
      mobileToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open && menu.open) menu.open = false;
      if (!open && restoreFocus) mobileToggle.focus();
    }
    function toggleMobileMenu() { setMobileOpen(nav.dataset.mobileOpen !== 'true'); }
    function closeMenus(event) {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && nav.contains(event.target)) return;
      var mobileWasOpen = nav.dataset.mobileOpen === 'true';
      var moreWasOpen = menu.open;
      setMobileOpen(false, event.type === 'keydown' && mobileWasOpen);
      if (event.type === 'keydown' && !mobileWasOpen && moreWasOpen) menu.firstElementChild.focus();
    }
    function closeOnDesktop() { if (window.innerWidth > 720) setMobileOpen(false); }
    var overlay = options.variant === 'overlay';
    var previousPadding = document.body.style.paddingTop;
    function measure() {
      document.documentElement.style.setProperty('--qc-nav-h', nav.offsetHeight + 'px');
      if (!overlay) document.body.style.paddingTop = nav.offsetHeight + 'px';
    }
    var observer = new ResizeObserver(measure); observer.observe(nav); measure();
    mobileToggle.addEventListener('click', toggleMobileMenu);
    nav.addEventListener('click', click);
    document.addEventListener('pointerdown', closeMenus);
    document.addEventListener('keydown', closeMenus);
    window.addEventListener('resize', closeOnDesktop, { passive: true });
    state = { nav: nav, slot: slot, cleanup: function () {
      observer.disconnect(); mobileToggle.removeEventListener('click', toggleMobileMenu); nav.removeEventListener('click', click);
      document.removeEventListener('pointerdown', closeMenus); document.removeEventListener('keydown', closeMenus);
      window.removeEventListener('resize', closeOnDesktop);
      if (!overlay) document.body.style.paddingTop = previousPadding;
      document.documentElement.style.removeProperty('--qc-nav-h');
    } };

    if (!document.querySelector('script[data-site-language]')) {
      var language = el('script'); language.src = ORIGIN + '/assets/site-language.js?v=20261017-nav';
      language.dataset.siteLanguage = ''; document.head.appendChild(language);
    }
    if (host === 'iridescently.xyz') showStatus(nav);
    if (!window.__HUIGUAN_OWN_AUTH) loadAccount(auth);
    return nav;
  }

  function unmount() {
    if (!state) return;
    state.cleanup(); state.nav.remove(); state = null;
  }

  /** Online dots next to the other two sites; only the main host serves /api/site-status. */
  function showStatus(nav) {
    fetch('/api/site-status', { cache: 'no-store' }).then(function (response) { return response.ok ? response.json() : null; }).then(function (body) {
      var status = body && body.sites;
      if (!status) return;
      var keys = { 'huiguan.iridescently.xyz': 'huiguan', 'zszm.iridescently.xyz': 'zszm' };
      nav.querySelectorAll('.qc-links>a[data-site]').forEach(function (link) {
        var key = keys[link.dataset.site]; if (!key || !(key in status)) return;
        var up = status[key] === true;
        var dot = el('span', 'qc-status'); dot.dataset.state = up ? 'up' : 'down';
        dot.setAttribute('role', 'img'); dot.setAttribute('aria-label', up ? '在线' : '暂时无法访问');
        link.appendChild(dot);
      });
    }).catch(function () {});
  }

  function loadAccount(auth) {
    function node(tag, text, target) { var element = el(tag, '', text); if (target) element.href = target; return element; }
    function login() { auth.replaceChildren(node('a', '登录', 'https://huiguan.iridescently.xyz/?openauth=1')); }
    // One /api/sso-user per page: shared-session/session.js reuses this same promise (user JSON or null).
    var request = window.__iridescentlySsoUser || (window.__iridescentlySsoUser = fetch('/api/sso-user', { credentials: 'same-origin' }).then(function (response) {
      return response.ok ? response.json() : null;
    }).catch(function () { return null; }));
    request.then(function (user) {
      if (!user || !user.logged_in) return login();
      auth.replaceChildren(node('span', user.name || user.nickname || user.username || '用户'), node('a', '账户', 'https://huiguan.iridescently.xyz/account.html'));
      if (user.is_admin || user.role === 'elder') auth.appendChild(node('a', '成员管理', 'https://huiguan.iridescently.xyz/member.html'));
      auth.appendChild(node('a', '退出', 'https://huiguan.iridescently.xyz/api/logout'));
    }).catch(login);
  }

  window.IridescentlyNav = {
    mount: mount,
    unmount: unmount,
    slot: function () { return state ? state.slot : null; },
    height: function () { return state ? state.nav.offsetHeight : 0; }
  };
  var script = document.currentScript;
  if (script && !('manual' in script.dataset)) {
    var start = function () { mount({ variant: script.dataset.variant, tone: script.dataset.tone }); };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
