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
  var domains = window.IridescentlyDomains;
  if (!domains) {
    // A page that predates the shared domain map: load it once, then this bar again.
    var self = document.currentScript;
    if (!self || 'domainRetry' in self.dataset) return;
    var map = document.createElement('script');
    map.src = '/shared/site-domains.js';
    map.onload = function () {
      var again = document.createElement('script');
      Object.keys(self.dataset).forEach(function (key) { again.dataset[key] = self.dataset[key]; });
      again.dataset.domainRetry = '';
      again.src = self.src;
      document.head.appendChild(again);
    };
    document.head.appendChild(map);
    return;
  }
  var ORIGIN = domains.url('main');
  var MARK = ORIGIN + '/shared/shared-ui/brand/iridescently-mark.svg';
  var SITES = [
    { host: new URL(domains.url('main')).hostname, label: '节气画廊', path: '/' },
    { host: new URL(domains.url('huiguan')).hostname, label: '西木会馆', path: '/' },
    { host: new URL(domains.url('zszm')).hostname, label: '众生之门', path: '/', beta: true }
  ];
  var MORE = [
    { host: new URL(domains.url('oc')).hostname, label: '佳霖馆长设定', path: '/' },
    { host: new URL(domains.url('huiguan')).hostname, label: '配色海报工坊', path: '/haibao/' },
    { host: new URL(domains.url('zszm')).hostname, label: '灵境会馆 · 据点经营', path: '/', hash: '#management' },
    { host: new URL(domains.url('zszm')).hostname, label: '聚灵', path: '/app/shell/m/juling' },
    { host: new URL(domains.url('main')).hostname, label: '连接与鸣谢', path: '/connections.html' }
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
    '#qc-nav .qc-more-panel .qc-panel-site,#qc-nav .qc-more-panel .qc-panel-sites-head{display:none}',
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
    '#qc-nav .qc-theme{position:relative;display:flex;align-items:center}',
    '#qc-nav .qc-theme>button{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:1px solid var(--qc-edge);border-radius:999px;background:transparent;color:inherit;cursor:pointer;transition:background .15s}',
    '#qc-nav .qc-theme>button:hover{background:var(--qc-hover)}',
    '#qc-nav .qc-theme>button svg{width:16px;height:16px;display:block}',
    '#qc-nav .qc-theme-panel{position:absolute;right:0;top:calc(100% + 8px);z-index:1;min-width:210px;padding:10px 12px;background:var(--qc-panel);border:1px solid var(--qc-edge);border-radius:12px;box-shadow:inset 0 1px 0 var(--qc-hi),0 14px 34px rgba(4,16,11,.22);-webkit-backdrop-filter:blur(16px) saturate(1.3);backdrop-filter:blur(16px) saturate(1.3);text-align:left}',
    '#qc-nav .qc-theme-seg{display:flex;gap:6px}',
    '#qc-nav .qc-theme-opt{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;min-height:34px;padding:0 10px;border:1px solid var(--qc-edge);border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer;transition:background .15s,border-color .15s}',
    '#qc-nav .qc-theme-opt:hover{background:var(--qc-hover)}',
    '#qc-nav .qc-theme-opt.is-active{border-color:var(--qc-mark);background:var(--qc-hover)}',
    '#qc-nav .qc-theme-opt svg{width:14px;height:14px}',
    '#qc-nav .qc-theme-panel[hidden]{display:none}',
    '#qc-nav .qc-theme-follow{display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;white-space:nowrap}',
    '#qc-nav .qc-theme-follow input{width:15px;height:15px;margin:0;accent-color:var(--qc-mark)}',
    '#qc-nav .qc-theme-hint{margin:7px 0 0;color:var(--qc-sub);font-size:11px;line-height:1.6}',
    '#qc-nav :where(a,button,summary):focus-visible{outline:2px solid var(--qc-mark);outline-offset:2px;border-radius:4px}',
    '@media(max-width:720px){',
    '#qc-nav{gap:4px;padding:0 8px;font-size:13px}',
    '#qc-nav .qc-brand span{display:none}',
    '#qc-nav .qc-brand img{width:26px;height:26px}',
    '#qc-nav .qc-links>a,#qc-nav .qc-more>summary{padding:0 7px}',
    '#qc-nav .qc-links>a.is-site::after{left:7px;right:7px}',
    '#qc-nav .qc-more>summary{font-size:0;padding:0 10px}',
    '#qc-nav .qc-more>summary::after{margin:-4px 0 0;width:7px;height:7px}',
    '#qc-nav .qc-more-panel{position:fixed;left:8px;right:8px;top:calc(var(--qc-nav-h) + 4px);max-width:none}',
    '#qc-nav .qc-right{gap:6px}',
    '#qc-nav .qc-theme-panel{position:fixed;right:8px;left:auto;top:calc(var(--qc-nav-h) + 4px);min-width:190px}',
    '#qc-nav .auth-bar :is(.role-tag,.lv-tag,.sync-status,.email-reminder){display:none}',
    '#qc-nav .auth-bar>span{display:none}',
    '#qc-nav .site-language-toggle{padding:0 8px}',
    '#qc-nav .qc-beta{display:none}',
    '#qc-nav .auth-bar>a:first-child:last-child{padding:0 10px}',
    '}',
    '@media(max-width:380px){#qc-nav .qc-links>a{padding:0 5px}}',
    '@media(max-width:420px){#qc-nav .qc-links>a{display:none}#qc-nav .qc-more>summary{font-size:inherit;padding:0 8px}#qc-nav .qc-more-panel .qc-panel-site{display:flex}#qc-nav .qc-more-panel .qc-panel-site[aria-current]{color:var(--qc-fg)}#qc-nav .qc-more-panel .qc-panel-sites-head{display:block}}',
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
    // 声明了 data-theme-enabled 的页面由主题控件接管 tone；未声明的保持手动指定（向后兼容）。
    if (options.theme) nav.dataset.themeControl = '';
    else if (options.tone === 'light') nav.dataset.tone = 'light';
    var brand = el('a', 'qc-brand'); brand.href = ORIGIN + '/'; brand.setAttribute('aria-label', 'Iridescently 节气画廊');
    brand.innerHTML = '<img src="' + MARK + '" width="26" height="26" alt=""><span>Iridescently</span>';
    nav.appendChild(brand);

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
    // 窄屏（≤420px）下顶部站点链接收纳进面板，桌面端隐藏以避免重复。
    panel.appendChild(el('small', 'qc-panel-sites-head', '站点'));
    SITES.forEach(function (site) {
      var link = el('a', 'qc-panel-site', site.label); link.href = href(site);
      if (site.host === host) link.setAttribute('aria-current', 'page');
      if (site.beta) link.appendChild(el('small', 'qc-beta', 'beta'));
      panel.appendChild(link);
    });
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
    menu.appendChild(panel); links.appendChild(menu); nav.appendChild(links);

    var right = el('div', 'qc-right');
    var slot = el('div', 'qc-nav-slot'); right.appendChild(slot);
    var auth = document.getElementById('authBar');
    if (!auth) { auth = el('div', 'auth-bar'); auth.id = 'authBar'; }
    else auth.classList.add('auth-bar');
    right.appendChild(auth); nav.appendChild(right);
    document.body.prepend(nav);
    document.body.classList.remove('has-topnav');

    nav.querySelectorAll('a[href]').forEach(function (link) {
      if (samePage(link)) link.setAttribute('aria-current', 'page');
    });
    function click(event) {
      var link = event.target.closest('a[href]');
      if (link && link.getAttribute('aria-current') === 'page' && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) event.preventDefault();
    }
    function closeMenu(event) {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && menu.contains(event.target)) return;
      if (menu.open) { menu.open = false; if (event.type === 'keydown') menu.firstElementChild.focus(); }
    }
    var overlay = options.variant === 'overlay';
    var previousPadding = document.body.style.paddingTop;
    function measure() {
      document.documentElement.style.setProperty('--qc-nav-h', nav.offsetHeight + 'px');
      if (!overlay) document.body.style.paddingTop = nav.offsetHeight + 'px';
    }
    var observer = new ResizeObserver(measure); observer.observe(nav); measure();
    nav.addEventListener('click', click);
    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeMenu);
    state = { nav: nav, slot: slot, right: right, cleanup: function () {
      observer.disconnect(); nav.removeEventListener('click', click);
      document.removeEventListener('pointerdown', closeMenu); document.removeEventListener('keydown', closeMenu);
      if (!overlay) document.body.style.paddingTop = previousPadding;
      document.documentElement.style.removeProperty('--qc-nav-h');
    } };

    if (!document.querySelector('script[data-site-language]')) {
      var language = el('script'); language.src = ORIGIN + '/assets/site-language.js?v=20261017-nav';
      language.dataset.siteLanguage = ''; document.head.appendChild(language);
    }
    // 主题控件等 theme.js 加载完成再挂（脚本注入是异步的，直接挂会拿不到 window.XTheme）。
    // 先试同源（主站/众生之门都部署了 shared/），404 再回退主域集中资源（会馆等子站）。
    if (options.theme) {
      var themeReady = function () { if (state && state.right === right) buildThemeControl(right, nav); };
      if (window.XTheme) themeReady();
      else {
        var THEME_SRC = '/shared/shared-ui/theme.js?v=20261025';
        var loadTheme = function (src, fallback) {
          var tag = el('script'); tag.src = src; tag.dataset.siteTheme = '';
          tag.addEventListener('load', themeReady);
          if (fallback) tag.addEventListener('error', function () { tag.remove(); loadTheme(fallback, null); });
          document.head.appendChild(tag);
        };
        loadTheme(THEME_SRC, ORIGIN + THEME_SRC);
      }
    }
    if (domains.service(host) === 'main') showStatus(nav);
    if (!window.__HUIGUAN_OWN_AUTH) loadAccount(auth);
    return nav;
  }

  function unmount() {
    if (!state) return;
    state.cleanup(); state.nav.remove(); state = null;
  }

  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.6 14.8A8.9 8.9 0 0 1 9.2 3.4a.5.5 0 0 0-.65-.6 9.4 9.4 0 1 0 12.65 12.65.5.5 0 0 0-.6-.65z"/></svg>';

  /** 主题设置弹层（仅声明 data-theme-enabled 的页面挂载）：
   *  按钮打开面板 → 两态分段选择（浅色/深色）+ “跟随系统”开关；nav 玻璃 tone 跟随生效主题。 */
  function buildThemeControl(right, nav) {
    if (!window.XTheme) return;
    var wrap = el('div', 'qc-theme');
    var button = el('button'); button.type = 'button';
    button.innerHTML = MOON;
    var panel = el('div', 'qc-theme-panel'); panel.hidden = true;
    var seg = el('div', 'qc-theme-seg');
    var light = el('button', 'qc-theme-opt'); light.type = 'button';
    light.innerHTML = SUN + '<span>浅色</span>';
    var dark = el('button', 'qc-theme-opt'); dark.type = 'button';
    dark.innerHTML = MOON + '<span>深色</span>';
    seg.appendChild(light); seg.appendChild(dark);
    var label = el('label', 'qc-theme-follow');
    var checkbox = el('input'); checkbox.type = 'checkbox';
    label.appendChild(checkbox); label.appendChild(el('span', '', '跟随系统'));
    panel.appendChild(seg); panel.appendChild(label);
    panel.appendChild(el('p', 'qc-theme-hint', '手动选择会覆盖系统偏好，设置在所有子站生效。'));
    function render(event) {
      var payload = event && event.detail;
      var effective = payload ? payload.resolved : window.XTheme.resolved();
      var darkNow = effective === 'dark';
      button.innerHTML = darkNow ? MOON : SUN;
      button.setAttribute('aria-label', '主题设置（当前' + (darkNow ? '深色' : '浅色') + '）');
      light.classList.toggle('is-active', !darkNow);
      dark.classList.toggle('is-active', darkNow);
      light.setAttribute('aria-pressed', String(!darkNow));
      dark.setAttribute('aria-pressed', String(darkNow));
      checkbox.checked = window.XTheme.stored() === 'auto';
      if (darkNow) delete nav.dataset.tone; else nav.dataset.tone = 'light';
    }
    light.addEventListener('click', function () { window.XTheme.set('light'); });
    dark.addEventListener('click', function () { window.XTheme.set('dark'); });
    checkbox.addEventListener('change', function () {
      window.XTheme.set(checkbox.checked ? 'auto' : window.XTheme.resolved());
    });
    button.addEventListener('click', function () { panel.hidden = !panel.hidden; });
    function closePanel(event) {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (panel.hidden || wrap.contains(event.target)) return;
      panel.hidden = true;
    }
    document.addEventListener('pointerdown', closePanel);
    document.addEventListener('keydown', closePanel);
    document.addEventListener('xthemechange', render);
    wrap.appendChild(button); wrap.appendChild(panel); right.appendChild(wrap);
    render(null);
  }

  /** Online dots next to the other two sites; only the main host serves /api/site-status. */
  function showStatus(nav) {
    fetch('/api/site-status', { cache: 'no-store' }).then(function (response) { return response.ok ? response.json() : null; }).then(function (body) {
      var status = body && body.sites;
      if (!status) return;
      var keys = { [new URL(domains.url('huiguan')).hostname]: 'huiguan', [new URL(domains.url('zszm')).hostname]: 'zszm' };
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
    function login() { auth.replaceChildren(node('a', '登录', domains.url('huiguan', '/?openauth=1'))); }
    // One /api/sso-user per page: shared-session/session.js reuses this same promise (user JSON or null).
    var request = window.__iridescentlySsoUser || (window.__iridescentlySsoUser = fetch('/api/sso-user', { credentials: 'same-origin' }).then(function (response) {
      return response.ok ? response.json() : null;
    }).catch(function () { return null; }));
    request.then(function (user) {
      if (!user || !user.logged_in) return login();
      auth.replaceChildren(node('span', user.name || user.nickname || user.username || '用户'), node('a', '账户', domains.url('huiguan', '/account.html')));
      if (user.is_admin || user.role === 'elder') auth.appendChild(node('a', '成员管理', domains.url('huiguan', '/member.html')));
      auth.appendChild(node('a', '退出', domains.url('huiguan', '/api/logout')));
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
    var start = function () { mount({ variant: script.dataset.variant, tone: script.dataset.tone, theme: 'themeEnabled' in script.dataset }); };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
  }
})();
