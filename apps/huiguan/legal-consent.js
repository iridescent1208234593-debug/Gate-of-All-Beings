/* 《用户须知》《隐私政策》：勾选同意、弹窗阅读全文、向服务端记录同意的版本。
 *
 *   HuiguanLegal.mount(el, { context })  在 el 里放一个必勾的同意框，返回 { checked(), nudge(), reset() }
 *   HuiguanLegal.open('terms' | 'privacy')  弹窗阅读全文（只读）
 *   HuiguanLegal.ensureAccepted({ context, lead, force })  弹窗读完并勾选后才 resolve(true)；已同意当前版本则直接 true
 *   HuiguanLegal.requireForAccount()  已登录但未同意当前版本：强制弹窗，只能同意或退出登录
 *   <script src="legal-consent.js" data-require-consent>  页面载入时自动执行 requireForAccount()
 *   HuiguanLegal.accept(context)  登录用户记录同意（POST /api/legal/accept）
 *   HuiguanLegal.version()  当前版本号（GET /api/legal，带缓存）
 *
 * 全文来自同源的 /terms.html、/privacy.html 的 .legal-body，页面是唯一文本来源。
 * 样式在 legal.css。服务端契约见 services/platform/legal_consent.py。
 */
(function () {
  'use strict';
  if (window.HuiguanLegal) return;

  var DOCS = { terms: { title: '用户须知', url: '/terms.html' }, privacy: { title: '隐私政策', url: '/privacy.html' } };
  var statusPromise = null;
  var docCache = {};
  var reader = null;

  function status(refresh) {
    if (!statusPromise || refresh) {
      statusPromise = fetch('/api/legal', { credentials: 'same-origin', cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('legal ' + r.status); return r.json(); })
        .catch(function (error) { statusPromise = null; throw error; });
    }
    return statusPromise;
  }
  function version() { return status().then(function (s) { return s.legal_version; }); }

  function accept(context) {
    return version().then(function (v) {
      return fetch('/api/legal/accept', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ legal_version: v, context: context || '' })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok || !d.ok) { var e = new Error(d.error || '同意记录保存失败，请重试'); e.status = r.status; throw e; }
          statusPromise = Promise.resolve(d);
          return d;
        });
      });
    });
  }

  // Pages that only opt in to the account gate may not link legal.css themselves.
  function ensureStyles() {
    if (document.querySelector('link[href*="legal.css"]')) return;
    var link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/legal.css?v=20261106';
    document.head.appendChild(link);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function label(onToggle, onOpen) {
    var wrap = el('label', 'legal-check');
    var box = el('input'); box.type = 'checkbox'; box.required = true;
    var span = el('span');
    span.appendChild(document.createTextNode('我已阅读并同意'));
    ['terms', 'privacy'].forEach(function (key, i) {
      if (i) span.appendChild(document.createTextNode('和'));
      var link = el('button', '', '《' + DOCS[key].title + '》'); link.type = 'button';
      link.addEventListener('click', function (event) { event.preventDefault(); (onOpen || open)(key); });
      span.appendChild(link);
    });
    wrap.appendChild(box); wrap.appendChild(span);
    box.addEventListener('change', function () { wrap.classList.remove('is-missing'); if (onToggle) onToggle(box.checked); });
    return { node: wrap, box: box };
  }

  function mount(container, options) {
    if (!container) return null;
    options = options || {};
    ensureStyles();
    var made = label(options.onChange);
    container.innerHTML = '';
    container.appendChild(made.node);
    return {
      checked: function () { return made.box.checked; },
      nudge: function () {
        made.node.classList.remove('is-missing'); void made.node.offsetWidth; made.node.classList.add('is-missing');
        made.box.focus();
      },
      reset: function () { made.box.checked = false; made.node.classList.remove('is-missing'); }
    };
  }

  function loadDoc(key) {
    if (!docCache[key]) {
      docCache[key] = fetch(DOCS[key].url, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error('doc ' + r.status);
        return r.text();
      }).then(function (html) {
        var parsed = new DOMParser().parseFromString(html, 'text/html');
        var body = parsed.querySelector('.legal-body');
        if (!body) throw new Error('doc body missing');
        // Anchors inside the dialog would scroll the host page; open them in the full page instead.
        body.querySelectorAll('a[href]').forEach(function (a) {
          var href = a.getAttribute('href');
          if (href.charAt(0) === '#') a.setAttribute('href', DOCS[key].url + href);
          a.target = '_blank'; a.rel = 'noopener';
        });
        if (window.IridescentlyDomains) {
          body.querySelectorAll('[data-site-service]').forEach(function (a) {
            a.setAttribute('href', window.IridescentlyDomains.url(a.dataset.siteService, a.dataset.sitePath || '/'));
          });
        }
        return body;
      }).catch(function (error) { delete docCache[key]; throw error; });
    }
    return docCache[key].then(function (body) { return body.cloneNode(true); });
  }

  function buildReader() {
    ensureStyles();
    var root = el('div', 'legal-reader'); root.hidden = true;
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', '用户须知与隐私政策');
    var box = el('div', 'legal-reader__box');
    var head = el('div', 'legal-reader__head');
    var tabs = el('div', 'legal-reader__tabs'); tabs.setAttribute('role', 'tablist');
    var tabButtons = {};
    Object.keys(DOCS).forEach(function (key) {
      var b = el('button', '', DOCS[key].title); b.type = 'button'; b.setAttribute('role', 'tab');
      b.addEventListener('click', function () { show(key); });
      tabs.appendChild(b); tabButtons[key] = b;
    });
    var openFull = el('a', 'legal-reader__open', '在新页面打开 ↗'); openFull.target = '_blank'; openFull.rel = 'noopener';
    var close = el('button', 'legal-reader__close', '×'); close.type = 'button'; close.setAttribute('aria-label', '关闭');
    head.appendChild(tabs); head.appendChild(openFull); head.appendChild(close);
    var scroll = el('div', 'legal-reader__scroll'); scroll.tabIndex = 0;
    var foot = el('div', 'legal-reader__foot'); foot.hidden = true;
    var check = label(function (on) { agree.disabled = !on; }, function (key) { show(key); });
    var actions = el('div', 'legal-reader__actions');
    var later = el('button', 'legal-reader__later', '暂不同意'); later.type = 'button';
    var agree = el('button', 'legal-reader__agree', '同意并继续'); agree.type = 'button'; agree.disabled = true;
    var msg = el('p', 'legal-reader__msg'); msg.setAttribute('role', 'alert');
    actions.appendChild(later); actions.appendChild(agree);
    foot.appendChild(check.node); foot.appendChild(actions); foot.appendChild(msg);
    box.appendChild(head); box.appendChild(scroll); box.appendChild(foot); root.appendChild(box);
    document.body.appendChild(root);

    var current = null, lead = '', pending = null, lastFocus = null;
    function show(key) {
      current = key;
      Object.keys(tabButtons).forEach(function (k) { tabButtons[k].setAttribute('aria-selected', String(k === key)); });
      openFull.href = DOCS[key].url;
      scroll.innerHTML = '';
      if (lead) scroll.appendChild(el('p', 'legal-reader__lead', lead));
      var loading = el('p', 'qc-hint', '正在载入《' + DOCS[key].title + '》…');
      scroll.appendChild(loading);
      scroll.scrollTop = 0;
      loadDoc(key).then(function (body) {
        if (current !== key) return;
        loading.remove(); scroll.appendChild(body);
      }).catch(function () {
        if (current !== key) return;
        loading.textContent = '载入失败。可以点右上角「在新页面打开」阅读全文。';
      });
    }
    function finish(result) {
      // Forced consent (logged-in Account without the current version) closes only by agreeing or logging out.
      if (!result && root.dataset.force === '1') return;
      root.hidden = true;
      document.removeEventListener('keydown', onKey, true);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
      var resolve = pending; pending = null;
      if (resolve) resolve(result);
    }
    function onKey(event) { if (event.key === 'Escape') { event.stopPropagation(); finish(false); } }
    close.addEventListener('click', function () { finish(false); });
    later.addEventListener('click', function () {
      if (root.dataset.force === '1') { location.href = '/api/logout'; return; }
      finish(false);
    });
    root.addEventListener('click', function (event) { if (event.target === root) finish(false); });
    agree.addEventListener('click', function () {
      if (!check.box.checked) return;
      var ctx = root.dataset.context || '';
      agree.disabled = true; msg.textContent = '';
      var save = root.dataset.loggedIn === '1' ? accept(ctx) : Promise.resolve(null);
      save.then(function () { finish(true); }).catch(function (error) {
        msg.textContent = error.message || '保存失败，请重试'; agree.disabled = false;
      });
    });
    return {
      open: function (key, options) {
        options = options || {};
        lead = options.lead || '';
        lastFocus = document.activeElement;
        foot.hidden = !options.consent;
        check.box.checked = false; agree.disabled = true; msg.textContent = '';
        root.dataset.context = options.context || '';
        root.dataset.loggedIn = options.loggedIn ? '1' : '';
        root.dataset.force = options.force ? '1' : '';
        close.hidden = !!options.force;
        later.textContent = options.force ? '不同意并退出登录' : '暂不同意';
        root.hidden = false;
        document.addEventListener('keydown', onKey, true);
        show(key || 'terms');
        (options.force ? check.box : close).focus();
        return new Promise(function (resolve) { if (pending) pending(false); pending = resolve; });
      }
    };
  }

  function open(key) {
    if (!reader) reader = buildReader();
    return reader.open(key, {});
  }

  /** Shows the consent dialog unless the logged-in Account already agreed to the current version; resolves true once agreed.
   *  options.force: only agreeing or logging out closes it (used for logged-in Accounts). */
  function ensureAccepted(options) {
    options = options || {};
    return status(true).then(function (s) {
      if (s.logged_in && s.is_accepted) return true;
      if (options.loggedInOnly && !s.logged_in) return true;
      if (!reader) reader = buildReader();
      return reader.open('terms', { consent: true, context: options.context, lead: options.lead, loggedIn: s.logged_in,
                                    force: !!options.force && s.logged_in });
    });
  }

  var FORCED_LEAD = '会馆的《用户须知》和《隐私政策》已于 2026 年 11 月 6 日生效。继续使用账号前，请阅读并勾选同意；不同意可以退出登录，以访客身份浏览。';
  /** Logged-in Accounts must agree before using the account; visitors are not interrupted. */
  function requireForAccount() {
    if (window.self !== window.top) return Promise.resolve(true);  // embedded previews never gate
    return ensureAccepted({ context: 'reconsent', lead: FORCED_LEAD, force: true, loggedInOnly: true }).catch(function () { return false; });
  }
  // Pages opt in with <script src="legal-consent.js" data-require-consent>.
  var selfScript = document.currentScript;
  if (selfScript && selfScript.hasAttribute('data-require-consent')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', requireForAccount);
    else requireForAccount();
  }

  // On the reading pages: highlight the section in view in the table of contents.
  function tocSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.legal-toc a[href^="#"]'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('is-active'); });
        var a = byId[entry.target.id]; if (a) a.classList.add('is-active');
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    Object.keys(byId).forEach(function (id) { var s = document.getElementById(id); if (s) observer.observe(s); });
    if (window.matchMedia('(max-width: 820px)').matches) {
      var details = document.querySelector('.legal-toc details');
      if (details) details.open = false;
    }
  }
  if (document.body && document.body.classList.contains('legal-page')) tocSpy();
  else document.addEventListener('DOMContentLoaded', function () { if (document.body.classList.contains('legal-page')) tocSpy(); });

  window.HuiguanLegal = { mount: mount, open: open, ensureAccepted: ensureAccepted, requireForAccount: requireForAccount, accept: accept, version: version, status: status };
})();
