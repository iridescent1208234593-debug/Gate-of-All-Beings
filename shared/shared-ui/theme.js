/*
 * 全站主题内核：light / dark / auto 三态，cookie 跨子站同步。
 *
 *   - 偏好存在 cookie `hx_theme`（light|dark|auto，缺省 auto = 跟随系统），
 *     在同一批准根域（见 shared/site-domains.json）的子站间共享；本地开发时退化为当前域 cookie。
 *   - 最终生效主题写到 <html data-theme="light|dark">，CSS 侧沿用
 *     `[data-theme="dark"]` 令牌覆盖（见 world-map/style.css、connections.css）。
 *   - auto 状态监听 prefers-color-scheme 变化，实时跟随系统。
 *
 * 用法（普通 script，提供 window.XTheme）：
 *   <script>/* 防闪烁片段，见 XTheme.HEAD_SNIPPET *&#47;</script>
 *   <script src="/shared/shared-ui/theme.js"></script>
 *   XTheme.toggleTwoState();            // 两态按钮：dark↔light，自动脱离跟随系统
 *   XTheme.set('auto');                 // 回到跟随系统
 *   XTheme.migrateLegacy('fantasy-map-theme');  // 旧 localStorage 二值迁入 cookie
 *
 * 变更时派发 document 事件 `xthemechange`：
 *   detail = { stored, resolved, system }（stored: 用户偏好，resolved: 当前生效）
 */
(function (global) {
  'use strict';

  var COOKIE = 'hx_theme';
  var VALID = ['light', 'dark', 'auto'];
  var MEDIA = global.matchMedia
    ? global.matchMedia('(prefers-color-scheme: dark)')
    : null;

  function readCookie() {
    var match = document.cookie.match(
      new RegExp('(?:^|;\\s*)' + COOKIE + '=(light|dark|auto)')
    );
    return match ? match[1] : null;
  }

  function writeCookie(preference) {
    var hostname = global.location.hostname;
    var parts = [
      COOKIE + '=' + preference,
      'path=/',
      'max-age=31536000',
      'samesite=lax',
    ];
    var root = global.IridescentlyDomains && global.IridescentlyDomains.rootFor(hostname);
    if (root) parts.push('domain=.' + root);
    if (global.location.protocol === 'https:') parts.push('secure');
    document.cookie = parts.join('; ');
  }

  function stored() {
    var value = readCookie();
    return VALID.indexOf(value) !== -1 ? value : 'auto';
  }

  function systemPrefersDark() {
    return MEDIA ? MEDIA.matches : false;
  }

  function resolved(storedPreference) {
    var preference = storedPreference || stored();
    if (preference === 'auto') return systemPrefersDark() ? 'dark' : 'light';
    return preference;
  }

  function apply(preference) {
    var effective = resolved(preference);
    document.documentElement.dataset.theme = effective;
    return effective;
  }

  var mediaListener =
    'addEventListener' in (MEDIA || {})
      ? function (handler) {
          MEDIA.addEventListener('change', handler);
        }
      : function (handler) {
          if (MEDIA) MEDIA.addListener(handler);
        };

  mediaListener(function () {
    if (stored() !== 'auto') return; // 显式选择时系统变化不影响本页
    var effective = apply('auto');
    notify('auto', effective);
  });

  function notify(storedPreference, effective) {
    document.dispatchEvent(
      new CustomEvent('xthemechange', {
        detail: {
          stored: storedPreference,
          resolved: effective,
          system: systemPrefersDark() ? 'dark' : 'light',
        },
      })
    );
  }

  function set(preference) {
    if (VALID.indexOf(preference) === -1) return resolved();
    writeCookie(preference);
    var effective = apply(preference);
    notify(preference, effective);
    return effective;
  }

  /** 两态按钮：把当前生效主题翻到另一态（顺带脱离“跟随系统”）。 */
  function toggleTwoState() {
    var next = resolved() === 'dark' ? 'light' : 'dark';
    set(next);
    return next;
  }

  /** 旧版 localStorage 二值迁入 cookie；仅在用户还没有 cookie 偏好时生效。 */
  function migrateLegacy(key) {
    if (readCookie()) return;
    try {
      var legacy = global.localStorage.getItem(key);
      if (legacy === 'dark' || legacy === 'light') set(legacy);
      else if (legacy !== null) global.localStorage.removeItem(key);
    } catch (error) {
      /* 存储不可用时静默，保持系统跟随 */
    }
  }

  global.XTheme = {
    stored: stored,
    resolved: function () {
      return resolved();
    },
    systemPrefersDark: systemPrefersDark,
    set: set,
    toggleTwoState: toggleTwoState,
    migrateLegacy: migrateLegacy,
    // 供构建脚本取用的防闪烁片段（head 内联，渲染前定 data-theme，避免 FOUC）。
    HEAD_SNIPPET:
      '(function(){try{' +
      'var m=document.cookie.match(/(?:^|;\\s*)hx_theme=(light|dark|auto)/);' +
      "var p=m?m[1]:'auto';" +
      "var t=p==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;" +
      'document.documentElement.dataset.theme=t;' +
      '}catch(e){}})();',
  };
})(window);
