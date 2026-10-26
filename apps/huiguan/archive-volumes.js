/* 档案分册条：同一套档案内的各册互相切换（目前只有「官方角色档案」有主册 / 副册两册）。
 * 档案结构唯一来源是服务端 ARCHIVES（/api/archives）；本脚本只负责渲染与查询。
 * 用法：<div data-archive-volume="official_main"></div> → 渲染该册所属档案的分册页签 + 本册说明；只有一册的档案不渲染。
 * 作品详情、投稿等页面用 HuiguanArchives.ready.then(…) / HuiguanArchives.volume(key)。
 * 依赖 design-system.css 的 .qc-tabs / .qc-tab / .qc-hint。
 */
(function () {
  'use strict';
  let archives = [];
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ready = fetch('/api/archives')
    .then(r => r.ok ? r.json() : { archives: [] })
    .then(d => (archives = d.archives || []))
    .catch(() => (archives = []));
  const archiveOf = key => archives.find(a => a.volumes.some(v => v.key === key)) || null;
  const volume = key => { const a = archiveOf(key); return a ? a.volumes.find(v => v.key === key) : null; };

  function render(el) {
    const key = el.getAttribute('data-archive-volume');
    const archive = archiveOf(key), cur = volume(key);
    if (!archive || archive.volumes.length < 2) { el.hidden = true; return; }
    el.innerHTML = `<nav class="qc-tabs" aria-label="${esc(archive.title)} · 分册">${archive.volumes.map(v =>
      `<a class="qc-tab${v.key === key ? ' is-active' : ''}" href="${esc(v.page)}"${v.key === key ? ' aria-current="page"' : ''} title="${esc(v.desc)}">${esc(v.label)} · ${esc(v.title)}</a>`).join('')}</nav>` +
      `<p class="qc-hint">${esc(cur.desc)}</p>`;
  }

  const style = document.createElement('style');
  style.textContent = '[data-archive-volume]{margin:0 0 18px}[data-archive-volume] .qc-tabs{margin-bottom:6px}' +
    '[data-archive-volume] a.qc-tab{display:inline-flex;align-items:center;text-decoration:none}';
  document.head.appendChild(style);
  ready.then(() => document.querySelectorAll('[data-archive-volume]').forEach(render));
  window.HuiguanArchives = { ready, archive: archiveOf, volume };
})();
