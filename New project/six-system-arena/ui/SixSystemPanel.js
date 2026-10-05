/* ============================================================
   六系演武 · 数值面板组件  SixSystemPanel.js
   ------------------------------------------------------------
   复用共享 UI 库能力（只调用，不修改）：
     LXHUI.radar6({labels, values})   -> DOM 元素（六维雷达）
     LXHUI.wuxingSVG({title, showStar}) -> SVG 字符串（五行星图）
     LXHUI.ICONS['jin'|'mu'|'shui'|'huo'|'tu'|'kongjian'] -> 六系图标

   依赖：ui/six-system-icons.js（若已先加载则六键可用；否则本模块自行兜底）

   用法：
     var el = SixSystemPanel.render({
       name: '罗小黑',
       subtitle: '妖灵会馆 · 无限的徒弟',
       tier: 'A 神话',
       systems: ['jin', 'kongjian'],
       values: [88, 62, 70, 55, 60, 95],     // 金 木 水 火 土 空间
       stats: { hp: 5400, attack: 320, defense: 268 },
       source: '{"id":1}'
     })
     document.body.appendChild(el)

     SixSystemPanel.mount('#detail', opts)   // 挂载到容器
   ============================================================ */
(function (global) {
  'use strict'

  var SIX = null
  function six() {
    if (SIX) return SIX
    SIX = global.SixSystemIcons || null
    return SIX
  }

  var DEFAULT_LABELS = ['金', '木', '水', '火', '土', '空间']
  var COLORS = { jin: '#c9a227', mu: '#4a8a5a', shui: '#3f7f9e', huo: '#c8452f', tu: '#9a7642', kongjian: '#7a6aa8' }
  function sysColor(k) { return (six() && six().color(k)) || COLORS[k] || '#5c6152' }

  /* ---------- 样式（幂等注入） ---------- */
  var STYLE_ID = 'ss-panel-style'
  function injectStyle() {
    if (!global.document || document.getElementById(STYLE_ID)) return
    var css =
      '.ss-panel{background:#f7f1e1;border:1px solid #d9cfae;border-radius:14px;padding:16px 18px;' +
      'font-family:"PingFang SC","Microsoft YaHei",sans-serif;color:#4a4636;max-width:560px}' +
      '.ss-panel__hd{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:10px}' +
      '.ss-panel__name{font-size:20px;font-weight:700}' +
      '.ss-panel__sub{font-size:12px;color:#8a8471;margin-left:8px;font-weight:400}' +
      '.ss-panel__tier{font-size:12px;padding:2px 10px;border-radius:10px;background:#e9e0c6;color:#6a6450;white-space:nowrap}' +
      '.ss-panel__icons{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}' +
      '.ss-icon-chip{display:flex;align-items:center;gap:6px;padding:4px 10px 4px 6px;border-radius:20px;' +
      'background:#fffdf6;border:1px solid #e9e0c6;font-size:12px;color:#6a6450}' +
      '.ss-icon-chip.is-main{border-width:2px;font-weight:700;color:#4a4636}' +
      '.ss-panel__body{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}' +
      '.ss-panel__radar{flex:1 1 300px;min-width:280px}' +
      '.ss-panel__side{flex:0 1 200px;min-width:180px}' +
      '.ss-stats{display:flex;flex-direction:column;gap:8px}' +
      '.ss-stat__row{display:flex;align-items:center;gap:8px;font-size:12px;color:#6a6450}' +
      '.ss-stat__label{width:52px;flex:none}' +
      '.ss-stat__bar{position:relative;flex:1;height:8px;border-radius:4px;background:#e9e0c6;overflow:hidden}' +
      '.ss-stat__fill{position:absolute;left:0;top:0;height:100%;border-radius:4px}' +
      '.ss-stat__num{width:56px;text-align:right;font-variant-numeric:tabular-nums;color:#4a4636}' +
      '.ss-panel__wuxing{margin-top:10px;text-align:center}' +
      '.ss-panel__src{margin-top:10px;font-size:11px;color:#a09a86;word-break:break-all}'
    var st = document.createElement('style')
    st.id = STYLE_ID
    st.textContent = css
    document.head.appendChild(st)
  }

  /* ---------- 兜底雷达（LXHUI 缺失时自绘） ---------- */
  function fallbackRadar(labels, values) {
    var size = 300, cx = size / 2, cy = size / 2, R = size / 2 - 34, n = labels.length
    var pts = [], grid = '', axes = ''
    for (var g = 1; g <= 4; g++) {
      var poly = []
      for (var i = 0; i < n; i++) {
        var a = -Math.PI / 2 + i * 2 * Math.PI / n, r = R * g / 4
        poly.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1))
      }
      grid += '<polygon points="' + poly.join(' ') + '" fill="none" stroke="#e9e0c6"/>'
    }
    for (var j = 0; j < n; j++) {
      var t = -Math.PI / 2 + j * 2 * Math.PI / n
      var x2 = cx + R * Math.cos(t), y2 = cy + R * Math.sin(t)
      axes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#e9e0c6"/>'
      var lx = cx + (R + 18) * Math.cos(t), ly = cy + (R + 18) * Math.sin(t)
      axes += '<text x="' + lx + '" y="' + (ly + 4) + '" font-size="12" text-anchor="middle" fill="#6a6450">' + labels[j] + '</text>'
      var v = Math.max(0, Math.min(100, values[j] || 0)) / 100, r2 = R * v
      pts.push((cx + r2 * Math.cos(t)).toFixed(1) + ',' + (cy + r2 * Math.sin(t)).toFixed(1))
    }
    var wrap = document.createElement('div')
    wrap.className = 'ss-panel__radar'
    wrap.innerHTML = '<svg viewBox="0 0 ' + size + ' ' + size + '" style="width:100%;height:auto">' +
      grid + axes +
      '<polygon points="' + pts.join(' ') + '" fill="rgba(74,70,54,0.18)" stroke="#4a4636" stroke-width="1.6"/>' +
      '</svg>'
    return wrap
  }

  function buildRadar(labels, values) {
    var LXH = global.LXHUI
    if (LXH && typeof LXH.radar6 === 'function') {
      try {
        var node = LXH.radar6({ labels: labels, values: values })
        if (node && node.nodeType === 1) {
          node.classList.add('ss-panel__radar')
          return node
        }
        var host = document.createElement('div')
        host.className = 'ss-panel__radar'
        host.appendChild(node)
        return host
      } catch (e) { /* 降级到自绘 */ }
    }
    return fallbackRadar(labels, values)
  }

  function buildWuxing(title) {
    var LXH = global.LXHUI
    if (LXH && typeof LXH.wuxingSVG === 'function') {
      try {
        var box = document.createElement('div')
        box.className = 'ss-panel__wuxing'
        box.innerHTML = LXH.wuxingSVG({ title: title || '五行', showStar: true })
        return box
      } catch (e) { /* ignore */ }
    }
    return null
  }

  /* ---------- 图标行 ---------- */
  function buildIcons(systems) {
    var row = document.createElement('div')
    row.className = 'ss-panel__icons'
    var main = systems && systems.length ? systems[0] : null
    var list = (six() && six().KEYS) || ['jin', 'mu', 'shui', 'huo', 'tu', 'kongjian']
    list.forEach(function (k) {
      var on = !systems || !systems.length || systems.indexOf(k) !== -1
      var chip = document.createElement('span')
      chip.className = 'ss-icon-chip' + (k === main ? ' is-main' : '')
      chip.style.opacity = on ? '1' : '0.35'
      var iconEl = (six() && six().create) ? six().create(k, 22) : null
      if (iconEl) chip.appendChild(iconEl)
      var txt = document.createElement('span')
      txt.textContent = (six() && six().label) ? six().label(k) : k
      chip.appendChild(txt)
      row.appendChild(chip)
    })
    return row
  }

  /* ---------- 三条属性条 ---------- */
  function buildStats(stats) {
    var box = document.createElement('div')
    box.className = 'ss-stats'
    var defs = [
      { key: 'hp', label: '生命', color: '#4a8a5a', max: 12000 },
      { key: 'attack', label: '攻击', color: '#c8452f', max: 600 },
      { key: 'defense', label: '防御', color: '#3f7f9e', max: 600 }
    ]
    defs.forEach(function (d) {
      var v = (stats && stats[d.key]) || 0
      var pct = Math.max(2, Math.min(100, Math.round(v / d.max * 100)))
      var row = document.createElement('div')
      row.className = 'ss-stat__row'
      row.innerHTML = '<span class="ss-stat__label">' + d.label + '</span>' +
        '<span class="ss-stat__bar"><span class="ss-stat__fill" style="width:' + pct + '%;background:' + d.color + '"></span></span>' +
        '<span class="ss-stat__num">' + v + '</span>'
      box.appendChild(row)
    })
    return box
  }

  /* ---------- 主渲染 ---------- */
  function render(opts) {
    opts = opts || {}
    if (!global.document) return null
    injectStyle()

    var labels = opts.labels || DEFAULT_LABELS
    var values = opts.values || [0, 0, 0, 0, 0, 0]

    var panel = document.createElement('div')
    panel.className = 'ss-panel'

    var hd = document.createElement('div')
    hd.className = 'ss-panel__hd'
    hd.innerHTML = '<div><span class="ss-panel__name">' + (opts.name || '未命名角色') + '</span>' +
      (opts.subtitle ? '<span class="ss-panel__sub">' + opts.subtitle + '</span>' : '') + '</div>' +
      (opts.tier ? '<span class="ss-panel__tier">' + opts.tier + '</span>' : '')
    panel.appendChild(hd)

    panel.appendChild(buildIcons(opts.systems))

    var body = document.createElement('div')
    body.className = 'ss-panel__body'
    body.appendChild(buildRadar(labels, values))

    var side = document.createElement('div')
    side.className = 'ss-panel__side'
    side.appendChild(buildStats(opts.stats))
    var wx = buildWuxing(opts.wuxingTitle || '御灵')
    if (wx) side.appendChild(wx)
    body.appendChild(side)

    panel.appendChild(body)
    if (opts.source) {
      var src = document.createElement('div')
      src.className = 'ss-panel__src'
      src.textContent = '数据来源：' + opts.source
      panel.appendChild(src)
    }
    return panel
  }

  function mount(target, opts) {
    var host = typeof target === 'string' ? document.querySelector(target) : target
    if (!host) return null
    var el = render(opts)
    if (el) { host.innerHTML = ''; host.appendChild(el) }
    return el
  }

  /* ---------- 从 generate_stats.py 的产物直接渲染 ---------- */
  function renderFromRecord(rec) {
    if (!rec) return null
    var keys = (six() && six().KEYS) || ['jin', 'mu', 'shui', 'huo', 'tu', 'kongjian']
    var order = { jin: 0, mu: 1, shui: 2, huo: 3, tu: 4, kongjian: 5 }
    var values = [0, 0, 0, 0, 0, 0]
    var sys = rec.systems || (rec.element ? [rec.element] : [])
    sys.forEach(function (k, i) {
      if (order[k] !== undefined) values[order[k]] = Math.max(40, 100 - i * 22)
    })
    return render({
      name: rec.name,
      subtitle: (rec.realm_name || '') + (rec.mainline ? ' · 主线' : ''),
      tier: rec.tier ? (rec.tier + ' ' + (rec.tier_name || '')) : '',
      systems: sys,
      values: values,
      stats: { hp: rec.hp, attack: rec.attack, defense: rec.defense },
      source: 'character_stats.json · id=' + rec.id
    })
  }

  global.SixSystemPanel = {
    render: render,
    mount: mount,
    renderFromRecord: renderFromRecord,
    fallbackRadar: fallbackRadar
  }
})(typeof window !== 'undefined' ? window : this)
