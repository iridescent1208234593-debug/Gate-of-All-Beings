// stage-13：环境干预 UI（DOM 覆盖层，不参与 three.js 渲染、不直接改世界状态）
// 两个部件：
//   1) EnvMenu   —— 鼠标点击地面后在落点弹出干预菜单（播种 / 排水 / 注水 / 升温 / 降温 / 温度复位）
//   2) ClimatePanel —— 常驻读数：基线气候温度、温度偏移、气候带、冷/暖适应占比、累计干预次数
// 验收口径（任务书 Stage 13）：「调高温度后，冷适应（多体细胞保温型）种群占比可观测变化」——
// 读数面板把 coldShare/warmShare 与调温前后对照直接摊在屏幕上，配合地图温度与生产力折扣可见。
// 颜色全部取自 theme token（COLORS.intervention），经 cssHex 转成 CSS 色值，无硬编码色值。
import { COLORS, WORLD, cssHex } from './theme.js';
import { TILE_CN } from '../world/map.js';
import { adaptationShares, climateBandOf, formatTemp, plantTempMul } from '../core/climate.js';

// 菜单项定义：kind 交由 main.js 映射成对应 Action（UI 层不认识 reducer 的 action type）
const MENU_ITEMS = [
  { kind: 'seed', label: '播种植物', hint: '在落点附近草地补种并抬升生物量', color: 'seed' },
  { kind: 'drain', label: '排水成陆', hint: '水域 -> 草地（露出可生长地表）', color: 'drain' },
  { kind: 'fill', label: '注水成湖', hint: '陆地 -> 水域（淹没该格植株）', color: 'fill' },
  { kind: 'warm', label: '升温 +5℃', hint: '抬高基线气候温度，制造暖选择压力', color: 'warm' },
  { kind: 'cool', label: '降温 -5℃', hint: '压低基线气候温度，制造冷选择压力', color: 'cool' },
  { kind: 'resetTemp', label: '温度复位', hint: '温度偏移归零（回到基线 18℃）', color: 'cool' },
];

export class EnvMenu {
  // onIntervene(kind, payload)：点击菜单项时回调，payload 形如 { gx, gy }（调温类为空对象）
  constructor(root, onIntervene) {
    this.events = new AbortController();
    this.root = root;
    this.onIntervene = onIntervene;
    this.target = null; // { gx, gy, tile }
    root.className = 'env-menu';
    root.hidden = true;
    // 点空白处 / 按 Esc 收起菜单（菜单自身点击不冒泡到此）
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    }, { signal: this.events.signal });
  }

  dispose() { this.events.abort(); this.close(); }

  get isOpen() {
    return !this.root.hidden;
  }

  // 在落点（屏幕坐标）弹出菜单；screenX/screenY 越界时自动回夹到视口内
  open(target, screenX, screenY) {
    this.target = target;
    const items = MENU_ITEMS.map(
      (it) =>
        `<button type="button" class="env-item" data-kind="${it.kind}" ` +
        `style="border-left-color:${cssHex(COLORS.intervention[it.color])}">` +
        `<b>${it.label}</b><span>${it.hint}</span></button>`
    ).join('');
    this.root.innerHTML =
      `<div class="env-head">环境干预 · 格(${target.gx}, ${target.gy}) ` +
      `<i>${TILE_CN[target.tile] ?? '未知'}</i></div>${items}`;
    this.root.hidden = false;
    for (const btn of this.root.querySelectorAll('.env-item')) {
      btn.addEventListener('click', () => {
        const kind = btn.dataset.kind;
        const payload = kind === 'warm' || kind === 'cool' || kind === 'resetTemp'
          ? {}
          : { gx: target.gx, gy: target.gy };
        this.close();
        if (this.onIntervene) this.onIntervene(kind, payload);
      });
    }
    // 先显示再量尺寸，才能正确回夹到视口内
    const rect = this.root.getBoundingClientRect();
    const w = rect.width || 220;
    const h = rect.height || 240;
    const x = Math.min(Math.max(8, screenX + 10), window.innerWidth - w - 8);
    const y = Math.min(Math.max(8, screenY + 10), window.innerHeight - h - 8);
    this.root.style.left = `${Math.round(x)}px`;
    this.root.style.top = `${Math.round(y)}px`;
  }

  close() {
    this.root.hidden = true;
    this.target = null;
  }
}

