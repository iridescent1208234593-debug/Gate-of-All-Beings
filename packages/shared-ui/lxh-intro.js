/* Shared intro controls used by the Cards gate and Huiguan homepage. */
(function (root) {
  'use strict';

  function clamp(value, max) {
    return Math.max(0, Math.min(Number(max) || 0, Number(value) || 0));
  }

  function formatTime(value) {
    var seconds = Math.floor(Math.max(0, Number(value) || 0));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }

  function progress(value, duration) {
    return duration > 0 ? clamp(value, duration) / duration : 0;
  }

  function syncProgress(range, value, duration) {
    if (!range) return;
    var safeDuration = Math.max(0.001, Number(duration) || 0.001);
    var safeValue = clamp(value, safeDuration);
    range.max = String(safeDuration);
    range.value = String(safeValue);
    range.style.setProperty('--lxh-intro-progress', (progress(safeValue, safeDuration) * 100) + '%');
    range.setAttribute('aria-valuetext', formatTime(safeValue) + ' / ' + formatTime(safeDuration));
  }

  function bindSeek(range, handlers) {
    if (!range) return function () {};
    handlers = handlers || {};
    var active = false;
    function start(event) {
      if (active) return;
      active = true;
      if (handlers.start) handlers.start(event);
    }
    function input(event) {
      start(event);
      if (handlers.input) handlers.input(Number(range.value), event);
    }
    function end(event) {
      if (!active) return;
      active = false;
      if (handlers.end) handlers.end(event);
    }
    range.addEventListener('pointerdown', start);
    range.addEventListener('keydown', start);
    range.addEventListener('input', input);
    range.addEventListener('change', end);
    range.addEventListener('keyup', end);
    range.addEventListener('blur', end);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    return function () {
      range.removeEventListener('pointerdown', start);
      range.removeEventListener('keydown', start);
      range.removeEventListener('input', input);
      range.removeEventListener('change', end);
      range.removeEventListener('keyup', end);
      range.removeEventListener('blur', end);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
    };
  }

  function bindSkip(button, onSkip) {
    if (!button || typeof onSkip !== 'function') return function () {};
    var click = function (event) {
      event.preventDefault();
      if (!button.disabled) onSkip(event);
    };
    button.addEventListener('click', click);
    return function () { button.removeEventListener('click', click); };
  }

  root.LXHIntro = { formatTime: formatTime, progress: progress, syncProgress: syncProgress, bindSeek: bindSeek, bindSkip: bindSkip };
})(window);
