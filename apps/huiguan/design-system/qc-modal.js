/* .qc-modal 行为：焦点圈定、Esc 关闭、点遮罩关闭、关闭后焦点回到触发元素、背景不滚动。
 * 用法（见 design-system.md 第九节）：
 *   <button data-qc-modal-open="confirmModal">删除</button>
 *   <div class="qc-modal" id="confirmModal" aria-labelledby="confirmTitle">
 *     <div class="qc-modal__panel"><h2 class="qc-modal__title" id="confirmTitle">…</h2>
 *       <button data-qc-modal-close>取消</button></div></div>
 * 脚本：QcModal.open(el | id, trigger?) / QcModal.close(el | id)，关闭时在 .qc-modal 上派发 `qc-modal-close`。
 * 旧写法直接切换 `.is-open` 也能拿到同样的行为（通过 MutationObserver）。
 * 加 data-qc-modal-static 的弹窗不响应 Esc / 点遮罩（必须做出选择的确认框）。 */
(function () {
  'use strict';
  if (window.QcModal) return;
  var FOCUSABLE = 'a[href],area[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),iframe,summary,[contenteditable="true"],[tabindex]:not([tabindex="-1"])';
  var stack = [];          // 打开中的弹窗，最后一个在最上层
  var returnTo = new WeakMap();
  var lastPointerTarget = null;
  var savedOverflow = '';

  function resolve(target) { return typeof target === 'string' ? document.getElementById(target) : target; }
  function top() { return stack[stack.length - 1] || null; }
  function focusables(modal) {
    return Array.prototype.filter.call(modal.querySelectorAll(FOCUSABLE), function (el) {
      return !el.hidden && el.getClientRects().length > 0;
    });
  }
  function panelOf(modal) { return modal.querySelector('.qc-modal__panel') || modal; }

  function prepare(modal) {
    var panel = panelOf(modal);
    panel.setAttribute('role', panel.getAttribute('role') || 'dialog');
    panel.setAttribute('aria-modal', 'true');
    if (!panel.hasAttribute('aria-labelledby') && !panel.hasAttribute('aria-label')) {
      var title = modal.getAttribute('aria-labelledby') ? null : modal.querySelector('.qc-modal__title');
      if (modal.getAttribute('aria-labelledby')) panel.setAttribute('aria-labelledby', modal.getAttribute('aria-labelledby'));
      else if (title) { if (!title.id) title.id = 'qc-modal-title-' + Math.random().toString(36).slice(2, 8); panel.setAttribute('aria-labelledby', title.id); }
    }
    if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
  }

  // 打开后的收尾：记录触发元素、锁滚动、把焦点放进弹窗。由 open() 或观察到 .is-open 出现时调用。
  function activate(modal, trigger) {
    if (stack.indexOf(modal) !== -1) return;
    prepare(modal);
    var from = trigger || (document.activeElement !== document.body ? document.activeElement : lastPointerTarget);
    if (from && !modal.contains(from)) returnTo.set(modal, from);
    if (!stack.length) { savedOverflow = document.documentElement.style.overflow; document.documentElement.style.overflow = 'hidden'; }
    stack.push(modal);
    var first = modal.querySelector('[autofocus]') || focusables(panelOf(modal))[0] || panelOf(modal);
    first.focus({ preventScroll: true });
  }
  function deactivate(modal) {
    var i = stack.indexOf(modal);
    if (i === -1) return;
    stack.splice(i, 1);
    if (!stack.length) document.documentElement.style.overflow = savedOverflow;
    var back = returnTo.get(modal);
    returnTo.delete(modal);
    if (back && back.isConnected && typeof back.focus === 'function') back.focus({ preventScroll: true });
    modal.dispatchEvent(new CustomEvent('qc-modal-close', { bubbles: true }));
  }

  function open(target, trigger) {
    var modal = resolve(target);
    if (!modal) return;
    modal.classList.add('is-open');
    activate(modal, trigger);
  }
  function close(target) {
    var modal = resolve(target);
    if (!modal) return;
    modal.classList.remove('is-open');
    deactivate(modal);
  }

  document.addEventListener('pointerdown', function (event) { lastPointerTarget = event.target.closest ? event.target.closest(FOCUSABLE) : null; }, true);

  document.addEventListener('click', function (event) {
    var opener = event.target.closest('[data-qc-modal-open]');
    if (opener) { event.preventDefault(); open(opener.getAttribute('data-qc-modal-open'), opener); return; }
    var closer = event.target.closest('[data-qc-modal-close]');
    if (closer) { var owner = closer.closest('.qc-modal'); if (owner) close(owner); return; }
    var modal = top();
    if (modal && event.target === modal && !modal.hasAttribute('data-qc-modal-static')) close(modal);
  });

  document.addEventListener('keydown', function (event) {
    var modal = top();
    if (!modal) return;
    if (event.key === 'Escape') {
      if (!modal.hasAttribute('data-qc-modal-static')) { event.preventDefault(); close(modal); }
      return;
    }
    if (event.key !== 'Tab') return;
    var items = focusables(panelOf(modal));
    if (!items.length) { event.preventDefault(); panelOf(modal).focus(); return; }
    var first = items[0], last = items[items.length - 1], active = document.activeElement;
    if (event.shiftKey && (active === first || !modal.contains(active))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (active === last || !modal.contains(active))) { event.preventDefault(); first.focus(); }
  });

  // 焦点被脚本或辅助技术移出弹窗时拉回来。
  document.addEventListener('focusin', function (event) {
    var modal = top();
    if (modal && !modal.contains(event.target)) (focusables(panelOf(modal))[0] || panelOf(modal)).focus({ preventScroll: true });
  });

  // 兼容直接切换 .is-open 的旧页面。
  new MutationObserver(function (records) {
    records.forEach(function (record) {
      var el = record.target;
      if (!el.classList || !el.classList.contains('qc-modal')) return;
      if (el.classList.contains('is-open')) activate(el); else deactivate(el);
    });
  }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'] });

  window.QcModal = { open: open, close: close };
})();
