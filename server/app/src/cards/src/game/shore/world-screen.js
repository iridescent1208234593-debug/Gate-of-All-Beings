/** Accepted original-ui shallow-shore exploration, now owned by one mounted mode. */
import { createPlayerAvatar, resolvePlayerAvatar } from '../../onboarding/player-avatar.js';
import { reportResult } from '@lxh/shared-session/progress.js';

const MAX_ENERGY = 100;
export function createWorldScreen({ world, getProfile, storageKey, onReturn }) {
  const lifetime = new AbortController();
  const timers = new Set();
  let active = false;
  let toastTimer = 0;
  let state = { discovered: [], energy: 72, logs: [] };
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (saved && Array.isArray(saved.discovered)) {
      state.discovered = [...new Set(saved.discovered.filter(id => /^beacon-[1-3]$/.test(id)))];
      state.energy = Number.isFinite(saved.energy) ? Math.max(0, Math.min(MAX_ENERGY, saved.energy)) : 72;
      if (Array.isArray(saved.logs)) state.logs = saved.logs.slice(0, 3).filter(log => typeof log?.time === 'string' && typeof log?.text === 'string');
    }
  } catch { /* Keep a playable mode when browser storage is unavailable. */ }
  function later(callback, delay) {
    const id = window.setTimeout(() => { timers.delete(id); if (active) callback(); }, delay);
    timers.add(id);
    return id;
  }
  function on(target, type, callback) { target.addEventListener(type, callback, { signal: lifetime.signal }); }
  world.innerHTML = `
    <header class="world-header">
      <div class="world-identity"><div class="world-avatar" role="img" aria-label="当前玩家头像"></div><div><p class="world-eyebrow">众生之门 · 林间相遇</p><h1 class="world-player"></h1><p class="world-race"></p></div></div>
      <div class="world-status" aria-label="角色状态"><div class="world-status__item"><span>灵息</span><strong class="world-energy-value">72</strong></div><div class="world-energy"><span class="world-energy__fill"></span></div><div class="world-status__item"><span>碎片</span><strong class="world-shard-value">00</strong></div><button class="world-journal-button" type="button" aria-label="打开探索日志" aria-expanded="false">日志 <kbd>J</kbd></button></div>
    </header>
    <div class="world-main" aria-label="探索区域">
      <div class="world-location"><p class="world-eyebrow">当前位置</p><h2>雾隐浅滩</h2><p>潮声从远处传来，雾里有微弱的光。</p></div>
      <div class="world-hotspots" aria-label="可探索的灵息节点">
        <button class="world-hotspot world-hotspot--one" type="button" data-hotspot="beacon-1" aria-label="探索北岸灵息"><span class="world-hotspot__core"></span><span class="world-hotspot__label">北岸灵息</span></button>
        <button class="world-hotspot world-hotspot--two" type="button" data-hotspot="beacon-2" aria-label="探索浅滩灵息"><span class="world-hotspot__core"></span><span class="world-hotspot__label">浅滩灵息</span></button>
        <button class="world-hotspot world-hotspot--three" type="button" data-hotspot="beacon-3" aria-label="探索礁石灵息"><span class="world-hotspot__core"></span><span class="world-hotspot__label">礁石灵息</span></button>
      </div>
      <div class="world-controls"><kbd>E</kbd><span>探索附近灵息</span><i aria-hidden="true"></i><kbd>J</kbd><span>打开日志</span></div>
    </div>
    <aside class="world-quest" aria-label="当前任务"><div class="world-quest__heading"><span class="world-quest__dot"></span><p>当前任务</p><span class="world-quest__count">0 / 3</span></div><h2>回应雾中的光</h2><p>在雾隐浅滩找到 3 个灵息节点，确认这片世界还记得你的到来。</p><div class="world-quest__progress"><span></span></div><p class="world-quest__hint">点击光点，或按 <kbd>E</kbd> 探索</p></aside>
    <button class="world-return" type="button">← 返回门庭</button>
    <div class="world-toast" role="status" aria-live="polite"></div>
    <div class="world-journal" hidden><div class="world-journal__backdrop" data-close-journal></div><section class="world-journal__panel" role="dialog" aria-modal="true" aria-labelledby="shore-journal-title" tabindex="-1"><button class="world-journal__close" type="button" data-close-journal aria-label="关闭日志">×</button><p class="world-eyebrow">探索记录</p><h2 id="shore-journal-title">雾隐浅滩</h2><p class="world-journal__copy">灵息是世界留下的回声。靠近它们，你会听见属于这个服务器的第一段记忆。</p><ul class="world-log-list"></ul></section></div>`;
  const query = selector => world.querySelector(selector);
  const hotspots = [...world.querySelectorAll('[data-hotspot]')];
  const journal = query('.world-journal');
  const journalButton = query('.world-journal-button');
  const closeButton = query('.world-journal__close');
  const toast = query('.world-toast');
  const avatar = query('.world-avatar');
  const avatarView = createPlayerAvatar(avatar);
  function syncPlayer() {
    const profile = getProfile();
    query('.world-player').textContent = profile.display_name || '旅人';
    query('.world-race').textContent = profile.species_name || '种族未填写';
    avatarView.render(resolvePlayerAvatar(profile), { reference: profile.avatar_mode === 'default' });
    avatar.dataset.frameId = profile.avatar_frame_id;
    avatar.setAttribute('aria-label', `${profile.display_name || '旅人'}的玩家头像`);
  }
  function renderLogs() {
    const list = query('.world-log-list');
    list.replaceChildren();
    if (!state.logs.length) {
      const empty = document.createElement('li'); empty.className = 'world-log-empty'; empty.textContent = '还没有探索记录，去寻找雾里的光吧。'; list.append(empty);
    }
    for (const entry of state.logs) {
      const item = document.createElement('li'); const time = document.createElement('time'); const text = document.createElement('span');
      time.textContent = entry.time; text.textContent = entry.text; item.append(time, text); list.append(item);
    }
  }
  function updateHud() {
    const count = state.discovered.length;
    query('.world-energy-value').textContent = String(state.energy).padStart(2, '0');
    query('.world-energy__fill').style.width = `${state.energy}%`;
    query('.world-shard-value').textContent = String(count).padStart(2, '0');
    query('.world-quest__count').textContent = `${count} / 3`;
    query('.world-quest__progress span').style.width = `${count / 3 * 100}%`;
    for (const hotspot of hotspots) {
      const found = state.discovered.includes(hotspot.dataset.hotspot);
      const label = hotspot.querySelector('.world-hotspot__label').textContent;
      hotspot.classList.toggle('is-found', found);
      hotspot.setAttribute('aria-label', found ? `${label}（已探索）` : `探索${label}`);
    }
    try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Exploration still works in memory. */ }
  }
  function showToast(message) {
    toast.textContent = message; toast.classList.add('is-visible');
    window.clearTimeout(toastTimer); timers.delete(toastTimer);
    toastTimer = later(() => toast.classList.remove('is-visible'), 2400);
  }
  function explore(id = hotspots.find(item => !state.discovered.includes(item.dataset.hotspot))?.dataset.hotspot) {
    if (!active || !id) return false;
    if (state.discovered.includes(id)) { showToast('这里的灵息已经被你记录过了。'); return false; }
    const hotspot = hotspots.find(item => item.dataset.hotspot === id);
    if (!hotspot) return false;
    state.discovered.push(id); state.energy = Math.max(0, state.energy - 8);
    const label = hotspot.querySelector('.world-hotspot__label').textContent;
    state.logs.unshift({ time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), text: `发现${label}，获得一枚灵息碎片。` });
    updateHud(); renderLogs(); hotspot.classList.add('is-pulsing');
    later(() => hotspot.classList.remove('is-pulsing'), 700);
    showToast(state.discovered.length === 3 ? '任务完成：雾隐浅滩回应了你。' : `已记录${label}。`);
    // 账户积分 / 排行榜：本次探索记录的节点数；三处全部记录算完成一次探索（每个会话 / 账户作用域一天一次）
    const done = state.discovered.length === 3;
    void reportResult('shore', { score: state.discovered.length, finished: done, won: done, toast: done,
      ref: done ? `shore:${storageKey}:${new Date().toDateString()}` : undefined });
    return true;
  }
  function openJournal() {
    journal.hidden = false; journalButton.setAttribute('aria-expanded', 'true');
    for (const element of [query('.world-header'), query('.world-main'), query('.world-quest'), query('.world-return')]) element.inert = true;
    closeButton.focus();
  }
  function closeJournal() {
    journal.hidden = true; journalButton.setAttribute('aria-expanded', 'false');
    for (const element of [query('.world-header'), query('.world-main'), query('.world-quest'), query('.world-return')]) element.inert = false;
    journalButton.focus();
  }
  hotspots.forEach(hotspot => on(hotspot, 'click', () => explore(hotspot.dataset.hotspot)));
  on(journalButton, 'click', openJournal);
  world.querySelectorAll('[data-close-journal]').forEach(element => on(element, 'click', closeJournal));
  on(query('.world-return'), 'click', onReturn);
  function syncVisibility() { world.toggleAttribute('data-page-hidden', document.hidden); }
  on(document, 'visibilitychange', syncVisibility);
  syncVisibility();
  on(window, 'keydown', event => {
    if (!active || event.defaultPrevented || event.isComposing || event.repeat || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName)) return;
    if (!journal.hidden && event.key === 'Tab') { event.preventDefault(); closeButton.focus(); return; }
    if (event.key.toLowerCase() === 'j') { event.preventDefault(); journal.hidden ? openJournal() : closeJournal(); }
    else if (event.key === 'Escape' && !journal.hidden) { event.preventDefault(); closeJournal(); }
    else if (event.key.toLowerCase() === 'e' && journal.hidden) { event.preventDefault(); explore(); }
  });
  return {
    show() { active = true; syncPlayer(); updateHud(); renderLogs(); world.hidden = false; },
    syncPlayer,
    explore,
    getState: () => ({ active, discovered: [...state.discovered], energy: state.energy, journalOpen: !journal.hidden }),
    dispose() { active = false; lifetime.abort(); timers.forEach(id => window.clearTimeout(id)); timers.clear(); world.replaceChildren(); },
  };
}
