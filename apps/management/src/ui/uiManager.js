/**
 * 灵境会馆 - UI 层
 * DOM 交互：倍速控制、暂停、建造菜单、网格点击放置、小妖列表、事件日志。
 * 所有修改都通过 dispatch(action) 走单向数据流。
 */
import { ActionTypes } from '../core/actionTypes.js';
import { isNight } from '../core/util.js';
import { BUILDINGS, getBuilding } from '../content/buildings.js';
import * as building from '../systems/building.js';
import { canPlace } from '../systems/spiritSpace.js';
import { mountManagementShell } from './managementShell.js';
import { getElement } from '../content/elements.js';
import { NEEDS } from '../content/needs.js';
import { COLONIST_STATES } from '../content/colonists.js';
import { RESEARCH, getResearch, canResearch, buildingResearch } from '../content/research.js';
import { RECIPES, getRecipe, skillLabel, MATERIAL_NAMES } from '../content/recipes.js';
import { ERAS, getEra, eraIndex, eraStatusList, canAdvance, nextEra } from '../content/eras.js';
import { EXPEDITION_TARGETS } from '../content/expeditionTargets.js';
import {
  hasActiveParty,
  hasHub,
  idleColonists,
  phaseDuration,
  partyProgress,
  MIN_PARTY,
  MAX_PARTY,
} from '../systems/expedition.js';
import { MENTAL_STATES, cultivationName } from '../systems/colonist.js';
import { getTrait } from '../content/traits.js';
import { GIFT_REPUTATION, GIFT_INTERVAL_TICKS } from '../systems/relations.js';
import { saveGame, loadGame, hasSave } from '../systems/saveGame.js';
import { login as accountLogin, logout as accountLogout, currentUser } from '../systems/account.js';
import { mountTurnstile, turnstileToken, resetTurnstile } from '../systems/turnstile.js';
import { COLOR_SCHEMES, getCurrentTheme, setTheme, applyThemeToDom } from '../core/theme.js';

const MOOD_EMOJI = { green: '😊', yellow: '😐', red: '😫' };
const MOOD_LABEL = { green: '愉快', yellow: '一般', red: '糟糕' };
const ELEMENT_NAME = { jin: '金', mu: '木', shui: '水', huo: '火', tu: '土' };

/** M6 选中详情：状态名 / 工作名 / 精神状态 */
const STATE_NAME = {
  [COLONIST_STATES.IDLE]: '空闲',
  [COLONIST_STATES.WORKING]: '工作中',
  [COLONIST_STATES.EATING]: '进食',
  [COLONIST_STATES.MOVING]: '移动',
  [COLONIST_STATES.SLEEPING]: '睡眠',
};
const WORK_NAME = {
  spirit: '采灵',
  cook: '烹饪',
  rest: '休憩',
  social: '外交',
  patrol: '巡逻',
  forge: '锻造',
  diplomacy: '传信',
  research: '研究',
  build: '建造', // M7
  craft: '炼制', // R1
  gather: '采集', // R1
};
const MENTAL_NAME = {
  [MENTAL_STATES.NORMAL]: '正常',
  [MENTAL_STATES.HOSTILE]: '敌对',
  [MENTAL_STATES.DEPRESSED]: '抑郁',
  [MENTAL_STATES.SICK]: '生病',
};

export class UIManager {
  /**
   * @param {object} opts
   * @param {(action: object) => void} opts.dispatch
   * @param {() => object} opts.getState
   * @param {import('../render/threeRenderer.js').RenderEngine} opts.engine
   * @param {(state: object) => void} [opts.onLoad]
   */
  constructor({ dispatch, getState, engine, onLoad }) {
    this.dispatch = dispatch;
    this.getState = getState;
    this.engine = engine;
    this.onLoad = onLoad || null;
    this.placement = null; // 当前建造中的 buildingId
    this.moveMode = false; // 移动模式
    this.moveBuilding = null; // 移动模式中已选中的建筑 id

    this.el = {
      time: document.getElementById('hud-time'),
      spirit: document.getElementById('hud-spirit'),
      food: document.getElementById('hud-food'),
      faqi: document.getElementById('hud-faqi'),
      speedControls: document.getElementById('speed-controls'),
      btnPause: document.getElementById('btn-pause'),
      buildList: document.getElementById('build-list'),
      researchList: document.getElementById('research-list'),
      craftList: document.getElementById('craft-list'),
      craftQueue: document.getElementById('craft-queue'),
      colonistCount: document.getElementById('colonist-count'),
      colonistList: document.getElementById('colonist-list'),
      eventLog: document.getElementById('event-log'),
      canvas: document.getElementById('game-canvas'),
      btnSave: document.getElementById('btn-save'),
      btnLoad: document.getElementById('btn-load'),
      btnMove: document.getElementById('btn-move'),
      btnDemolish: document.getElementById('btn-demolish'),
      btnExpand: document.getElementById('btn-expand'),
      btnExpandSouth: document.getElementById('btn-expand-south'),
      themeSelect: document.getElementById('theme-select'),
      accountStatus: document.getElementById('account-status'),
      btnLogin: document.getElementById('btn-login'),
      btnLogout: document.getElementById('btn-logout'),
      loginModal: document.getElementById('login-modal'),
      loginUsername: document.getElementById('login-username'),
      loginPassword: document.getElementById('login-password'),
      loginError: document.getElementById('login-error'),
      loginOk: document.getElementById('login-ok'),
      loginCancel: document.getElementById('login-cancel'),
      settingDifficulty: document.getElementById('setting-difficulty'),
      settingFrequency: document.getElementById('setting-frequency'),
      eraCurrentName: document.getElementById('era-current-name'),
      eraTabs: document.getElementById('era-tabs'),
      eraDetail: document.getElementById('era-detail'),
      eraAdvance: document.getElementById('era-advance'),
      settlementList: document.getElementById('settlement-list'),
      expeditionStatus: document.getElementById('expedition-status'),
      expeditionDispatch: document.getElementById('expedition-dispatch'),
      expeditionLog: document.getElementById('expedition-log'),
    };

    // 时代面板当前查看的时代（null = 跟随当前时代）；用户点击 tab 后切换
    this._eraView = null;
    // 远征派发勾选集合（重建 DOM 时保留选择）
    this._expSelected = new Set();
    // 面板 HTML 缓存（避免每 tick 重建闪烁）
    this._settlementHTML = '';
    this._expDispatchKey = '';
    this._expLogHTML = '';

    this.bindHud();
    this.bindTheme();
    this.bindEraPanel();
    this.bindBuildPanel();
    this.bindResearchPanel();
    this.bindCraftPanel();
    this.bindSaveControls();
    this.bindAccount();
    this.bindSettings();
    this.bindMoveExpand();
    this.bindCanvas();
    this.bindColonistPanel();
    this._disposeShell = mountManagementShell(this);
    this.onUserChange(currentUser());
    this.refresh();
  }

