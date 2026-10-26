// stage-16：文明最小闭环 UI（DOM 覆盖层，不参与 three.js 渲染、不直接改世界状态）
// 一句话职责：把 state.civ 摊成可读面板——文明进度条（当前阶段）/ 三类资源完成度 /
// 研究点数 / 两级科技（火种、工具）的解锁状态 / 本 tick 采集单位与速率；
// 进度满建城后弹出「建城」胜利资料页（后续太空/上帝阶段以文本预告收尾）。
// 按钮只上报意图（onAckCity），由 main.js 映射成权威 Action；
// 颜色全部取自 theme token（COLORS.civ / COLORS.resource / COLORS.tribe），经 cssHex 转 CSS 色值，无硬编码色值。
import { COLORS, cssHex } from './theme.js';
import { RESOURCE_KINDS, RESOURCE_CN, CIV_NEED, CIV_RES_CAP, techView } from '../core/civilization.js';

export class CivPanel {
  // handlers：{ onAckCity() }
  constructor(root, victoryRoot, handlers = {}) {
    this.root = root;
    this.handlers = handlers;
    root.classList.add('civ-panel');
    root.innerHTML = `
      <div class="cv-head">
        <span class="cv-title">文明与科技</span>
        <span class="cv-stage" id="cv-stage">游群</span>
      </div>
      <div class="cv-bar"><i id="cv-fill"></i><span id="cv-pct">0%</span></div>
      <div class="cv-rows">
        <div class="cv-row" data-kind="water"><i class="cv-dot"></i><span>水</span><b id="cv-res-water">0/60</b></div>
        <div class="cv-row" data-kind="food"><i class="cv-dot"></i><span>食物</span><b id="cv-res-food">0/60</b></div>
        <div class="cv-row" data-kind="mineral"><i class="cv-dot"></i><span>矿物</span><b id="cv-res-mineral">0/60</b></div>
      </div>
      <div class="cv-sep"></div>
      <div class="cv-row"><span>研究点</span><b id="cv-research">0</b></div>
      <div class="cv-row"><span>采集单位 · 速率 · 资源点</span><b id="cv-gather">0 · 0.0/s · 0</b></div>
      <div class="cv-techs" id="cv-techs"></div>
      <div class="cv-tip" id="cv-tip">把群体移到资源点圈内即可开采（群体面板 → 移动）</div>
    `;
    this.el = {
      stage: root.querySelector('#cv-stage'),
      fill: root.querySelector('#cv-fill'),
      pct: root.querySelector('#cv-pct'),
      res: {
        water: root.querySelector('#cv-res-water'),
        food: root.querySelector('#cv-res-food'),
        mineral: root.querySelector('#cv-res-mineral'),
      },
      dots: {},
      research: root.querySelector('#cv-research'),
      gather: root.querySelector('#cv-gather'),
      techs: root.querySelector('#cv-techs'),
      tip: root.querySelector('#cv-tip'),
    };
    for (const k of RESOURCE_KINDS) {
      const dot = root.querySelector(`.cv-row[data-kind="${k}"] .cv-dot`);
      dot.style.background = cssHex(COLORS.resource[k]);
      this.el.dots[k] = dot;
    }
    this.el.fill.style.background = cssHex(COLORS.civ.cityRing);

    // 科技行：按科技树定长生成（两级），后续每帧只改文本与色点，不重建 DOM
    this.techRows = new Map();
    for (const t of techView(null)) {
      const row = document.createElement('div');
      row.className = 'cv-tech';
      row.innerHTML = '<i class="cv-tdot"></i><span class="cv-tname"></span><b class="cv-tstate"></b><em class="cv-teff"></em>';
      this.el.techs.appendChild(row);
      this.techRows.set(t.id, {
        row,
        dot: row.querySelector('.cv-tdot'),
        name: row.querySelector('.cv-tname'),
        state: row.querySelector('.cv-tstate'),
        eff: row.querySelector('.cv-teff'),
      });
    }

    // 建城资料页：整屏 overlay，仅在建城且未读时显示；「继续观察」只上报已读意图
    this.victory = victoryRoot;
    victoryRoot.classList.add('cv-victory');
    victoryRoot.hidden = true;
    victoryRoot.innerHTML = `
      <div class="cv-card">
        <div class="cv-vtitle" id="cv-vtitle">建城</div>
        <div class="cv-vmeta" id="cv-vmeta"></div>
        <div class="cv-vbody" id="cv-vbody"></div>
        <div class="cv-vfoot">
          <span class="cv-vhint">史册已记下这一笔（后续：工业 · 太空 · 上帝，留待下一段旅程）</span>
          <button type="button" id="cv-ok">继续观察</button>
        </div>
      </div>
    `;
    this.vEl = {
      title: victoryRoot.querySelector('#cv-vtitle'),
      meta: victoryRoot.querySelector('#cv-vmeta'),
      body: victoryRoot.querySelector('#cv-vbody'),
    };
    victoryRoot.querySelector('#cv-ok').addEventListener('click', () => {
      if (this.handlers.onAckCity) this.handlers.onAckCity();
    });
    this._victoryShown = false;
  }

