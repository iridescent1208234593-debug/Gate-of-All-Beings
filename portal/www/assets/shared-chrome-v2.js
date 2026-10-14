/* Shared site chrome. Pages keep their own content, theme and account flow. */
(function () {
  'use strict';
  if (document.getElementById('qc-nav')) return;
  var HOST = location.hostname.replace(/^www\./, '');
  var home = HOST === 'huiguan.iridescently.xyz' && /^\/(?:index\.html)?$/.test(location.pathname);
  var SITES = [
    { host: 'iridescently.xyz', label: '主页', sign: '节气之间，自有天气' },
    { host: 'huiguan.iridescently.xyz', label: '西木会馆', sign: '故事与角色档案' },
    { host: 'zszm.iridescently.xyz', label: '众生之门', sign: '罗小黑战记世界观', beta: true },
    { host: 'oc.iridescently.xyz', label: '佳霖馆长设定', sign: '佳霖的原创角色设定页' },
    { host: 'psyche.iridescently.xyz', label: '心理档案云', sign: '尚未并入本站', unpublished: true },
    { host: 'huiguan.iridescently.xyz', label: '配色海报工坊', path: '/haibao/', sign: '自定义角色配色海报' },
    { host: 'iridescently.xyz', label: '连接与鸣谢', path: '/connections.html', sign: '开源项目、友站与鸣谢' }
  ];
  var auth = document.getElementById('authBar');
  if (auth) auth.remove();
  document.querySelectorAll('.topnav, .site-nav, .ip-footer').forEach(function (el) { el.remove(); });
  var style = document.createElement('style');
  style.id = 'qc-chrome-style';
  style.textContent = [
    '#qc-nav{position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;align-items:center;gap:14px;padding:8px clamp(14px,3vw,32px);box-sizing:border-box;background:rgba(22,42,36,.97);border-bottom:1px solid rgba(212,168,64,.35);color:#f5f0e8;font:13px/1.4 "LXGW WenKai","Noto Serif SC",system-ui,sans-serif}',
    '#qc-nav .qc-brand{display:inline-flex;align-items:center;gap:9px;color:inherit;text-decoration:none;white-space:nowrap;font-weight:600;letter-spacing:.04em}',
    '#qc-nav .qc-brand img{width:26px;height:26px;object-fit:contain;image-rendering:pixelated}',
    '#qc-nav .qc-links{display:flex;align-items:center;gap:4px;min-width:0}',
    '#qc-nav a,#qc-nav summary{color:rgba(245,240,232,.85);text-decoration:none}',
    '#qc-nav .qc-links>a,#qc-nav .qc-more>summary{padding:8px 9px;white-space:nowrap;border-radius:4px}',
    '#qc-nav a:hover,#qc-nav summary:hover{color:#ffd783}',
    '#qc-nav a[aria-current="page"]{color:#ffd783;cursor:default}',
    '#qc-nav :where(a,button,summary):focus-visible{outline:2px solid #ffd783;outline-offset:3px}',
    '#qc-nav .qc-beta{font:9px system-ui,sans-serif;color:#e7ba64;margin-left:4px;vertical-align:super}',
    '#qc-nav .qc-status{width:5px;height:5px;background:#e4645e;border-radius:50%;display:inline-block;margin:0 0 2px 7px}',
    '#qc-nav .qc-right{margin-left:auto;display:flex;align-items:center;gap:10px;min-width:0}',
    '#qc-nav .qc-sign{display:none}',
    '#qc-nav .auth-bar{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:4px}',
    '#qc-nav .auth-bar>a,#qc-nav .auth-bar>button{min-height:30px;display:inline-flex;align-items:center}',
    '#qc-nav details>summary{cursor:pointer;list-style:none}',
    '#qc-nav summary::-webkit-details-marker{display:none}',
    '#qc-nav .qc-more{position:relative}',
    '#qc-nav .qc-more-panel{position:absolute;right:0;top:calc(100% + 8px);display:grid;min-width:200px;max-width:min(310px,calc(100vw - 28px));max-height:70svh;overflow:auto;padding:8px;background:#142b25;border:1px solid rgba(212,168,64,.35);border-radius:6px;box-shadow:0 12px 30px #06150d40}',
    '#qc-nav .qc-more-panel>a,#qc-nav .qc-more-panel>details>summary{padding:10px 9px}',
    '#qc-nav .qc-more-panel>a:hover{background:#e9be5514}',
    '#qc-nav .qc-more-panel small{padding:8px 9px;color:#c3d2bf;font-size:10px}',
    '#qc-nav .qc-copy,#qc-nav .qc-disclaimer{white-space:normal;font-size:11px;line-height:1.8;margin:8px 9px;color:#c3d2bf}',
    '@media(max-width:680px){#qc-nav{gap:6px;padding:6px 12px;flex-wrap:wrap}#qc-nav .qc-brand{font-size:11px;gap:6px}#qc-nav .qc-brand img{width:22px;height:22px}#qc-nav .qc-links>a,#qc-nav .qc-more>summary{font-size:11px;padding:8px 5px}#qc-nav .qc-right{flex:1 0 100%;justify-content:flex-end}#qc-nav .qc-right:has(.auth-bar:empty){display:none}#qc-nav .auth-bar{font-size:11px}}',
    '@media(prefers-reduced-motion:reduce){#qc-nav *{scroll-behavior:auto;transition:none}}'
  ].join('\n');
  document.head.appendChild(style);
  var nav = document.createElement('nav');
  nav.id = 'qc-nav';
  nav.setAttribute('aria-label', '站点导航');
  var brand = document.createElement('a');
  brand.className = 'qc-brand';
  brand.href = 'https://iridescently.xyz/';
  brand.innerHTML = '<img src="https://iridescently.xyz/assets/iridescently-mark.png" width="26" height="26" alt=""><span>Iridescently</span>';
  nav.appendChild(brand);
  var links = document.createElement('div');
  links.className = 'qc-links';
  var menu = document.createElement('details');
  menu.className = 'qc-more';
  menu.innerHTML = '<summary>更多去处</summary><div class="qc-more-panel"></div>';
  var panel = menu.lastElementChild;
  SITES.forEach(function (site, index) {
    var link = document.createElement('a');
    link.href = 'https://' + site.host + (site.path || '/');
    link.textContent = site.label;
    if (site.beta) {
      var badge = document.createElement('small'); badge.className = 'qc-beta'; badge.textContent = 'beta'; link.appendChild(badge);
    }
    if (site.unpublished) {
      var dot = document.createElement('span'); dot.className = 'qc-status'; dot.setAttribute('role', 'img'); dot.setAttribute('aria-label', '尚未并入本站'); dot.title = '尚未并入本站'; link.appendChild(dot);
    }
    // The hall homepage composes these existing anchors with its own lightweight menu.
    (home || index === 1 || index === 2 ? links : panel).appendChild(link);
  });
  if (!home) links.appendChild(menu);
  nav.appendChild(links);
  var right = document.createElement('div'); right.className = 'qc-right';
  var sign = document.createElement('span'); sign.className = 'qc-sign';
  var current = SITES.find(function (site) { return site.host === HOST; });
  sign.textContent = current ? current.sign : ''; right.appendChild(sign);
  if (!auth) { auth = document.createElement('div'); auth.id = 'authBar'; auth.className = 'auth-bar'; }
  right.appendChild(auth); nav.appendChild(right);
  document.body.prepend(nav);
  document.body.classList.remove('has-topnav');

  var legal = document.createElement('details');
  legal.innerHTML = '<summary>版权与免责声明</summary><p class="qc-copy">罗小黑战记相关 IP 版权归寒木春华动画工作室所有。</p><p class="qc-disclaimer">本站为非商业性粉丝社区项目，用于信息交流与角色创作。罗小黑战记相关角色、形象与作品的知识产权归原作者及寒木春华动画工作室所有。本站未获官方授权，如有侵权请通过连接与鸣谢页面联系管理员删除。</p>';
  if (home) {
    var foot = document.createElement('div'); foot.id = 'qc-foot'; foot.appendChild(legal); document.body.appendChild(foot);
  } else {
    panel.appendChild(legal);
    var copyright = document.createElement('small'); copyright.textContent = '© ' + new Date().getFullYear() + ' Iridescently'; panel.appendChild(copyright);
  }
  function canonicalPath(path) { return path.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/'; }
  function currentPage(link) {
    var target = new URL(link.href, location.href);
    return target.hostname.replace(/^www\./, '') === HOST && canonicalPath(target.pathname) === canonicalPath(location.pathname) && target.search === location.search && (!target.hash || target.hash === location.hash);
  }
  nav.querySelectorAll('a[href]').forEach(function (link) {
    if (currentPage(link)) { link.classList.add('qc-active'); link.setAttribute('aria-current', 'page'); }
  });
  function click(event) {
    var link = event.target.closest('a[href]');
    if (link && currentPage(link) && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && link.target !== '_blank' && !link.hasAttribute('download')) event.preventDefault();
  }
  function closeMenu(event) {
    if (event.type === 'keydown') { if (event.key !== 'Escape') return; }
    else if (menu.contains(event.target)) return;
    if (menu.open) { menu.open = false; if (event.type === 'keydown') menu.firstElementChild.focus(); }
  }
  var previousPadding = document.body.style.paddingTop;
  function padTop() { document.body.style.paddingTop = nav.offsetHeight + 'px'; }
  var observer = new ResizeObserver(padTop); observer.observe(nav); padTop();
  nav.addEventListener('click', click);
  document.addEventListener('pointerdown', closeMenu);
  document.addEventListener('keydown', closeMenu);
  window.addEventListener('pagehide', function (event) { if (event.persisted) return; observer.disconnect(); nav.removeEventListener('click', click); document.removeEventListener('pointerdown', closeMenu); document.removeEventListener('keydown', closeMenu); document.body.style.paddingTop = previousPadding; }, { once: true });

  if (window.__HUIGUAN_OWN_AUTH) return;
  function node(tag, text, href) { var element = document.createElement(tag); element.textContent = text; if (href) element.href = href; return element; }
  function login() { auth.replaceChildren(node('a', '登录 / 注册', 'https://huiguan.iridescently.xyz/?openauth=1')); }
  fetch('/api/sso-user', { credentials: 'same-origin' }).then(function (response) { if (!response.ok) throw new Error('session unavailable'); return response.json(); }).then(function (user) {
    if (!user || !user.logged_in) return login();
    auth.replaceChildren(node('span', user.name || user.nickname || user.username || '用户'), node('a', '账户', 'https://huiguan.iridescently.xyz/account.html'));
    if (user.is_admin || user.role === 'elder') auth.appendChild(node('a', '成员管理', 'https://huiguan.iridescently.xyz/member.html'));
    auth.appendChild(node('a', '退出', 'https://huiguan.iridescently.xyz/api/logout'));
  }).catch(login);
})();
