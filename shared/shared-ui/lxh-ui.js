/* ============================================================
   罗小黑战记·众生之门 官方 UI 复刻 · 渲染库
   用法：<script src="ui/lxh-ui.js"></script> 后使用 window.LXHUI
   组件：hud / filmcard / charpanel / radar6 / radar5 /
         confirm / amount / mail / statusrow / wxnode
   ============================================================ */
(function () {
  'use strict'

  var PAPER = '#f7f1e1', NODE = '#f8ecca', STAR = '#d9cfae',
      LINE = '#f2ead6', INK = '#4a4636', TEXT = '#5c6152'

  /* ---------- SVG 图标（对齐官方按钮造型） ---------- */
  var ICONS = {
    help: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="' + NODE + '"/><circle cx="16" cy="16" r="13" fill="none" stroke="#c8a24a" stroke-width="1.5"/><text x="16" y="22" font-size="16" text-anchor="middle" fill="' + TEXT + '" font-family="serif">?</text></svg>',
    exit: '<svg viewBox="0 0 32 32"><rect x="17" y="5" width="10" height="22" fill="#e8e0c8" stroke="' + INK + '" stroke-width="1.5"/><rect x="19" y="7" width="6" height="20" fill="#b8a86a"/><line x1="4" y1="16" x2="18" y2="16" stroke="#c8963c" stroke-width="2.5"/><path d="M14 11 L19 16 L14 21" fill="none" stroke="#c8963c" stroke-width="2.5"/><circle cx="8" cy="24" r="3" fill="#7a8a7e"/></svg>',
    wrench: '<svg viewBox="0 0 32 32"><path d="M20 6 a6 6 0 1 0 6 6 l-3 -1 -1 -4 z" fill="#9aa5a0" stroke="' + INK + '"/><rect x="7" y="15" width="14" height="6" rx="3" transform="rotate(45 14 18)" fill="#9aa5a0" stroke="' + INK + '"/><text x="25" y="10" font-size="9" fill="' + NODE + '">+</text><text x="6" y="26" font-size="9" fill="' + NODE + '">+</text></svg>',
    scroll: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="none" stroke="#c8963c" stroke-width="1.5"/><rect x="10" y="9" width="12" height="14" rx="2" transform="rotate(8 16 16)" fill="' + NODE + '" stroke="' + INK + '"/><circle cx="14" cy="13" r="1.2" fill="' + INK + '"/></svg>',
    shop: '<svg viewBox="0 0 32 32"><path d="M8 12 h16 l-2 14 h-12 z" fill="#c8963c" stroke="' + INK + '"/><path d="M12 12 a4 4 0 0 1 8 0" fill="none" stroke="' + INK + '" stroke-width="2"/><text x="16" y="23" font-size="10" text-anchor="middle" fill="' + NODE + '">$</text><text x="26" y="10" font-size="8" fill="' + NODE + '">+</text></svg>',
    radar: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="7" fill="#7a8a7e" stroke="#c8963c" stroke-width="1.5"/><circle cx="14" cy="15" r="1.2" fill="' + NODE + '"/><circle cx="18" cy="15" r="1.2" fill="' + NODE + '"/><line x1="16" y1="3" x2="16" y2="9" stroke="#c8963c" stroke-width="1.5"/><line x1="16" y1="23" x2="16" y2="29" stroke="#c8963c" stroke-width="1.5"/><line x1="3" y1="16" x2="9" y2="16" stroke="#c8963c" stroke-width="1.5"/><line x1="23" y1="16" x2="29" y2="16" stroke="#c8963c" stroke-width="1.5"/><rect x="2" y="2" width="5" height="5" fill="none" stroke="#c8963c"/><rect x="25" y="25" width="5" height="5" fill="none" stroke="#c8963c"/></svg>',
    friend: '<svg viewBox="0 0 32 32"><circle cx="12" cy="12" r="6" fill="' + NODE + '" stroke="' + INK + '"/><circle cx="21" cy="13" r="5" fill="#c8b89a" stroke="' + INK + '"/><path d="M4 26 a8 8 0 0 1 16 0" fill="' + NODE + '" stroke="' + INK + '"/><path d="M15 26 a7 7 0 0 1 13 0" fill="#c8b89a" stroke="' + INK + '"/></svg>',
    star: '<svg viewBox="0 0 32 32"><path d="M16 2 L19 12 L29 12 L21 18 L24 28 L16 22 L8 28 L11 18 L3 12 L13 12 Z" fill="' + NODE + '" stroke="#c8963c"/><circle cx="6" cy="6" r="1.5" fill="#c8963c"/><circle cx="27" cy="24" r="1.5" fill="#c8963c"/></svg>',
    map: '<svg viewBox="0 0 32 32"><path d="M5 8 L13 5 L19 8 L27 5 L27 24 L19 27 L13 24 L5 27 Z" fill="' + NODE + '" stroke="' + INK + '"/><path d="M13 5 L13 24 M19 8 L19 27" stroke="' + INK + '"/><circle cx="10" cy="12" r="1.5" fill="#c8963c"/></svg>',
    door: '<svg viewBox="0 0 40 40"><rect x="20" y="6" width="13" height="28" fill="#e8e0c8" stroke="#fdf6e3" stroke-width="2"/><rect x="23" y="9" width="7" height="25" fill="#b8a86a"/><line x1="5" y1="20" x2="22" y2="20" stroke="#c8963c" stroke-width="3"/><path d="M17 14 L23 20 L17 26" fill="none" stroke="#c8963c" stroke-width="3"/><circle cx="10" cy="30" r="3.5" fill="#7a8a7e"/></svg>',
    smiley: '<svg viewBox="0 0 20 20"><circle cx="7" cy="8" r="1.7" fill="#fdf6e3"/><circle cx="13" cy="8" r="1.7" fill="#fdf6e3"/><path d="M6 12 q4 3.4 8 0" stroke="#fdf6e3" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
    person: '<svg viewBox="0 0 14 16"><circle cx="7" cy="3.6" r="2.6" fill="#e8a13c"/><path d="M7 7.4 L10.6 14.6 H3.4 Z" fill="#e8a13c"/></svg>',
    search: '<svg viewBox="0 0 32 32"><circle cx="14" cy="14" r="7" fill="none" stroke="#f2ead6" stroke-width="2.5"/><line x1="19" y1="19" x2="27" y2="27" stroke="#f2ead6" stroke-width="2.5"/></svg>',
    back: '<svg viewBox="0 0 32 32"><path d="M20 6 L10 16 L20 26" fill="none" stroke="#f2ead6" stroke-width="3"/></svg>',
    locate: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="6" fill="none" stroke="#fdf6e3" stroke-width="2.5"/><line x1="16" y1="4" x2="16" y2="10" stroke="#fdf6e3" stroke-width="2.5"/><line x1="16" y1="22" x2="16" y2="28" stroke="#fdf6e3" stroke-width="2.5"/><line x1="4" y1="16" x2="10" y2="16" stroke="#fdf6e3" stroke-width="2.5"/><line x1="22" y1="16" x2="28" y2="16" stroke="#fdf6e3" stroke-width="2.5"/></svg>',
    camera: '<svg viewBox="0 0 32 32"><rect x="5" y="10" width="22" height="15" rx="3" fill="#f2ead6"/><circle cx="16" cy="17" r="5" fill="#4a4636"/><rect x="12" y="7" width="8" height="4" rx="1" fill="#f2ead6"/></svg>',
    race_human: '<svg viewBox="0 0 32 32"><circle cx="16" cy="10" r="5" fill="#f2ead6"/><path d="M8 26 a8 8 0 0 1 16 0 z" fill="#f2ead6"/></svg>',
    race_bird: '<svg viewBox="0 0 32 32"><ellipse cx="15" cy="17" rx="8" ry="6" fill="#f2ead6"/><circle cx="23" cy="12" r="4" fill="#f2ead6"/><path d="M27 12 l4 1 -4 2 z" fill="#f2ead6"/><path d="M7 17 l-5 -3 1 5 z" fill="#f2ead6"/></svg>',
    race_fish: '<svg viewBox="0 0 32 32"><ellipse cx="14" cy="16" rx="9" ry="5.5" fill="#f2ead6"/><path d="M22 16 l7 -5 v10 z" fill="#f2ead6"/><circle cx="10" cy="15" r="1.2" fill="#4a4636"/></svg>',
    race_lizard: '<svg viewBox="0 0 32 32"><ellipse cx="14" cy="16" rx="8" ry="4.5" fill="#f2ead6"/><circle cx="24" cy="14" r="3.5" fill="#f2ead6"/><path d="M6 17 q-4 2 -3 6" stroke="#f2ead6" stroke-width="2.5" fill="none"/><circle cx="25" cy="13" r="1" fill="#4a4636"/></svg>',
    race_frog: '<svg viewBox="0 0 32 32"><ellipse cx="16" cy="18" rx="9" ry="6" fill="#f2ead6"/><circle cx="11" cy="10" r="3.5" fill="#f2ead6"/><circle cx="21" cy="10" r="3.5" fill="#f2ead6"/><circle cx="11" cy="10" r="1.2" fill="#4a4636"/><circle cx="21" cy="10" r="1.2" fill="#4a4636"/></svg>'
  ,
    jin: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" data-system="jin"><defs><radialGradient id="ssBg-jin" cx="50%" cy="36%" r="72%"><stop offset="0%" stop-color="#2b2b30"/><stop offset="100%" stop-color="#0d0d10"/></radialGradient></defs><circle cx="64" cy="64" r="60" fill="url(#ssBg-jin)" stroke="#c9a227" stroke-width="3.5"/><circle cx="64" cy="64" r="51" fill="none" stroke="#c9a227" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/><text x="64" y="84" font-size="46" text-anchor="middle" fill="#c9a227" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">金</text><path d="M52 96 L76 96" stroke="#c9a227" stroke-width="2" stroke-linecap="round" opacity="0.7"/></svg>',
    mu: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" data-system="mu"><defs><radialGradient id="ssBg-mu" cx="50%" cy="36%" r="72%"><stop offset="0%" stop-color="#2b2b30"/><stop offset="100%" stop-color="#0d0d10"/></radialGradient></defs><circle cx="64" cy="64" r="60" fill="url(#ssBg-mu)" stroke="#4a8a5a" stroke-width="3.5"/><circle cx="64" cy="64" r="51" fill="none" stroke="#4a8a5a" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/><text x="64" y="84" font-size="46" text-anchor="middle" fill="#4a8a5a" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">木</text><path d="M52 96 L76 96" stroke="#4a8a5a" stroke-width="2" stroke-linecap="round" opacity="0.7"/></svg>',
    shui: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" data-system="shui"><defs><radialGradient id="ssBg-shui" cx="50%" cy="36%" r="72%"><stop offset="0%" stop-color="#2b2b30"/><stop offset="100%" stop-color="#0d0d10"/></radialGradient></defs><circle cx="64" cy="64" r="60" fill="url(#ssBg-shui)" stroke="#3f7f9e" stroke-width="3.5"/><circle cx="64" cy="64" r="51" fill="none" stroke="#3f7f9e" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/><text x="64" y="84" font-size="46" text-anchor="middle" fill="#3f7f9e" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">水</text><path d="M52 96 L76 96" stroke="#3f7f9e" stroke-width="2" stroke-linecap="round" opacity="0.7"/></svg>',
    huo: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" data-system="huo"><defs><radialGradient id="ssBg-huo" cx="50%" cy="36%" r="72%"><stop offset="0%" stop-color="#2b2b30"/><stop offset="100%" stop-color="#0d0d10"/></radialGradient></defs><circle cx="64" cy="64" r="60" fill="url(#ssBg-huo)" stroke="#c8452f" stroke-width="3.5"/><circle cx="64" cy="64" r="51" fill="none" stroke="#c8452f" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/><text x="64" y="84" font-size="46" text-anchor="middle" fill="#c8452f" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">火</text><path d="M52 96 L76 96" stroke="#c8452f" stroke-width="2" stroke-linecap="round" opacity="0.7"/></svg>',
    tu: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" data-system="tu"><defs><radialGradient id="ssBg-tu" cx="50%" cy="36%" r="72%"><stop offset="0%" stop-color="#2b2b30"/><stop offset="100%" stop-color="#0d0d10"/></radialGradient></defs><circle cx="64" cy="64" r="60" fill="url(#ssBg-tu)" stroke="#9a7642" stroke-width="3.5"/><circle cx="64" cy="64" r="51" fill="none" stroke="#9a7642" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/><text x="64" y="84" font-size="46" text-anchor="middle" fill="#9a7642" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">土</text><path d="M52 96 L76 96" stroke="#9a7642" stroke-width="2" stroke-linecap="round" opacity="0.7"/></svg>',
    kongjian: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" data-system="kongjian"><defs><radialGradient id="ssBg-kongjian" cx="50%" cy="36%" r="72%"><stop offset="0%" stop-color="#2b2b30"/><stop offset="100%" stop-color="#0d0d10"/></radialGradient></defs><circle cx="64" cy="64" r="60" fill="url(#ssBg-kongjian)" stroke="#7a6aa8" stroke-width="3.5"/><circle cx="64" cy="64" r="51" fill="none" stroke="#7a6aa8" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/><text x="64" y="84" font-size="46" text-anchor="middle" fill="#7a6aa8" font-family="KaiTi,STKaiti,SimSun,serif" font-weight="bold">域</text><path d="M52 96 L76 96" stroke="#7a6aa8" stroke-width="2" stroke-linecap="round" opacity="0.7"/></svg>'}

  /* 星形徽记（胶片卡水印） */
  function starSVG() {
    return '<svg viewBox="0 0 100 100"><path d="M50 4 L61 36 L95 36 L68 56 L78 90 L50 70 L22 90 L32 56 L5 36 L39 36 Z" fill="' + STAR + '"/><circle cx="50" cy="52" r="9" fill="none" stroke="#bfb493" stroke-width="3"/></svg>'
  }

  function el(html) {
    var t = document.createElement('template')
    t.innerHTML = html.trim()
    return t.content.firstElementChild
  }

  /* ---------- 1. 主 HUD ---------- */
  function hud(opts) {
    opts = opts || {}
    var night = opts.night ? ' lxh-hud--night' : ''
    var status = ''
    if (opts.status) {
      status = '<div class="lxh-statusrow">' +
        opts.status.map(function (s) {
          var big = s.big ? ' lxh-status--big' : ''
          var flash = s.flash ? ' lxh-status--flash' : ''
          return '<span class="lxh-status' + big + flash + '">' + (ICONS[s.icon] || ICONS.radar) + '</span>'
        }).join('') + '</div>'
    }
    var right = (opts.right || ['help', 'exit', 'wrench', 'scroll', 'shop', 'radar']).map(function (k) {
      return '<button class="lxh-fbtn" data-fn="' + k + '" title="' + k + '">' + ICONS[k] + '</button>'
    }).join('')
    var bottom = (opts.bottom || ['friend', 'star', 'map']).map(function (k) {
      return '<button class="lxh-fbtn" data-fn="' + k + '" title="' + k + '">' + ICONS[k] + '</button>'
    }).join('')
    return el(
      '<div class="lxh-hud lxh' + night + '">' +
        '<div class="lxh-hud__user"><div class="row1">' +
          '<div class="lxh-avatar">' + (opts.avatar ? '<img src="' + opts.avatar + '" alt="">' : '') +
            '<span class="lxh-avatar__lv">Lv.' + (opts.lv == null ? 1 : opts.lv) + '</span></div>' +
          '<div class="lxh-bars"><i></i><i></i><i></i></div>' +
        '</div>' + status + '</div>' +
        '<div class="lxh-hud__stage">' + (opts.stage || '') + '</div>' +
        '<div class="lxh-hud__right">' + right + '</div>' +
        '<div class="lxh-hud__bottom">' + bottom + '<div class="lxh-chat"></div></div>' +
      '</div>')
  }

  /* ---------- 2. 胶片卡 ---------- */
  function filmcard(opts) {
    opts = opts || {}
    var films = '', i
    for (i = 0; i < 6; i++) films += '<i></i>'
    return el(
      '<div class="lxh-filmcard lxh' + (opts.solid ? ' lxh-filmcard--solid' : '') + '">' +
        '<div class="lxh-filmcard__film">' + films + '</div>' +
        '<div class="lxh-filmcard__meta"><div class="lines"><i></i><i></i><i></i></div><div class="dot"></div></div>' +
        '<div class="lxh-filmcard__star">' + starSVG() + '</div>' +
        '<div class="lxh-filmcard__tail"><i></i><i></i><i></i></div>' +
      '</div>')
  }

  /* ---------- 五行生克星图 SVG ---------- */
  function wuxingSVG(opts) {
    opts = opts || {}
    var cx = 200, cy = 170, R = 150, r = 62
    var names = ['火', '土', '金', '水', '木']  // 顺时针
    var pts = [], i, a
    for (i = 0; i < 5; i++) {
      a = (-90 + i * 72) * Math.PI / 180
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)])
    }
    var starPts = pts.map(function (p) { return p[0] + ',' + p[1] }).join(' ')
    // 生：相邻顺时针箭头；克：隔位连线
    var sheng = '', ke = ''
    for (i = 0; i < 5; i++) {
      var p1 = pts[i], p2 = pts[(i + 1) % 5], p3 = pts[(i + 2) % 5]
      sheng += '<line x1="' + p1[0] + '" y1="' + p1[1] + '" x2="' + p2[0] + '" y2="' + p2[1] + '" stroke="' + NODE + '" stroke-width="2" opacity=".7"/>'
      ke += '<line x1="' + p1[0] + '" y1="' + p1[1] + '" x2="' + p3[0] + '" y2="' + p3[1] + '" stroke="' + NODE + '" stroke-width="1.2" opacity=".45"/>'
    }
    var nodes = pts.map(function (p, idx) {
      return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="24" fill="' + NODE + '"/>' +
        '<text x="' + p[0] + '" y="' + (p[1] + 8) + '" font-size="24" text-anchor="middle" fill="#fdf6e3" font-family="var(--lxh-font)">' + names[idx] + '</text>'
    }).join('')
    var labels = ''
    for (i = 0; i < 5; i++) {
      var m1 = pts[i], m2 = pts[(i + 1) % 5]
      labels += '<text x="' + ((m1[0] + m2[0]) / 2 * 1.12 - cx * 0.12) + '" y="' + ((m1[1] + m2[1]) / 2 * 1.12 - cy * 0.12) + '" font-size="15" text-anchor="middle" fill="' + NODE + '" opacity=".85">生</text>'
    }
    var center = opts.showStar === false ? '' :
      '<polygon points="' + starPts + '" fill="' + STAR + '" opacity=".85"/>' +
      (opts.title ? '<text x="' + cx + '" y="' + (cy + 10) + '" font-size="40" text-anchor="middle" fill="#fdf6e3" font-family="var(--lxh-font)">' + opts.title + '</text>' : '')
    return '<svg viewBox="0 0 400 340">' + ke + sheng + center + nodes + labels + '</svg>'
  }

  /* ---------- 3. 角色属性面板 ---------- */
  function charpanel(data) {
    var abilities = (data.abilities || []).map(function (a) {
      return '<div class="lxh-ability">' + a + '</div>'
    }).join('')
    return el(
      '<div class="lxh-charpanel lxh">' +
        '<div>' +
          '<div class="lxh-charpanel__head">' +
            '<div class="lxh-avatar">' + (data.avatar ? '<img src="' + data.avatar + '" alt="">' : '') + '</div>' +
            '<div class="lxh-charpanel__fields">' +
              '<div class="row"><b>姓名</b>' + data.name + '</div>' +
              '<div class="row"><b>种族</b>' + data.race + '</div>' +
              '<div class="row"><b>等级</b>' + data.lv + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="lxh-charpanel__intro"><h4>介绍</h4>' + data.intro + '</div>' +
          '<div class="lxh-charpanel__abilities"><h4>能力</h4><div class="slots">' + abilities + '</div></div>' +
        '</div>' +
        '<div class="lxh-charpanel__wuxing">' + wuxingSVG({ title: '御灵' }) +
          (data.portrait ? '<div class="lxh-charpanel__portrait"><img src="' + data.portrait + '" alt=""></div>' : '') +
        '</div>' +
      '</div>')
  }

  /* ---------- 4. 六维雷达 ---------- */
  function radar6(opts) {
    opts = opts || {}
    var labels = opts.labels || ['御灵系', '心灵系', '空间系', '锁御系', '造物系', '生灵系']
    var values = opts.values || [0.8, 0.5, 0.7, 0.4, 0.55, 0.6]
    var cx = 200, cy = 180, R = 120
    var grid = '', axes = '', i, a, ring
    for (ring = 1; ring <= 3; ring++) {
      var poly = []
      for (i = 0; i < 6; i++) {
        a = (-90 + i * 60) * Math.PI / 180
        poly.push((cx + R * ring / 3 * Math.cos(a)) + ',' + (cy + R * ring / 3 * Math.sin(a)))
      }
      grid += '<polygon points="' + poly.join(' ') + '" fill="none" stroke="#e8e0c8" stroke-width="1" opacity="' + (0.25 + ring * 0.15) + '"/>'
    }
    var dataPoly = [], nodes = ''
    for (i = 0; i < 6; i++) {
      a = (-90 + i * 60) * Math.PI / 180
      var vx = cx + R * Math.cos(a), vy = cy + R * Math.sin(a)
      axes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + vx + '" y2="' + vy + '" stroke="#e8e0c8" stroke-width="1" opacity=".4"/>'
      dataPoly.push((cx + R * values[i] * Math.cos(a)) + ',' + (cy + R * values[i] * Math.sin(a)))
      nodes += '<circle cx="' + vx + '" cy="' + vy + '" r="5" fill="' + NODE + '"/>'
      var lx = cx + (R + 34) * Math.cos(a), ly = cy + (R + 26) * Math.sin(a)
      nodes += '<text x="' + lx + '" y="' + (ly + 6) + '" font-size="17" text-anchor="middle" fill="' + NODE + '" font-family="var(--lxh-font)">' + labels[i] + '</text>'
    }
    return el('<div class="lxh-radar6 lxh"><svg viewBox="0 0 400 360">' + grid + axes +
      '<polygon points="' + dataPoly.join(' ') + '" fill="rgba(216,207,174,.35)" stroke="' + STAR + '" stroke-width="2"/>' +
      nodes + '<circle cx="' + cx + '" cy="' + cy + '" r="6" fill="#8ea06a"/></svg></div>')
  }

  /* ---------- 5. 五行星形雷达（星角随 opts.values 0~1 伸缩） ---------- */
  function radar5(opts) {
    opts = opts || {}
    var names = opts.names || ['金', '木', '水', '火', '土']
    var values = opts.values || [0.95, 0.6, 0.8, 0.45, 0.9]
    var cx = 200, cy = 175, R = 130
    var grid = '', dpts = [], i, a, ring
    for (ring = 1; ring <= 3; ring++) {
      var poly = []
      for (i = 0; i < 5; i++) {
        a = (-90 + i * 72) * Math.PI / 180
        poly.push((cx + R * ring / 3 * Math.cos(a)) + ',' + (cy + R * ring / 3 * Math.sin(a)))
      }
      grid += '<polygon points="' + poly.join(' ') + '" fill="none" stroke="#e8e0c8" stroke-width="1" opacity="' + (0.18 + ring * 0.12) + '"/>'
    }
    for (i = 0; i < 5; i++) {
      a = (-90 + i * 72) * Math.PI / 180
      var v = Math.max(0.3, Math.min(1, values[i] == null ? 0.6 : values[i]))
      dpts.push([cx + R * v * Math.cos(a), cy + R * v * Math.sin(a)])
    }
    var star = '<polygon points="' + dpts.map(function (p) { return p[0] + ',' + p[1] }).join(' ') + '" fill="' + PAPER + '" opacity=".9"/>'
    var nodes = dpts.map(function (p, idx) {
      return '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="16" ry="12" fill="' + NODE + '"/>' +
        '<text x="' + p[0] + '" y="' + (p[1] + 5) + '" font-size="14" text-anchor="middle" fill="#fdf6e3" font-family="var(--lxh-font)">' + names[idx] + '</text>'
    }).join('')
    return el('<div class="lxh-radar5 lxh"><svg viewBox="0 0 400 350">' + grid + star + nodes +
      '<rect x="182" y="157" width="36" height="36" rx="6" transform="rotate(12 200 175)" fill="#7a8a7e" opacity=".8"/>' +
      '</svg></div>')
  }

  /* ---------- 6. 确认对话框 ---------- */
  function confirmBox(opts) {
    var box = el(
      '<div class="lxh-modal"><div class="lxh-confirm lxh">' +
        '<div class="lxh-confirm__icon">' + (ICONS[opts.icon || 'door'] || ICONS.door) + '</div>' +
        '<div class="lxh-confirm__title">' + opts.title + '</div>' +
        '<div class="lxh-confirm__hint">' + (opts.hint || '') + '</div>' +
        (opts.amount != null ? amountHTML(opts.amount) : '') +
        '<div class="lxh-confirm__btns">' +
          '<button class="lxh-btn lxh-btn--yes"><span>是</span></button>' +
          '<button class="lxh-btn lxh-btn--no"><span>否</span></button>' +
        '</div>' +
      '</div></div>')
    box.querySelector('.lxh-btn--yes').onclick = function () { close(); opts.onYes && opts.onYes() }
    box.querySelector('.lxh-btn--no').onclick = function () { close(); opts.onNo && opts.onNo() }
    function close() { box.classList.remove('is-open') }
    box.open = function () { document.body.appendChild(box); box.classList.add('is-open') }
    box.close = close
    return box
  }

  function amountHTML(v) {
    var s = String(v == null ? '' : v)
    var digits = ''
    for (var i = 0; i < 4; i++) digits += '<i>' + (s[i] || '') + '</i>'
    return '<div class="lxh-amount"><div class="lxh-amount__digits">' + digits + '</div><span class="lxh-amount__yen">¥</span></div>'
  }

  /* ---------- 8. 邮件图标 ---------- */
  function mail() {
    return el(
      '<div class="lxh-mail lxh"><svg viewBox="0 0 64 48">' +
        '<rect x="2" y="4" width="60" height="40" rx="4" fill="#f7f1e1"/>' +
        '<path d="M2 8 L32 28 L62 8" fill="none" stroke="#b8b2a0" stroke-width="2.5"/></svg>' +
        '<span class="lxh-mail__badge">!</span></div>')
  }

  /* ---------- 独立五行徽章 ---------- */
  function wxnode(ch) { return el('<span class="lxh-wxnode lxh">' + ch + '</span>') }


  /* ---------- 9. 数字状态条（数码管计数器） ---------- */
  function counter(v) {
    var s = String(v == null ? 14688645 : v)
    while (s.length < 9) s = '0' + s
    s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return el('<div class="lxh-counter lxh"><span class="lxh-counter__badge">' + ICONS.smiley +
      '</span><span class="lxh-counter__num">' + s + '</span>' + ICONS.person + '</div>')
  }

  /* ---------- 10. 聊天气泡 ---------- */
  function chatbubble(opts) {
    opts = opts || {}
    return el('<div class="lxh-chatline lxh"><span class="lxh-chatline__avatar">' +
      (opts.avatar ? '<img src="' + opts.avatar + '" alt="">' : '') +
      '</span><span class="lxh-chatline__bubble">' + (opts.text || '') + '</span></div>')
  }

  /* ---------- 11. ID 名牌 ---------- */
  function nameplate(opts) {
    opts = opts || {}
    return el('<div class="lxh-nameplate lxh"><span class="lxh-nameplate__id">' + (opts.id || 'ID') +
      '</span><span class="lxh-nameplate__name">' + (opts.name || '') + '</span>' +
      (opts.editing ? '<span class="lxh-nameplate__caret"></span>' : '') + '</div>')
  }

  /* ---------- 12. 经验条 ---------- */
  function expbar(v) {
    return el('<div class="lxh-expbar lxh"><i class="lxh-expbar__fill" style="width:' +
      (v == null ? 60 : v) + '%"></i></div>')
  }

  /* ---------- 13. 等级条形图 ---------- */
  function lvchart(vals) {
    vals = vals || [22, 34, 46, 60, 76, 94, 112]
    var html = vals.map(function (h, i) {
      return '<div class="col"><div class="bar" style="height:' + h + 'px"></div>' +
        '<span class="lv">LV' + (i + 1) + '</span></div>'
    }).join('')
    return el('<div class="lxh-lvchart lxh">' + html + '</div>')
  }

  /* ---------- 14. 种族选择网格 ---------- */
  var RACE_TABS = ['race_human', 'race_bird', 'race_fish', 'race_lizard', 'race_frog']
  function racegrid(opts) {
    opts = opts || {}
    var tab = opts.tab == null ? 0 : opts.tab
    var tabs = RACE_TABS.map(function (k, i) {
      return '<button class="lxh-racegrid__tab' + (i === tab ? ' is-on' : '') + '" title="' + k + '">' + ICONS[k] + '</button>'
    }).join('')
    var cells = ''
    for (var i = 0; i < 12; i++) {
      var ava = opts.avatars && opts.avatars[i]
      cells += '<button class="lxh-racecell' + (i === (opts.sel == null ? 5 : opts.sel) ? ' is-sel' : '') + '">' +
        (ava ? '<img src="' + ava + '" alt="">' : ICONS[RACE_TABS[(i + tab) % 5]]) + '</button>'
    }
    var dots = ''
    for (var d = 0; d < 8; d++) dots += '<i' + (d === 1 ? ' class="is-on"' : '') + '></i>'
    return el('<div class="lxh-racegrid lxh"><div class="lxh-racegrid__tabs">' + tabs +
      '<div class="lxh-racegrid__search">' + ICONS.search + '</div>' +
      '<button class="lxh-racegrid__back" title="back">' + ICONS.back + '</button></div>' +
      '<div class="lxh-racegrid__cells">' + cells + '</div>' +
      '<div class="lxh-racegrid__dots">' + dots + '</div></div>')
  }

  /* ---------- 15. 种族谱系树（电路板直角连线） ---------- */
  function racetree() {
    function innerOf(k) { return ICONS[k].replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '') }
    function tile(x, y, k, gold) {
      return '<rect x="' + x + '" y="' + y + '" width="52" height="52" rx="12" fill="' + (gold ? '#c08b3c' : '#9aa58f') + '"/>' +
        '<svg x="' + (x + 10) + '" y="' + (y + 10) + '" width="32" height="32" viewBox="0 0 32 32">' + innerOf(k) + '</svg>'
    }
    var wires =
      '<polyline points="72,56 111,56 111,96 150,96" fill="none" stroke="#f2ead6" stroke-width="2"/>' +
      '<polyline points="72,136 111,136 111,96" fill="none" stroke="#f2ead6" stroke-width="2"/>' +
      '<polyline points="72,216 111,216 111,176 150,176" fill="none" stroke="#f2ead6" stroke-width="2"/>' +
      '<polyline points="202,96 241,96 241,56 280,56" fill="none" stroke="#c08b3c" stroke-width="2.5"/>' +
      '<polyline points="202,176 241,176 241,136 280,136" fill="none" stroke="#c08b3c" stroke-width="2.5"/>' +
      '<polyline points="202,176 241,176 241,216 280,216" fill="none" stroke="#c08b3c" stroke-width="2.5"/>' +
      '<circle cx="72" cy="56" r="4" fill="#f2ead6"/><circle cx="72" cy="136" r="4" fill="#f2ead6"/>' +
      '<circle cx="72" cy="216" r="4" fill="#f2ead6"/><circle cx="280" cy="56" r="5" fill="#c08b3c"/>' +
      '<circle cx="280" cy="136" r="5" fill="#c08b3c"/><circle cx="280" cy="216" r="5" fill="#c08b3c"/>'
    return el('<div class="lxh-racetree lxh"><svg viewBox="0 0 352 268">' + wires +
      tile(20, 30, 'race_frog', false) + tile(20, 110, 'race_lizard', false) + tile(20, 190, 'race_fish', false) +
      tile(150, 70, 'race_bird', false) + tile(150, 150, 'race_human', false) +
      tile(280, 30, 'race_bird', true) + tile(280, 110, 'race_lizard', true) + tile(280, 190, 'race_human', true) +
      '</svg></div>')
  }

  /* ---------- 16. 好友定位面板 ---------- */
  function friends(opts) {
    opts = opts || {}
    var rows = (opts.rows || [{ name: '阿根' }, { name: '小白' }, { name: '小黑' }]).map(function (r) {
      return '<div class="lxh-friends__row"><span class="lxh-friends__ava">' +
        (r.avatar ? '<img src="' + r.avatar + '" alt="">' : '') +
        '</span><span class="lxh-friends__name">' + r.name + '</span>' +
        '<button class="lxh-friends__loc" title="locate">' + ICONS.locate + '</button></div>'
    }).join('')
    return el('<div class="lxh-friends lxh"><div class="lxh-friends__title">好友定位</div>' +
      '<div class="lxh-friends__search">' + ICONS.search + '<span>搜索好友…</span></div>' + rows + '</div>')
  }

  /* ---------- 17. 游戏内手机面板 ---------- */
  function phone() {
    var apps = [['help', '#d8b84a'], ['shop', '#8a9a5a'], ['map', '#c08b3c'], ['radar', '#7d8b7d']].map(function (a) {
      return '<span class="lxh-phone__app" style="background:' + a[1] + '">' + ICONS[a[0]] + '</span>'
    }).join('')
    var list = ''
    for (var i = 1; i <= 4; i++) list += '<li><b>' + i + '.</b> 进入游戏后不能说话，只能打字交流。</li>'
    return el('<div class="lxh-phone lxh"><div class="lxh-phone__status"><span>10:23</span><span>●●●</span></div>' +
      '<div class="lxh-phone__apps">' + apps + '</div>' +
      '<div class="lxh-phone__body"><h5>声明</h5><ul class="lxh-phone__list">' + list + '</ul></div></div>')
  }

  /* ---------- 18. 头像框 ---------- */
  function avaframe(opts) {
    opts = opts || {}
    return el('<div class="lxh-avaframe lxh' + (opts.gold ? ' lxh-avaframe--gold' : '') + '">' +
      '<div class="lxh-avaframe__inner">' + (opts.avatar ? '<img src="' + opts.avatar + '" alt="">' : '') + '</div>' +
      '<span class="lxh-avaframe__btn">' + (opts.gold ? ICONS.camera : ICONS.wrench) + '</span></div>')
  }

  window.LXHUI = {
    ICONS: ICONS, hud: hud, filmcard: filmcard, charpanel: charpanel,
    radar6: radar6, radar5: radar5, confirm: confirmBox, mail: mail,
    wxnode: wxnode, wuxingSVG: wuxingSVG, starSVG: starSVG,
    counter: counter, chatbubble: chatbubble, nameplate: nameplate,
    expbar: expbar, lvchart: lvchart, racegrid: racegrid,
    racetree: racetree, friends: friends, phone: phone, avaframe: avaframe
  }
})()
