/* ============================================================
   六系演武 · 六系图标自包含模块  six-system-icons.js
   ------------------------------------------------------------
   来源：官方卡片图标 shared-ui/AI image/cards\
         metal.svg / wood.svg / water.svg / fire.svg / earth.svg / space.svg
         （仅重命名渐变色 id 以避免多实例冲突，图形与配色原样保留）

   统一 key：jin / mu / shui / huo / tu / kongjian

   用法：
     <script src="ui/lxh-ui.js"></script>
     <script src="ui/six-system-icons.js"></script>   // 自动注册到 window.LXHUI.ICONS
     LXHUI.ICONS['jin']      // => SVG 字符串
     SixSystemIcons.create('huo', 48)   // => 带尺寸的 span 元素
   ============================================================ */
(function (global) {
  'use strict'

  /* ---------- 1. 六系元数据 ---------- */
  var META = {
    jin: { name: '金系', official: '御灵系·金', glyph: '金', color: '#c9a227', colorSoft: '#e0c25c', src: 'metal.svg' },
    mu: { name: '木系', official: '御灵系·木', glyph: '木', color: '#4a8a5a', colorSoft: '#6fae7f', src: 'wood.svg' },
    shui: { name: '水系', official: '御灵系·水（冰）', glyph: '水', color: '#3f7f9e', colorSoft: '#63a6c4', src: 'water.svg' },
    huo: { name: '火系', official: '御灵系·火', glyph: '火', color: '#c8452f', colorSoft: '#e2725b', src: 'fire.svg' },
    tu: { name: '土系', official: '御灵系·土', glyph: '土', color: '#9a7642', colorSoft: '#bf9a63', src: 'earth.svg' },
    kongjian: { name: '空间系', official: '空间系', glyph: '域', color: '#7a6aa8', colorSoft: '#9d8fc4', src: 'space.svg' }
  }

  var KEYS = ['jin', 'mu', 'shui', 'huo', 'tu', 'kongjian']
  var LABELS = KEYS.map(function (k) { return META[k].name })

  /* ---------- 2. SVG 生成（渐变色 id 按 key 去重） ---------- */
  function buildSvg(key) {
    var cfg = META[key]
    if (!cfg) return ''
    var uid = 'ssBg-' + key
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="' + cfg.name + '" data-system="' + key + '">' +
      '<defs><radialGradient id="' + uid + '" cx="50%" cy="36%" r="72%">' +
      '<stop offset="0%" stop-color="#2b2b30"/><stop offset="100%" stop-color="#0d0d10"/>' +
      '</radialGradient></defs>' +
      '<circle cx="64" cy="64" r="60" fill="url(#' + uid + ')" stroke="' + cfg.color + '" stroke-width="3.5"/>' +
      '<circle cx="64" cy="64" r="51" fill="none" stroke="' + cfg.color + '" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>' +
      '<text x="64" y="84" font-size="46" text-anchor="middle" fill="' + cfg.color + '" ' +
      'font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">' + cfg.glyph + '</text>' +
      '<path d="M52 96 L76 96" stroke="' + cfg.color + '" stroke-width="2" stroke-linecap="round" opacity="0.7"/>' +
      '</svg>'
  }

  var ICONS = {}
  KEYS.forEach(function (k) { ICONS[k] = buildSvg(k) })

  /* ---------- 3. 零侵入注册到 lxh-ui.js 的 ICONS ---------- */
  function registerIcons(target) {
    var host = target || global.LXHUI
    if (!host) return false
    if (!host.ICONS) host.ICONS = {}
    var added = 0
    KEYS.forEach(function (k) {
      if (!host.ICONS[k]) { host.ICONS[k] = ICONS[k]; added++ }
    })
    return added > 0 || KEYS.every(function (k) { return !!host.ICONS[k] })
  }
  registerIcons()

  /* LXHUI 若晚于本模块加载，则在 DOM 就绪时兜底注册一次 */
  if (global.document && !(global.LXHUI && global.LXHUI.ICONS && global.LXHUI.ICONS.jin)) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { registerIcons() })
    } else {
      global.setTimeout(function () { registerIcons() }, 0)
    }
  }

  /* ---------- 4. 便捷构造 ---------- */
  function create(key, size) {
    var cfg = META[key]
    var box = global.document.createElement('span')
    box.className = 'ss-icon ss-icon--' + key
    box.style.display = 'inline-block'
    box.style.width = box.style.height = (size || 32) + 'px'
    box.style.lineHeight = '0'
    box.title = cfg ? (cfg.name + ' · ' + cfg.official) : key
    box.innerHTML = ICONS[key] || ''
    var svg = box.querySelector('svg')
    if (svg) { svg.style.width = '100%'; svg.style.height = '100%' }
    return box
  }

  function label(key) { return META[key] ? META[key].name : key }
  function color(key) { return META[key] ? META[key].color : '#5c6152' }
  function isSix(key) { return KEYS.indexOf(key) !== -1 }

  /* ---------- 5. 导出 ---------- */
  global.SixSystemIcons = {
    KEYS: KEYS,
    LABELS: LABELS,
    META: META,
    ICONS: ICONS,
    svg: function (key) { return ICONS[key] || '' },
    create: create,
    label: label,
    color: color,
    isSixSystem: isSix,
    registerIcons: registerIcons
  }
})(typeof window !== 'undefined' ? window : this)
