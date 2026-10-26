import { mountEcologyImport } from './ui/ecologyImport.js';
import { mountHubBridge } from './systems/hubBridge.js';
import '@lxh/shared-ui/lxh-ui.css';
import './ui/styles.css';
import './ui/management.css';
/**
 * 灵境会馆 - 入口装配
 * 单向数据流装配：UI 派发 Action → reducer 更新 GameState → 渲染层每帧绘制。
 */
import { createInitialState, TICK_MS } from './core/gameState.js';
import { createEventSystem } from './core/eventSystem.js';
import { reducer } from './core/reducer.js';
import { GameLoop } from './core/gameLoop.js';
import { RenderEngine } from './render/threeRenderer.js';
import { UIManager } from './ui/uiManager.js';
import { loadGame, hasSave, loadCloudSave, saveGame } from './systems/saveGame.js';
import { restoreSession, currentUser } from './systems/account.js';
import { getCurrentTheme, applyThemeToDom } from './core/theme.js';

// 启动即应用持久化主题（首帧兜底用 styles.css :root 默认，此处覆盖为真实主题）
applyThemeToDom(getCurrentTheme());

// ---- 装配 ----
const canvas = document.getElementById('game-canvas');
const tooltip = document.getElementById('tooltip');
const events = createEventSystem();

let state = createInitialState();
let ui = null;
let bootReady = false;
let saveWritable = true;
let lastAutoSave = performance.now();
document.getElementById('app').inert = true;

/** 唯一写入口：Action → reducer → 新 state */
function dispatch(action) {
  if (!bootReady) throw new Error('会馆存档正在恢复，请稍后操作。');
  if(action.type==='IMPORT_ECOLOGY'&&!saveWritable)throw new Error('现有存档无法读取，收获已保留，请先处理存档。');
  const next = reducer(state, action);
  if (action.type === 'IMPORT_ECOLOGY' && !saveGame(next)) throw new Error('本地保存失败，收获尚未入库，请稍后重试。');
  state = next;
  engine.setState(state);
  if (ui) ui.refresh();
}

let engine;
try {
  engine = new RenderEngine(canvas, { tooltipEl: tooltip });
} catch (error) {
  const status = document.getElementById('render-status');
  status.classList.remove('hidden');
  status.textContent = '三维画面无法启动。请开启浏览器硬件加速，或使用支持 WebGL 2 的浏览器后重新打开。';
  throw error;
}
engine.setState(state);
mountEcologyImport(dispatch);

ui = new UIManager({
  dispatch,
  getState: () => state,
  engine,
  onLoad: (loaded) => {
    ui.cancelPlacement();
    engine.setSelected(null);
    state = loaded;
    engine.setState(state);
    ui.refresh();
  },
});

// ---- 主循环：固定 tick 模拟 + 每帧渲染 ----
const loop = new GameLoop({
  tickIntervalMs: TICK_MS, // 250ms = 4 tick/秒
  tickFn: () => {
    state = reducer(state, { type: 'TICK' });
    ui.onTick(state);
    if(saveWritable&&performance.now()-lastAutoSave>15000){
      if(!saveGame(state))ui.flashSaveHint('自动保存失败，请检查浏览器存储');
      lastAutoSave=performance.now();
    }
  },
  renderFn: () => {
    engine.setState(state);
    engine.render();
  },
  getSpeed: () => state.speed,
  isPaused: () => state.paused,
});

// Restore once before ticking so late account responses cannot replace live progress.
const ready = (async () => {
  try {
    const user = await restoreSession();
    const cloud = user ? await loadCloudSave() : null;
    const existing=hasSave();
    const loaded = cloud || (existing ? loadGame() : null);
    if(existing&&!loaded){saveWritable=false;ui.flashSaveHint('旧存档读取失败，当前临时游玩；原存档已保留');}
    if (loaded) state = loaded;
  } finally {
    if (engine.disposed) return;
    engine.setState(state);
    ui.onUserChange(currentUser());
    ui.refresh();
    bootReady = true;
    document.getElementById('app').inert = false;
    if (!engine.disposed) loop.start();
  }
})();

// 暴露调试句柄（控制台可用）
const disposeBridge=mountHubBridge({getState:()=>state,dispatch,isReady:()=>bootReady});
const onPageHide = e => { if (!e.persisted) dispose(); };
function dispose() { if(engine.disposed)return;window.removeEventListener("pagehide", onPageHide);if(window.__lingjing?.engine===engine)delete window.__lingjing;loop.stop();if(bootReady&&saveWritable)saveGame(state);disposeBridge();ui.dispose();engine.dispose(); }
// 供统一壳无 iframe 挂载时卸载
window.__iridescentlyDispose = dispose;
window.addEventListener('pagehide', onPageHide);
if (import.meta.hot) import.meta.hot.dispose(dispose);
window.__lingjing = { state: () => state, dispatch, loop, events, engine, ui, ready, dispose };
