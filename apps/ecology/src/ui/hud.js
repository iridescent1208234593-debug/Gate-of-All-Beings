// stage-12：生态经营面板（DOM 覆盖层）
// 一句话职责：把 GameState 折算成经营读数（总能量/种群数/多样性/温度/时段/流速），
// 以纯 DOM 文本与按钮呈现——不参与 three.js 渲染，也不改动世界状态（只 dispatch 动作）。
// 数据口径见 core/eco.js，颜色全部取自 theme token（--eco-* 见 ui/style.css）。
import { COLORS, WORLD, cssHex } from './theme.js';
import { computeEcoMetrics, formatClock } from '../core/eco.js';

export class EcoPanel {
  // onScale(scale)：点击流速按钮时回调，交给 main.js 走 dispatch(Actions.setTimeScale)
  constructor(root, onScale) {
    this.root = root;
    this.onScale = onScale;
    root.classList.add('eco-panel');
    root.innerHTML = `
      <div class="eco-head">
        <span class="eco-title">生态经营面板</span>
        <span class="eco-clock" id="eco-clock">--:--</span>
      </div>
      <div class="eco-row"><span>总能量</span><b id="eco-energy">0</b></div>
      <div class="eco-row"><span>种群数</span><b id="eco-pop">0</b></div>
      <div class="eco-row"><span>多样性 Simpson</span><b id="eco-div">0.00</b></div>
      <div class="eco-row"><span>地图温度</span><b id="eco-temp">0℃</b></div>
      <div class="eco-detail" id="eco-detail">细胞 0 · 有机体 0 · 植物 0</div>
      <div class="eco-sun">
        <div class="eco-sun-track"><i id="eco-sunbar"></i></div>
        <span class="eco-phase" id="eco-phase">白昼</span>
      </div>
      <div class="eco-scale">
        <span class="eco-scale-label">时间流速</span>
        <div class="eco-btns" id="eco-scale-btns"></div>
      </div>
      <div class="eco-tip">光照驱动叶绿体产能与视野 · 温度随昼夜升降</div>
    `;
    this.el = {
      clock: root.querySelector('#eco-clock'),
      energy: root.querySelector('#eco-energy'),
      pop: root.querySelector('#eco-pop'),
      div: root.querySelector('#eco-div'),
      temp: root.querySelector('#eco-temp'),
      detail: root.querySelector('#eco-detail'),
      sunbar: root.querySelector('#eco-sunbar'),
      phase: root.querySelector('#eco-phase'),
    };
    // 流速按钮：按 WORLD.timeScaleOptions 生成（1x/2x/3x）
    const wrap = root.querySelector('#eco-scale-btns');
    this.buttons = new Map();
    for (const s of WORLD.timeScaleOptions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'eco-btn';
      btn.textContent = `${s}x`;
      btn.title = `时间流速 ${s} 倍（快捷键 ${s}）`;
      btn.addEventListener('click', () => this.onScale && this.onScale(s));
      wrap.appendChild(btn);
      this.buttons.set(s, btn);
    }
  }

  // 每帧读数：面板数据随 tick 更新（暂停时数字静止，倍速时变化更快）
  update(state) {
    const m = computeEcoMetrics(state);
    const el = this.el;
    el.energy.textContent = `≈ ${Math.round(m.totalEnergy)}`;
    el.pop.textContent = `${m.population}`;
    el.div.textContent = m.diversity.toFixed(3);
    el.temp.textContent = `${m.temperature.toFixed(1)}℃`;
    el.temp.style.color = cssHex(m.light >= 0.5 ? COLORS.dayNight.tempHot : COLORS.dayNight.tempCold);
    el.energy.style.color = cssHex(COLORS.eco.energy);
    el.detail.textContent = `细胞 ${m.cells} · 有机体 ${m.organisms} · 植物 ${m.plants}（物种 ${m.species}）`;

    // 昼夜：进度条宽度 = 光照系数；夜晚换冷色，白昼用暖色（色值取 token）
    const day = m.light >= 0.5;
    el.sunbar.style.width = `${Math.round(m.light * 100)}%`;
    el.sunbar.style.background = cssHex(day ? COLORS.eco.day : COLORS.eco.night);
    el.phase.textContent = `${day ? '白昼' : '夜晚'} · 光照 ${Math.round(m.light * 100)}%`;
    el.clock.textContent = formatClock(m.dayPhase);

    // 流速按钮激活态跟随权威状态
    for (const [s, btn] of this.buttons) {
      btn.classList.toggle('active', (state.timeScale || 1) === s);
    }
    document.body.classList.toggle('night', m.light < 0.35);
  }
}
