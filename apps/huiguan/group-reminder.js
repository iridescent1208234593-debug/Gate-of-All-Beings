/* 温柔的「请进群」提醒弹窗：编辑码 / 荣誉长老 / 妖王 等免审核身份成功后使用 */
(function () {
  'use strict';
  const QQ = '878029597';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function show(opts) {
    opts = opts || {};
    const old = document.getElementById('hgGroupRemind'); if (old) old.remove();
    const m = document.createElement('div');
    m.id = 'hgGroupRemind'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.style.cssText = 'position:fixed;inset:0;z-index:100002;background:rgba(20,26,22,.6);display:flex;align-items:center;justify-content:center;padding:20px;';
    m.innerHTML = `<div style="background:var(--surface,var(--panel,#fbf8f2));border:1px solid var(--border,#d4cfbe);border-radius:14px;max-width:440px;width:100%;padding:24px;box-shadow:0 18px 50px rgba(0,0,0,.3);color:var(--text,#3a4a3e);font-family:inherit;">
      <div style="font-size:30px;line-height:1;margin-bottom:8px;">🌿</div>
      <strong style="font-size:17px;letter-spacing:1px;">${esc(opts.title || '欢迎～顺手进个群吧')}</strong>
      <p style="font-size:13px;line-height:1.9;margin:12px 0 14px;color:var(--dim,var(--text-dim,#5a6e5e));">${esc(opts.lead || '')}
        设定库是大家一起守护的小花园，进群之后遇到误改、想反馈或者想一起讨论设定，都能很快找到伙伴，也能避免数据被随意改动或破坏。谢谢你的体谅 🙏</p>
      <div style="border:1px dashed var(--border,#d4cfbe);border-radius:10px;padding:12px 14px;font-size:13px;line-height:2;background:rgba(90,158,143,.06);">
        QQ 群：<strong id="hgQQ" style="letter-spacing:1px;">${QQ}</strong>
        <button type="button" id="hgCopy" style="margin-left:8px;font:inherit;font-size:12px;cursor:pointer;padding:2px 12px;border-radius:999px;border:1px solid var(--accent,#5a9e8f);background:transparent;color:var(--accent,#5a9e8f);">复制群号</button><br>
        微信群：<strong>西木会馆-众生之门</strong><span style="color:var(--dim,var(--text-dim,#7a8a7e));font-size:12px;">（二维码见页脚 / 群聊）</span>
      </div>
      <button type="button" id="hgOk" style="margin-top:16px;width:100%;padding:10px;border:none;border-radius:8px;background:var(--accent,#5a9e8f);color:var(--on-accent,#fff);font:inherit;font-size:14px;cursor:pointer;">好的，我会去的</button>
    </div>`;
    document.body.appendChild(m);
    const close = () => { m.remove(); document.removeEventListener('keydown', onKey); if (opts.onClose) opts.onClose(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    m.addEventListener('click', e => { if (e.target === m) close(); });
    m.querySelector('#hgOk').onclick = close;
    m.querySelector('#hgOk').focus();
    m.querySelector('#hgCopy').onclick = async function () {
      try { await navigator.clipboard.writeText(QQ); this.textContent = '已复制 ✓'; }
      catch (_) { const r = document.createRange(); r.selectNode(m.querySelector('#hgQQ')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); this.textContent = '请长按复制'; }
    };
  }
  window.HuiguanGroup = { show, QQ };
})();
