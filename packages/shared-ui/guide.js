/*
 * 引路 · IridescentlyGuide — the one new-player guide runtime for every web page.
 *
 * A small light (灵光) travels to the thing being introduced, a soft lamp-pool
 * dims everything else a little, a hand-drawn ring settles round the target and
 * a paper note says one or two short lines. Nothing blocks the page: the player
 * can click through, scroll, close or ignore it at any moment.
 *
 * Progress contract: docs/development/NAMING_AND_CONTRACTS.md §12 (Onboarding Progress).
 *   - browser:  localStorage["iridescently.onboarding.v1"]
 *   - account:  GET/POST /api/onboarding on the 会馆 host (pages pass `sync`).
 *
 * Usage
 *   IridescentlyGuide.init({ sync: '/api/onboarding' });
 *   IridescentlyGuide.define('world', { title: '认识世界', steps: [...], required: [...] });
 *   IridescentlyGuide.tour('world');                     // sequential steps
 *   IridescentlyGuide.hint('identity', 'oc-form', {...}); // one contextual step, once
 *
 * Step: { key, target: selector|Element|() => Element, title, body, tryText?,
 *         action?: { label, run }, doneOn?: 'click'|'input'|'submit', doneText?, place? }
 */
(function () {
  'use strict';
  if (window.IridescentlyGuide) return;

  var STORE_KEY = 'iridescently.onboarding.v1';
  var FINISHED = { completed: 1, skipped: 1, veteran: 1 };
  var doc = document;
  var reducedQuery = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() {
    return reducedQuery.matches || doc.documentElement.getAttribute('data-ling-motion') === 'reduced';
  }

  // ------------------------------------------------------------------ storage
  function readLocal() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (raw && raw.v === 1 && raw.chapters && typeof raw.chapters === 'object') return raw;
    } catch (e) {}
    return { v: 1, chapters: {} };
  }
  function writeLocal(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }
  var local = readLocal();
  var account = null;        // { chapters } when signed in and synced
  var syncUrl = null;
  var chapters = {};         // definitions
  var listeners = [];
  var ready = null;

  function progress(id) {
    var src = account && account.chapters[id] ? account.chapters[id] : local.chapters[id];
    return src ? { status: src.status || 'new', seen: (src.seen || []).slice() } : { status: 'new', seen: [] };
  }
  function setLocal(id, p) {
    local.chapters[id] = { status: p.status, seen: p.seen.slice(0, 64), updated_at: Date.now() };
    writeLocal(local);
  }
  function post(body) {
    if (!syncUrl || !account) return Promise.resolve(null);
    return fetch(syncUrl, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (d && d.ok && account) account.chapters[body.chapter] = { status: d.status, seen: d.seen || [] };
      return d;
    }).catch(function () { return null; });
  }
  function save(id, p, change) {
    if (account && account.chapters) {
      account.chapters[id] = { status: p.status, seen: p.seen.slice() };
      post(Object.assign({ chapter: id }, change));
    } else {
      setLocal(id, p);   // guest progress only: account progress never lands in the shared browser copy
    }
    emit();
  }
  function emit() { listeners.forEach(function (fn) { try { fn(); } catch (e) {} }); renderMenu(); }

  function markSeen(id, key) {
    var p = progress(id);
    if (p.seen.indexOf(key) < 0) p.seen.push(key);
    if (p.status === 'new') p.status = 'active';
    var def = chapters[id];
    var required = def && (def.required || (def.steps || []).map(function (s) { return s.key; }));
    var done = required && required.length && required.every(function (k) { return p.seen.indexOf(k) >= 0; });
    var change = { seen: [key] };
    if (FINISHED[p.status] || p.status === 'paused') {
      // finished or paused: record the key, leave the status exactly as it is
    } else if (done) {
      p.status = 'completed'; change.status = 'completed';
    } else {
      change.status = 'active';
    }
    save(id, p, change);
  }
  function setStatus(id, status) {
    var p = progress(id);
    p.status = status;
    save(id, p, { status: status });
  }
  function reset(id) {
    save(id, { status: 'active', seen: [] }, { reset: true });
  }

  function syncAccount() {
    if (!syncUrl) return Promise.resolve();
    return fetch(syncUrl, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.logged_in) { account = null; return; }
        account = { chapters: {} };
        var merges = [];
        Object.keys(d.chapters || {}).forEach(function (id) {
          var server = d.chapters[id];
          account.chapters[id] = { status: server.status, seen: server.seen || [] };
          var mine = local.chapters[id];
          if (!mine) return;
          var extra = (mine.seen || []).filter(function (k) { return (server.seen || []).indexOf(k) < 0; });
          var forward = mine.status && mine.status !== 'new' && mine.status !== server.status && !FINISHED[server.status];
          if (extra.length || forward) {
            var status = mine.status === 'veteran' ? 'completed' : mine.status;
            merges.push(post({ chapter: id, seen: extra, status: forward ? status : undefined, merge: true }));
          }
        });
        return Promise.all(merges);
      }).catch(function () { account = null; });
  }

  // ------------------------------------------------------------------ DOM
  var root, lamp, ringSvg, ringPath, wisp, trail = [], note, live, menuBtn, menuPanel;
  var current = null;   // { id, steps, index, step, target, cleanup, mode }
  var wispPos = null;
  var lastFocus = null;

  function el(tag, cls, html) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  var wispSeq = 0;
  function wispSvg() {
    var gid = 'lingWispGlow' + (++wispSeq);
    return WISP_SVG.replace(/lingWispGlow/g, gid);
  }
  var WISP_SVG = '<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">' +
    '<defs><radialGradient id="lingWispGlow"><stop offset="0" stop-color="#fffbe6"/><stop offset=".35" stop-color="#f6e7a4" stop-opacity=".9"/>' +
    '<stop offset="1" stop-color="#cfe6a6" stop-opacity="0"/></radialGradient></defs>' +
    '<circle cx="20" cy="20" r="19" fill="url(#lingWispGlow)"/>' +
    '<path d="M20 12c3 3 4.2 6 4.2 8.4A4.2 4.2 0 0 1 20 24.6a4.2 4.2 0 0 1-4.2-4.2C15.8 18 17 15 20 12z" fill="#fffdf2"/>' +
    '<path d="M20 24.6v4.6M20 27c1.6-.4 2.8-1.2 3.6-2.4" stroke="#9fcf7a" stroke-width="1.3" stroke-linecap="round" fill="none"/></svg>';

  function build() {
    if (root) return;
    root = el('div', 'ling-guide');
    root.setAttribute('data-ling-guide', '');
    lamp = el('div', 'ling-guide__lamp');
    ringSvg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ringSvg.setAttribute('class', 'ling-guide__ring');
    ringSvg.setAttribute('aria-hidden', 'true');
    ringPath = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    ringPath.setAttribute('pathLength', '1');
    ringSvg.appendChild(ringPath);
    for (var i = 0; i < 3; i++) { var t = el('span', 'ling-guide__trail'); trail.push(t); root.appendChild(t); }
    wisp = el('div', 'ling-guide__wisp', wispSvg());
    note = el('section', 'ling-guide__note');
    note.setAttribute('role', 'dialog');
    note.setAttribute('aria-modal', 'false');
    note.setAttribute('aria-labelledby', 'lingGuideTitle');
    note.hidden = true;
    live = el('p', 'ling-visually-hidden');
    live.setAttribute('aria-live', 'polite');
    root.appendChild(lamp); root.appendChild(ringSvg); root.appendChild(wisp); root.appendChild(note); root.appendChild(live);
    menuBtn = el('button', 'ling-guide__menu-btn', wispSvg() + '<span class="ling-visually-hidden">新手引导</span>');
    menuBtn.type = 'button';
    menuBtn.setAttribute('aria-haspopup', 'dialog');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.title = '新手引导';
    menuBtn.hidden = true;
    menuBtn.addEventListener('click', toggleMenu);
    menuPanel = el('section', 'ling-guide__menu');
    menuPanel.setAttribute('role', 'dialog');
    menuPanel.setAttribute('aria-label', '新手引导');
    menuPanel.hidden = true;
    root.appendChild(menuBtn); root.appendChild(menuPanel);
    doc.body.appendChild(root);
    doc.addEventListener('keydown', onKey, true);
    addEventListener('resize', relayout, { passive: true });
    addEventListener('scroll', relayout, { passive: true, capture: true });
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      if (!menuPanel.hidden) { closeMenu(true); e.stopPropagation(); return; }
      if (current && !note.hidden && note.contains(doc.activeElement)) {
        if (current.mode === 'tour') pause(); else finishStep(true);
        e.stopPropagation();
      }
    }
  }

  // ------------------------------------------------------------------ geometry
  function resolve(target) {
    if (!target) return null;
    var n = typeof target === 'function' ? target() : (typeof target === 'string' ? doc.querySelector(target) : target);
    if (!n || !n.getBoundingClientRect) return null;
    var r = n.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return n;
  }
  function rectOf(n) {
    var r = n.getBoundingClientRect();
    var pad = Math.max(6, Math.min(14, Math.min(r.width, r.height) * .08));
    return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
  }
  function inView(n) {
    var r = n.getBoundingClientRect();
    var top = 64, bottom = innerHeight - (innerWidth < 640 ? 220 : 24);
    return r.top >= top && r.bottom <= bottom || (r.height > bottom - top && r.top < bottom * .5 && r.bottom > top);
  }
  function settleScroll(n) {
    if (inView(n)) return Promise.resolve();
    var mobile = innerWidth < 640;
    var r = n.getBoundingClientRect();
    var y = scrollY + r.top - (mobile ? Math.max(80, (innerHeight - 220 - r.height) / 2) : Math.max(90, (innerHeight - r.height) / 2.4));
    scrollTo({ top: Math.max(0, y), behavior: reduced() ? 'auto' : 'smooth' });
    return new Promise(function (done) {
      var last = -1, still = 0, start = performance.now();
      (function poll() {
        var now = n.getBoundingClientRect().top;
        still = Math.abs(now - last) < .5 ? still + 1 : 0;
        last = now;
        if (still > 6 || performance.now() - start > 1200) return done();
        requestAnimationFrame(poll);
      })();
    });
  }

  // A hand-drawn loop: a rounded rectangle traced once with a slight overrun and wobble.
  function ringD(b) {
    var x = b.x, y = b.y, w = b.w, h = b.h, r = Math.min(18, w / 4, h / 4);
    var j = function (v, s) { return (v + (Math.sin(s * 12.9898) * 43758.5453 % 1) * 2.2).toFixed(1); };
    return 'M' + j(x + r + 6, 1) + ' ' + j(y - 1, 2) +
      ' L' + j(x + w - r, 3) + ' ' + j(y, 4) + ' Q' + j(x + w, 5) + ' ' + j(y, 6) + ' ' + j(x + w + 1, 7) + ' ' + j(y + r, 8) +
      ' L' + j(x + w, 9) + ' ' + j(y + h - r, 10) + ' Q' + j(x + w, 11) + ' ' + j(y + h, 12) + ' ' + j(x + w - r, 13) + ' ' + j(y + h + 1, 14) +
      ' L' + j(x + r, 15) + ' ' + j(y + h, 16) + ' Q' + j(x - 1, 17) + ' ' + j(y + h, 18) + ' ' + j(x, 19) + ' ' + j(y + h - r, 20) +
      ' L' + j(x - 1, 21) + ' ' + j(y + r, 22) + ' Q' + j(x, 23) + ' ' + j(y - 2, 24) + ' ' + j(x + r + 2, 25) + ' ' + j(y - 3, 26) +
      ' L' + j(x + r * 2 + 14, 27) + ' ' + j(y - 5, 28);
  }

  // cubic-bezier(.55,0,.18,1) — crisp start, soft landing
  function travelEase(t) {
    var x1 = .55, y1 = 0, x2 = .18, y2 = 1, lo = 0, hi = 1, mid = t;
    for (var i = 0; i < 18; i++) {
      mid = (lo + hi) / 2;
      var x = 3 * (1 - mid) * (1 - mid) * mid * x1 + 3 * (1 - mid) * mid * mid * x2 + mid * mid * mid;
      if (x < t) lo = mid; else hi = mid;
    }
    return 3 * (1 - mid) * (1 - mid) * mid * y1 + 3 * (1 - mid) * mid * mid * y2 + mid * mid * mid;
  }

  function anchorFor(b) {
    // The light rests just above the target's top-left corner, never on top of its text.
    var x = Math.min(innerWidth - 28, Math.max(28, b.x + Math.min(28, b.w * .2)));
    var y = b.y - 22 < 56 ? Math.min(innerHeight - 28, b.y + b.h + 22) : b.y - 22;
    return { x: x, y: y };
  }

  var flight = 0;
  function fly(to) {
    var id = ++flight;
    root.classList.add('is-on');
    if (!wispPos || reduced()) {
      wispPos = to; placeWisp(to, 0); return Promise.resolve();
    }
    var from = wispPos, dx = to.x - from.x, dy = to.y - from.y, dist = Math.hypot(dx, dy);
    if (dist < 2) return Promise.resolve();
    // a light arc perpendicular to the path, never more than 90px
    var bend = Math.min(90, dist * .18), cx = (from.x + to.x) / 2 - dy / dist * bend, cy = (from.y + to.y) / 2 + dx / dist * bend;
    var dur = Math.max(520, Math.min(900, dist * .9));
    var start = performance.now();
    root.classList.add('is-flying');
    return new Promise(function (done) {
      (function step(now) {
        if (id !== flight) return done();
        var t = Math.min(1, (now - start) / dur), e = travelEase(t);
        var p = qpoint(from, { x: cx, y: cy }, to, e);
        wispPos = p; placeWisp(p, t);
        for (var i = 0; i < trail.length; i++) {
          var tp = qpoint(from, { x: cx, y: cy }, to, travelEase(Math.max(0, t - (i + 1) * .045)));
          trail[i].style.transform = 'translate(' + tp.x.toFixed(1) + 'px,' + tp.y.toFixed(1) + 'px)';
          trail[i].style.opacity = t < 1 ? String((.42 - i * .12) * Math.sin(Math.PI * t)) : '0';
        }
        if (t < 1) requestAnimationFrame(step);
        else { root.classList.remove('is-flying'); done(); }
      })(start);
    });
  }
  function qpoint(a, c, b, t) {
    var u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  }
  function placeWisp(p) { wisp.style.transform = 'translate(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px)'; }

  function lampTo(b, on) {
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    var r = Math.hypot(b.w, b.h) / 2 + 12;   // fully lit to the corners
    lamp.style.setProperty('--lx', cx.toFixed(0) + 'px');
    lamp.style.setProperty('--ly', cy.toFixed(0) + 'px');
    lamp.style.setProperty('--lr', r.toFixed(0) + 'px');
    lamp.classList.toggle('is-on', !!on);
  }

  function drawRing(b) {
    ringSvg.setAttribute('viewBox', '0 0 ' + innerWidth + ' ' + innerHeight);
    ringPath.setAttribute('d', ringD(b));
    ringSvg.classList.remove('is-drawn');
    // restart the stroke animation
    void ringSvg.getBoundingClientRect();
    ringSvg.classList.add('is-drawn');
  }

  function placeNote(b) {
    note.classList.remove('is-docked');
    if (innerWidth < 640) { note.classList.add('is-docked'); note.style.left = note.style.top = ''; return; }
    var nw = note.offsetWidth, nh = note.offsetHeight, g = 16;
    var below = b.y + b.h + 18, above = b.y - nh - 18;
    var top = below + nh < innerHeight - g ? below : (above > 64 ? above : Math.max(64, Math.min(innerHeight - nh - g, b.y + b.h / 2 - nh / 2)));
    var left = Math.max(g, Math.min(innerWidth - nw - g, b.x));
    if (top !== below && top !== above) {   // beside the target
      left = b.x + b.w + 18 + nw < innerWidth - g ? b.x + b.w + 18 : Math.max(g, b.x - nw - 18);
    }
    note.style.left = left.toFixed(0) + 'px';
    note.style.top = top.toFixed(0) + 'px';
  }

  var relayoutRaf = 0;
  function relayout() {
    if (relayoutRaf || !current || !current.target) return;
    relayoutRaf = requestAnimationFrame(function () {
      relayoutRaf = 0;
      if (!current || !current.target || !current.target.isConnected) return;
      var b = rectOf(current.target);
      ringSvg.setAttribute('viewBox', '0 0 ' + innerWidth + ' ' + innerHeight);
      ringPath.setAttribute('d', ringD(b));
      lampTo(b, true);
      if (root.classList.contains('is-flying')) return;
      wispPos = anchorFor(b); placeWisp(wispPos);
      if (!note.hidden) placeNote(b);
    });
  }

  // ------------------------------------------------------------------ note
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function renderNote(c) {
    var def = chapters[c.id] || {}, s = c.step;
    var tour = c.mode === 'tour';
    var dots = tour ? c.steps.map(function (st, i) {
      return '<span class="ling-guide__dot' + (i < c.index ? ' is-past' : i === c.index ? ' is-now' : '') + '"></span>';
    }).join('') : '';
    var last = tour && c.index === c.steps.length - 1;
    var primary = s.action ? s.action.label : (tour ? (last ? '开始探索' : '下一处') : '知道了');
    note.innerHTML =
      '<p class="ling-guide__kicker"><span>' + esc(def.title || '') + '</span>' + (dots ? '<span class="ling-guide__dots" aria-hidden="true">' + dots + '</span>' : '') + '</p>' +
      '<h2 class="ling-guide__title" id="lingGuideTitle" tabindex="-1">' + esc(s.title) + '</h2>' +
      (s.body ? '<p class="ling-guide__body">' + esc(s.body) + '</p>' : '') +
      (s.tryText ? '<p class="ling-guide__try"><span aria-hidden="true">✦</span>' + esc(s.tryText) + '</p>' : '') +
      '<div class="ling-guide__actions">' +
      '<button type="button" class="ling-btn ling-btn--primary" data-guide="next">' + esc(primary) + (tour && !last && !s.action ? ' <span aria-hidden="true">→</span>' : '') + '</button>' +
      (tour && c.index > 0 ? '<button type="button" class="ling-btn ling-btn--quiet" data-guide="back">上一处</button>' : '') +
      '<span class="ling-guide__spacer"></span>' +
      '<button type="button" class="ling-btn ling-btn--quiet" data-guide="pause">' + (tour ? '稍后再看' : '收起') + '</button>' +
      '</div>' +
      (tour ? '<button type="button" class="ling-guide__skip" data-guide="skip">不需要引导</button>' : '');
    note.querySelector('[data-guide="next"]').onclick = function () {
      if (s.action && s.action.run) { finishStep(); try { s.action.run(); } catch (e) {} return; }
      next();
    };
    var back = note.querySelector('[data-guide="back"]');
    if (back) back.onclick = function () { go(c.index - 1); };
    note.querySelector('[data-guide="pause"]').onclick = function () { tour ? pause() : finishStep(true); };
    var skipBtn = note.querySelector('[data-guide="skip"]');
    if (skipBtn) skipBtn.onclick = skip;
  }

  function showNote(c) {
    renderNote(c);
    note.hidden = false;
    note.classList.remove('is-in');
    placeNote(rectOf(c.target));
    void note.offsetWidth;
    note.classList.add('is-in');
    live.textContent = c.step.title + '。' + (c.step.body || '');
    var title = note.querySelector('#lingGuideTitle');
    if (title && c.focus !== false) title.focus({ preventScroll: true });
  }

  function feedback(text) {
    // one sprout on the ring, then a short line on the note — the only "celebration" there is
    root.classList.remove('is-sprout'); void root.offsetWidth; root.classList.add('is-sprout');
    if (!text) return;
    var body = note.querySelector('.ling-guide__body') || note.querySelector('.ling-guide__title');
    if (body) { body.textContent = text; body.classList.add('is-done'); }
    live.textContent = text;
  }

  // ------------------------------------------------------------------ flow
  function present(c) {
    var target = resolve(c.step.target);
    if (!target) return false;
    c.target = target;
    current = c;
    build();
    closeMenu();
    renderMenu();
    root.classList.add('is-on');
    note.hidden = true;
    ringSvg.classList.remove('is-drawn');
    if (!lastFocus) lastFocus = doc.activeElement;
    var token = c;
    settleScroll(target).then(function () {
      if (current !== token) return;
      var b = rectOf(target);
      lampTo(b, true);
      return fly(anchorFor(b)).then(function () {
        if (current !== token) return;
        drawRing(rectOf(target));
        root.classList.remove('is-arrive'); void root.offsetWidth; root.classList.add('is-arrive');
        setTimeout(function () { if (current === token) showNote(token); }, reduced() ? 0 : 140);
      });
    });
    watchDone(c);
    return true;
  }

  function watchDone(c) {
    if (c.cleanup) c.cleanup();
    if (!c.step.doneOn) return;
    var evt = c.step.doneOn === 'input' ? 'input' : c.step.doneOn === 'submit' ? 'submit' : 'click';
    var handler = function () {
      if (current !== c) return;
      feedback(c.step.doneText || '');
      markSeen(c.id, c.step.key);
      c.done = true;
      setTimeout(function () { if (current === c) (c.mode === 'tour' ? next() : finishStep()); }, reduced() ? 300 : 1100);
    };
    var t = c.target;
    t.addEventListener(evt, handler, { once: true, capture: true });
    c.cleanup = function () { t.removeEventListener(evt, handler, { capture: true }); };
  }

  function hide(restoreFocus) {
    flight++;
    if (current && current.cleanup) current.cleanup();
    current = null;
    if (!root) return;
    root.classList.remove('is-on', 'is-flying', 'is-arrive', 'is-sprout');
    lamp.classList.remove('is-on');
    ringSvg.classList.remove('is-drawn');
    note.hidden = true;
    wispPos = null;
    if (restoreFocus && lastFocus && lastFocus.focus && lastFocus.isConnected) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    lastFocus = null;
    renderMenu();
  }

  function finishStep(dismissed) {
    var c = current;
    if (!c) return;
    if (!c.done) markSeen(c.id, c.step.key);
    hide(true);
    if (c.onClose) c.onClose(!!dismissed);
  }

  function go(index) {
    var c = current;
    if (!c || c.mode !== 'tour') return;
    var back = index < c.index;
    var shown = 0;
    for (var i = index; i >= 0 && i < c.steps.length; i += back ? -1 : 1) {
      var step = c.steps[i];
      if (step.when && !step.when()) continue;
      var nextC = { id: c.id, mode: 'tour', steps: c.steps, index: i, step: step };
      if (present(nextC)) return;
    }
    if (back) return;                       // nothing earlier to show: stay on the current note
    var p = progress(c.id);
    var anySeen = c.steps.some(function (st) { return p.seen.indexOf(st.key) >= 0; });
    if (anySeen) complete(c.id);            // walked to the end
    else hide(true);                        // nothing on this page could be shown: try again another time
  }
  function next() {
    var c = current;
    if (!c) return;
    if (!c.done) markSeen(c.id, c.step.key);
    if (c.mode !== 'tour') return finishStep();
    if (c.index >= c.steps.length - 1) return complete(c.id);
    go(c.index + 1);
  }
  function complete(id) {
    setStatus(id, 'completed');
    var def = chapters[id];
    hide(true);
    if (def && def.onComplete) def.onComplete();
  }
  function pause() {
    var c = current;
    if (!c) return;
    setStatus(c.id, 'paused');
    hide(true);
    toast('引导收进了角落的这点灵光里，想继续时点它。');
    pulseMenu();
  }
  function skip() {
    var c = current;
    if (!c) return;
    setStatus(c.id, 'skipped');
    hide(true);
    toast('好，不再引导。需要时可以在角落的灵光里重新查看。');
    pulseMenu();
  }

  var toastTimer = 0;
  function toast(text) {
    build();
    var t = root.querySelector('.ling-guide__toast') || root.appendChild(el('p', 'ling-guide__toast'));
    t.setAttribute('role', 'status');
    t.textContent = text;
    t.classList.add('is-in');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-in'); }, 4200);
  }

  // ------------------------------------------------------------------ menu (pause / resume / review)
  function menuChapters() {
    return Object.keys(chapters).filter(function (id) { return chapters[id].menu !== false; });
  }
  function renderMenu() {
    if (!root) return;
    var ids = menuChapters();
    var open = ids.filter(function (id) { var s = progress(id).status; return s === 'paused' || s === 'active'; });
    var forced = root.getAttribute('data-menu') === 'always';
    // never next to an open note: on phones the docked note would sit under it
    menuBtn.hidden = !!current || !ids.length || (!open.length && !forced && menuPanel.hidden);
    if (menuPanel.hidden) return;
    var html = '<h2 class="ling-guide__menu-title">新手引导</h2><ul class="ling-guide__menu-list">';
    ids.forEach(function (id) {
      var def = chapters[id], p = progress(id);
      var total = (def.required || (def.steps || []).map(function (s) { return s.key; })).length;
      var count = p.seen.filter(function (k) { return (def.required || (def.steps || []).map(function (s) { return s.key; })).indexOf(k) >= 0; }).length;
      var label = { completed: '已完成', skipped: '已跳过', veteran: '老朋友，已默认完成', paused: '已暂停 · ' + count + '/' + total, active: '进行中 · ' + count + '/' + total, 'new': '还没开始' }[p.status] || '';
      var finished = !!FINISHED[p.status];
      html += '<li><div><strong>' + esc(def.title) + '</strong><span>' + esc(def.summary || '') + '</span><em>' + esc(label) + '</em></div>' +
        '<div class="ling-guide__menu-actions">' +
        (!finished && def.steps ? '<button type="button" class="ling-btn ling-btn--primary" data-resume="' + id + '">' + (p.status === 'new' ? '开始' : '继续') + '</button>' : '') +
        '<button type="button" class="ling-btn" data-review="' + id + '">重新查看</button></div></li>';
    });
    html += '</ul>';
    if (root.getAttribute('data-menu-note')) html += '<p class="ling-guide__menu-note">' + esc(root.getAttribute('data-menu-note')) + '</p>';
    menuPanel.innerHTML = html;
    menuPanel.querySelectorAll('[data-resume]').forEach(function (b) {
      b.onclick = function () { closeMenu(); var id = b.getAttribute('data-resume'); setStatus(id, 'active'); api.tour(id); };
    });
    menuPanel.querySelectorAll('[data-review]').forEach(function (b) {
      b.onclick = function () { closeMenu(); var id = b.getAttribute('data-review'); reset(id); var def = chapters[id]; if (def.steps) api.tour(id, { force: true }); else toast('「' + def.title + '」的提示会在你用到对应功能时重新出现。'); };
    });
  }
  function toggleMenu() { menuPanel.hidden ? openMenu() : closeMenu(true); }
  function openMenu() {
    build();
    if (current) hide(false);
    menuPanel.hidden = false;
    menuBtn.setAttribute('aria-expanded', 'true');
    renderMenu();
    var first = menuPanel.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }
  function closeMenu(focusBtn) {
    if (!menuPanel || menuPanel.hidden) return;
    menuPanel.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
    renderMenu();
    if (focusBtn && !menuBtn.hidden) menuBtn.focus({ preventScroll: true });
  }
  function pulseMenu() {
    renderMenu();
    if (!menuBtn || menuBtn.hidden) return;
    menuBtn.classList.remove('is-pulse'); void menuBtn.offsetWidth; menuBtn.classList.add('is-pulse');
  }
  doc.addEventListener('click', function (e) {
    if (menuPanel && !menuPanel.hidden && !menuPanel.contains(e.target) && !menuBtn.contains(e.target)) closeMenu();
  }, true);

  // ------------------------------------------------------------------ public API
  var api = {
    init: function (options) {
      options = options || {};
      syncUrl = options.sync || null;
      // A browser that used the site before the guide existed is treated like a veteran account:
      // it is never walked through again, but can reopen the guide from the corner light.
      if (options.returningGuest) {
        Object.keys(options.returningGuest).forEach(function (id) {
          if (!local.chapters[id] && options.returningGuest[id]) setLocal(id, { status: 'veteran', seen: [] });
        });
      }
      ready = syncAccount().then(function () {
        build();
        if (options.menu === 'always') root.setAttribute('data-menu', 'always');
        if (options.menuNote) root.setAttribute('data-menu-note', options.menuNote);
        renderMenu();
      });
      return ready;
    },
    /** Re-read the account after sign-in / sign-out (merges this browser's progress in). */
    refresh: function () { ready = syncAccount().then(emit); return ready; },
    ready: function () { return ready || Promise.resolve(); },
    define: function (id, def) { chapters[id] = def; renderMenu(); return api; },
    status: function (id) { return progress(id); },
    isFinished: function (id) { return !!FINISHED[progress(id).status]; },
    tour: function (id, opts) {
      var def = chapters[id];
      if (!def || !def.steps) return false;
      var p = progress(id);
      if (!(opts && opts.force) && (FINISHED[p.status] || p.status === 'paused')) return false;
      if (current) hide(false);
      if (p.status === 'new') setStatus(id, 'active');
      var start = 0;
      while (start < def.steps.length - 1 && p.seen.indexOf(def.steps[start].key) >= 0 && !(opts && opts.force)) start++;
      current = { id: id, mode: 'tour', steps: def.steps, index: start - 1, step: def.steps[Math.max(0, start - 1)] };
      current.done = true;
      go(start);
      return true;
    },
    /** One contextual note, shown the first time only, never while the chapter is paused or finished. */
    hint: function (id, key, step, opts) {
      var p = progress(id);
      if (FINISHED[p.status] || p.status === 'paused' || p.seen.indexOf(key) >= 0) return false;
      if (current && current.mode === 'tour') return false;   // never stack on a running tour
      step = Object.assign({ key: key }, step);
      return present({ id: id, mode: 'hint', steps: [step], index: 0, step: step, focus: !(opts && opts.quiet), onClose: opts && opts.onClose });
    },
    seen: function (id, key) { return progress(id).seen.indexOf(key) >= 0; },
    mark: function (id, key) { markSeen(id, key); },
    pause: pause, skip: skip, close: function () { if (current && current.mode === 'hint') finishStep(true); else hide(true); },
    reset: reset,
    openMenu: openMenu,
    active: function () { return current ? { chapter: current.id, step: current.step.key } : null; },
    onChange: function (fn) { listeners.push(fn); },
    toast: toast
  };
  window.IridescentlyGuide = api;
})();
