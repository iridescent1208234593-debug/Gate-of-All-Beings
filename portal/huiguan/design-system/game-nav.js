/* Shared module navigation. When embedded, all chrome belongs to its module container. */
(function () {
  'use strict';
  var host = window.__iridescentlyEmbed || document.body;
  if (host.querySelector('#qc-gamenav')) return;
  var ITEMS = [
    { name: '官网 ↗', url: 'https://iridescently.xyz/' },
    { name: '众生之门', url: 'https://zszm.iridescently.xyz/', key: 'cards' },
    { name: '灵境生态', url: 'https://zszm.iridescently.xyz/#ecosystem', key: 'ecology' },
    { name: '聚灵', url: 'https://zszm.iridescently.xyz/app/shell/m/juling', key: 'juling' },
    { name: '灵境会馆', url: 'https://zszm.iridescently.xyz/#management', key: 'management' },
    { name: '素材库', url: 'https://huiguan.iridescently.xyz/design-system/assets-library.html' }
  ];
  var nav = document.createElement('nav');
  nav.id = 'qc-gamenav'; nav.setAttribute('aria-label', '模块导航');
  var brand = document.createElement('a'); brand.className = 'qn-brand'; brand.href = ITEMS[0].url; brand.textContent = 'Iridescently ↗'; nav.appendChild(brand);
  var menu = document.createElement('details'); menu.className = 'qn-more'; menu.innerHTML = '<summary>更多去处</summary><div class="qn-panel"></div>';
  var panel = menu.lastElementChild;
  var moduleMatch = location.pathname.match(/\/app\/(?:modules\/|shell\/m\/)([^/]+)/);
  var currentModule = moduleMatch ? moduleMatch[1] : null;
  function samePage(url) {
    var target = new URL(url);
    return target.origin === location.origin && target.pathname.replace(/\/+$/, '') === location.pathname.replace(/\/+$/, '') && target.hash === location.hash;
  }
  ITEMS.slice(1).forEach(function (item, index) {
    var link = document.createElement('a'); link.className = 'qn-item'; link.href = item.url; link.textContent = item.name;
    var current = samePage(item.url) || (item.key && item.key === currentModule);
    if (current) { link.classList.add('is-active'); link.setAttribute('aria-current', 'page'); }
    link.addEventListener('click', function (event) {
      if (current && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) event.preventDefault();
    });
    (index === 0 ? nav : panel).appendChild(link);
  });
  nav.appendChild(menu);
  var style = document.createElement('style');
  style.id = 'qc-gamenav-style';
  style.textContent = [
    '#qc-gamenav{position:sticky;top:0;z-index:99990;box-sizing:border-box;min-height:46px;display:flex;align-items:center;gap:10px;padding:6px 16px;background:rgba(22,42,36,.97);border-bottom:1px solid #d4a84055;color:#f5f0e8;font:13px/1.4 "Noto Serif SC",serif;letter-spacing:.04em}',
    '#qc-gamenav a{color:inherit;text-decoration:none;white-space:nowrap;padding:6px 8px}',
    '#qc-gamenav .qn-brand{margin-right:auto;font-weight:600;color:#eac568}',
    '#qc-gamenav a:hover,#qc-gamenav a.is-active{color:#ffd783}',
    '#qc-gamenav a.is-active{cursor:default}',
    '#qc-gamenav :where(a,summary):focus-visible{outline:2px solid #ffd783;outline-offset:3px}',
    '#qc-gamenav .qn-more{position:relative}',
    '#qc-gamenav summary{cursor:pointer;list-style:none;padding:6px 8px;white-space:nowrap}',
    '#qc-gamenav summary::-webkit-details-marker{display:none}',
    '#qc-gamenav .qn-panel{position:absolute;right:0;top:calc(100% + 8px);min-width:180px;display:grid;padding:8px;background:#142b25;border:1px solid #d4a84055;border-radius:6px;box-shadow:0 10px 30px #06150d40}',
    '#qc-gamenav .qn-panel a{padding:10px 9px}',
    '@media(max-width:600px){#qc-gamenav{font-size:11px;gap:4px;padding:6px 10px}#qc-gamenav a,#qc-gamenav summary{padding:8px 6px}}'
  ].join('\n');
  // Keeping styles inside the owner avoids leaking navigation CSS between shell modules.
  host.prepend(style); host.prepend(nav);
  nav.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && menu.open) { menu.open = false; menu.firstElementChild.focus(); }
  });
})();
