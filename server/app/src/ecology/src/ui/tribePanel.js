// stage-15：群体与领地 UI（DOM 覆盖层，不参与 three.js 渲染、不直接改世界状态）
// 一句话职责：把 state.tribes 摊成可操作清单——每一群显示成员数 / 公共能量池 / 当前指令 /
// 是否禁繁，并提供「移动 / 采集 / 自由 / 禁繁」四个按钮；按钮只上报意图，
// 由 main.js 映射成权威 Action（UI 层不认识 reducer 的 action type）。
// 验收口径（任务书 Stage 15）：「成员跟随指令移动、能量共享可见」——
// 指令后群体悬浮标记与领地圈会整体迁移（渲染层），面板同步显示池量/累计给取的实时数字。
// 颜色全部取自 theme token（COLORS.tribe），经 cssHex 转 CSS 色值，无硬编码色值。
import { COLORS, WORLD, cssHex } from './theme.js';
import { ORDER, ORDER_CN, tribeSummary } from '../core/tribe.js';

// 指令按钮：mode 交给 main.js 转成 Actions.setTribeOrder / toggleTribeBreed
const ORDER_BTNS = [
  { mode: ORDER.MOVE, label: '移动', title: '再点地面指定落点，整群行军过去（成员跟随指令移动）' },
  { mode: ORDER.GATHER, label: '采集', title: '整群优先就近取食，吃饱后向领地中心归队' },
  { mode: ORDER.ROAM, label: '自由', title: '解除指令，恢复自主觅食 / 巡游 / 光合' },
];

export class TribePanel {
  // handlers：{ onSelect(id), onOrder(id, mode), onToggleBreed(id) }
  constructor(root, handlers = {}) {
    this.root = root;
    this.handlers = handlers;
    root.classList.add('tribe-panel');
    root.innerHTML = `
      <div class="tb-head">
        <span class="tb-title">群体与领地</span>
        <span class="tb-count" id="tb-count">0 群</span>
      </div>
      <div class="tb-rows" id="tb-rows"></div>
      <div class="tb-sep"></div>
      <div class="tb-row"><span>群体成员</span><b id="tb-members">0</b></div>
      <div class="tb-row"><span>公共能量池</span><b id="tb-pool">0</b></div>
      <div class="tb-row"><span>累计上缴 / 领取</span><b id="tb-flow">0 / 0</b></div>
      <div class="tb-row"><span>指令中（移动/采集）</span><b id="tb-orders">0 / 0</b></div>
      <div class="tb-row"><span>禁繁群体 · 分裂拦截</span><b id="tb-ban">0 · 0</b></div>
      <div class="tb-tip" id="tb-tip">点击成员个体或列表行选中群体 · 指令对整群生效</div>
    `;
    this.el = {
      count: root.querySelector('#tb-count'),
      rows: root.querySelector('#tb-rows'),
      members: root.querySelector('#tb-members'),
      pool: root.querySelector('#tb-pool'),
      flow: root.querySelector('#tb-flow'),
      orders: root.querySelector('#tb-orders'),
      ban: root.querySelector('#tb-ban'),
      tip: root.querySelector('#tb-tip'),
    };
    this.rows = new Map(); // tribe id -> { item, dot, name, sub, order, ban }
    this._sig = null;      // 群体 id 序列签名：变化时才重建 DOM 行
    this._selColor = cssHex(COLORS.tribe.selected);
  }

  // 行 DOM：每群一行（色点 + 名称/概要 + 四个指令按钮）；只在群体清单变化时重建
  _ensureRows(tribes) {
    const sig = tribes.map((t) => t.id).join(',');
    if (sig === this._sig) return;
    this._sig = sig;
    this.el.rows.innerHTML = '';
    this.rows.clear();
    for (const t of tribes) {
      const item = document.createElement('div');
      item.className = 'tb-item';
      item.innerHTML = `
        <i class="tb-dot"></i>
        <div class="tb-info"><b class="tb-name"></b><span class="tb-sub"></span></div>
        <div class="tb-acts"></div>
      `;
      const acts = item.querySelector('.tb-acts');
      for (const b of ORDER_BTNS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tb-btn';
        btn.dataset.order = b.mode;
        btn.textContent = b.label;
        btn.title = b.title;
        btn.addEventListener('click', () => {
          if (this.handlers.onOrder) this.handlers.onOrder(t.id, b.mode);
        });
        acts.appendChild(btn);
      }
      const banBtn = document.createElement('button');
      banBtn.type = 'button';
      banBtn.className = 'tb-btn tb-ban';
      banBtn.textContent = '禁繁';
      banBtn.title = '切换该群体的繁殖禁令：成员在禁令期内不分裂（可观测“指令 > 本能”）';
      banBtn.addEventListener('click', () => {
        if (this.handlers.onToggleBreed) this.handlers.onToggleBreed(t.id);
      });
      acts.appendChild(banBtn);

      const dot = item.querySelector('.tb-dot');
      dot.style.background = cssHex(this._paletteOf(t));
      item.addEventListener('click', (e) => {
        if (e.target.closest('.tb-btn')) return; // 按钮点击不触发选中
        if (this.handlers.onSelect) this.handlers.onSelect(t.id);
      });
      this.el.rows.appendChild(item);
      this.rows.set(t.id, {
        item,
        dot,
        name: item.querySelector('.tb-name'),
        sub: item.querySelector('.tb-sub'),
        order: item.querySelector('.tb-sub'),
        ban: banBtn,
        btns: [...acts.querySelectorAll('.tb-btn')],
      });
    }
  }

