// 生成编辑器（stage-09）：暂停时的「组装模式」DOM 覆盖层（原生 DOM，不引入框架）
//
// 编辑器状态机：
//   选择模块类型(SET_MODULE_TYPE) -> 点击 3x3 网格空格(ToggleModuleCell 添加)
//   -> 点击已有格子(移除) -> 预览合成效果(速度/体积上限/耗能/吸收/光合) -> 应用(APPLY_LAYOUT)
//
// 单向数据流：本文件只读取 GameState 并发出 Action，由 main 统一 dispatch；
// 所有颜色取自 src/ui/theme.js 的 token（禁止硬编码色值）。
import { COLORS, WORLD, cssHex } from './theme.js';
import {
  MODULE_TYPES,
  MODULE_CN,
  synthesizePhenotype,
  countModules,
  gridCapacity,
} from '../core/organism.js';

// 模块 -> 色（body 随有机体色系基因，其余取 stage-07 模块 token）
function moduleColor(type, colorIndex) {
  if (type === 'body') {
    const i = Math.min(COLORS.cell.length - 1, Math.max(0, colorIndex | 0));
    return cssHex(COLORS.cell[i]);
  }
  return cssHex(COLORS.organism[type]);
}

export class OrganismEditorUI {
  // onAction: (action) => void（main 注入 dispatch 包装）
  constructor(onAction) {
    this.onAction = onAction;
    this.el = document.createElement('div');
    this.el.id = 'orgeditor';
    this.el.className = 'orgeditor';
    this.el.hidden = true;
    // 覆盖层本身不吃指针事件，只有卡片可交互：面板开着也能点选场景里的有机体
    this.el.innerHTML = `
      <div class="oe-card">
        <div class="oe-head">
          <span class="oe-title">生成编辑器 · 组装模式</span>
          <span class="oe-points">进化点 <b data-points>0</b></span>
        </div>
        <div class="oe-sub" data-sub></div>
        <div class="oe-section">
          <div class="oe-label">目标有机体（点选切换）</div>
          <div class="oe-orgs" data-orgs></div>
        </div>
        <div class="oe-section">
          <div class="oe-label">1. 选择模块类型</div>
          <div class="oe-types" data-types></div>
        </div>
        <div class="oe-section">
          <div class="oe-label">2. 点击网格增删模块 <span class="oe-count" data-count></span></div>
          <div class="oe-grid" data-grid></div>
          <div class="oe-legend">已有模块=实心可移除 · 虚线=本次新加 · 空格=放下所选模块</div>
        </div>
        <div class="oe-section">
          <div class="oe-label">3. 合成效果预览</div>
          <table class="oe-preview" data-preview></table>
        </div>
        <div class="oe-msg" data-msg></div>
        <div class="oe-foot">
          <button class="btn btn-primary" data-act="apply">应用并恢复世界</button>
          <button class="btn" data-act="close">关闭（丢弃）</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.el);

    this.el.querySelector('[data-act="apply"]').addEventListener('click', () =>
      this.onAction({ type: 'APPLY_LAYOUT' })
    );
    this.el.querySelector('[data-act="close"]').addEventListener('click', () =>
      this.onAction({ type: 'CLOSE_ORG_EDITOR' })
    );
  }

  // 每次 dispatch 后同步面板（state.orgEditor 为空则隐藏）
  update(state) {
    const ed = state.orgEditor;
    if (!ed || !state.paused) {
      this.el.hidden = true;
      return;
    }
    const org = state.organisms.find((o) => o.id === ed.organismId);
    if (!org) {
      this.el.hidden = true;
      return;
    }
    this.el.hidden = false;

    const counts = countModules(ed.layout);
    const colorIndex = org.colorIndex || 0;
    const originalKeys = new Set(org.layout.map((m) => `${m.gx},${m.gy}`));

    this.el.querySelector('[data-points]').textContent = String(state.evoPoints);
    this.el.querySelector('[data-sub]').textContent =
      `有机体 #${org.id} · 世界已冻结 · 增删模块立即改基因型（应用后立即游动）`;

    // ---- 目标有机体切换 ----
    const orgsBox = this.el.querySelector('[data-orgs]');
    orgsBox.innerHTML = '';
    state.organisms.slice(0, 12).forEach((o) => {
      const b = document.createElement('button');
      b.className = 'oe-org' + (o.id === ed.organismId ? ' active' : '');
      b.type = 'button';
      b.textContent = `#${o.id}·${o.moduleCount}块`;
      b.title = `切换编辑有机体 #${o.id}`;
      b.addEventListener('click', () => this.onAction({ type: 'OPEN_ORG_EDITOR', organismId: o.id }));
      orgsBox.appendChild(b);
    });

    // ---- 1. 模块类型选择（状态机第 1 步）----
    const typesBox = this.el.querySelector('[data-types]');
    typesBox.innerHTML = '';
    for (const type of MODULE_TYPES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'oe-type' + (type === ed.selectedType ? ' active' : '');
      b.innerHTML =
        `<i class="swatch" style="background:${moduleColor(type, colorIndex)}"></i>` +
        `${MODULE_CN[type]}`;
      b.addEventListener('click', () =>
        this.onAction({ type: 'SET_MODULE_TYPE', moduleType: type })
      );
      typesBox.appendChild(b);
    }

    // ---- 2. 3x3 网格（状态机第 2 步）----
    this.el.querySelector('[data-count]').textContent =
      `（${ed.layout.length}/${gridCapacity()} 格 · 体细胞 ${counts.body} / 鞭毛 ${counts.flagellum} / 口器 ${counts.mouth} / 叶绿体 ${counts.chloroplast}）`;
    const grid = this.el.querySelector('[data-grid]');
    grid.innerHTML = '';
    for (let gy = 0; gy < WORLD.orgGridSize; gy++) {
      for (let gx = 0; gx < WORLD.orgGridSize; gx++) {
        const m = ed.layout.find((x) => x.gx === gx && x.gy === gy);
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'oe-cell';
        cell.dataset.gx = String(gx);
        cell.dataset.gy = String(gy);
        if (m) {
          cell.classList.add('filled', `t-${m.type}`);
          if (!originalKeys.has(`${gx},${gy}`)) cell.classList.add('is-new');
          cell.style.background = moduleColor(m.type, colorIndex);
          cell.textContent = MODULE_CN[m.type].slice(0, 1);
          cell.title = `${MODULE_CN[m.type]} (${gx},${gy}) · 点击移除`;
        } else {
          cell.style.background = cssHex(COLORS.orgEditor.gridSlot);
          cell.style.borderColor = cssHex(COLORS.orgEditor.gridEdge);
          cell.textContent = '';
          cell.title = `空格 (${gx},${gy}) · 点击放置${MODULE_CN[ed.selectedType]}`;
        }
        cell.addEventListener('click', () =>
          this.onAction({ type: 'TOGGLE_MODULE_CELL', gx, gy })
        );
        grid.appendChild(cell);
      }
    }

    // ---- 3. 合成效果预览（模块布局 -> 表型数值，与当前值对比）----
    const syn = synthesizePhenotype(org.genome, ed.layout);
    const rows = [
      ['移动速度', syn.speed, org.speed, (v) => v.toFixed(2)],
      ['储能上限(体积)', syn.maxEnergy, org.maxEnergy, (v) => v.toFixed(0)],
      ['耗能/秒', syn.drainPerSec, org.drainPerSec, (v) => v.toFixed(2)],
      ['吸收倍率', syn.absorbMul, org.absorbMul, (v) => '×' + v.toFixed(2)],
      ['光合产能/秒', syn.photoPerSec, org.photoPerSec, (v) => v.toFixed(1)],
      ['进食半径', syn.eatRange, org.eatRange, (v) => v.toFixed(2)],
    ];
    const preview = this.el.querySelector('[data-preview]');
    preview.innerHTML =
      '<tr><th>项目</th><th>当前</th><th>组装后</th><th>变化</th></tr>' +
      rows
        .map(([name, next, cur, fmt]) => {
          const d = next - cur;
          const arrow = Math.abs(d) < 1e-6 ? '＝' : d > 0 ? '▲' : '▼';
          const cls = Math.abs(d) < 1e-6 ? 'flat' : d > 0 ? 'up' : 'down';
          const dv = fmt(Math.abs(d));
          return (
            `<tr><td>${name}</td><td class="dim">${fmt(cur)}</td>` +
            `<td>${fmt(next)}</td><td class="${cls}">${arrow}${dv}</td></tr>`
          );
        })
        .join('') +
      `<tr><td>模块数</td><td class="dim">${org.moduleCount}</td><td>${syn.moduleCount}</td>` +
      `<td class="flat">${syn.moduleCount - org.moduleCount >= 0 ? '+' : ''}${syn.moduleCount - org.moduleCount}</td></tr>` +
      `<tr><td>组装能量开销</td><td class="dim">—</td><td colspan="2" class="dim">${ed.energySpent || 0}（应用时从有机体能量扣除）</td></tr>`;

    this.el.querySelector('[data-msg]').textContent = ed.message || '';
  }
}
