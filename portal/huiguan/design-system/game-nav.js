/* 西木会馆 · 游戏导航栏（跨游戏共享组件）
 * 用法：<script src="https://huiguan.iridescently.xyz/design-system/game-nav.js" defer></script>
 * 规范：仅使用 design-system.css 的 token（qc- 前缀），深色导航条 + 描金高亮当前游戏。
 */
(function () {
  if (document.getElementById('qc-gamenav')) return

  var ITEMS = [
    { name: '官网', host: 'iridescently.xyz', url: 'https://iridescently.xyz' },
    { name: '众生之门', host: 'zszm.iridescently.xyz', url: 'https://zszm.iridescently.xyz', tag: '卡牌冒险' },
    { name: '灵境生态', host: null, url: 'https://zszm.iridescently.xyz/#ecosystem', tag: '生态模拟' },
    { name: '聚灵', host: 'juling.iridescently.xyz', url: 'https://juling.iridescently.xyz', tag: '五行小游戏' },
    { name: '灵境会馆', host: 'lingjing.iridescently.xyz', url: 'https://lingjing.iridescently.xyz', tag: '经营模拟' },
    { name: '素材库', host: null, url: 'https://huiguan.iridescently.xyz/design-system/assets-library.html' }
  ]

  var style = document.createElement('style')
  style.id = 'qc-gamenav-style'
  style.textContent = [
    ':root{--qc-nav-bg:rgba(34,45,38,.96);--qc-nav-text:#f5f0e8;--qc-accent:#5a9e8f;--qc-gold:#d4a840;--qc-dim:#7a8a7e;--qc-font-body:"Noto Serif SC","Source Han Serif SC",serif}',
    '#qc-gamenav{position:fixed;top:0;left:0;right:0;z-index:99990;height:46px;display:flex;align-items:center;gap:2px;padding:0 14px;background:var(--qc-nav-bg);backdrop-filter:blur(6px);font-family:var(--qc-font-body);font-size:13px;letter-spacing:1px;box-shadow:0 2px 8px rgba(30,40,34,.18)}',
    '#qc-gamenav .qn-brand{color:var(--qc-gold);font-size:14px;letter-spacing:2px;margin-right:14px;white-space:nowrap;text-decoration:none}',
    '#qc-gamenav .qn-brand:hover{filter:brightness(1.15)}',
    '#qc-gamenav a.qn-item{color:var(--qc-nav-text);text-decoration:none;padding:6px 12px;border-radius:6px;white-space:nowrap;transition:all .15s;opacity:.85}',
    '#qc-gamenav a.qn-item:hover{background:rgba(90,158,143,.18);opacity:1}',
    '#qc-gamenav a.qn-item.is-active{color:var(--qc-gold);opacity:1;box-shadow:inset 0 -2px 0 var(--qc-gold)}',
    '#qc-gamenav .qn-tag{font-size:10px;color:var(--qc-dim);margin-left:4px;letter-spacing:0}',
    '#qc-gamenav a.qn-item.is-active .qn-tag{color:var(--qc-gold)}',
    '#qc-gamenav .qn-spacer{flex:1}',
    '@media (max-width:720px){#qc-gamenav{overflow-x:auto}#qc-gamenav .qn-tag{display:none}}'
  ].join('\n')
  document.head.appendChild(style)

  var nav = document.createElement('nav')
  nav.id = 'qc-gamenav'
  var here = location.hostname

  var brand = document.createElement('a')
  brand.className = 'qn-brand'
  brand.href = 'https://iridescently.xyz'
  brand.textContent = '西木会馆 · 游戏门户'
  nav.appendChild(brand)

  ITEMS.forEach(function (it) {
    var a = document.createElement('a')
    a.className = 'qn-item'
    a.href = it.url
    if (it.host && here === it.host) a.className += ' is-active'
    a.textContent = it.name
    if (it.tag) {
      var s = document.createElement('span')
      s.className = 'qn-tag'
      s.textContent = it.tag
      a.appendChild(s)
    }
    nav.appendChild(a)
  })

  var spacer = document.createElement('span')
  spacer.className = 'qn-spacer'
  nav.appendChild(spacer)

  function mount() { document.body.insertBefore(nav, document.body.firstChild) }
  if (document.body) mount()
  else document.addEventListener('DOMContentLoaded', mount)
})()