  update(state) {
    const civ = state.civ;
    if (!civ) return;
    const pct = Math.round((civ.progress || 0) * 100);
    this.el.fill.style.width = `${pct}%`;
    this.el.pct.textContent = `${pct}%`;
    this.el.stage.textContent = civ.built ? `${civ.stageCn} · 已建城` : civ.stageCn;
    this.el.stage.style.color = cssHex(civ.built ? COLORS.civ.techOn : COLORS.tribe.selected);

    const lack = [];
    for (const k of RESOURCE_KINDS) {
      const cur = Math.round(civ.resources?.[k] || 0);
      const need = CIV_NEED[k];
      this.el.res[k].textContent = `${cur}/${need}`;
      this.el.res[k].style.color = cssHex(cur >= need ? COLORS.civ.techOn : COLORS.civ.techOff);
      this.el.dots[k].style.opacity = civ.nodes?.some((n) => n.kind === k && n.gatherers > 0) ? '1' : '0.4';
      if (cur < need) lack.push(RESOURCE_CN[k]);
    }

    this.el.research.textContent = `${Math.round(civ.research || 0)}`;
    this.el.gather.textContent = `${civ.units || 0} 只 · ${(civ.rate || 0).toFixed(1)}/s · ${civ.activeNodes || 0} 点`;

    for (const t of techView(civ)) {
      const r = this.techRows.get(t.id);
      if (!r) continue;
      const color = t.unlocked ? COLORS.civ.techOn : t.ready ? COLORS.civ.fireGlow : COLORS.civ.techOff;
      r.row.classList.toggle('cv-tech-on', t.unlocked);
      r.dot.style.background = cssHex(color);
      r.dot.style.boxShadow = t.ready ? `0 0 0 2px ${cssHex(COLORS.civ.fireGlow)}` : 'none';
      r.name.textContent = `${t.tier} 级 · ${t.name}`;
      r.state.textContent = t.unlocked
        ? '已解锁'
        : t.gated
          ? '需先解锁 火种'
          : `差 ${Math.ceil(t.short)} 点`;
      r.state.style.color = cssHex(color);
      r.eff.textContent = t.effect;
    }

    // 底部提示：直接告诉玩家「下一步该干什么」，避免只看到进度条不动却不知原因
    if (civ.built) {
      this.el.tip.textContent = `「${civ.city.name}」已落成 · 建城耗时 ${Math.round(civ.builtAt || 0)} 秒`;
      this.el.tip.style.color = cssHex(COLORS.civ.techOn);
    } else if (civ.activeNodes === 0) {
      this.el.tip.textContent = '暂无单位在采集：选中群体 → 移动，把群体派到资源点圈内';
      this.el.tip.style.color = cssHex(COLORS.civ.fireGlow);
    } else if (lack.length) {
      this.el.tip.textContent = `尚缺 ${lack.join('/')}：把群体派去对应颜色的资源点`;
      this.el.tip.style.color = '';
    } else {
      this.el.tip.textContent = `资源齐备：采够研究点即自动解锁科技（上限 ${CIV_RES_CAP.water}/类）`;
      this.el.tip.style.color = '';
    }

    this._syncVictory(civ);
  }

  // 建城资料页：建城且玩家未读时显示；已读（ackCity）则收起
  _syncVictory(civ) {
    if (!civ.built) return;
    if (civ.ackCity) {
      if (!this.victory.hidden) this.victory.hidden = true;
      return;
    }
    if (this._victoryShown) return;
    this._victoryShown = true;
    const techs = (civ.techs?.fire ? 1 : 0) + (civ.techs?.tools ? 1 : 0);
    this.vEl.title.textContent = `建城 · ${civ.city.name}`;
    this.vEl.meta.textContent =
      `文明进度 100% · 建城耗时 ${Math.round(civ.builtAt || 0)} 秒 · 已解锁科技 ${techs}/2 · ` +
      `累计入库资源 ${Math.round(civ.gathered || 0)}`;
    const lines = (civ.milestones || []).slice(-5).map((m) => `<li>${Math.round(m.t)}s · ${m.text}</li>`);
    this.vEl.body.innerHTML = `
      <div class="cv-vsub">从游群到城邦，这条链路已经跑通：资源点 → 采集入库 → 研究点 → 科技 → 建城。</div>
      <ul class="cv-vlist">${lines.join('')}</ul>
      <div class="cv-vnext">后续预告：工业（蒸汽与电力）、太空（离开这颗星球）、上帝（重塑生态）——留待后续阶段。</div>
    `;
    this.victory.hidden = false;
  }
}