  // 群体标识色：与渲染层同一口径（按 id 序号在调色板取色），保证面板色点 = 场上领地圈颜色
  _paletteOf(t) {
    const n = Number(String(t.id).split('-').pop());
    const i = Number.isFinite(n) ? Math.abs(n - 1) % COLORS.tribe.palette.length : 0;
    return COLORS.tribe.palette[i];
  }

  // 每帧读数：ui = { selectedTribeId, awaitTargetFor }（等待玩家点地面选落点的群体 id）
  update(state, ui = {}) {
    const all = state.tribes || [];
    const tribes = all.slice(0, WORLD.tribePanelMax);
    const selId = ui.selectedTribeId || null;
    const awaitFor = ui.awaitTargetFor || null;
    this._ensureRows(tribes);

    for (const t of tribes) {
      const r = this.rows.get(t.id);
      if (!r) continue;
      const selected = t.id === selId;
      r.item.classList.toggle('tb-item-sel', selected);
      r.dot.style.background = cssHex(this._paletteOf(t));
      r.dot.style.boxShadow = selected ? `0 0 0 2px ${this._selColor}` : 'none';
      r.name.textContent = `${t.name} · ${t.count}只`;
      const mode = (t.order && t.order.mode) || ORDER.ROAM;
      const orderCn = ORDER_CN[mode] || mode;
      const banning = t.noBreed ? ' · 禁繁' : '';
      const waiting = awaitFor === t.id ? ' · 等落点' : '';
      r.sub.textContent =
        `池 ${Math.round(t.pool || 0)} · 指令 ${orderCn}${t.auto ? '（文明自动派遣）' : ''}${banning}${waiting} · 龄 ${t.age || 0}`;
      for (const btn of r.btns) {
        const isOrderBtn = btn.dataset.order;
        const active = isOrderBtn
          ? isOrderBtn === mode
          : (btn.classList.contains('tb-ban') && t.noBreed);
        btn.classList.toggle('tb-btn-on', !!active);
      }
      r.ban.classList.toggle('tb-btn-on', !!t.noBreed);
    }

    const s = tribeSummary(all);
    this.el.count.textContent = `${s.count} 群`;
    this.el.members.textContent = `${s.members} · 最大 ${s.largest}`;
    this.el.pool.textContent = `${Math.round(s.pooled)}`;
    this.el.pool.style.color = cssHex(COLORS.tribe.selected);
    this.el.flow.textContent = `${Math.round(s.given)} / ${Math.round(s.taken)}`;
    this.el.orders.textContent = `${s.moving} / ${s.gathering}`;
    const blocked = (state.tribeStats && state.tribeStats.banBlocked) || 0;
    this.el.ban.textContent = `${s.banned} · ${blocked}`;
    this.el.ban.style.color = cssHex(s.banned ? COLORS.tribe.forbidden : COLORS.tribe.selected);

    // 底部提示随交互态切换：明确告诉玩家「下一步该点什么」
    if (awaitFor) {
      const t = all.find((x) => x.id === awaitFor);
      this.el.tip.textContent = `已选「${t ? t.name : awaitFor}」：点击地面指定行军落点（Esc 取消）`;
      this.el.tip.style.color = cssHex(COLORS.tribe.target);
    } else if (selId) {
      const t = all.find((x) => x.id === selId);
      this.el.tip.textContent = `选中「${t ? t.name : selId}」：可下移动 / 采集 / 自由 / 禁繁指令`;
      this.el.tip.style.color = cssHex(COLORS.tribe.selected);
    } else {
      this.el.tip.textContent = '点击成员个体或列表行选中群体 · 指令对整群生效';
      this.el.tip.style.color = '';
    }
  }
}
