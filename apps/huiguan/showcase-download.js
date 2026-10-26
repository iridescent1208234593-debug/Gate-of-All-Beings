/* The opaque saved page asks its trusted host to export; it never reads host DOM. */
(function () {
  if (window.__showcaseDownloadBound) return;
  window.__showcaseDownloadBound = true;
  const button = document.getElementById('saveImgBtn');
  if (!button || window.parent === window) return;
  let requestId = '', timeout;
  const restore = () => { button.disabled = false; button.textContent = '⬇ 保存为图片'; clearTimeout(timeout); };
  button.addEventListener('click', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    if (button.disabled) return;
    button.disabled = true; button.textContent = '生成中…';
    const colors = getComputedStyle(document.documentElement);
    requestId = String(Date.now()) + '-' + Math.random().toString(36).slice(2);
    parent.postMessage({ type: 'huiguan-showcase-export', requestId, colors: {
      primary: colors.getPropertyValue('--character-primary').trim(),
      accent: colors.getPropertyValue('--character-accent').trim(),
      background: colors.getPropertyValue('--bg').trim(),
      cream: document.documentElement.getAttribute('data-theme') === 'cream'
    } }, '*');
    timeout = setTimeout(restore, 60000);
  }, true);
  window.addEventListener('message', event => {
    if (event.source !== parent || event.data?.type !== 'huiguan-showcase-export-result' || event.data.requestId !== requestId) return;
    restore();
    if (event.data.error) { button.textContent = '导出失败，点击重试'; button.title = event.data.error; }
  });
})();
