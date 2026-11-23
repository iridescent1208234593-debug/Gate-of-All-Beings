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
import { openSave, readLocalSave, sameOwner, saveGame } from './systems/saveGame.js';
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
let slot = null;
let switchingAccount = false;
let lastAutoSave = performance.now();
document.getElementById('app').inert = true;

/** 唯一写入口：Action → reducer → 新 state */
function dispatch(action) {
  if (!bootReady || switchingAccount) throw new Error('会馆存档正在恢复，请稍后操作。');
  if(action.type==='IMPORT_ECOLOGY'&&!slot?.writable)throw new Error('现有存档无法读取，收获已保留，请先处理存档。');
  const next = reducer(state, action);
  if (action.type === 'IMPORT_ECOLOGY' && !saveGame(next, slot)) throw new Error('本地保存失败，收获尚未入库，请稍后重试。');
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
  onSave: () => saveCurrent(),
  onReadSave: () => loadCurrent(),
  onAccountChange: changeAccount,
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
    if(!switchingAccount && slot?.writable && performance.now()-lastAutoSave>15000){
      if(!saveGame(state, slot))ui.flashSaveHint('自动保存失败，请核对账号与浏览器存储');
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

function saveCurrent() {
  if (switchingAccount || !slot?.writable) return slot?.hint || '存档正在恢复，请稍后再试';
  return saveGame(state, slot) ? '已存档' : '存档失败，请核对账号与浏览器存储';
}
function loadCurrent() {
  if (switchingAccount || !slot || !sameOwner(slot.user, currentUser())) {
    return {reason: '账号已变更，请重新进入后再读档'};
  }
  return readLocalSave(slot.user);
}
async function enterSlot(user) {
  const next = await openSave(user);
  if (engine.disposed) return;
  slot = next;
  ui.cancelPlacement();
  engine.setSelected(null);
  state = next?.state || createInitialState();
  lastAutoSave = performance.now();
  engine.setState(state);
  ui.onUserChange(currentUser());
  ui.refresh();
  ui.flashSaveHint(next?.hint || (next ? '' : '账号已变更，请重新进入后再存档'), !!next && !next.writable);
}
async function changeAccount(change) {
  if (switchingAccount || engine.disposed) return;
  // Persist the outgoing slot before its cookie changes, then suspend all saves.
  if (slot?.writable) saveGame(state, slot, {localOnly: true});
  switchingAccount = true;
  loop.stop();
  try {
    const user = await change();
    await enterSlot(user);
  } finally {
    switchingAccount = false;
    if (!engine.disposed) loop.start();
  }
}

// Restore once before ticking so late account responses cannot replace live progress.
const ready = (async () => {
  try {
    await enterSlot(await restoreSession());
  } finally {
    if (engine.disposed) return;
    bootReady = true;
    document.getElementById('app').inert = false;
    loop.start();
  }
})();

// 暴露调试句柄（控制台可用）
const disposeBridge=mountHubBridge({getState:()=>state,dispatch,isReady:()=>bootReady});
const onPageHide = e => { if (!e.persisted) dispose(); };
function dispose() { if(engine.disposed)return;window.removeEventListener("pagehide", onPageHide);if(window.__lingjing?.engine===engine)delete window.__lingjing;loop.stop();if(bootReady&&!switchingAccount&&slot?.writable)saveGame(state, slot);disposeBridge();ui.dispose();engine.dispose(); }
// 供统一壳无 iframe 挂载时卸载
window.__iridescentlyDispose = dispose;
window.addEventListener('pagehide', onPageHide);
if (import.meta.hot) import.meta.hot.dispose(dispose);
window.__lingjing = { state: () => state, dispatch, loop, events, engine, ui, ready, dispose };