  bindAccount() {
    this.el.btnLogin.addEventListener('click', () => {
      document.getElementById('settings-dialog').close();
      this.el.loginModal.classList.remove('hidden');
      this.el.loginError.textContent = '';
      mountTurnstile(document.getElementById('login-turnstile'), 'auth').catch((err) => {
        this.el.loginError.textContent = err.message;
      });
      this.el.loginUsername.focus();
    });
    this.el.loginCancel.addEventListener('click', () => {
      this.el.loginModal.classList.add('hidden');
    });
    this.el.loginModal.addEventListener('click', (e) => {
      if (e.target === this.el.loginModal) this.el.loginModal.classList.add('hidden');
    });
    const submit = async () => {
      const username = this.el.loginUsername.value.trim();
      const password = this.el.loginPassword.value;
      if (!username || !password) {
        this.el.loginError.textContent = '请输入用户名和密码';
        return;
      }
      this.el.loginError.textContent = '登录中…';
      const token = turnstileToken();
      resetTurnstile();
      try {
        const { user, registered } = await accountLogin(username, password, token);
        this.el.loginModal.classList.add('hidden');
        this.el.loginUsername.value = '';
        this.el.loginPassword.value = '';
        this.onUserChange(user);
        this.flashSaveHint(registered ? `已注册并登录：${user.name}` : `欢迎回来：${user.name}`);
        // 登录后云存档优先读档
        const { loadCloudSave, saveGame } = await import('../systems/saveGame.js');
        const cloud = await loadCloudSave();
        if (cloud && this.onLoad) {
          this.onLoad(cloud);
          this.flashSaveHint('已读取云端存档');
        } else {
          saveGame(this.getState()); // 首次登录把当前进度同步上云
        }
      } catch (err) {
        this.el.loginError.textContent = err.message || '登录失败';
      }
    };
    this.el.loginOk.addEventListener('click', submit);
    this.el.loginPassword.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    this.el.btnLogout.addEventListener('click', async () => {
      await accountLogout();
      this.onUserChange(null);
      this.flashSaveHint('已退出登录');
    });
  }

  /** 登录状态变化后刷新账号区显示 */
  onUserChange(user) {
    if (user) {
      this.el.accountStatus.textContent = user.name || user.uid;
      this.el.btnLogin.classList.add('hidden');
      this.el.btnLogout.classList.remove('hidden');
    } else {
      this.el.accountStatus.textContent = '未登录';
      this.el.btnLogin.classList.remove('hidden');
      this.el.btnLogout.classList.add('hidden');
    }
  }

  /** 主题切换：填充方案列表 → 同步当前主题 → change 时切换并持久化 */
  bindTheme() {
    if (!this.el.themeSelect) return;
    this.el.themeSelect.innerHTML = COLOR_SCHEMES.map(
      (s) => `<option value="${s.name}">${s.name}</option>`
    ).join('');
    this.el.themeSelect.value = getCurrentTheme().name;
    this.el.themeSelect.addEventListener('change', () => {
      const theme = setTheme(this.el.themeSelect.value);
      applyThemeToDom(theme);
      this.flashSaveHint(`主题：${theme.name}`);
    });
  }

  bindSettings() {
    this.el.settingDifficulty.addEventListener('change', () => {
      this.dispatch({
        type: ActionTypes.SET_SETTINGS,
        payload: { difficulty: this.el.settingDifficulty.value },
      });
    });
    this.el.settingFrequency.addEventListener('change', () => {
      this.dispatch({
        type: ActionTypes.SET_SETTINGS,
        payload: { eventFrequency: this.el.settingFrequency.value },
      });
    });
  }

  bindMoveExpand() {
    this.el.btnMove.addEventListener('click', () => this.toggleMoveMode());
    this.el.btnExpand.addEventListener('click', () => {
      this.dispatch({ type: ActionTypes.SPACE_EXPAND, payload: { dir: 'east' } });
    });
    this.el.btnExpandSouth.addEventListener('click', () => {
      this.dispatch({ type: ActionTypes.SPACE_EXPAND, payload: { dir: 'south' } });
    });
    this.el.btnDemolish.addEventListener('click', () => {
      if (!this.moveBuilding) return;
      const inst = this.getState().buildings.find((b) => b.id === this.moveBuilding);
      if (!inst) return;
      this.dispatch({
        type: ActionTypes.BUILD_DEMOLISH,
        payload: { buildingId: inst.id },
      });
      this.exitMoveMode();
    });
  }

