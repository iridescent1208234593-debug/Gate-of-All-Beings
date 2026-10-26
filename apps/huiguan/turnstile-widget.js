// Cloudflare Turnstile for the account forms. The server says whether it is enabled
// (GET /api/turnstile returns the public site key or null); the secret never reaches the page.
(function () {
  var SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var config = null, loading = null, widget = null, current = '';

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

  // Render once into container; later calls only reset the existing widget.
  function mount(container, action) {
    if (!container) return Promise.resolve(false);
    return siteKey().then(function (key) {
      if (!key) { container.hidden = true; return false; }
      container.hidden = false;
      if (widget !== null) { reset(); return true; }
      return loadScript().then(function (ts) {
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

  function token() { return current; }

  // Tokens are single-use: reset after every submission, successful or not.
  function reset() {
    current = '';
    if (widget !== null && window.turnstile) window.turnstile.reset(widget);
  }

  window.HuiguanTurnstile = { mount: mount, token: token, reset: reset };
})();
