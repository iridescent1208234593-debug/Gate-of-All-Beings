/*
 * 西木会馆 · new-player guide chapters (runtime: /shared/shared-ui/guide.js).
 *
 *  world    认识世界 — a short walk once the opening has played: the gate, the hall, the
 *                      three archives, how to take part. Starts only after the opening ends.
 *  identity 建立身份 — contextual notes that appear the first time each thing is used:
 *                      account, the registration form, the first saved OC, the fan gallery.
 *  (life    开始生活 — lives in the LAB game itself.)
 *
 * The guide never opens a modal and never blocks the page. It replaces the old
 * on-load "先给你的创作留个归处" dialog and the static 新手指引 block in the form.
 */
(function () {
  'use strict';
  var G = window.IridescentlyGuide;
  if (!G) return;
  var page = document.body.getAttribute('data-guide-page') || 'hall';
  var mobile = function () { return innerWidth < 760; };
  function visible(sel) {
    var n = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!n) return null;
    var r = n.getBoundingClientRect(), cs = getComputedStyle(n);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' ? n : null;
  }
  function navSite(label) {
    // desktop shows site links in the bar; phones keep them inside 「更多」
    var bar = document.getElementById('qc-nav');
    var barBottom = bar ? bar.getBoundingClientRect().bottom + 2 : 80;
    var links = document.querySelectorAll('#qc-nav .qc-links > a');
    for (var i = 0; i < links.length; i++) {
      var r = links[i].getBoundingClientRect();
      if (links[i].textContent.indexOf(label) === 0 && visible(links[i]) && r.top >= 0 && r.bottom <= barBottom) return links[i];
    }
    return visible('#qc-nav .qc-more > summary');
  }
  function loginButton() { return visible('.btn-login') || visible('#qc-nav .qc-nav-slot'); }
  function signedIn() { return !!document.querySelector('.btn-logout'); }

  G.define('world', {
    title: '认识世界',
    summary: '众生之门、西木会馆，以及你能在这里做什么。',
    steps: [
      { key: 'gate', target: '#gateHero',
        title: '这扇门，叫众生之门',
        body: '门的那边，灵与万物一起生活。众生之门是会馆里的游戏：带着同行的灵出行、历练，把遇见的生灵记进手记。' },
      { key: 'hall', target: function () { return visible('#archiveRoom .archive-room-heading') || visible('#archiveRoom'); },
        title: '推开门，是西木会馆',
        body: '会馆是《罗小黑战记》同人共创的家。官方资料、大家的原创角色、同人作品，都收在这三扇档案门里。' },
      { key: 'official', target: '[data-door="official"]',
        title: '先认识原作里的大家',
        body: '官方角色档案收着原作角色的资料和关系图。想写同人，可以先来这里对一对设定。' },
      { key: 'register', target: '[data-door="character"]',
        title: '然后，写下你自己的角色',
        body: '给你的原创角色（OC）建一份档案：名字、样子、来历。登记以后，它就能在会馆和游戏里露面。',
        tryText: '第一次登记时，这点灵光会在表单旁陪你。' },
      { key: 'fan', target: '[data-door="fan"]',
        title: '大家的角色在这里相遇',
        body: '同人画廊收着审核通过、作者愿意公开的设表。逛一逛，遇到喜欢的就点个喜欢、留句话。' },
      { key: 'game', target: function () { return navSite('众生之门'); },
        title: '想进门看看，就从这里',
        body: mobile() ? '众生之门和节气画廊在「更多」里。游戏会先请你选好自己的样子再出发。' : '众生之门在顶栏。游戏会先请你选好自己的样子再出发。' },
      { key: 'together', target: function () { return visible('#qc-nav .qc-more > summary'); },
        title: '共创，人人都能来',
        body: '画画、写设定、做游戏素材、帮忙审核都可以。共创名录和联系方式在「更多 · 连接与鸣谢」；想再看一遍这段引导，也在「更多」里。' }
    ]
  });

  G.define('identity', {
    title: '建立身份',
    summary: '登录、登记你的角色、把它介绍给大家。用到时才出现。',
    required: ['account', 'oc-form', 'oc-saved', 'fan-gallery']
  });

  // ------------------------------------------------------------ hall (index.html)
  function hallHooks() {
    var flow = document.getElementById('homeFlow');
    var started = false;
    function ready() {
      var state = flow && flow.dataset.homeState;
      return state && state !== 'loading' && state !== 'intro' && state !== 'settling';
    }
    function maybeTour() {
      if (started || !ready()) return;
      if (document.querySelector('.auth-mask:not([hidden]), #groupModal, #fanSuggestModal, .legal-consent-mask:not([hidden])')) return;
      started = true;
      // let the hall settle for a breath before the light arrives
      setTimeout(function () { G.tour('world'); }, 900);
    }
    if (flow) {
      new MutationObserver(maybeTour).observe(flow, { attributes: true, attributeFilter: ['data-home-state'] });
      maybeTour();
    }

    // 建立身份 · account: when a visitor first reaches for the registration, not on page load.
    function accountHint() {
      if (signedIn()) { if (!G.seen('identity', 'account')) G.mark('identity', 'account'); return; }
      if (G.active()) return;
      G.hint('identity', 'account', {
        target: loginButton,
        title: '先有一个会馆账号',
        body: '不登录也能写，但只会存在这个浏览器里：清缓存、换设备就找不回了。登录后，登记会跟着账号走。',
        action: { label: '登录 / 注册', run: function () { if (window.openAuthModal) openAuthModal('登录后，登记会跟着账号走。'); } }
      });
    }
    function formHint() {
      if (G.active()) return;
      var first = visible('#registrationBasics input[name="code"]');
      if (!first) return;
      G.hint('identity', 'oc-form', {
        target: function () { return visible('#row-code') || first; },
        title: '从一句话开始就好',
        body: '只填带 * 的几项就能登记。能力、喜好、介绍没想好，先空着，以后随时可以改。',
        tryText: '档案里请写角色的事，不要填自己的手机号、邮箱或住址。',
        doneOn: 'input', doneText: '对，就这样。慢慢写，写完点页面下方的「提交登记」。'
      }, { onClose: function () { if (!signedIn()) setTimeout(accountHint, 400); } });
    }
    document.addEventListener('huiguan:select-archive', function (e) {
      var key = e.detail && (e.detail.key || e.detail);
      if (key === 'character') setTimeout(formHint, 700);
    });
    document.addEventListener('huiguan:browse-registration', function () { setTimeout(formHint, 900); });
    document.addEventListener('focusin', function (e) {
      if (e.target.closest && e.target.closest('#charForm')) {
        if (!G.seen('identity', 'oc-form')) formHint();
        else if (!signedIn() && !G.seen('identity', 'account')) accountHint();
      }
    });

    // 建立身份 · oc-saved: the first successful registration.
    var success = document.getElementById('successMsg');
    if (success) new MutationObserver(function () {
      if (!success.classList.contains('show') || G.seen('identity', 'oc-saved')) return;
      G.close();
      setTimeout(function () {
        G.hint('identity', 'oc-saved', {
          target: success,
          title: '登记好了',
          body: '它已经存进你的账号，展示页也生成了。想让大家看到，可以到同人画廊申请公开，审核通过后就会出现。',
          action: { label: '去同人画廊看看', run: function () { location.href = '/fan.html'; } }
        });
      }, 600);
    }).observe(success, { attributes: true, attributeFilter: ['class'] });
  }

  // ------------------------------------------------------------ fan gallery
  function fanHooks() {
    function show() {
      if (G.active()) return;
      G.hint('identity', 'fan-gallery', {
        target: function () { return visible('.toolbar') || visible('#search'); },
        title: '大家的角色都在这里',
        body: '可以按喜欢或最新排列、按种族筛选。点开卡片看完整设表；登录后能点喜欢、收藏和留言。',
        tryText: '想公开自己的角色？登记后在这一页点「提交公开」，审核通过就会出现。'
      });
    }
    setTimeout(show, 1400);
  }

  G.init({
    sync: '/api/onboarding',
    // browsers that already kept characters here before the guide existed are not walked through again
    returningGuest: (function () {
      var old = false;
      try { old = (localStorage.getItem('luoxiaohei_characters') || '[]').length > 2; } catch (e) {}
      return { world: old, identity: old };
    })(),
    menuNote: '「开始生活」一章在会馆 LAB 游戏里：走路、聊天、种植这些，进游戏后边玩边学。'
  }).then(function () {
    if (page === 'hall') hallHooks();
    else if (page === 'fan') fanHooks();
  });
  // a sign-in made on this page carries this browser's progress into the account
  window.addEventListener('huiguan:auth-changed', function () { G.refresh(); });
})();