  toggleMoveMode() {
    if (this.moveMode) {
      this.exitMoveMode();
      this.flashSaveHint('已退出移动模式');
      return;
    }
    this.cancelPlacement();
    this.moveMode = true;
    this.moveBuilding = null;
    this.el.btnMove.classList.add('active');
    this.refreshMapMode();
    this.flashSaveHint('移动模式：点击建筑，再点目标位置');
  }

  bindEraPanel() {
    this.el.eraTabs.querySelectorAll('.era-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._eraView = btn.dataset.era;
        this.refreshEraPanel(this.getState());
      });
    });
    this.el.eraAdvance.addEventListener('click', () => {
      this.dispatch({ type: ActionTypes.ERA_ADVANCE });
    });
  }

  bindHud() {
    this.el.speedControls.querySelectorAll('.speed-btn[data-rate]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.dispatch({
          type: ActionTypes.SET_SPEED,
          payload: { rate: Number(btn.dataset.rate) },
        });
      });
    });
    this.el.btnPause.addEventListener('click', () => {
      this.dispatch({ type: ActionTypes.TOGGLE_PAUSE });
    });
  }

  bindBuildPanel() {
    for (const def of BUILDINGS) {
      const btn = document.createElement('button');
      btn.className = 'build-item';
      btn.dataset.id = def.id;
      btn.innerHTML = `
        <span class="bi-icon" style="color:${def.color}">${def.icon}</span>
        <span class="bi-main">
          <span class="bi-name">${def.name}</span>
          <span class="bi-cost">${formatCost(def.cost)}</span>
        </span>
      `;
      btn.addEventListener('click', () => {
        this.togglePlacement(def.id);
      });
      this.el.buildList.appendChild(btn);
    }
  }

  togglePlacement(buildingId) {
    this.exitMoveMode();
    if (this.placement === buildingId) {
      this.placement = null;
      this.engine.setPlacement(null);
    } else {
      this.placement = buildingId;
      this.engine.setPlacement(buildingId);
    }
    this.el.buildList.querySelectorAll('.build-item').forEach((b) => {
      b.classList.toggle('active', b.dataset.id === this.placement);
    });
    this.refreshMapMode();
    document.querySelectorAll('.paper-panel').forEach(p => p.classList.remove('is-open'));
  }

  bindResearchPanel() {
    for (const def of RESEARCH) {
      const item = document.createElement('button');
      item.className = 'research-item';
      item.dataset.id = def.id;
      item.innerHTML = `
        <div class="ri-head">
          <span class="ri-name">${def.name}</span>
          <span class="ri-state"></span>
        </div>
        <div class="ri-desc">${def.desc}</div>
        <div class="ri-progress hidden"><div class="ri-bar"></div></div>
      `;
      item.addEventListener('click', () => {
        const state = this.getState();
        if (state.tech.researching === def.id) {
          this.dispatch({ type: ActionTypes.CANCEL_RESEARCH });
          return;
        }
        if (state.tech.researching || state.tech.unlocked.includes(def.id)) return;
        if (!canResearch(state, def.id)) return;
        this.dispatch({ type: ActionTypes.RESEARCH_START, payload: { researchId: def.id } });
      });
      this.el.researchList.appendChild(item);
    }
  }

  bindSaveControls() {
    this.el.btnSave.addEventListener('click', () => {
      const ok = saveGame(this.getState());
      this.flashSaveHint(ok ? '已存档' : '存档失败');
    });
    this.el.btnLoad.addEventListener('click', () => {
      const loaded = loadGame();
      if (!loaded) {
        this.flashSaveHint('没有可用存档');
        return;
      }
      if (this.onLoad) this.onLoad(loaded);
      else this.dispatch({ type: 'LOAD_GAME', payload: { state: loaded } });
      this.flashSaveHint('已读档');
    });
  }

  flashSaveHint(msg) {
    let hint = document.getElementById('save-hint');
    if (!hint) {
      hint = document.createElement('span');
      hint.id = 'save-hint';
      hint.className = 'save-hint';
      this.el.btnSave.parentNode.appendChild(hint);
    }
    hint.textContent = msg;
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => {
      hint.textContent = '';
    }, 3500);
  }

  bindCanvas() {
    this.engine.bindInput({
      onTap: hit => { if (hit.inside) this.onGridClick(hit.gx, hit.gy, hit); },
      onCancel: () => this.cancelPlacement(),
    });
    this._keyHandler = e => {
      if (e.key === 'Escape') this.cancelPlacement();
    };
    window.addEventListener('keydown', this._keyHandler);
  }

  onGridClick(gx, gy, hit = {}) {
    const state = this.getState();
    if (gx < 0 || gy < 0 || gx >= state.space.width || gy >= state.space.height) return;
    if (this.moveMode) {
      this.onMoveClick(gx, gy);
      return;
    }
    if (this.placement) {
      const check = canPlace(state, this.placement, gx, gy);
      if (!check.ok) { this.flashSaveHint(check.reason.replace('spirit', '灵质')); return; }
      if (!buildingResearch(this.placement) || state.tech.unlocked.includes(buildingResearch(this.placement))) {
      this.dispatch({
        type: ActionTypes.BUILD_PLACE,
        payload: { buildingId: this.placement, x: gx, y: gy },
      });
      // M7：放置后提示需要小妖建造
      this.flashSaveHint('已放置，需小妖前往建造完成后方可生效');
      } else this.flashSaveHint('尚未研究解锁该建筑');
      // 保持建造模式以连续放置；右键/ESC 取消
    } else {
      const c = this.findColonistAt(gx, gy);
      const b = this.getBuildingAt(gx, gy);
      this.engine.setSelected(hit.id || c?.id || b?.id || null);
      this.refreshColonistPanel();
      this.refreshSelection();
    }
  }

  /** 移动模式：第一击选中建筑，第二击落位 */
  onMoveClick(gx, gy) {
    if (!this.moveBuilding) {
      const inst = this.getBuildingAt(gx, gy);
      if (!inst) {
        this.flashSaveHint('请点击一个建筑');
        return;
      }
      this.moveBuilding = inst.id;
      this.engine.setSelected(inst.id);
      const data = this.getState().buildings.find(b => b.id === inst.id);
      this.engine.setPlacement(data.buildingId, inst.id);
      this.el.btnDemolish.classList.remove('hidden');
      this.refreshMapMode();
      this.refreshSelection();
      this.flashSaveHint(`已选中「${inst.name}」，点目标位置移动，或点「拆除」`);
      return;
    }
    const inst = this.getState().buildings.find((b) => b.id === this.moveBuilding);
    if (!inst) {
      this.exitMoveMode();
      return;
    }
    this.engine.setMouse(gx, gy, true);
    const check = this.engine.placementCheck();
    if (!check.ok) { this.flashSaveHint(check.reason); return; }
    this.dispatch({
      type: ActionTypes.BUILD_MOVE,
      payload: { buildingId: inst.id, x: gx, y: gy },
    });
    this.exitMoveMode();
    this.flashSaveHint('建筑已搬迁');
  }

  getBuildingAt(gx, gy) {
    const t = this.getState().space.tiles[gy * this.getState().space.width + gx];
    if (!t || !t.buildingId) return null;
    const inst = this.getState().buildings.find((b) => b.id === t.buildingId);
    if (!inst) return null;
    const def = getBuilding(inst.buildingId);
    return { id: inst.id, name: def ? def.name : inst.buildingId };
  }

  exitMoveMode() {
    if (this.moveMode) this.engine.setPlacement(null);
    this.moveMode = false;
    this.moveBuilding = null;
    this.el.btnMove.classList.remove('active');
    this.el.btnDemolish.classList.add('hidden');
    this.refreshMapMode();
  }

  cancelPlacement() {
    this.placement = null;
    this.engine.setPlacement(null);
    this.el.buildList.querySelectorAll('.build-item').forEach((b) => b.classList.remove('active'));
    this.exitMoveMode();
  }

  mouseGrid(e) {
    return this.engine.screenToGrid(e.clientX, e.clientY);
  }

  findColonistAt(gx, gy) {
    return this.getState().colonists.find((c) => c.x === gx && c.y === gy) || null;
  }

  bindColonistPanel() {
    const addBtn = document.createElement('button');
    addBtn.className = 'add-colonist';
    addBtn.textContent = '+ 招新小妖';
    addBtn.addEventListener('click', () => this.dispatch({ type: ActionTypes.ADD_COLONIST }));
    this.el.colonistList.parentNode.insertBefore(addBtn, this.el.colonistList);
    this.addBtn = addBtn;
  }

  /** tick 后轻量刷新 */
  onTick(state) {
    this.refreshHud(state);
    this.refreshEraPanel(state);
    this.refreshRelationsPanel(state);
    this.refreshExpeditionPanel(state);
    this.refreshResearchPanel(state);
    this.refreshCraftPanel(state);
    this.refreshLog(state);
    this.refreshBuildPanel(state);
    if (state.tick % 4 === 0) this.refreshColonistPanel();
    this.refreshSelection();
  }

  /** 全量刷新（dispatch 后调用） */
  refresh() {
    const state = this.getState();
    this.refreshHud(state);
    this.refreshEraPanel(state);
    this.refreshRelationsPanel(state);
    this.refreshExpeditionPanel(state);
    this.refreshBuildPanel(state);
    this.refreshResearchPanel(state);
    this.refreshCraftPanel(state);
    this.refreshColonistPanel();
    this.refreshLog(state);
    this.syncSettingsControls(state);
    this.refreshSelection();
  }

  /** 设置控件与 state.settings 同步（读档后保持一致） */
  syncSettingsControls(state) {
    const s = state.settings || {};
    if (this.el.settingDifficulty && s.difficulty) {
      this.el.settingDifficulty.value = s.difficulty;
    }
    if (this.el.settingFrequency && s.eventFrequency) {
      this.el.settingFrequency.value = s.eventFrequency;
    }
  }

  refreshHud(state) {
    this.el.time.textContent = formatTime(state.time);
    const cap = this.getStorageCap(state);
    this.el.spirit.textContent = `${Math.floor(state.resources.spirit)}/${cap.spirit}`;
    this.el.food.textContent = `${Math.floor(state.resources.food)}/${cap.food}`;
    this.el.faqi.textContent = Math.floor(state.resources.faqi || 0);
    this.el.colonistCount.textContent = state.colonists.length;

    this.el.speedControls.querySelectorAll('.speed-btn[data-rate]').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.rate) === state.speed);
    });
    this.el.btnPause.textContent = state.paused ? '▶' : '⏸';
    this.el.btnPause.setAttribute('aria-label', state.paused ? '继续' : '暂停');
    const stock = document.getElementById('material-stock');
    if (stock) stock.textContent = `灵木 ${Math.floor(state.resources.wood || 0)} · 草药 ${Math.floor(state.resources.herb || 0)} · 石料 ${Math.floor(state.resources.stone || 0)} · 矿料 ${Math.floor(state.resources.ore || 0)}`;
  }

  /** 计算资源存储上限（基础 + 已建成灵仓扩容，与 reducer applyStorageCap 一致；M7 只认建成） */
  getStorageCap(state) {
    const cap = { spirit: 400, food: 300 };
    for (const b of state.buildings) {
      const def = getBuilding(b.buildingId);
      if (def && def.storageCap && building.isBuilt(b)) {
        for (const [k, v] of Object.entries(def.storageCap)) {
          cap[k] = (cap[k] ?? 0) + v;
        }
      }
    }
    return cap;
  }

  /** 时代面板：当前时代名 + 三时代查看 + 跃迁条件/按钮 */
  refreshEraPanel(state) {
    const eraDef = getEra(state.era);
    this.el.eraCurrentName.textContent = eraDef ? eraDef.name : state.era;

    const curIdx = eraIndex(state.era);
    const next = nextEra(state);
    const canGo = canAdvance(state);
    // 查看目标：默认跟随当前时代，用户点 tab 后锁定
    const viewEra = this._eraView || state.era;
    const viewIdx = eraIndex(viewEra);

    this.el.eraTabs.querySelectorAll('.era-tab').forEach((btn) => {
      const idx = eraIndex(btn.dataset.era);
      btn.classList.toggle('active', btn.dataset.era === viewEra);
      btn.classList.toggle('past', idx < curIdx);
      btn.classList.toggle('future', idx > curIdx);
    });

    // 详情区（HTML 变化才重建，避免闪烁）
    const vdef = getEra(viewEra);
    let html = `<span class="era-desc">${vdef ? vdef.desc : ''}</span>`;
    if (viewIdx < curIdx) {
      html += '<span class="era-state-done">✓ 已跃迁</span>';
    } else if (viewIdx === curIdx) {
      html += '<span class="era-state-cur">◆ 当前时代</span>';
    } else {
      const statuses = eraStatusList(state, viewEra);
      html += '<span class="era-conds">' +
        statuses.map((s) => `<span class="${s.done ? 'cond-ok' : 'cond-miss'}">${s.done ? '✓' : '✗'} ${s.label}</span>`).join('') +
        '</span>';
    }
    if (html !== this._eraDetailHTML) {
      this.el.eraDetail.innerHTML = html;
      this._eraDetailHTML = html;
    }

    // 跃迁按钮：仅当查看下一时代且满足条件时显示
    const showAdvance = viewEra === next && canGo && next;
    this.el.eraAdvance.classList.toggle('hidden', !showAdvance);
    if (showAdvance) {
      const nd = getEra(next);
      this.el.eraAdvance.textContent = `✨ 跃迁至「${nd ? nd.name : next}」`;
    }
  }

  /** 关系面板：聚落名称 / 声望条 / 结盟 / 进贡状态 */
  refreshRelationsPanel(state) {
    const list = (state.relations && state.relations.settlements) || [];
    if (list.length === 0) {
      this.el.settlementList.innerHTML = '<span class="panel-empty">尚未接触人类聚落</span>';
      return;
    }
    const html = list
      .map((s) => {
        const rep = Math.max(0, Math.min(100, s.reputation || 0));
        const giftState = this.giftStateText(state, s);
        return `<div class="settlement-item">
          <div class="st-head"><span class="st-name">${s.name}</span><span class="st-ally">${s.ally ? '🤝 已结盟' : ''}</span></div>
          <div class="rep-bar"><div class="rep-fill" style="width:${rep}%"></div></div>
          <div class="st-meta"><span>声望 ${Math.floor(rep)}</span><span>${giftState}</span></div>
        </div>`;
      })
      .join('');
    if (html !== this._settlementHTML) {
      this.el.settlementList.innerHTML = html;
      this._settlementHTML = html;
    }
  }

  giftStateText(state, s) {
    if (s.ally) return '进贡中';
    if (s.reputation >= GIFT_REPUTATION) {
      const sinceGift = state.tick - (s.lastGiftTick || 0);
      if (sinceGift >= GIFT_INTERVAL_TICKS) return '可进贡';
      return '进贡冷却中';
    }
    return '';
  }

  /** 远征面板：当前队状态 / 派发区 / 最近日志 */
  refreshExpeditionPanel(state) {
    const hub = hasHub(state);
    const active = hasActiveParty(state);
    const parties = state.expedition.parties || [];

    if (!hub) {
      this.el.expeditionStatus.innerHTML = '<span class="panel-empty">需先建造传送枢纽（研究「传送阵」解锁）</span>';
    } else if (active) {
      const p = parties[0];
      const phaseName = phaseLabel(p.phase);
      const pct = Math.round(partyProgress(p) * 100);
      const members = (p.colonists || [])
        .map((c) => `<span class="exp-member" style="color:${getElement(c.element).color}">${c.name}</span>`)
        .join('');
      this.el.expeditionStatus.innerHTML = `<div class="expedition-party">
        <div class="ep-head"><span>「${p.target}」${p.targetDesc ? `<span class="ep-desc">${p.targetDesc}</span>` : ''}</span><span class="ep-phase">${phaseName}</span></div>
        <div class="rep-bar"><div class="rep-fill" style="width:${pct}%"></div></div>
        <div class="ep-meta">进度 ${pct}% · 队员 ${members}</div>
      </div>`;
    } else {
      this.el.expeditionStatus.innerHTML = '<span class="panel-empty">无进行中远征</span>';
    }

    this.renderExpeditionDispatch(state, hub, active);
    this.refreshExpeditionLog(state);
  }

  /** 派发区：勾选 2~5 只空闲小妖 + 目标名 + 出发按钮（重建时保留勾选） */
  renderExpeditionDispatch(state, hub, active) {
    if (!hub) {
      this.el.expeditionDispatch.innerHTML = '';
      return;
    }
    if (active) {
      this.el.expeditionDispatch.innerHTML = '<span class="panel-empty">远征进行中，无法再次派发</span>';
      this._expDispatchKey = 'active';
      return;
    }
    const idle = idleColonists(state);
    const key = `idle|${idle.map((c) => c.id).join(',')}`;
    if (key === this._expDispatchKey) return; // 无变化，保留现有 DOM（含勾选）

    this._expDispatchKey = key;
    if (idle.length === 0) {
      this.el.expeditionDispatch.innerHTML = '<span class="panel-empty">没有空闲小妖可派遣</span>';
      return;
    }
    const opts = idle
      .map((c) => `<label class="exp-colonist-option">
        <input type="checkbox" value="${c.id}" ${this._expSelected.has(c.id) ? 'checked' : ''}/>
        <span style="color:${getElement(c.element).color}">${c.name}</span><em>${ELEMENT_NAME[c.element]}</em>
      </label>`)
      .join('');
    const targetOptions = EXPEDITION_TARGETS.map(
      (t) => `<option value="${t.name}">${t.name}</option>`
    ).join('');
    this.el.expeditionDispatch.innerHTML = `
      <div class="exp-select-title">选择 ${MIN_PARTY}~${MAX_PARTY} 只空闲小妖</div>
      <div class="exp-select-list">${opts}</div>
      <div class="exp-actions">
        <select id="exp-target" class="exp-target" title="选择远征目标（默认随机）">
          <option value="">随机目标</option>
          ${targetOptions}
        </select>
        <button id="exp-send" class="exp-send">出发</button>
      </div>`;

    this.el.expeditionDispatch.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        if (cb.checked) this._expSelected.add(cb.value);
        else this._expSelected.delete(cb.value);
      });
    });
    this.el.expeditionDispatch.querySelector('#exp-send').addEventListener('click', () => {
      const ids = [...this._expSelected];
      if (ids.length < MIN_PARTY || ids.length > MAX_PARTY) {
        this.flashSaveHint(`请选择 ${MIN_PARTY}~${MAX_PARTY} 只小妖`);
        return;
      }
      const input = this.el.expeditionDispatch.querySelector('#exp-target');
      const target = input ? input.value.trim() : '';
      this.dispatch({
        type: ActionTypes.EXPEDITION_START,
        payload: { colonistIds: ids, target },
      });
      this._expSelected.clear();
    });
  }

  /** 远征最近日志（eventLog 中远征相关最后 3 条） */
  refreshExpeditionLog(state) {
    const msgs = state.eventLog.filter((e) => e.includes('远征')).slice(-3);
    const html = msgs.length
      ? msgs.map((m) => `<div class="exp-log-item">${m}</div>`).join('')
      : '<span class="panel-empty">暂无远征记录</span>';
    if (html !== this._expLogHTML) {
      this.el.expeditionLog.innerHTML = html;
      this._expLogHTML = html;
    }
  }

  refreshBuildPanel(state) {
    this.el.buildList.querySelectorAll('.build-item').forEach((btn) => {
      const def = getBuilding(btn.dataset.id);
      if (!def) return;
      const affordable = Object.entries(def.cost).every(
        ([k, v]) => (state.resources[k] ?? 0) >= v
      );
      const rid = buildingResearch(def.id);
      const unlocked = !rid || state.tech.unlocked.includes(rid);
      btn.classList.toggle('disabled', !affordable || !unlocked);
      btn.classList.toggle('locked', !unlocked);
      btn.disabled = !affordable || !unlocked;
      const costEl = btn.querySelector('.bi-cost');
      if (!unlocked) {
        costEl.textContent = `🔒 ${getResearch(rid) ? getResearch(rid).name : '研究解锁'}`;
      } else {
        costEl.textContent = formatCost(def.cost);
      }
    });
  }

  refreshResearchPanel(state) {
    this.el.researchList.querySelectorAll('.research-item').forEach((item) => {
      const def = getResearch(item.dataset.id);
      if (!def) return;
      const done = state.tech.unlocked.includes(def.id);
      const researching = state.tech.researching === def.id;
      const ready = canResearch(state, def.id);
      const stateEl = item.querySelector('.ri-state');
      const progEl = item.querySelector('.ri-progress');
      const barEl = item.querySelector('.ri-bar');

      item.classList.toggle('done', done);
      item.classList.toggle('researching', researching);
      item.classList.toggle('disabled', !done && !ready && !researching);

      if (done) {
        stateEl.textContent = '✓ 已解锁';
        progEl.classList.add('hidden');
      } else if (researching) {
        stateEl.textContent = `研究中 ${Math.floor((state.tech.progress / def.durationTicks) * 100)}%`;
        progEl.classList.remove('hidden');
        barEl.style.width = `${Math.min(100, (state.tech.progress / def.durationTicks) * 100)}%`;
      } else if (!ready) {
        const need = def.requires.map((rid) => getResearch(rid).name).join('、');
        stateEl.textContent = need ? `需先研究 ${need}` : '';
        progEl.classList.add('hidden');
      } else {
        stateEl.textContent = '点击研究';
        progEl.classList.add('hidden');
      }
    });
  }

  // ---------- R1 合成面板 ----------
  bindCraftPanel() {
    for (const def of RECIPES) {
      const item = document.createElement('div');
      item.className = 'craft-item';
      item.dataset.id = def.id;
      const r = def.result;
      const outName = MATERIAL_NAMES[r.id] || r.id;
      const outQty = r.type === 'resource' ? `+${r.amount}` : `×${r.amount || 1}`;
      const bldId = def.requires && def.requires.building;
      const bldName = bldId && getBuilding(bldId) ? getBuilding(bldId).name : bldId || '';
      const costTxt = Object.entries(def.materials || {})
        .map(([k, v]) => `${MATERIAL_NAMES[k] || k}×${v}`)
        .join(' + ');
      item.innerHTML = `
        <div class="cr-head">
          <span class="cr-name">${def.name}</span>
          <span class="cr-state"></span>
        </div>
        <div class="cr-desc">${def.desc}</div>
        <div class="cr-meta">🏭 ${bldName} · ${skillLabel(def)} · 约 ${Math.round(def.timeTicks / 4)}s</div>
        <div class="cr-costs">${costTxt} <span class="cr-arrow">→</span> ${outName}${outQty}</div>
      `;
      item.addEventListener('click', () => {
        const recipe = getRecipe(item.dataset.id);
        if (!recipe) return;
        const bld = recipe.requires && recipe.requires.building;
        const built = bld
          ? this.getState().buildings.some((b) => b.buildingId === bld && building.isBuilt(b))
          : false;
        if (!built) return;
        this.dispatch({ type: ActionTypes.CRAFT_ENQUEUE, payload: { recipeId: recipe.id } });
      });
      this.el.craftList.appendChild(item);
    }
    // 队列取消按钮事件委托
    this.el.craftQueue.addEventListener('click', (e) => {
      const btn = e.target.closest('.cq-cancel');
      if (!btn || !btn.dataset.recipeId) return;
      this.dispatch({ type: ActionTypes.CRAFT_CANCEL, payload: { recipeId: btn.dataset.recipeId } });
    });
    this._craftQKey = '';
  }

  refreshCraftPanel(state) {
    this.refreshCraftItems(state);
    this.refreshCraftQueue(state);
  }

  refreshCraftItems(state) {
    const queue = (state.crafting && state.crafting.queue) || [];
    const counts = {};
    for (const rid of queue) counts[rid] = (counts[rid] || 0) + 1;
    this.el.craftList.querySelectorAll('.craft-item').forEach((item) => {
      const recipe = getRecipe(item.dataset.id);
      if (!recipe) return;
      const bld = recipe.requires && recipe.requires.building;
      const built = bld
        ? state.buildings.some((b) => b.buildingId === bld && building.isBuilt(b))
        : false;
      const queued = counts[recipe.id] || 0;
      const stateEl = item.querySelector('.cr-state');
      item.classList.toggle('disabled', !built);
      item.classList.toggle('queued', queued > 0);
      if (!built) {
        const bldName = bld && getBuilding(bld) ? getBuilding(bld).name : bld;
        stateEl.textContent = `🔒 需建${bldName || ''}`;
      } else if (queued > 0) {
        stateEl.textContent = `队列×${queued}`;
      } else {
        stateEl.textContent = '点击排队';
      }
    });
  }

  refreshCraftQueue(state) {
    const queue = (state.crafting && state.crafting.queue) || [];
    const countEl = document.getElementById('craft-queue-count');
    if (countEl) countEl.textContent = queue.length > 0 ? `${queue.length}` : '';
    const activeJob =
      state.colonists.find((c) => c.job && c.job.workType === 'craft') || null;
    const activeId = activeJob ? activeJob.job.recipeId : '';
    const key = `${queue.join('|')}__${activeId}`;
    const el = this.el.craftQueue;
    if (this._craftQKey !== key) {
      this._craftQKey = key;
      if (queue.length === 0) {
        el.innerHTML =
          '<div class="cq-empty">队列为空：工坊建成后点上方配方排队，<br/>材料不足时小妖会自动采集补料</div>';
      } else {
        el.innerHTML = queue
          .map((rid, i) => {
            const recipe = getRecipe(rid);
            const name = recipe ? recipe.name : rid;
            const isActive = activeId === rid && i === 0;
            return `<div class="cq-item${isActive ? ' cq-active' : ''}">
              <span>${i + 1}. ${name}</span>
              <span class="cq-right">${isActive ? '<span class="cq-pct">…</span>' : ''}<button class="cq-cancel" data-recipe-id="${rid}" title="移出队列">✕</button></span>
            </div>`;
          })
          .join('');
      }
    }
    // 队首活跃进度：DOM 常驻时仅更新文本，避免每 tick 重建闪烁
    if (activeJob) {
      const pctEl = el.querySelector('.cq-item.cq-active .cq-pct');
      if (pctEl) {
        const pct = Math.min(100, Math.floor((activeJob.job.progress / activeJob.job.workTime) * 100));
        pctEl.textContent = `${pct}%`;
      }
    }
  }

  refreshColonistPanel() {
    const state = this.getState();
    this.el.colonistList.innerHTML = '';
    for (const c of state.colonists) {
      const lowest = lowestNeed(c);
      const selected = this.engine.selectedId === c.id;
      const el = document.createElement('div');
      el.className = 'colonist-item' + (selected ? ' selected' : '');
      el.innerHTML = `
        <span class="ci-dot" style="background:${getElement(c.element).color}"></span>
        <span class="ci-name">${c.name}</span>
        <span class="ci-elem">${ELEMENT_NAME[c.element]}</span>
        <span class="ci-mood" title="${MOOD_LABEL[c.mood]}">${MOOD_EMOJI[c.mood]}</span>
        <span class="ci-need">${lowest ? NEEDS.find((n) => n.id === lowest.id).name : ''} ${lowest ? Math.round(lowest.value) : ''}</span>
        ${c.desc ? `<span class="ci-desc">${[...c.desc].slice(0, 30).join('')}</span>` : ''}
      `;
      // M6 选中详情：五行 / 心情 / 精神 / 状态与工作 / 五需求
      if (selected) {
        const stateName = STATE_NAME[c.state] || c.state;
        const workName = c.job ? WORK_NAME[c.job.workType] || c.job.workType : '';
        // M7：正在建造时显示建造进度
        let statusText = stateName;
        if (c.job && c.job.workType === 'build') {
          const pct = c.job.workTime > 0 ? Math.round((c.job.progress / c.job.workTime) * 100) : 0;
          statusText = `建造中(${pct}%)`;
        } else if (workName) {
          statusText = `${stateName}（${workName}）`;
        }
        const detail = document.createElement('div');
        detail.className = 'ci-detail';
        detail.innerHTML = `
          <div class="ci-d-row"><span class="ci-d-label">五行</span><span>${ELEMENT_NAME[c.element] || c.element}</span></div>
          <div class="ci-d-row"><span class="ci-d-label">修为</span><span>${cultivationName(c.element, (c.cultivation && c.cultivation.level) || 1)}</span></div>
          <div class="ci-d-row"><span class="ci-d-label">特质</span><span>${(c.traits || []).map((id) => (getTrait(id) || {}).name || id).join('、') || '无'}</span></div>
          <div class="ci-d-row"><span class="ci-d-label">心情</span><span>${MOOD_EMOJI[c.mood] || ''} ${MOOD_LABEL[c.mood] || c.mood}</span></div>
          <div class="ci-d-row"><span class="ci-d-label">精神</span><span>${MENTAL_NAME[c.mentalState] || '正常'}</span></div>
          <div class="ci-d-row"><span class="ci-d-label">状态</span><span>${statusText}</span></div>
          <div class="ci-d-needs">
            ${NEEDS.map((n) => {
              const val = Math.round(c.needs[n.id] ?? 0);
              return `<div class="ci-d-need"><span class="ci-dn-name">${n.icon}${n.name}</span><div class="ci-dn-bar"><div style="width:${Math.max(0, Math.min(100, val))}%"></div></div><b>${val}</b></div>`;
            }).join('')}
          </div>
        `;
        el.appendChild(detail);
      }
      el.addEventListener('click', () => {
        this.engine.setSelected(this.engine.selectedId === c.id ? null : c.id);
        this.engine.focusSelected();
        this.refreshColonistPanel();
        this.refreshSelection();
      });
      this.el.colonistList.appendChild(el);
    }
  }

  refreshLog(state) {
    const recent = state.eventLog.slice(-4);
    this.el.eventLog.innerHTML = recent.map((m) => `<span class="log-item">${m}</span>`).join('');
  }

  refreshMapMode() {
    const el = document.getElementById('map-mode');
    if (!el) return;
    el.classList.toggle('hidden', !this.placement && !this.moveMode);
    document.getElementById('map-mode-text').textContent = this.placement
      ? `营造 · ${getBuilding(this.placement).name}，点击空地放置`
      : this.moveBuilding ? '搬迁 · 点击目标空地' : '搬迁 · 先选择一座建筑';
  }

  refreshSelection() {
    const panel = document.getElementById('selection-detail');
    if (!panel) return;
    const state = this.getState();
    const b = state.buildings.find(b => b.id === this.engine.selectedId);
    panel.classList.toggle('hidden', !b || !!this.placement || this.moveMode);
    if (!b) return;
    const def = getBuilding(b.buildingId);
    const text = `${def.name}|${b.workers.length}|${Math.floor(b.construction || 0)}|${b.hp}`;
    if (panel.dataset.state === text) return;
    panel.dataset.state = text;
    panel.replaceChildren();
    const title = document.createElement('strong'); title.textContent = def.name;
    const desc = document.createElement('p'); desc.textContent = def.desc;
    const detail = document.createElement('p'); detail.textContent = `工位 ${b.workers.length}/${def.maxWorkers} · ${building.isBuilt(b) ? '已建成' : `施工 ${Math.floor((b.construction || 0) / (b.buildTime || 1) * 100)}%`} · 耐久 ${Math.ceil(b.hp)}`;
    const actions = document.createElement('div'); actions.className = 'selection-actions';
    const move = document.createElement('button'); move.textContent = '搬迁 / 拆除';
    move.onclick = () => { this.toggleMoveMode(); this.onMoveClick(b.x, b.y); };
    const close = document.createElement('button'); close.textContent = '收起'; close.onclick = () => { this.engine.setSelected(null); this.refreshSelection(); };
    actions.append(move, close); panel.append(title, desc, detail, actions);
  }

  dispose() {
    clearTimeout(this._hintTimer);
    window.removeEventListener('keydown', this._keyHandler);
    this._disposeShell?.();
  }
}

function lowestNeed(c) {
  let lowest = null;
  for (const [id, value] of Object.entries(c.needs)) {
    if (!lowest || value < lowest.value) lowest = { id, value };
  }
  return lowest;
}

function phaseLabel(phase) {
  return phase === 'travel' ? '行路' : phase === 'event' ? '目标事件' : '归途';
}

function formatCost(cost) {
  return Object.entries(cost)
    .map(([k, v]) => `${k === 'spirit' ? '灵质' : k}${v}`)
    .join(' ');
}

function formatTime(time) {
  const hh = Math.floor(time.minute / 20);
  const mm = (time.minute % 20) * 3;
  const mark = isNight(time) ? '🌙' : '☀';
  return `${mark} 天 ${time.day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
