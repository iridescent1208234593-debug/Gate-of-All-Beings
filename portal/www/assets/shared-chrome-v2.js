/* 西木会馆站群 · 共享导航 + 页脚（单一来源，根治排版漂移）
   用法：在任意子站 </body> 前加 <script src="https://iridescently.xyz/assets/shared-chrome.js"></script>
   它会移除页面里旧的 .topnav / .site-nav / .ip-footer，注入统一的导航与页脚。
   导航右侧预留 #authBar 插槽，供 huiguan 的登录组件挂载。 */
(function () {
  'use strict';
  var HOST = location.hostname.replace(/^www\./, '');
  var SITES = [
    { host: 'iridescently.xyz',        label: '主页',     sign: '佳霖的首页' },
    { host: 'huiguan.iridescently.xyz', label: '西木会馆', sign: '故事与角色档案' },
    { host: 'psy.iridescently.xyz',     label: '心理测试', sign: '心理测试 · 题库中心' },
    { host: 'oc.iridescently.xyz',      label: '馆长设定', sign: '佳霖的原创角色设定页' },
    { host: 'zszm.iridescently.xyz',    label: '众生之门', sign: '“人类与妖精共存” · 罗小黑战记世界观', beta: true },
    { host: 'huiguan.iridescently.xyz', label: '自定义配色海报', path: '/haibao/', href: 'https://huiguan.iridescently.xyz/haibao/', sign: '自定义配色角色海报工坊' },
    { host: 'iridescently.xyz',   label: '连接与鸣谢', path: '/connections.html', href: 'https://iridescently.xyz/connections.html', sign: '开源项目、友站与鸣谢' }
  ];

  // 移除旧的内联导航/页脚，避免重复与漂移
  var oldSel = '.topnav, .site-nav, .ip-footer';
  document.querySelectorAll(oldSel).forEach(function (el) { el.remove(); });

  // ---------- 样式（自包含，不依赖页面 CSS） ----------
  var css = '' +
    '#qc-nav{position:fixed;top:0;left:0;right:0;z-index:9999;display:flex;align-items:center;gap:8px;' +
    'padding:9px 18px;background:rgba(34,45,38,.96);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);' +
    'border-bottom:1px solid rgba(212,168,64,.45);box-shadow:0 2px 14px rgba(30,40,34,.28);' +
    'font-family:"LXGW WenKai","Noto Serif SC",system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.4;}' +
    '#qc-nav .qc-brand{font-weight:700;letter-spacing:1px;color:#f5f0e8;text-decoration:none;white-space:nowrap;margin-right:6px;}' +
    '#qc-nav .qc-links{display:flex;gap:3px;flex-wrap:nowrap;overflow-x:auto;}' +
    '#qc-nav .qc-links a{color:rgba(245,240,232,.72);text-decoration:none;padding:5px 10px;border-radius:4px;white-space:nowrap;}' +
    '#qc-nav .qc-links a:hover{color:#f5f0e8;background:rgba(212,168,64,.18);}' +
    '#qc-nav .qc-links a.qc-active{color:#d4a840;background:rgba(212,168,64,.14);}' +
    '#qc-nav .qc-beta{font-size:9px;font-style:normal;color:#c9a96e;border:1px solid rgba(201,169,110,.5);background:rgba(201,169,110,.16);border-radius:6px;padding:0 4px;margin-left:2px;vertical-align:2px;}' +
    '#qc-nav .qc-right{margin-left:auto;display:flex;align-items:center;gap:10px;min-width:0;}' +
    '#qc-nav .qc-sign{color:rgba(245,240,232,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:34vw;}' +
    '#qc-foot{display:block;width:100%;box-sizing:border-box;clear:both;margin-top:48px;padding:16px 16px 28px;' +
    'border-top:1px solid rgba(128,128,128,.35);text-align:center;' +
    'font-size:13.5px;letter-spacing:1px;color:inherit;opacity:.85;line-height:1.9;}' +
    '#qc-foot .qc-contact{font-size:13.5px;}' +
    '#qc-foot .qc-copy{display:block;}' +
    '#qc-foot details{display:block;margin-top:2px;}' +
    '#qc-foot summary{cursor:pointer;display:inline;user-select:none;text-decoration:underline dotted;}' +
    '#qc-foot summary::-webkit-details-marker{display:none;}' +
    '#qc-foot .qc-disclaimer{display:block;max-width:680px;margin:8px auto 0;text-align:left;line-height:1.9;}' +
    'body{--qc-nav-h:41px;}' +
    'body.qc-hasnav{padding-top:41px !important;}' +
    '@media (max-width:640px){#qc-nav{flex-wrap:wrap;}#qc-nav .qc-links{flex-wrap:wrap;overflow:visible;}#qc-nav .qc-sign{max-width:100%;}}' +
    '#qc-foot .jl-wrap{position:relative;display:inline-block;cursor:pointer;}' +
    '#qc-foot .jl-pop{display:none;position:absolute;left:50%;bottom:135%;transform:translateX(-50%);z-index:99;background:#fbf8f2;border:1px solid #d4cfbe;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:10px 16px;white-space:nowrap;text-align:left;color:#5a6a5e;font-size:12px;line-height:1.9;}' +
    '#qc-foot .jl-wrap:hover .jl-pop,#qc-foot .jl-wrap.open .jl-pop{display:block;}' +
    '#qc-foot .qr-wrap{position:relative;display:inline-block;cursor:pointer;}' +
    '#qc-foot .qr-mini{width:20px;height:20px;border-radius:3px;border:1px solid #d4cfbe;vertical-align:-5px;}' +
    '#qc-foot .qr-pop{display:none;position:absolute;left:50%;bottom:135%;transform:translateX(-50%);z-index:99;background:#fff;border:1px solid #d4cfbe;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:8px;}' +
    '#qc-foot .qr-wrap:hover .qr-pop,#qc-foot .qr-wrap.open .qr-pop{display:block;}' +
    '#qc-foot .qr-pop img{width:230px;height:auto;display:block;}';
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ---------- 导航 ----------
  var nav = document.createElement('nav');
  nav.id = 'qc-nav';
  var html = '<a class="qc-brand" href="https://iridescently.xyz/">西木会馆</a><div class="qc-links">';
  var onPathEntry = SITES.some(function (s) { return s.path && s.host === HOST && location.pathname.indexOf(s.path) === 0; });
  SITES.forEach(function (s) {
    var active = s.path
      ? ((s.host === HOST && location.pathname.indexOf(s.path) === 0) ? ' class="qc-active"' : '')
      : ((!onPathEntry && s.host === HOST) ? ' class="qc-active"' : '');
    var beta = s.beta ? '<i class="qc-beta">beta</i>' : '';
    html += '<a href="' + (s.href || ('https://' + s.host + '/')) + '"' + active + '>' + s.label + beta + '</a>';
  });
  html += '</div><div class="qc-right">';
  var cur = SITES.filter(function (s) { return s.host === HOST; })[0];
  html += '<span class="qc-sign">' + (cur ? cur.sign : '') + '</span>';
  html += '<div id="authBar" class="auth-bar"></div>';
  html += '</div>';
  nav.innerHTML = html;
  document.body.insertBefore(nav, document.body.firstChild);
  // 清除各站旧的顶部留白类，按实际导航高度留白（自适应换行/登录栏）
  document.body.classList.remove('has-topnav');
  function padTop() { document.body.style.paddingTop = nav.offsetHeight + 'px'; }
  padTop();
  window.addEventListener('resize', padTop);
  window.addEventListener('load', padTop);

  // ---------- 页脚 ----------
  var foot = document.createElement('div');
  foot.id = 'qc-foot';
  foot.setAttribute('role', 'contentinfo');
  var contactLine = '';
  if (!window.__HUIGUAN_OWN_CONTACT) {
    contactLine =
      '<span class="qc-contact" style="display:block;margin-bottom:6px;">西木会馆 · by ' +
      '<span class="jl-wrap">佳霖<span class="jl-pop">微信：JiaLinkuo<br>QQ：1208234593<br>抖音：JiaLinkuo</span></span>' +
      '<span class="qc-dot" aria-hidden="true"> · </span>讨论 QQ 群：878029597' +
      '<span class="qc-dot" aria-hidden="true"> · </span>微信群：' +
      '<span class="qr-wrap"><img class="qr-mini" src="https://iridescently.xyz/assets/wechat-group-qr.png" alt="微信群二维码">' +
      '<span class="qr-pop"><img src="https://iridescently.xyz/assets/wechat-group-qr.png" alt="西木会馆-众生之门 微信群二维码"></span></span></span>';
  }
  foot.innerHTML =
    contactLine +
    '<span class="qc-copy">罗小黑战记相关 IP 版权归寒木春华动画工作室所有</span>' +
    '<details><summary>· 免责声明</summary>' +
    '<p class="qc-disclaimer">本站为非商业性粉丝社区项目，仅为用户提供信息交流与身份认证服务。所有涉及"罗小黑战记"及相关角色、形象、作品的内容，其著作权、商标权等知识产权均归原作者及寒木春华动画工作室所有。本站未获官方授权，如有侵权请联系管理员删除。</p>' +
    '</details>';
  // 若 body 为 flex/grid 居中布局，页脚须放进主内容列，否则会被当成横向子项甩到右边
  var footTarget = document.body;
  var bcs = getComputedStyle(document.body);
  if (bcs.display.indexOf('flex') >= 0 || bcs.display.indexOf('grid') >= 0) {
    var best = null;
    Array.prototype.forEach.call(document.body.children, function (ch) {
      var p = getComputedStyle(ch).position;
      if (p === 'fixed' || p === 'absolute') return;
      if (!best || ch.offsetHeight > best.offsetHeight) best = ch;
    });
    if (best) footTarget = best;
  }
  footTarget.appendChild(foot);

  // ---------- 联系方式弹层：悬停显示 + 点击展开（触屏可用） ----------
  function bindPopToggles() {
    document.querySelectorAll('.jl-wrap, .qr-wrap').forEach(function (w) {
      if (w.dataset.popBound) return;
      w.dataset.popBound = '1';
      w.addEventListener('click', function (e) {
        e.stopPropagation();
        w.classList.toggle('open');
      });
    });
  }
  bindPopToggles();
  document.addEventListener('click', function () {
    document.querySelectorAll('.jl-wrap.open, .qr-wrap.open').forEach(function (w) { w.classList.remove('open'); });
  });

  // ---------- 跨站登录状态（页面自带登录栏时设 __HUIGUAN_OWN_AUTH 跳过） ----------
  (function () {
    if (window.__HUIGUAN_OWN_AUTH) return;
    var bar = document.getElementById('authBar');
    if (!bar) return;
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function loginLink() { bar.innerHTML = '<a href="https://huiguan.iridescently.xyz/" style="color:#d4a840;font-size:12px;text-decoration:none;">登录 / 注册</a>'; }
    fetch('/api/sso-user', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (u) {
        if (u && u.logged_in) {
          var memberLink = (u.is_admin || u.role === 'elder')
            ? '<a href="https://huiguan.iridescently.xyz/member.html" style="color:#d4a840;font-size:12px;text-decoration:none;margin-left:8px;">成员管理</a>' : '';
          bar.innerHTML = '<span style="color:#f5f0e8;font-size:12px;">' + esc(u.name || u.nickname || u.username || '用户') + '</span>' +
            '<a href="https://huiguan.iridescently.xyz/account.html" style="color:#d4a840;font-size:12px;text-decoration:none;margin-left:8px;">账户</a>' +
            memberLink +
            '<a href="https://huiguan.iridescently.xyz/api/logout" style="color:#d4a840;font-size:12px;text-decoration:none;margin-left:8px;">退出</a>';
        } else { loginLink(); }
      })
      .catch(loginLink);
  })();
})();
