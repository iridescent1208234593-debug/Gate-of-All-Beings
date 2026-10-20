/* Artwork thumbnails open their own unmodified source image on click. */
(function () {
  'use strict';

  const selector = 'img[data-original-image]';
  const prompt = '查看原图';
  const hiddenKey = 'iridescently.originalImageHintDismissed.v1';
  const isHintDismissed = () => {
    try { return localStorage.getItem(hiddenKey) === '1'; }
    catch { return false; }
  };
  const hint = document.createElement('span');
  hint.className = 'hg-original-image-hint';
  hint.innerHTML = '<button type="button" class="hg-original-image-hint__open">查看原图</button><button type="button" class="hg-original-image-hint__dismiss">不再提示</button>';
  hint.hidden = true;
  if (document.body) document.body.append(hint);

  const style = document.createElement('style');
  style.textContent = '.hg-original-image{cursor:zoom-in!important}.hg-original-image-hint{position:fixed;z-index:10000;transform:translate(-50%,-50%);display:flex;gap:6px;padding:6px;border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(22,25,30,.88);box-shadow:0 3px 14px rgba(0,0,0,.22);white-space:nowrap}.hg-original-image-hint[hidden]{display:none}.hg-original-image-hint button{border:0;border-radius:999px;padding:7px 11px;color:#fff;background:transparent;font:500 12px/1.2 system-ui,sans-serif;cursor:pointer}.hg-original-image-hint__open{background:rgba(255,255,255,.18)!important}.hg-original-image-hint button:hover,.hg-original-image-hint button:focus-visible{background:rgba(255,255,255,.28)}';
  document.head.append(style);

  function originalURL(image) {
    const source = image.dataset.full || image.dataset.originalSrc || image.currentSrc || image.src;
    try {
      const url = new URL(source, location.href);
      if (!['http:', 'https:'].includes(url.protocol)) return '';
      if (/^\/api\/(official\/img(?:-id)?|assets\/shared)$/.test(url.pathname)) {
        url.searchParams.delete('t');
      }
      return url.href;
    } catch {
      return '';
    }
  }

  function prepare(image) {
    if (image.dataset.originalViewerReady === '1') return;
    image.dataset.originalViewerReady = '1';
    image.removeAttribute('title');
    image.setAttribute('aria-label', `${image.alt || '图片'}，${prompt}`);
    image.tabIndex = 0;
    image.classList.add('hg-original-image');
  }

  function open(image, event) {
    const url = originalURL(image);
    if (!url) return;
    event.preventDefault();
    event.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  let hoveredImage = null;

  function showHint(image) {
    if (!image || isHintDismissed()) return hideHint();
    prepare(image);
    hoveredImage = image;
    const rect = image.getBoundingClientRect();
    hint.hidden = false;
    hint.style.left = `${rect.left + rect.width / 2}px`;
    hint.style.top = `${rect.top + rect.height / 2}px`;
  }

  function moveHint(event) {
    const image = event.target.closest?.(selector);
    if (image) showHint(image);
    else if (!hint.contains(event.target)) hideHint();
  }

  function hideHint() { hint.hidden = true; hoveredImage = null; }

  function scan(node) {
    if (node instanceof HTMLImageElement && node.matches(selector)) prepare(node);
    node.querySelectorAll?.(selector).forEach(prepare);
  }

  document.addEventListener('click', event => {
    if (event.target.closest?.('.hg-original-image-hint__dismiss')) {
      try { localStorage.setItem(hiddenKey, '1'); } catch {}
      hideHint();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.target.closest?.('.hg-original-image-hint__open')) {
      if (hoveredImage) open(hoveredImage, event);
      return;
    }
    const image = event.target.closest?.(selector);
    if (image) open(image, event);
  }, true);

  document.addEventListener('pointerover', moveHint, true);
  document.addEventListener('pointermove', moveHint, true);
  document.addEventListener('pointerout', event => {
    if (event.relatedTarget && hint.contains(event.relatedTarget)) return;
    if (event.target.closest?.(selector) && !event.relatedTarget?.closest?.(selector)) hideHint();
    else if (hint.contains(event.target) && !hint.contains(event.relatedTarget)) hideHint();
  }, true);
  window.addEventListener('scroll', hideHint, { passive: true });

  document.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    const image = event.target.closest?.(selector);
    if (image) open(image, event);
  }, true);

  scan(document);
  new MutationObserver(records => {
    for (const record of records) record.addedNodes.forEach(scan);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
