/* Homepage views consume the existing official/fan/account APIs. No second session store. */
(function () {
  'use strict';
  var officialGrid = document.getElementById('homeOfficialGrid');
  var fanGrid = document.getElementById('homeFanGrid');
  var personal = document.getElementById('homeMyCharacter');
  var more = document.getElementById('homeOfficialMore');
  if (!officialGrid || !fanGrid || !personal) return;
  var controller = new AbortController();
  var officialPage = 1;
  var officialQuery = '';
  var officialGeneration = 0;
  var accountGeneration = 0;
  var searchTimer;
  var loaded = 0;

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function imageURL(value) {
    if (!value) return '';
    try {
      var url = new URL(value, location.href);
      return /^(https?:|data:)$/.test(url.protocol) && (url.protocol !== 'data:' || /^data:image\/(png|jpeg|webp|gif);/i.test(value)) ? url.href : '';
    } catch (error) { return ''; }
  }
  // Fan cards use the 360px WebP thumbnail, like the official cards; data-full keeps the 1600px site version
  // for the owner-only "查看原图" viewer. Only same-origin preview routes accept the t=1 flag.
  function thumbURL(value) {
    try {
      var url = new URL(value, location.href);
      if (url.origin !== location.origin || !/^\/api\/(uploads\/preview|image-preview)$/.test(url.pathname)) return value;
      url.searchParams.set('t', '1');
      return url.href;
    } catch (error) { return value; }
  }
  async function read(url) {
    var response = await fetch(url, { credentials: 'same-origin', signal: controller.signal });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  }
  function card(character, type) {
    var source = type === 'official' && character.thumb_path
      ? '/api/official/img?cid=' + encodeURIComponent(character.id) + '&n=0&t=1'
      : imageURL(character.image_data || character.image);
    var href = type === 'official' ? '/char.html?id=' + encodeURIComponent(character.id)
      : '/show.html?code=' + encodeURIComponent(character.code || '');
    return '<a class="home-character" href="' + href + '"><figure>' +
      (source ? '<img data-original-image src="' + esc(type === 'official' ? source : thumbURL(source)) + '" data-full="' + esc(source) + '" alt="' + esc(character.name) + '" loading="lazy" decoding="async">' : '<span class="character-initial">' + esc((character.name || '档')[0]) + '</span>') +
      '</figure><span class="character-name">' + esc(character.name) + '</span><small>' + esc(character.user_name || character.species || character.type || '角色档案') + '</small></a>';
  }
  async function loadOfficial(reset) {
    var generation = ++officialGeneration;
    if (reset) { officialPage = 1; loaded = 0; }
    more.disabled = true;
    try {
      var params = new URLSearchParams({ limit: '24', page: String(officialPage), q: officialQuery, min: '0', max: '8' });
      var data = await read('/api/official/characters?' + params);
      if (generation !== officialGeneration) return;
      var list = data.characters || [];
      if (reset) officialGrid.innerHTML = '';
      officialGrid.insertAdjacentHTML('beforeend', list.map(function (c) { return card(c, 'official'); }).join(''));
      if (!list.length && reset) officialGrid.innerHTML = '<p class="archive-note">没有匹配的角色。</p>';
      loaded += list.length;
      document.getElementById('homeOfficialCount').textContent = data.total + ' 份档案';
      more.hidden = loaded >= data.total;
    } catch (error) {
      if (error.name !== 'AbortError' && generation === officialGeneration) officialGrid.innerHTML = '<p class="archive-note">官方档案暂时无法加载。<a href="/gallery.html">打开角色画廊重试</a></p>';
    } finally { if (generation === officialGeneration) more.disabled = false; }
  }
  async function loadPublic() {
    try {
      var data = await read('/api/fan/list?limit=24');
      fanGrid.innerHTML = (data.characters || []).map(function (c) { return card(c, 'fan'); }).join('') || '<p class="archive-note">还没有公开的角色。</p>';
    } catch (error) {
      if (error.name !== 'AbortError') fanGrid.innerHTML = '<p class="archive-note">公开档案暂时无法加载。<a href="/fan.html">打开同人画廊重试</a></p>';
    }
  }
  async function loadPersonal(user) {
    var generation = ++accountGeneration;
    // Clear the previous account before any asynchronous request can complete.
    personal.innerHTML = '<p class="archive-note">正在查阅你的登记…</p>';
    if (!user || !user.logged_in) {
      personal.innerHTML = '<div class="my-character-prompt"><span>你的角色，也在这里。</span><p>登录后，展示你已经登记的人设。</p><button type="button" data-home-login>登录 / 注册 →</button></div>';
      return;
    }
    try {
      var data = await read('/api/get-characters');
      if (generation !== accountGeneration) return;
      var list = (data.characters || []).map(function (c) { return Object.assign({}, c.data || c, { code: c.code || (c.data && c.data.code) }); });
      var main = list.find(function (c) { return c.image; }) || list[0];
      personal.innerHTML = main
        ? '<span class="personal-kicker">' + esc(user.nickname || user.username || '你') + ' · 已登记的人设</span>' + card(main, 'mine')
        : '<div class="my-character-prompt"><span>还没有登记的角色</span><button type="button" data-home-register>直接开始登记 →</button></div>';
    } catch (error) {
      if (error.name !== 'AbortError' && generation === accountGeneration) personal.innerHTML = '<p class="archive-note">你的角色暂时无法读取，公开档案仍可浏览。</p>';
    }
  }
  async function applyScribe() {
    try {
      var user = await read('/api/user');
      if (!user.logged_in) { window.openAuthModal(); return; }
      if (!confirm('编辑可以审查与修订官方角色资料。请确认已加入会馆交流群，并愿意谨慎维护资料。继续申请？')) return;
      var message = prompt('简单介绍为什么适合成为编辑（选填）：');
      if (message === null) return;
      var response = await fetch('/api/official/scribe-apply', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: message.trim() }), signal: controller.signal });
      var data = await response.json();
      if (window.showToast) window.showToast(data.ok ? 'success' : 'error', data.ok ? '申请已提交。' : data.error || '申请未成功');
    } catch (error) { if (error.name !== 'AbortError' && window.showToast) window.showToast('error', '网络错误，请稍后重试。'); }
  }
  document.getElementById('homeOfficialSearch').addEventListener('input', function (event) {
    officialQuery = event.target.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { loadOfficial(true); }, 250);
  });
  more.addEventListener('click', function () { officialPage++; loadOfficial(false); });
  document.getElementById('homeScribeApply').addEventListener('click', applyScribe);
  personal.addEventListener('click', function (event) {
    if (event.target.closest('[data-home-login]')) window.openAuthModal();
    if (event.target.closest('[data-home-register]')) document.dispatchEvent(new CustomEvent('huiguan:select-archive', { detail: 'character' }));
  });
  var receivedAuthChange = false;
  function onAuthChange(event) { receivedAuthChange = true; loadPersonal(event.detail); }
  document.addEventListener('huiguan:auth-change', onAuthChange);
  read('/api/user').then(function (user) { if (!receivedAuthChange) loadPersonal(user); }).catch(function () { if (!receivedAuthChange) loadPersonal(null); });
  loadOfficial(true);
  loadPublic();
  window.addEventListener('pagehide', function () {
    controller.abort(); clearTimeout(searchTimer); document.removeEventListener('huiguan:auth-change', onAuthChange);
  }, { once: true });
})();
