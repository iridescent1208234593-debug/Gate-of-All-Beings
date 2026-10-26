// 细胞编辑器面板（stage-06）：原生 DOM 覆盖层，不引入框架
// 状态全部来自 GameState（单向流），按钮只发出 Action，由 main 统一 dispatch。
import { COLORS, WORLD } from './theme.js';
import { deriveTraits } from '../core/genome.js';

const LABELS = {
  speed: '速度',
  perception: '感知',
  size: '体型',
  metabolism: '代谢',
  color: '色系',
};

// 十六进制数值 -> CSS 色串（仅用于 UI 色块，色源仍为 theme token）
function cssHex(v) {
  return '#' + v.toString(16).padStart(6, '0');
}

export class EditorUI {
  // onAction: (action) => void（main 注入 dispatch 包装）
  constructor(onAction) {
    this.onAction = onAction;
    this.el = document.createElement('div');
    this.el.id = 'editor';
    this.el.className = 'editor';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="editor-card">
        <div class="editor-head">
          <span class="editor-title">细胞编辑器</span>
          <span class="editor-points">进化点 <b class="ep-val">0</b></span>
        </div>
        <div class="editor-sub" data-sub></div>
        <div class="editor-attrs" data-attrs></div>
        <div class="editor-readonly" data-readonly></div>
        <div class="editor-foot">
          <button class="btn btn-primary" data-act="apply">应用基因 · 展示后代 ×3</button>
          <button class="btn" data-act="close">关闭</button>
        </div>
      </div>
    `;
    this.el.querySelector('[data-act="apply"]').addEventListener('click', () =>
      this.onAction({ type: 'APPLY_GENOME' })
    );
    this.el.querySelector('[data-act="close"]').addEventListener('click', () =>
      this.onAction({ type: 'CLOSE_EDITOR' })
    );
    document.body.appendChild(this.el);
  }

  // 每次 dispatch 后同步面板内容
  update(state) {
    const ed = state.editor;
    if (!state.paused || !ed) {
      this.el.hidden = true;
      return;
    }
    this.el.hidden = false;
    const cell = state.cells.find((c) => c.id === ed.cellId);
    this.el.querySelector('.ep-val').textContent = String(state.evoPoints);
    this.el.querySelector('[data-sub]').textContent = cell
      ? `已选中 #${cell.id} · 能量 ${Math.round(cell.energy)} · 当前基因作为编辑起点`
      : '选中细胞已不存在';

    const attrs = this.el.querySelector('[data-attrs]');
    attrs.innerHTML = '';
    const t = deriveTraits(ed.genome);
    for (const key of ['speed', 'perception', 'size']) {
      const gv = ed.genome[key];
      const row = document.createElement('div');
      row.className = 'attr-row';
      const pct = Math.round(gv * 100);
      const pv =
        key === 'speed'
          ? t.speed.toFixed(2)
          : key === 'perception'
            ? t.senseRange.toFixed(1)
            : t.radius.toFixed(2);
      row.innerHTML = `
        <span class="attr-name">${LABELS[key]}</span>
        <span class="attr-bar"><i style="width:${pct}%"></i></span>
        <span class="attr-value">${pv}</span>
        <span class="attr-gen">g${gv.toFixed(2)}</span>
        <span class="attr-btns">
          <button class="btn btn-mini" data-key="${key}" data-dir="-1">−</button>
          <button class="btn btn-mini" data-key="${key}" data-dir="1">+</button>
        </span>
      `;
      row.querySelectorAll('.btn-mini').forEach((b) => {
        b.addEventListener('click', () =>
          this.onAction({
            type: 'EDIT_GENE',
            key: b.dataset.key,
            dir: Number(b.dataset.dir),
          })
        );
      });
      attrs.appendChild(row);
    }

    const ro = this.el.querySelector('[data-readonly]');
    const metFrac = ed.genome.metabolism;
    const colorIdx = Math.min(
      COLORS.cell.length - 1,
      Math.floor(ed.genome.color * COLORS.cell.length)
    );
    ro.innerHTML = `
      <div class="ro-row">代谢（只读）<span>${LABELS.metabolism} ×${(0.6 + 0.8 * metFrac).toFixed(2)}</span></div>
      <div class="ro-row">色系（只读）<span><i class="swatch" style="background:${cssHex(COLORS.cell[colorIdx])}"></i>${colorIdx}</span></div>
      <div class="ro-tip">每步 ±${WORLD.editorAttrStep.toFixed(2)} 基因值消耗 1 进化点；应用后向场景投放 ${WORLD.editorShowCount} 个带小变异的展示后代</div>
    `;
  }
}
