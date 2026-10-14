/* Homepage-only composition of shared links, the existing account bar and legal copy. */
(function () {
  'use strict';
  var nav = document.getElementById('qc-nav');
  if (!nav) return;
  document.body.classList.add('huiguan-homepage');
  nav.setAttribute('aria-label', '站点导航');
  var brand = nav.querySelector('.qc-brand');
  brand.textContent = '官网 ↗';
  brand.setAttribute('aria-label', 'Iridescently 官网');
  var links = nav.querySelector('.qc-links');
  var menu = document.createElement('details');
  menu.className = 'home-more';
  menu.innerHTML = '<summary>更多去处</summary><div class="home-more-panel"></div>';
  var panel = menu.querySelector('.home-more-panel');
  Array.from(links.querySelectorAll('a')).forEach(function (link) {
    var url = new URL(link.href);
    if (url.hostname === 'zszm.iridescently.xyz') return;
    if (url.hostname === 'huiguan.iridescently.xyz' || (url.hostname === 'iridescently.xyz' && url.pathname === '/')) { link.remove(); return; }
    panel.appendChild(link);
  });
  links.appendChild(menu);
  var foot = document.getElementById('qc-foot');
  if (foot) {
    var legal = foot.querySelector('details');
    if (legal) {
      legal.className = 'home-legal';
      legal.querySelector('summary').textContent = '版权与免责声明';
      var copy = foot.querySelector('.qc-copy');
      if (copy) legal.insertBefore(copy, legal.querySelector('p'));
      panel.appendChild(legal);
    }
    var signature = document.createElement('small');
    signature.textContent = '© ' + new Date().getFullYear() + ' Iridescently · 西木会馆';
    panel.appendChild(signature);
    foot.remove();
  }
  nav.querySelector('.qc-sign').remove();
  // The first /api/user response can precede shared-chrome's replacement of the original bar.
  // Repaint from the existing session, then let the normal account flow continue updating it.
  if (typeof window.renderAuthBar === 'function') window.renderAuthBar(window.currentUser || null);
  function close(event) {
    if (event.type === 'keydown' && event.key !== 'Escape') return;
    if (event.type === 'pointerdown' && menu.contains(event.target)) return;
    if (menu.open) {
      menu.open = false;
      if (event.type === 'keydown') menu.querySelector('summary').focus();
    }
  }
  document.addEventListener('pointerdown', close);
  document.addEventListener('keydown', close);
  window.addEventListener('pagehide', function () {
    document.removeEventListener('pointerdown', close);
    document.removeEventListener('keydown', close);
  }, { once: true });
})();
