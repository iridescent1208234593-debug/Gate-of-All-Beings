/* Module pages (聚灵, 重生之门 …) opened on their own get the shared site bar plus a way back to 门庭.
 * Inside the 众生之门 module shell — embedded (window.__iridescentlyEmbed) or framed — the shell
 * already shows the bar, so this adds nothing. Bar itself: packages/shared-ui/site-nav.js. */
(function () {
  'use strict';
  var framed = false;
  try { framed = window.top !== window.self; } catch (error) { framed = true; }
  if (window.__iridescentlyEmbed || framed) return;
  function addReturn() {
    var slot = window.IridescentlyNav && window.IridescentlyNav.slot();
    if (!slot || slot.querySelector('[data-return-hall]')) return;
    var back = document.createElement('a');
    back.href = window.IridescentlyDomains.url('zszm', '/#home');
    back.textContent = '回门庭';
    back.dataset.returnHall = '';
    back.style.cssText = 'padding:0 10px;opacity:.85';
    slot.appendChild(back);
  }
  if (window.IridescentlyNav) { window.IridescentlyNav.mount(); addReturn(); return; }
  var script = document.createElement('script');
  script.src = '/shared/shared-ui/site-nav.js?v=20261029a';
  script.onload = addReturn;
  document.head.appendChild(script);
})();
