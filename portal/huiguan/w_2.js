
(function () {
  var c = document.getElementById('ink-canvas');
  if (!c) return;
  var ctx = c.getContext('2d');
  var w, h, dots = [], MAX = 40;
  function resize() { w = c.width = window.innerWidth; h = c.height = window.innerHeight; }
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
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      d.phase += d.speed;
      d.x += d.vx + Math.sin(d.phase) * 0.06;
      d.y += d.vy + Math.cos(d.phase * 0.8) * 0.05;
      if (d.x < -5) d.x = w + 5; if (d.x > w + 5) d.x = -5;
      if (d.y < -5) d.y = h + 5; if (d.y > h + 5) d.y = -5;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(42, 58, 46,' + d.o + ')'; ctx.fill();
    }
    requestAnimationFrame(draw);
  })();
})();
