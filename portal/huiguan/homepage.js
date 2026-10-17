/* One composition clock; media time remains independent of page scroll. */
(function () {
  'use strict';
  var flow = document.getElementById('homeFlow');
  var stage = flow && flow.querySelector('.home-flow-stage');
  var heroArea = flow && flow.querySelector('.home-hero-area');
  var hero = document.getElementById('gateHero');
  if (!flow || !stage || !hero) return;
  document.body.classList.add('huiguan-homepage');
  var archive = document.getElementById('archiveRoom');
  var grid = flow.querySelector('.archive-door-grid');
  var registration = document.getElementById('characterRegistration');
  var registrationMount = document.getElementById('registrationMount');
  var preview = registrationMount.querySelector('.registration-preview');
  var boot = document.getElementById('homeBoot');
  var video = document.getElementById('gateFallbackVideo');
  var host = hero.querySelector('.gate-canvas-host');
  var ui = document.createElement('div');
  ui.className = 'gate-ui';
  heroArea.appendChild(ui);
  ui.appendChild(hero.querySelector('.gate-theme-controls'));
  ui.appendChild(hero.querySelector('.gate-controls'));
  var rotationHint = document.createElement('p');
  rotationHint.className = 'gate-rotation-hint';
  rotationHint.textContent = mobileHint();
  rotationHint.hidden = true;
  ui.appendChild(rotationHint);
  var toggle = document.getElementById('gatePlayToggle');
  var range = document.getElementById('gateProgress');
  var reset = document.getElementById('archiveReset');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobile = matchMedia('(max-width: 700px)');
  var INTRO_KEY = 'huiguan.model-intro.v2';
  var state = { phase: 'loading', selected: null, browsing: false, progress: 0, intro: 1 };
  var scene;
  var duration = 6;
  var introStop = 3.67;
  var firstIntroFinished = false;
  var hasRotated = false;
  try { hasRotated = localStorage.getItem('huiguan.model-rotated.v1') === '1'; } catch (error) {}
  var playing = false;
  var seeking = false;
  var resumeSeek = false;
  var resumeHidden = false;
  var disposed = false;
  var cleanups = [];
  var readyCalled = false;
  var readyTimeout = 0;
  var raf = 0;
  var lastTick = 0;
  var settleStart = 0;
  var geometry = {};
  var previousVars;
  var themeSyncing = false;
  var themeOriginal = window.applyFormTheme;
  var schemeByTheme = { original: '深绿×暖黄', emerald: '水绿×葱青', twilight: '无限·靛蓝×银白', golden: '黛蓝×缃色', cyber: '绛紫×月白' };
  var vars = ['--bg','--surface','--surface-hover','--paper','--border','--accent','--accent-glow','--gold','--gold-dim','--text','--text-dim','--outline','--btn-text','--accent-hover'];

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    cleanups.push(function () { target.removeEventListener(type, handler, options); });
  }
  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function mobileHint() { return matchMedia('(max-width: 700px)').matches ? '左右拖动旋转模型 · 上下滑动浏览' : '拖动，可旋转模型'; }
  function ease(value) { return 1 - Math.pow(1 - clamp(value), 3); }
  function timeLabel(value) { return window.LXHIntro.formatTime(value); }
  function currentTime() { return scene ? scene.getTime() : video.currentTime || 0; }
  function setPlaying(value) {
    playing = value;
    var ended = currentTime() >= duration - .001;
    toggle.textContent = value ? 'Ⅱ' : ended ? '↺' : '▷';
    toggle.setAttribute('aria-label', value ? '暂停开屏动画' : ended ? '重新播放开屏动画' : '播放开屏动画');
    toggle.setAttribute('aria-pressed', String(value));
  }
  function pause() { if (scene) scene.pause(); else video.pause(); setPlaying(false); }
  function seek(value) {
    var time = Math.max(0, Math.min(duration, Number(value) || 0));
    if (scene) scene.seek(time); else video.currentTime = time;
    updateTime(time);
  }
  function play() {
    if (disposed) return;
    if (currentTime() >= duration - .001) seek(0);
    if (scene) scene.play();
    else { var promise = video.play(); if (promise) promise.catch(function () { setPlaying(false); }); }
    setPlaying(true);
  }
  function updateTime(time) {
    document.getElementById('gateCurrentTime').textContent = timeLabel(time);
    window.LXHIntro.syncProgress(range, time, duration);
    if (state.phase === 'intro' && time >= introStop) {
      pause();
      transition('INTRO_END');
    }
    if (time >= duration - .001) {
      setPlaying(false);
      if (state.phase === 'intro') transition('INTRO_END');
    }
  }

  function measure() {
    var height = heroArea.clientHeight;
    geometry = {
      width: stage.clientWidth, height: height,
      frameWidth: Math.min(stage.clientWidth * (mobile.matches ? .96 : .9), height * 16 / 9 * .78, 1180),
      travel: height * .65,
      flowTop: flow.getBoundingClientRect().top + scrollY,
      archiveTop: archive.getBoundingClientRect().top + scrollY,
    };
    geometry.frameHeight = geometry.frameWidth * 9 / 16;
    geometry.introScale = mobile.matches
      ? Math.min(innerWidth / geometry.frameWidth, innerHeight / geometry.frameHeight)
      : Math.max(innerWidth / geometry.frameWidth, innerHeight / geometry.frameHeight);
    flow.style.setProperty('--home-travel', geometry.travel + 'px');
    hero.style.width = geometry.frameWidth + 'px';
    hero.style.height = geometry.frameHeight + 'px';
    if (scene) scene.resize();
    render();
  }

  function render() {
    // Normal document flow reveals the archive. Only a small downward translation follows scroll.
    // The model and controls retain their size; the scene's measured centre projects to (0.5,0.5).
    var y = geometry.height * .5 + (reduced ? 0 : ease(state.progress) * Math.min(80, geometry.height * .12));
    y += (innerHeight / 2 - y) * state.intro;
    var scale = 1 + (geometry.introScale - 1) * state.intro;
    hero.style.transform = 'translate3d(-50%, -50%, 0) scale(' + scale.toFixed(6) + ')';
    hero.style.top = y.toFixed(3) + 'px';
    ui.style.width = (geometry.frameWidth + (innerWidth - geometry.frameWidth) * state.intro).toFixed(3) + 'px';
    ui.style.height = (geometry.frameHeight + (innerHeight - geometry.frameHeight) * state.intro).toFixed(3) + 'px';
    ui.style.top = y.toFixed(3) + 'px';
    rotationHint.hidden = !scene || !firstIntroFinished || hasRotated || state.intro > 0;
    var registrationVisible = state.selected === 'character' || (!state.selected && state.browsing);
    registration.hidden = !registrationVisible;
    preview.hidden = registrationVisible;
    grid.dataset.registrationBrowsing = String(state.browsing);
    var available = state.phase !== 'intro' && state.phase !== 'settling' && state.phase !== 'loading';
    archive.inert = !available;
    archive.setAttribute('aria-hidden', String(!available));
    flow.dataset.homeState = state.phase;
    flow.style.setProperty('--intro-opacity', state.intro.toFixed(5));
  }

  function frame(now) {
    raf = 0;
    if (disposed || document.hidden) return;
    var dt = lastTick ? Math.min(now - lastTick, 64) : 16;
    lastTick = now;
    if (state.phase === 'settling') {
      if (!settleStart) settleStart = now;
      state.intro = 1 - ease((now - settleStart) / 1050);
      if (state.intro < .0001) { state.intro = 0; transition('HERO'); }
    } else if (state.phase !== 'intro' && state.phase !== 'loading' && !state.selected) {
      var target = clamp((scrollY - geometry.flowTop) / geometry.travel);
      state.progress += (target - state.progress) * (reduced ? 1 : 1 - Math.exp(-dt / 105));
      if (Math.abs(state.progress - target) < .0005 || target === 0 || target === 1) state.progress = target;
      state.phase = state.progress >= .7 ? 'archive' : 'hero';
    }
    render();
    var target = clamp((scrollY - geometry.flowTop) / geometry.travel);
    if (state.phase === 'settling' || (!state.selected && state.phase !== 'intro' && state.phase !== 'loading' && Math.abs(state.progress - target) >= .0005)) schedule();
  }
  function schedule() { if (!raf && !disposed && !document.hidden) raf = requestAnimationFrame(frame); }

  function transition(event, value, options) {
    if (event === 'INTRO_END') {
      try { sessionStorage.setItem(INTRO_KEY, '1'); } catch (error) {}
      state.phase = reduced ? 'hero' : 'settling'; settleStart = 0;
      if (reduced) state.intro = 0;
    }
    if (event === 'HERO') {
      state.phase = state.selected ? 'active' : 'hero'; state.intro = 0; firstIntroFinished = true;
      document.body.classList.remove('home-intro');
    }
    if (event === 'BROWSE') { state.browsing = true; state.phase = 'archive'; }
    if (event === 'SELECT' || event === 'CLOSE') {
      var old = state.selected;
      state.selected = event === 'SELECT' ? value : null;
      state.browsing = state.selected === 'character';
      state.phase = state.selected ? 'active' : 'archive';
      state.progress = 1;
      flow.classList.toggle('has-active-archive', !!state.selected);
      if (state.selected) grid.dataset.selected = state.selected; else delete grid.dataset.selected;
      delete grid.dataset.focus;
      reset.hidden = !state.selected;
      grid.querySelectorAll('.archive-door').forEach(function (door) {
        var active = door.dataset.door === state.selected;
        door.querySelector('.door-main').setAttribute('aria-expanded', String(active));
        door.querySelector('.archive-body').inert = !!state.selected && !active;
      });
      if (registration.parentNode !== registrationMount) registrationMount.appendChild(registration);
      if (location.hash === '#charForm' || state.selected === 'character') history.replaceState(null, '', state.selected === 'character' ? '#charForm' : location.pathname + location.search);
      if (!options || options.scroll !== false) window.scrollTo({ top: geometry.archiveTop - 76, behavior: reduced ? 'instant' : 'smooth' });
      if (event === 'CLOSE' && old) grid.querySelector('[data-door="' + old + '"] .door-main').focus({ preventScroll: true });
    }
    render(); schedule();
  }

  function setTheme(id, syncPage) {
    if (scene) scene.setTheme(id);
    ui.querySelectorAll('.gate-dot').forEach(function (button) {
      var on = button.dataset.theme === id;
      button.classList.toggle('on', on); button.setAttribute('aria-pressed', String(on));
    });
    document.documentElement.dataset.homeTheme = id;
    if (!syncPage || typeof COLOR_SCHEMES === 'undefined' || !themeOriginal) return;
    if (!previousVars) { previousVars = {}; vars.forEach(function (key) { previousVars[key] = document.documentElement.style.getPropertyValue(key); }); }
    var scheme = COLOR_SCHEMES.find(function (scheme) { return scheme.name === schemeByTheme[id]; });
    if (scheme) { themeSyncing = true; themeOriginal(scheme); themeSyncing = false; }
  }
  function clearTheme() {
    if (previousVars) vars.forEach(function (key) {
      if (previousVars[key]) document.documentElement.style.setProperty(key, previousVars[key]);
      else document.documentElement.style.removeProperty(key);
    });
    previousVars = null;
  }
  window.__gateSetTheme = setTheme; window.__gateClearTheme = clearTheme;
  if (themeOriginal) window.applyFormTheme = function (scheme) {
    themeOriginal.apply(this, arguments);
    if (themeSyncing || !scheme) return;
    var id = Object.keys(schemeByTheme).find(function (id) { return schemeByTheme[id] === scheme.name; });
    if (id) setTheme(id, false);
  };

  flow.classList.add('is-enhanced');
  measure();
  var lib = window.LXHGate;
  if (lib && lib.hasWebGL()) scene = lib.createScene(host, {
    theme: 'original', loop: false, loopStart: 0, autoplay: false,
    interactive: true, scrollFriendly: true, centerModel: true, pixelRatio: mobile.matches ? 1.25 : 1.5,
    onFrame: function (info) { updateTime(info.t); },
    onRotate: function () {
      if (hasRotated) return;
      hasRotated = true; rotationHint.hidden = true;
      try { localStorage.setItem('huiguan.model-rotated.v1', '1'); } catch (error) {}
    }
  });
  if (scene) hero.classList.add('gate-mode');
  else hero.classList.add('gate-fallback');
  range.max = duration; document.getElementById('gateTotalTime').textContent = timeLabel(duration);
  var played = false;
  try { played = sessionStorage.getItem(INTRO_KEY) === '1'; } catch (error) {}
  var initialForm = location.hash === '#charForm';
  firstIntroFinished = played || reduced;
  introStop = lib && lib.GATE_FULLY_OPEN_AT || introStop;
  function ready(fallbackUnavailable) {
    if (disposed || readyCalled) return;
    readyCalled = true;
    clearTimeout(readyTimeout);
    var skipIntro = reduced || played || initialForm || fallbackUnavailable === true;
    state.phase = skipIntro ? 'hero' : 'intro';
    state.intro = state.phase === 'intro' ? 1 : 0;
    document.body.classList.toggle('home-intro', state.phase === 'intro');
    if (skipIntro) seek(duration);
    render();
    boot.hidden = true; document.documentElement.classList.remove('home-booting');
    if (state.phase === 'intro') play();
    if (initialForm) transition('SELECT', 'character');
    schedule();
  }
  if (scene) requestAnimationFrame(ready);
  else {
    // Register before load: a cached response can complete immediately. A stalled
    // fallback must not keep the archive hidden indefinitely.
    listen(video, 'loadeddata', ready, { once: true });
    listen(video, 'error', function () { ready(true); }, { once: true });
    readyTimeout = setTimeout(function () { ready(video.readyState < 2); }, 8000);
    cleanups.push(function () { clearTimeout(readyTimeout); });
    video.preload = 'auto';
    video.load();
  }
  setTheme('original', true);

  listen(window, 'scroll', schedule, { passive: true });
  listen(window, 'resize', function () { measure(); schedule(); }, { passive: true });
  if (window.ResizeObserver) {
    var navObserver = new ResizeObserver(function () { measure(); schedule(); });
    var nav = document.getElementById('qc-nav'); if (nav) navObserver.observe(nav);
    cleanups.push(function () { navObserver.disconnect(); });
  }
  toggle.title = '单击播放 / 暂停，双击重播全屏开场';
  listen(toggle, 'click', function (event) { if (event.detail < 2) playing ? pause() : play(); });
  listen(toggle, 'dblclick', function () {
    pause(); state.phase = reduced ? 'hero' : 'intro'; state.intro = reduced ? 0 : 1; state.progress = 0;
    document.body.classList.toggle('home-intro', !reduced);
    window.scrollTo({ top: geometry.flowTop, behavior: 'instant' });
    seek(0); render(); play();
  });
  function endSeek() { if (!seeking) return; seeking = false; if (resumeSeek && currentTime() < duration) play(); }
  cleanups.push(window.LXHIntro.bindSeek(range, {
    start: function () { seeking = true; resumeSeek = playing; pause(); },
    input: function (value) { seek(value); },
    end: endSeek
  }));
  cleanups.push(window.LXHIntro.bindSkip(document.getElementById('gateSkip'), function () {
    pause(); seek(duration); transition('HERO');
    try { sessionStorage.setItem(INTRO_KEY, '1'); } catch (error) {}
    window.scrollTo({ top: geometry.archiveTop - 76, behavior: reduced ? 'instant' : 'smooth' });
  }));
  listen(grid, 'click', function (event) {
    var button = event.target.closest('.door-main');
    if (!button) return;
    var key = button.closest('.archive-door').dataset.door;
    if (key === 'character' && !state.selected) transition('BROWSE');
    else transition('SELECT', key);
  });
  listen(grid, 'pointerover', function (event) {
    if (event.pointerType === 'touch') return;
    var door = event.target.closest('.archive-door');
    if (door) {
      if (state.selected) grid.dataset.edgeFocus = door.dataset.door;
      else grid.dataset.focus = door.dataset.door;
    }
  });
  listen(grid, 'pointerleave', function () { delete grid.dataset.focus; delete grid.dataset.edgeFocus; });
  listen(grid, 'focusin', function (event) {
    var door = event.target.closest('.archive-door');
    if (door) { if (state.selected) grid.dataset.edgeFocus = door.dataset.door; else grid.dataset.focus = door.dataset.door; }
  });
  listen(grid, 'focusout', function (event) { if (!grid.contains(event.relatedTarget)) { delete grid.dataset.focus; delete grid.dataset.edgeFocus; } });
  listen(reset, 'click', function () { transition('CLOSE'); });
  listen(document.getElementById('heroReturn'), 'click', function () {
    if (state.selected) transition('CLOSE');
    window.scrollTo({ top: geometry.flowTop, behavior: reduced ? 'instant' : 'smooth' });
  });
  listen(document, 'keydown', function (event) {
    if (event.key === 'Escape' && state.selected && document.getElementById('authMask').hidden) transition('CLOSE');
  });
  listen(document, 'huiguan:select-archive', function (event) {
    var value = event.detail;
    transition('SELECT', typeof value === 'string' ? value : value.key, typeof value === 'string' ? null : value);
  });
  listen(document, 'huiguan:browse-registration', function () { if (!state.selected) transition('BROWSE'); });
  listen(window, 'hashchange', function () { if (location.hash === '#charForm') transition('SELECT', 'character'); });
  ui.querySelectorAll('.gate-dot').forEach(function (button) { listen(button, 'click', function () { setTheme(button.dataset.theme, true); }); });
  if (!scene) { listen(video, 'timeupdate', function () { updateTime(video.currentTime); }); listen(video, 'loadedmetadata', function () { duration = video.duration || 6; range.max = duration; document.getElementById('gateTotalTime').textContent = timeLabel(duration); }); }
  listen(document, 'visibilitychange', function () {
    if (document.hidden) { resumeHidden = playing; pause(); if (raf) cancelAnimationFrame(raf); raf = 0; }
    else { lastTick = 0; schedule(); if (resumeHidden) { resumeHidden = false; play(); } }
  });
  if (window.IntersectionObserver) {
    var visibleObserver = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting && playing) pause();
    });
    visibleObserver.observe(hero); cleanups.push(function () { visibleObserver.disconnect(); });
  }
  // Read-only diagnostics for centre/lifecycle acceptance; no application state is stored here.
  window.huiguanHomepage = {
    inspect: function () { return { phase: state.phase, selected: state.selected, browsing: state.browsing, progress: state.progress, intro: state.intro, introStop: introStop, compositionRAF: !!raf, time: currentTime(), playing: playing, layout: scene && scene.getLayout() }; }
  };
  listen(window, 'pagehide', function () {
    if (disposed) return; disposed = true; pause(); cancelAnimationFrame(raf);
    if (scene) scene.destroy();
    cleanups.forEach(function (remove) { remove(); });
    clearTheme(); if (themeOriginal) window.applyFormTheme = themeOriginal;
    delete window.huiguanHomepage;
  }, { once: true });
})();
