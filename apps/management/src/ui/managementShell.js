import '@lxh/shared-ui/lxh-ui.js';

export function mountManagementShell(ui) {
  const abort = new AbortController();
  const on = (selector, fn) => document.querySelector(selector)?.addEventListener('click', fn, { signal: abort.signal });
  document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = window.LXHUI.ICONS[el.dataset.icon] || ''; });
  document.querySelectorAll('.panel-tabs').forEach(nav => {
    nav.addEventListener('click', e => {
      const button = e.target.closest('[data-pane]');
      if (!button) return;
      nav.querySelectorAll('button').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
      nav.closest('aside').querySelectorAll('.panel-pane').forEach(p => p.classList.toggle('hidden', p.id !== button.dataset.pane));
    }, { signal: abort.signal });
  });
  document.querySelectorAll('[data-open-panel]').forEach(button => button.addEventListener('click', () => {
    const target = document.getElementById(button.dataset.openPanel), opening = !target.classList.contains('is-open');
    document.querySelectorAll('.paper-panel').forEach(p => p.classList.remove('is-open'));
    target.classList.toggle('is-open', opening);
  }, { signal: abort.signal }));
  document.querySelectorAll('[data-close-panel]').forEach(button => button.addEventListener('click', () => button.closest('aside').classList.remove('is-open'), { signal: abort.signal }));
  const settings = document.getElementById('settings-dialog');
  on('#btn-settings', () => settings.showModal());
  on('#settings-close', () => settings.close());
  on('#btn-zoom-in', () => ui.engine.zoomAt(1.2));
  on('#btn-zoom-out', () => ui.engine.zoomAt(1 / 1.2));
  on('#btn-reset-view', () => ui.engine.resetView());
  on('#btn-cancel', () => ui.cancelPlacement());
  let closeWorkshop;
  on('#btn-spirit-workshop', async () => {const {openSpiritWorkshop}=await import('../assembly/workshop.js');closeWorkshop?.();closeWorkshop=openSpiritWorkshop();});
  return () => {abort.abort();closeWorkshop?.();};
}
