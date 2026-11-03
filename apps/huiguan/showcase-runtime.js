/* [M7] Showcase page behaviour: ink dots, reveal, theme toggle and image lightbox.
 * The server serves saved showcase HTML without any of its own scripts and adds this file
 * (and showcase-download.js) under a nonce CSP, so the behaviour no longer travels inside
 * user-controlled HTML. */
(function () {
  var c = document.getElementById('ink-canvas'), ctx = c && c.getContext('2d');
  var w, h, dots = [], MAX = 40;
  var inkRGB = [42, 58, 46];
  function readInk() {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
      if (v.charAt(0) === '#' && v.length === 7) {
        inkRGB = [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)];
      }
    } catch (e) {}
  }
  readInk();
  window.addEventListener('lhx-theme-change', readInk);
  function resize() { w = window.innerWidth; h = window.innerHeight; if (c) { c.width = w; c.height = h; } }
  resize(); window.addEventListener('resize', resize);
  for (var i = 0; i < MAX; i++) {
    dots.push({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.8 + 0.4,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.1 - 0.03,
      o: Math.random() * 0.08 + 0.02,
      phase: Math.random() * Math.PI * 2,
      speed: 0.002 + Math.random() * 0.005
    });
  }
  (function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      d.phase += d.speed;
      d.x += d.vx + Math.sin(d.phase) * 0.06;
      d.y += d.vy + Math.cos(d.phase * 0.8) * 0.05;
      if (d.x < -5) d.x = w + 5; if (d.x > w + 5) d.x = -5;
      if (d.y < -5) d.y = h + 5; if (d.y > h + 5) d.y = -5;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + inkRGB[0] + ', ' + inkRGB[1] + ', ' + inkRGB[2] + ',' + d.o + ')'; ctx.fill();
    }
    requestAnimationFrame(draw);
  })();
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(function (el) { observer.observe(el); });
})();
(function () {
  var btn = document.getElementById('themeToggle');
  if (!btn) return;
  var root = document.documentElement;
  function apply(mode) {
    if (mode === 'cream') root.setAttribute('data-theme', 'cream');
    else root.removeAttribute('data-theme');
    btn.textContent = mode === 'cream' ? '☀ 角色配色' : '☾ 会馆乳白';
    try { localStorage.setItem('lhx_showcase_theme', mode); } catch (e) {}
  }
  var saved = 'char';
  try { saved = localStorage.getItem('lhx_showcase_theme') || 'char'; } catch (e) {}
  apply(saved);
  btn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'cream' ? 'char' : 'cream';
    document.body.classList.add('theme-transition');
    apply(next);
    // 与「众生之门」门动画配色联动：清除门动画注入的页面配色，并把动画主题切回 original
    if (window.__gateClearTheme) { try { window.__gateClearTheme(); } catch (e) {} }
    if (window.__gateSetTheme) { try { window.__gateSetTheme('original', false); } catch (e) {} }
    window.dispatchEvent(new Event('lhx-theme-change'));
    setTimeout(function () { document.body.classList.remove('theme-transition'); }, 1000);
  });
})();
(function () {
  var lb = document.createElement('div');
  lb.id = 'lhx-lightbox';
  lb.innerHTML = '<img loading="lazy" decoding="async" alt="">';
  lb.addEventListener('click', function () { lb.classList.remove('show'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') lb.classList.remove('show'); });
  document.body.appendChild(lb);
  function zoom(el) {
    lb.querySelector('img').src = el.src;
    lb.classList.add('show');
  }
  // Saved pages carry no event attributes; older pages' onclick="lhxZoom(this)" is stripped on output.
  document.addEventListener('click', function (e) {
    var img = e.target && e.target.closest ? e.target.closest('.lhx-img') : null;
    if (img) zoom(img);
  });
  window.lhxZoom = zoom;
})();
