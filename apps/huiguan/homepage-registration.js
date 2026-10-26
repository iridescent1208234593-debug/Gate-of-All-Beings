/* Scroll-led registration: reuse the existing form and keep document scrolling native. */
(function () {
  'use strict';
  var grid = document.querySelector('.archive-door-grid');
  var middle = grid && grid.querySelector('[data-door="character"]');
  var form = document.getElementById('charForm');
  var registration = document.getElementById('characterRegistration');
  var basic = document.getElementById('registrationBasics');
  var palette = document.getElementById('registrationPalette');
  if (!middle || !form || !basic || !palette) return;
  form.insertBefore(basic, palette);
  var mount = document.getElementById('registrationMount');
  mount.appendChild(registration);
  var hovered = false;
  var touchIntent = false;
  var boundaryNear = false;
  var lastScroll = scrollY;
  var cleanups = [];
  function listen(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    cleanups.push(function () { target.removeEventListener(type, callback, options); });
  }
  function browse() {
    if (grid.dataset.selected || grid.dataset.registrationBrowsing === 'true') return;
    document.dispatchEvent(new CustomEvent('huiguan:browse-registration'));
  }
  function focusRegistration() {
    if (grid.dataset.registrationBrowsing !== 'true' || grid.dataset.selected || !boundaryNear) return;
    if (!hovered && !touchIntent && !form.contains(document.activeElement)) return;
    document.dispatchEvent(new CustomEvent('huiguan:select-archive', { detail: { key: 'character', scroll: false } }));
  }
  listen(middle, 'pointerenter', function (event) { if (event.pointerType !== 'touch') hovered = true; });
  listen(middle, 'pointerleave', function (event) { if (event.pointerType !== 'touch') hovered = false; });
  listen(middle, 'pointerdown', function (event) { touchIntent = event.pointerType === 'touch'; });
  listen(document, 'pointerdown', function (event) { if (!middle.contains(event.target)) touchIntent = false; }, { passive: true });
  listen(middle, 'wheel', function (event) {
    if (event.deltaY > 0) { browse(); focusRegistration(); }
  }, { passive: true });
  listen(window, 'scroll', function () {
    if (scrollY > lastScroll && (hovered || touchIntent)) { browse(); focusRegistration(); }
    lastScroll = scrollY;
  }, { passive: true });
  var chapters = Array.from(form.children).filter(function (node) { return node.classList.contains('section'); });
  chapters.forEach(function (node) { node.classList.add('form-chapter'); });
  if (window.IntersectionObserver) {
    var reveal = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) entry.target.classList.add('is-revealed');
        else if (entry.boundingClientRect.top > innerHeight * .88) entry.target.classList.remove('is-revealed');
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });
    chapters.forEach(function (node) { reveal.observe(node); });
    var sentinel = document.createElement('span');
    sentinel.className = 'registration-boundary';
    sentinel.setAttribute('aria-hidden', 'true');
    basic.after(sentinel);
    var focus = new IntersectionObserver(function (entries) {
      boundaryNear = entries[0].isIntersecting || (entries[0].boundingClientRect.top < 0 && !registration.hidden);
      focusRegistration();
    }, { rootMargin: '0px 0px -35% 0px', threshold: 0 });
    focus.observe(sentinel);
    cleanups.push(function () { reveal.disconnect(); focus.disconnect(); });
  } else chapters.forEach(function (node) { node.classList.add('is-revealed'); });
  listen(form, 'focusin', function (event) {
    var chapter = event.target.closest('.form-chapter');
    if (chapter) chapter.classList.add('is-revealed');
    focusRegistration();
  });
  listen(window, 'pagehide', function () { cleanups.forEach(function (remove) { remove(); }); }, { once: true });
})();
