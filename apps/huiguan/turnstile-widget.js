// Cloudflare Turnstile for the account forms. The server says whether it is enabled
// (GET /api/turnstile returns the public site key or null); the secret never reaches the page.
(function () {
  var SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var config = null, loading = null, widget = null, rendered = '', current = '';

  function siteKey() {
    if (!config) config = fetch('/api/turnstile', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (d) { return d.siteKey || ''; }, function () { return ''; });
    return config;
  }

  function loadScript() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (!loading) loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = SCRIPT; s.async = true;
      s.onload = function () { resolve(window.turnstile); };
      s.onerror = function () { loading = null; reject(new Error('Turnstile script failed to load')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  // Render into container; later calls for the same action only reset the existing widget.
  // The server binds each token to its endpoint's action, so another action re-renders it.
  function mount(container, action) {
    if (!container) return Promise.resolve(false);
    return siteKey().then(function (key) {
      if (!key) { container.hidden = true; return false; }
      container.hidden = false;
      if (widget !== null && rendered === action) { reset(); return true; }
      return loadScript().then(function (ts) {
        if (widget !== null) { ts.remove(widget); widget = null; }
        current = '';
        rendered = action;
        widget = ts.render(container, {
          sitekey: key, action: action,
          callback: function (token) { current = token; },
          'expired-callback': function () { current = ''; },
          'error-callback': function () { current = ''; }
        });
        return true;
      });
    });
  }

  // Before a submission: "off" when Turnstile is not enabled, "ready" when the widget already
  // serves this action (send token()), "pending" when it was just switched to this action and
  // the visitor has to complete it first.
  function ensure(container, action) {
    return siteKey().then(function (key) {
      if (!key) return 'off';
      if (widget !== null && rendered === action) return 'ready';
      return mount(container, action).then(function () { return 'pending'; });
    });
  }

  function token() { return current; }

  // Tokens are single-use: reset after every submission, successful or not.
  function reset() {
    current = '';
    if (widget !== null && window.turnstile) window.turnstile.reset(widget);
  }

  window.HuiguanTurnstile = { mount: mount, ensure: ensure, token: token, reset: reset };
})();