export class ClimatePanel {
  constructor(root) {
    this.root = root;
    root.classList.add('climate-panel');
    root.innerHTML = `
      <div class="cl-head">
        <span class="cl-title">气候与环境干预</span>
        <span class="cl-band" id="cl-band">温和</span>
      </div>
      <div class="cl-row"><span>基线气候温度</span><b id="cl-base">--</b></div>
      <div class="cl-row"><span>温度偏移</span><b id="cl-offset">--</b></div>
      <div class="cl-row"><span>地图温度</span><b id="cl-map">--</b></div>
      <div class="cl-row"><span>生产力折扣</span><b id="cl-plant">--</b></div>
      <div class="cl-sep"></div>
      <div class="cl-row"><span>冷适应（保温型）</span><b id="cl-cold">--</b></div>
      <div class="cl-row"><span>暖适应（散热型）</span><b id="cl-warm">--</b></div>
      <div class="cl-bar"><i id="cl-coldbar"></i></div>
      <div class="cl-detail" id="cl-detail">有机体 0 · 冷 0 / 暖 0</div>
      <div class="cl-detail" id="cl-env">播种 0 · 排水 0 · 注水 0 · 调温 0</div>
      <div class="cl-detail" id="cl-temploss">温度不适耗能 0</div>
      <div class="cl-tip">左键点地面撒干预 · 冷适应占比随调温变化即为选择压力证据</div>
    `;
    this.el = {
      band: root.querySelector('#cl-band'),
      base: root.querySelector('#cl-base'),
      offset: root.querySelector('#cl-offset'),
      map: root.querySelector('#cl-map'),
      plant: root.querySelector('#cl-plant'),
      cold: root.querySelector('#cl-cold'),
      warm: root.querySelector('#cl-warm'),
      coldbar: root.querySelector('#cl-coldbar'),
      detail: root.querySelector('#cl-detail'),
      env: root.querySelector('#cl-env'),
      temploss: root.querySelector('#cl-temploss'),
    };
  }

  // 每帧读数：气候来自 state（env.tempOffset / climateTemp），适应型占比直接统计当前有机体
  update(state) {
    const env = state.env || {};
    const climateTemp = Number.isFinite(state.climateTemp) ? state.climateTemp : WORLD.climateTempBase;
    const shares = adaptationShares(state.organisms);
    const el = this.el;

    el.base.textContent = formatTemp(climateTemp);
    const off = env.tempOffset || 0;
    el.offset.textContent = `${off > 0 ? '+' : ''}${off.toFixed(0)}℃`;
    // 偏移越大越暖：暖色/冷色 token 复用昼夜温度读数色
    el.offset.style.color = cssHex(off > 0 ? COLORS.dayNight.tempHot : off < 0 ? COLORS.dayNight.tempCold : COLORS.eco.energy);
    const mapTemp = Number.isFinite(state.temperature) ? state.temperature : climateTemp;
    el.map.textContent = formatTemp(mapTemp);
    el.plant.textContent = `${Math.round(plantTempMul(climateTemp) * 100)}%`;

    el.band.textContent = climateBandOf(climateTemp);
    el.cold.textContent = `${(shares.coldShare * 100).toFixed(0)}%`;
    el.cold.style.color = cssHex(COLORS.intervention.coldFit);
    el.warm.textContent = `${(shares.warmShare * 100).toFixed(0)}%`;
    el.warm.style.color = cssHex(COLORS.intervention.warmFit);
    el.coldbar.style.width = `${Math.round(shares.coldShare * 100)}%`;
    el.coldbar.style.background = cssHex(COLORS.intervention.coldFit);
    el.detail.textContent =
      `有机体 ${shares.total} · 冷 ${shares.cold} / 暖 ${shares.warm} · ` +
      `均最适 ${shares.optimalTempAvg ? shares.optimalTempAvg.toFixed(1) : '--'}℃`;
    el.env.textContent =
      `播种 ${env.seeds || 0} · 排水 ${env.drained || 0} · 注水 ${env.filled || 0} · ` +
      `调温 ${env.tempAdjusted || 0}`;
    const loss = (state.orgStats && state.orgStats.tempLoss) || 0;
    el.temploss.textContent = `温度不适耗能 ${Math.round(loss)}`;
  }
}
