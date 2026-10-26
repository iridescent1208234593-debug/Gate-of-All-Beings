/**
 * 灵境会馆 - 渲染层：渲染引擎
 * 每帧读取最新 GameState → Canvas 2D 绘制。
 */
import { GRID } from '../core/gameState.js';
import { drawBase, drawPlacementGhost } from './drawBase.js';
import { drawColonists, drawEnemies } from './drawColonists.js';
import { getBuilding } from '../content/buildings.js';

export class RenderEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts
   * @param {number} [opts.tileSize=32]
   * @param {HTMLElement|null} [opts.tooltipEl]
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tileSize = opts.tileSize ?? 32;
    this.tooltipEl = opts.tooltipEl ?? null;

    canvas.width = GRID.width * this.tileSize;
    canvas.height = GRID.height * this.tileSize;

    this.state = null;
    this.mouse = { gx: -1, gy: -1, inside: false };
    this.placement = null; // { buildingId }
    this.selectedId = null;
  }

  setState(state) {
    this.state = state;
  }

  setPlacement(buildingId) {
    this.placement = buildingId ? { buildingId } : null;
  }

  setMouse(gx, gy, inside) {
    this.mouse = { gx, gy, inside };
  }

  setSelected(id) {
    this.selectedId = id;
  }

  /** 每帧渲染 */
  render() {
    const { ctx, state, tileSize } = this;
    if (!state) return;
    drawBase(ctx, state, tileSize);
    if (this.placement) {
      drawPlacementGhost(ctx, state, this.placement, this.mouse, tileSize);
    }
    drawColonists(ctx, state, tileSize, this.selectedId);
    drawEnemies(ctx, state, tileSize);
    this.updateTooltip();
  }

  /** 命中检测：某网格上的对象信息 */
  hitInfo(gx, gy) {
    const { state } = this;
    if (!state || gx < 0 || gy < 0 || gx >= state.space.width || gy >= state.space.height) return null;

    // 小妖优先
    const colonist = state.colonists.find((c) => c.x === gx && c.y === gy);
    if (colonist) {
      const lowest = lowestNeedOf(colonist);
      return {
        kind: 'colonist',
        html: `<b>${colonist.name}</b>（${elementName(colonist.element)}系）<br/>心情：${moodEmoji(colonist.mood)} ${colonist.mood === 'green' ? '愉快' : colonist.mood === 'yellow' ? '一般' : '糟糕'}<br/>最低需求 ${lowest.id}：${Math.round(lowest.value)}`,
      };
    }

    const tile = state.space.tiles[gy * state.space.width + gx];
    if (tile && tile.buildingId) {
      const b = state.buildings.find((x) => x.id === tile.buildingId);
      if (b) {
        const def = getBuilding(b.buildingId);
        return {
          kind: 'building',
          html: `<b>${def.name}</b><br/>${def.desc}<br/>占用：${b.workers.length}/${def.maxWorkers}`,
        };
      }
    }
    return null;
  }

  updateTooltip() {
    if (!this.tooltipEl) return;
    const info = this.mouse.inside ? this.hitInfo(this.mouse.gx, this.mouse.gy) : null;
    if (!info) {
      this.tooltipEl.classList.add('hidden');
      return;
    }
    this.tooltipEl.classList.remove('hidden');
    this.tooltipEl.innerHTML = info.html;
    this.tooltipEl.style.left = `${this.mouse.gx * this.tileSize + 14}px`;
    this.tooltipEl.style.top = `${this.mouse.gy * this.tileSize + 14}px`;
  }
}

function lowestNeedOf(c) {
  let lowest = null;
  for (const [id, value] of Object.entries(c.needs)) {
    if (!lowest || value < lowest.value) lowest = { id, value };
  }
  return lowest;
}

function elementName(id) {
  const map = { jin: '金', mu: '木', shui: '水', huo: '火', tu: '土' };
  return map[id] || id;
}

function moodEmoji(mood) {
  return mood === 'green' ? '😊' : mood === 'yellow' ? '😐' : '😫';
}
