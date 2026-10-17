/* 喜欢 / 点赞 / 踩 —— 共用的状态逻辑 + 情绪动效
 *
 * 逻辑：
 *  - 乐观更新：点击立刻变色/变数字，请求在后台按点击顺序串行发出（同一对象的连点不会乱序）
 *  - 全部请求结束后用服务端返回的权威状态对账；失败则重拉整表回滚
 *  - 「喜欢」每人只有 1 个，转移时被取代的角色同步扣数
 *  - 事件委托：卡片重渲染后无需重新绑定
 * 动效：爱心迸发 / 心碎 / 点赞飞溅 / 踩踩的小泪滴 / 里程碑彩带；尊重 prefers-reduced-motion
 */
(function () {
  'use strict';
  const SCOPES = {
    official: { react: '/api/official/react', list: '/api/official/reactions', trio: true },
    fan: { react: '/api/fan/react', list: '/api/fan/reactions', trio: true },
    fanart: { trio: false, like: '/api/official/fanart/like' }
  };
  const RX = {};          // trio 作用域：{fav:{}, up:{}, down:{}, my:{fav, votes}}
  const ART = {};         // fanart：id -> {fav, myFav}
  const pending = {}, chains = {};
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ICON = {
    fav: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>'
  };
  const TITLE = {
    fav: ['喜欢（每人 1 个，可转移 / 取消）', '喜欢这个'],
    up: ['点赞（可取消 / 改踩）', '点赞'],
    down: ['踩（可取消 / 改赞）', '踩']
  };

  // ---------- 样式 ----------
  const css = `
.rfx-bar{display:flex;gap:6px;margin-top:8px}
.rfx-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:5px;font:inherit;font-size:12px;padding:5px 0;border-radius:999px;cursor:pointer;
  border:1px solid var(--border,#d4cfbe);background:var(--panel,#fbf8f2);color:var(--dim,#7a8a7e);position:relative;overflow:visible;
  transition:background .2s,border-color .2s,color .2s,transform .12s,box-shadow .2s;-webkit-tap-highlight-color:transparent;user-select:none}
.rfx-btn svg{width:15px;height:15px;fill:currentColor;flex:none;transition:fill .2s}
.rfx-btn:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,.10)}
.rfx-btn:active{transform:scale(.92)}
.rfx-btn:focus-visible{outline:2px solid var(--accent,#5a9e8f);outline-offset:2px}
.rfx-btn .rfx-n{display:inline-block;min-width:1ch;font-variant-numeric:tabular-nums}
.rfx-btn.rfx-fav:hover{color:#e2475d;border-color:#e2475d}
.rfx-btn.rfx-up:hover{color:var(--accent,#5a9e8f);border-color:var(--accent,#5a9e8f)}
.rfx-btn.rfx-down:hover{color:var(--gold,#d4a840);border-color:var(--gold,#d4a840)}
.rfx-btn.rfx-fav.on{color:#e2475d;border-color:#e2475d;background:rgba(226,71,93,.12)}
.rfx-btn.rfx-up.on{color:var(--accent,#5a9e8f);border-color:var(--accent,#5a9e8f);background:rgba(90,158,143,.14)}
.rfx-btn.rfx-down.on{color:var(--gold,#b3873a);border-color:var(--gold,#d4a840);background:rgba(212,168,64,.14)}
.rfx-btn.on svg{filter:drop-shadow(0 1px 3px currentColor)}
#rfx-layer{position:fixed;inset:0;pointer-events:none;z-index:100000;overflow:hidden}
#rfx-layer .p{position:absolute;left:0;top:0;will-change:transform,opacity;line-height:1}
#rfx-layer .p svg{display:block;fill:currentColor}
#rfx-layer .ring{position:absolute;border-radius:50%;border:2px solid currentColor;will-change:transform,opacity}
#rfx-layer .txt{position:absolute;font-weight:700;font-size:13px;white-space:nowrap;text-shadow:0 1px 2px rgba(255,255,255,.8)}
.rfx-toast{position:fixed;left:50%;bottom:36px;transform:translateX(-50%);z-index:100001;background:rgba(40,52,45,.94);color:#fff;font-size:13px;line-height:1.6;
  padding:10px 16px;border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.28);display:flex;align-items:center;gap:12px;max-width:min(92vw,420px)}
.rfx-toast button{font:inherit;font-size:12px;cursor:pointer;border:none;border-radius:999px;padding:5px 14px;background:#e2475d;color:#fff;white-space:nowrap}
@media (prefers-reduced-motion:reduce){.rfx-btn,.rfx-btn svg{transition:none}.rfx-btn:hover{transform:none}}
`;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  function layer() {
    let l = document.getElementById('rfx-layer');
    if (!l) { l = document.createElement('div'); l.id = 'rfx-layer'; document.body.appendChild(l); }
    return l;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clean = (el, anim) => { anim.onfinish = anim.oncancel = () => el.remove(); };

  function particle(html, x, y, color, size, keyframes, dur, delay) {
    const el = document.createElement('div');
    el.className = 'p'; el.innerHTML = html; el.style.color = color;
    el.style.width = el.style.height = size + 'px';
    el.style.left = (x - size / 2) + 'px'; el.style.top = (y - size / 2) + 'px';
    layer().appendChild(el);
    const a = el.animate(keyframes, { duration: dur, delay: delay || 0, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
    clean(el, a);
  }
  function floatText(text, x, y, color) {
    const el = document.createElement('div'); el.className = 'txt'; el.textContent = text; el.style.color = color;
    el.style.left = x + 'px'; el.style.top = y + 'px'; layer().appendChild(el);
    const a = el.animate([
      { transform: 'translate(-50%,0) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%,-18px) scale(1.15)', opacity: 1, offset: .25 },
      { transform: 'translate(-50%,-54px) scale(1)', opacity: 0 }
    ], { duration: 1100, easing: 'ease-out', fill: 'both' });
    clean(el, a);
  }
  function ring(x, y, color) {
    const el = document.createElement('div'); el.className = 'ring'; el.style.color = color;
    el.style.left = (x - 12) + 'px'; el.style.top = (y - 12) + 'px'; el.style.width = el.style.height = '24px';
    layer().appendChild(el);
    clean(el, el.animate([{ transform: 'scale(.4)', opacity: .8 }, { transform: 'scale(3.2)', opacity: 0 }], { duration: 520, easing: 'ease-out', fill: 'both' }));
  }
  const center = btn => { const r = btn.getBoundingClientRect(); return { x: r.left + r.width / 2 - 8, y: r.top + r.height / 2 }; };
  const iconOf = btn => btn.querySelector('svg');
  function wiggle(el, frames, dur) { if (el && el.animate) el.animate(frames, { duration: dur, easing: 'cubic-bezier(.3,1.6,.5,1)' }); }

  // ---------- 动效 ----------
  const FX = {
    favOn(btn, n) {
      wiggle(iconOf(btn), [{ transform: 'scale(1)' }, { transform: 'scale(1.6)', offset: .22 }, { transform: 'scale(.9)', offset: .45 }, { transform: 'scale(1.3)', offset: .65 }, { transform: 'scale(1)' }], 620);
      if (reduced()) return;
      const { x, y } = center(btn);
      ring(x, y, '#e2475d');
      const colors = ['#e2475d', '#ff7b8f', '#f2a0b0', '#ff9a5a', '#d4a840'];
      const count = 14;
      for (let i = 0; i < count; i++) {
        const ang = (-90 + rnd(-62, 62)) * Math.PI / 180, dist = rnd(46, 118), size = rnd(9, 19);
        const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist, sway = rnd(-14, 14), rot = rnd(-40, 40);
        particle(ICON.fav, x, y, colors[i % colors.length], size, [
          { transform: 'translate(0,0) scale(.2) rotate(0)', opacity: 0 },
          { transform: `translate(${dx * .55 + sway}px,${dy * .6}px) scale(1.05) rotate(${rot * .5}deg)`, opacity: 1, offset: .3 },
          { transform: `translate(${dx - sway}px,${dy + 34}px) scale(.45) rotate(${rot}deg)`, opacity: 0 }
        ], rnd(800, 1250), i * 18);
      }
      if (n === 1) floatText('首位喜欢 ✨', x, y - 16, '#e2475d');
      else floatText('♥', x, y - 14, '#e2475d');
      if (n >= 10 && (n % 10 === 0 || n === 25 || n === 50)) FX.confetti(x, y, n + ' 人喜欢了她/他 🎉');
    },
    favOff(btn) {
      const svg = iconOf(btn); if (!svg || reduced()) return;
      const { x, y } = center(btn);
      // 心碎：左右两半裂开、旋转、坠落
      [['inset(0 50% 0 0)', -1], ['inset(0 0 0 50%)', 1]].forEach(([clip, dir]) => {
        particle(ICON.fav, x, y, '#c9a0a8', 17, [
          { transform: 'translate(0,0) rotate(0)', opacity: 1, clipPath: clip },
          { transform: `translate(${dir * 9}px,10px) rotate(${dir * 24}deg)`, opacity: .9, clipPath: clip, offset: .3 },
          { transform: `translate(${dir * 16}px,46px) rotate(${dir * 70}deg)`, opacity: 0, clipPath: clip }
        ], 700);
      });
      wiggle(svg, [{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }], 360);
    },
    upOn(btn, n) {
      wiggle(iconOf(btn), [{ transform: 'rotate(0) scale(1)' }, { transform: 'rotate(-28deg) scale(1.45)', offset: .3 }, { transform: 'rotate(8deg) scale(.95)', offset: .6 }, { transform: 'rotate(0) scale(1)' }], 520);
      if (reduced()) return;
      const { x, y } = center(btn);
      ring(x, y, 'var(--accent,#5a9e8f)');
      const colors = ['#5a9e8f', '#7fc8b8', '#d4a840', '#f2d98a'];
      for (let i = 0; i < 9; i++) {
        const ang = rnd(0, Math.PI * 2), dist = rnd(24, 62);
        particle('<svg viewBox="0 0 24 24"><path d="M12 0l2.6 8.4L23 12l-8.4 3.6L12 24l-2.6-8.4L1 12l8.4-3.6z"/></svg>', x, y, colors[i % colors.length], rnd(6, 12), [
          { transform: 'translate(0,0) scale(.2) rotate(0)', opacity: 0 },
          { transform: `translate(${Math.cos(ang) * dist}px,${Math.sin(ang) * dist - 10}px) scale(1) rotate(90deg)`, opacity: 1, offset: .4 },
          { transform: `translate(${Math.cos(ang) * dist * 1.3}px,${Math.sin(ang) * dist * 1.3 + 14}px) scale(.2) rotate(200deg)`, opacity: 0 }
        ], rnd(550, 900), i * 14);
      }
      floatText('+1', x, y - 14, '#5a9e8f');
      if (n >= 10 && n % 10 === 0) FX.confetti(x, y, n + ' 个赞 🎉');
    },
    upOff(btn) { wiggle(iconOf(btn), [{ transform: 'scale(1)' }, { transform: 'scale(.7)', offset: .4 }, { transform: 'scale(1)' }], 300); },
    downOn(btn) {
      wiggle(iconOf(btn), [{ transform: 'rotate(0) translateY(0)' }, { transform: 'rotate(22deg) translateY(4px)', offset: .45 }, { transform: 'rotate(10deg) translateY(2px)', offset: .75 }, { transform: 'rotate(0) translateY(0)' }], 620);
      if (reduced()) return;
      const { x, y } = center(btn);
      for (let i = 0; i < 3; i++) {
        particle('<svg viewBox="0 0 24 24"><path d="M12 2C12 2 5 10.5 5 15a7 7 0 0014 0c0-4.5-7-13-7-13z"/></svg>', x + rnd(-6, 6), y + 4, '#8fb4c9', rnd(7, 10), [
          { transform: 'translate(0,0) scale(.5)', opacity: 0 },
          { transform: 'translate(0,6px) scale(1)', opacity: .95, offset: .2 },
          { transform: `translate(${rnd(-6, 6)}px,40px) scale(.8)`, opacity: 0 }
        ], rnd(650, 900), i * 120);
      }
      floatText('收到…', x, y - 8, '#8a8f98');
    },
    downOff(btn) { wiggle(iconOf(btn), [{ transform: 'translateY(0)' }, { transform: 'translateY(-3px) scale(1.15)', offset: .4 }, { transform: 'translateY(0)' }], 320); },
    confetti(x, y, text) {
      if (reduced()) return;
      const colors = ['#e2475d', '#d4a840', '#5a9e8f', '#7a8bd1', '#ff9a5a'];
      for (let i = 0; i < 26; i++) {
        const ang = (-90 + rnd(-80, 80)) * Math.PI / 180, dist = rnd(70, 190);
        particle('<svg viewBox="0 0 10 16"><rect width="10" height="16" rx="2"/></svg>', x, y, colors[i % colors.length], rnd(6, 10), [
          { transform: 'translate(0,0) rotate(0)', opacity: 1 },
          { transform: `translate(${Math.cos(ang) * dist}px,${Math.sin(ang) * dist}px) rotate(${rnd(180, 540)}deg)`, opacity: 1, offset: .45 },
          { transform: `translate(${Math.cos(ang) * dist * 1.15}px,${Math.sin(ang) * dist + 90}px) rotate(${rnd(540, 900)}deg)`, opacity: 0 }
        ], rnd(1100, 1700), i * 10);
      }
      if (text) floatText(text, x, y - 36, '#d4a840');
    }
  };

  // ---------- 提示 ----------
  function toast(msg, action) {
    document.querySelectorAll('.rfx-toast').forEach(t => t.remove());
    const t = document.createElement('div'); t.className = 'rfx-toast'; t.setAttribute('role', 'status');
    const s = document.createElement('span'); s.textContent = msg; t.appendChild(s);
    if (action) { const b = document.createElement('button'); b.type = 'button'; b.textContent = action.label; b.onclick = action.run; t.appendChild(b); }
    document.body.appendChild(t);
    t.animate([{ opacity: 0, transform: 'translate(-50%,12px)' }, { opacity: 1, transform: 'translate(-50%,0)' }], { duration: 220, fill: 'both' });
    setTimeout(() => { if (t.isConnected) t.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' }).onfinish = () => t.remove(); }, action ? 5200 : 2600);
  }
  const loginToast = () => toast('登录后才能表达喜欢哦～', { label: '去登录', run: () => { location.href = '/?openauth=1'; } });

  // ---------- 状态 ----------
  const empty = () => ({ fav: {}, up: {}, down: {}, my: { fav: null, votes: {} } });
  function get(scope, id) {
    if (!SCOPES[scope].trio) { const a = ART[id] || { fav: 0, myFav: false }; return { fav: a.fav, up: 0, down: 0, myFav: a.myFav, myVote: 0 }; }
    const r = RX[scope] || empty();
    return { fav: r.fav[id] || 0, up: r.up[id] || 0, down: r.down[id] || 0, myFav: r.my.fav === id, myVote: r.my.votes[String(id)] || 0 };
  }
  function put(scope, id, s) {
    if (!SCOPES[scope].trio) { ART[id] = { fav: s.fav, myFav: s.myFav }; return; }
    const r = RX[scope] || (RX[scope] = empty());
    r.fav[id] = s.fav; r.up[id] = s.up; r.down[id] = s.down;
    if (s.myFav) r.my.fav = id; else if (r.my.fav === id) r.my.fav = null;
    if (s.myVote) r.my.votes[String(id)] = s.myVote; else delete r.my.votes[String(id)];
  }
  function fromServer(st) { return { fav: st.fav, up: st.up, down: st.down, myFav: !!st.my_fav, myVote: st.my_vote || 0 }; }

  // ---------- 渲染 ----------
  function btnHTML(type, s) {
    const on = type === 'fav' ? s.myFav : type === 'up' ? s.myVote === 1 : s.myVote === -1;
    const n = s[type];
    return `<button type="button" class="rfx-btn rfx-${type}${on ? ' on' : ''}" data-type="${type}" aria-pressed="${on}" title="${TITLE[type][0]}" aria-label="${TITLE[type][1]}">${ICON[type]}<span class="rfx-n">${n}</span></button>`;
  }
  function barHTML(scope, id, opts) {
    const s = get(scope, id), only = (opts && opts.only) || (SCOPES[scope].trio ? null : 'fav');
    const types = only ? [only] : ['fav', 'up', 'down'];
    return `<div class="rfx-bar" data-k="${scope}:${id}">${types.map(t => btnHTML(t, s)).join('')}</div>`;
  }
  function paint(scope, id, animateTypes) {
    const s = get(scope, id);
    document.querySelectorAll(`.rfx-bar[data-k="${scope}:${id}"]`).forEach(bar => {
      bar.querySelectorAll('.rfx-btn').forEach(b => {
        const type = b.dataset.type;
        const on = type === 'fav' ? s.myFav : type === 'up' ? s.myVote === 1 : s.myVote === -1;
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
        const nEl = b.querySelector('.rfx-n'), val = String(s[type]);
        if (nEl.textContent !== val) {
          const up = Number(val) > Number(nEl.textContent);
          nEl.textContent = val;
          if (!reduced() && nEl.animate) nEl.animate([{ transform: `translateY(${up ? 70 : -70}%)`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
        }
      });
    });
  }

  async function load(scope) {
    const cfg = SCOPES[scope];
    if (!cfg.trio) return;
    try { const r = await fetch(cfg.list); const d = await r.json(); RX[scope] = Object.assign(empty(), d, { my: Object.assign({ fav: null, votes: {} }, d.my) }); } catch (e) { RX[scope] = RX[scope] || empty(); }
  }

  // ---------- 点击 ----------
  function optimistic(scope, id, type) {
    const s = get(scope, id); const before = { ...s };
    let prevId = null, prevS = null;
    if (type === 'fav') {
      if (s.myFav) { s.myFav = false; s.fav = Math.max(0, s.fav - 1); }
      else {
        if (SCOPES[scope].trio) {
          const cur = (RX[scope] || empty()).my.fav;
          if (cur != null && cur !== id) { prevId = cur; prevS = get(scope, cur); prevS.myFav = false; prevS.fav = Math.max(0, prevS.fav - 1); put(scope, cur, prevS); }
        }
        s.myFav = true; s.fav += 1;
      }
    } else {
      const want = type === 'up' ? 1 : -1;
      if (s.myVote === want) { s[type] = Math.max(0, s[type] - 1); s.myVote = 0; }
      else {
        if (s.myVote) { const o = s.myVote === 1 ? 'up' : 'down'; s[o] = Math.max(0, s[o] - 1); }
        s[type] += 1; s.myVote = want;
      }
    }
    put(scope, id, s);
    return { before, now: s, prevId };
  }

  function onClick(e) {
    const btn = e.target.closest('.rfx-btn'); if (!btn) return;
    const bar = btn.closest('.rfx-bar'); if (!bar) return;
    e.preventDefault(); e.stopPropagation();
    const [scope, idStr] = bar.dataset.k.split(':'); const id = Number(idStr), type = btn.dataset.type;
    if (!SCOPES[scope]) return;
    if (navigator.vibrate) { try { navigator.vibrate(type === 'fav' ? [10, 30, 14] : 10); } catch (_) {} }
    const { before, now, prevId } = optimistic(scope, id, type);
    paint(scope, id); if (prevId != null) paint(scope, prevId);
    const turnedOn = type === 'fav' ? now.myFav : type === 'up' ? now.myVote === 1 : now.myVote === -1;
    const wasUpVote = before.myVote === 1, wasDownVote = before.myVote === -1;
    (type === 'fav' ? (turnedOn ? FX.favOn(btn, now.fav) : FX.favOff(btn)) :
      type === 'up' ? (turnedOn ? FX.upOn(btn, now.up) : FX.upOff(btn)) :
      (turnedOn ? FX.downOn(btn) : FX.downOff(btn)));
    if (turnedOn && type !== 'fav') {   // 改赞 / 改踩时，另一枚按钮松一口气
      const other = bar.querySelector(type === 'up' ? '.rfx-down' : '.rfx-up');
      if (other && (type === 'up' ? wasDownVote : wasUpVote)) (type === 'up' ? FX.downOff : FX.upOff)(other);
    }
    send(scope, id, type);
  }

  function send(scope, id, type) {
    const key = scope + ':' + id; pending[key] = (pending[key] || 0) + 1;
    const cfg = SCOPES[scope];
    const call = () => fetch(cfg.react || cfg.like, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg.trio ? { character_id: id, type } : { id })
    }).then(async r => ({ status: r.status, d: await r.json().catch(() => ({})) }));
    chains[key] = (chains[key] || Promise.resolve()).then(call).then(async res => {
      pending[key]--;
      if (res.status === 401) { await resync(scope, id); loginToast(); return; }
      if (!res.d.ok) { await resync(scope, id); toast('⚠ ' + (res.d.error || '操作没成功，已恢复')); return; }
      if (pending[key] === 0) {
        if (cfg.trio && res.d.state) {
          put(scope, id, fromServer(res.d.state)); paint(scope, id);
          if (res.d.prev_state) { put(scope, res.d.prev_state.cid, fromServer(res.d.prev_state)); paint(scope, res.d.prev_state.cid); }
        } else if (!cfg.trio) { put(scope, id, { fav: res.d.likes, up: 0, down: 0, myFav: !!res.d.liked, myVote: 0 }); paint(scope, id); }
      }
    }).catch(async () => { pending[key]--; await resync(scope, id); toast('⚠ 网络不太顺，已恢复原状'); });
  }
  async function resync(scope, id) {
    if (SCOPES[scope].trio) { await load(scope); document.querySelectorAll(`.rfx-bar[data-k^="${scope}:"]`).forEach(b => paint(scope, Number(b.dataset.k.split(':')[1]))); }
    else paint(scope, id);
  }

  document.addEventListener('click', onClick, true);
  window.RFX = { bar: barHTML, paint, load, seed: (id, likes, liked) => { ART[id] = { fav: likes, myFav: !!liked }; }, toast, fx: FX, confetti: FX.confetti };
})();
