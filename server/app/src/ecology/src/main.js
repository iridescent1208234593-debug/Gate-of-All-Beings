import { loadWorld, saveWorld } from './core/persistence.js';
import { mountSpacePanel } from './ui/spacePanel.js';
// 入口：装配 state + renderer + 游戏循环（单向数据流）
// stage-03：HUD 新增基因统计（存活种群平均速度/感知/体型、色系多样性）
// stage-04：HUD 新增分裂/压力淘汰计数，左下角世代结算面板（auto-evo 趋势）
// stage-06：细胞编辑器——[E]/按钮暂停世界，单击细胞打开编辑器，进化点消耗与累积
// stage-07：有机体 HUD（数量/均速/叶绿体产能）与“投放有机体 [O]”按钮
// stage-08：有机体行为 HUD——每秒统计各类行为个体数（觅/逃/压/光/巡）
// stage-09：生成编辑器——[G]/按钮进入“组装模式”，3x3 网格增删模块并预览合成效果
// stage-10：世代演化——HUD 增加三条营养带的存活/体型对比，右下角趋势图画出
// auto-evo 每代记录的“全体 / 富营养区 / 贫瘠区”平均模块数走向（体型分异证据）
// stage-12：昼夜循环 + 时间流速 + 生态经营面板——左上角面板实时显示
// 总能量/种群数/多样性(Simpson)/地图温度/时段，1x/2x/3x 倍速按钮（快捷键 1/2/3）
// 切换世界推进速度，昼夜光照影响叶绿体产能、感知视野与场景灯光。
import { createInitialState, reducer } from './core/state.js';
import { Actions } from './core/actions.js';
import { Renderer } from './core/renderer.js';
import { EditorUI } from './ui/editor.js';
import { OrganismEditorUI } from './ui/organismEditor.js';
import { TrendChart } from './ui/trendChart.js';
import { EcoPanel } from './ui/hud.js';
import { EnvMenu, ClimatePanel } from './ui/envPanel.js';
// stage-15：群体与领地——面板（DOM 覆盖层）与群体汇总读数
import { TribePanel } from './ui/tribePanel.js';
import { tribeSummary, ORDER } from './core/tribe.js';
// stage-16：文明最小闭环——资源点采集 / 研究点 / 两级科技 / 建城资料页
import { CivPanel } from './ui/civPanel.js';
import { WORLD } from './ui/theme.js';
import { computeOrganismStats } from './core/organism.js';
import { totalBiomass } from './world/plants.js';

const canvas = document.getElementById('scene');
const hudCells = document.getElementById('hud-cells');
const hudFood = document.getElementById('hud-food');
const hudEnergy = document.getElementById('hud-energy');
const hudGene = document.getElementById('hud-gene');
const hudSplit = document.getElementById('hud-split');
const hudCulled = document.getElementById('hud-culled');
const hudEvoPoints = document.getElementById('hud-evo-points');
const hudEvo = document.getElementById('hud-evo');
const hudFps = document.getElementById('hud-fps');
const hudOrg = document.getElementById('hud-org');
const hudBeh = document.getElementById('hud-beh');
const hudZone = document.getElementById('hud-zone');
const hudEco = document.getElementById('hud-eco');
// stage-14：神经网络个体读数（带脑占比 + NN/普通个体的人均觅食收益对比）
const hudNn = document.getElementById('hud-nn');
// stage-15：群体读数（群体数/成员/公共能量池/指令中/禁繁）
const hudTribe = document.getElementById('hud-tribe');
const hudCiv = document.getElementById('hud-civ'); // stage-16：文明读数（进度/科技/采集单位）
const btnEditor = document.getElementById('btn-editor');
const btnSpawn = document.getElementById('btn-spawn');
const btnOrgEditor = document.getElementById('btn-org-editor');

let initialError='';
let state;
try { state=loadWorld(); } catch(e) { initialError='旧存档读取失败，已保留；当前仅临时游玩。'; }
if(!state){state=createInitialState(crypto.getRandomValues(new Uint32Array(1))[0]);state.worldId=`eco-${crypto.randomUUID()}`;state.space.id=state.worldId;}
window.addEventListener('pagehide',()=>{if(!initialError)try{saveWorld(state);}catch{/* A pending harvest was already persisted before sending. */}});
const spacePanel=mountSpacePanel(()=>state,dispatch,initialError);
const renderer = new Renderer(canvas);
// ---- stage-10：世代趋势图（DOM Canvas2D 覆盖层，不参与 three.js 渲染）----
const trendChart = new TrendChart(document.getElementById('chart-modules'));
// ---- stage-12：生态经营面板（左上角 DOM 覆盖层，读状态不写世界）----
const ecoPanel = new EcoPanel(document.getElementById('eco-panel'), (scale) =>
  dispatch(Actions.setTimeScale(scale))
);
// ---- stage-13：气候读数面板（右上角）与地面干预菜单（点击处弹出）----
const climatePanel = new ClimatePanel(document.getElementById('climate-panel'));
// 菜单只上报“干预意图”，由这里映射成权威 Action（UI 层不认识 reducer 的 action type）
const envMenu = new EnvMenu(document.getElementById('env-menu'), (kind, payload) => {
  renderer.hideEnvMarker();
  switch (kind) {
    case 'seed':
      dispatch(Actions.seedPlants(payload.gx, payload.gy));
      break;
    case 'drain':
      dispatch(Actions.drainTile(payload.gx, payload.gy));
      break;
    case 'fill':
      dispatch(Actions.fillTile(payload.gx, payload.gy));
      break;
    case 'warm':
      dispatch(Actions.adjustTemp(WORLD.tempOffsetStep));
      break;
    case 'cool':
      dispatch(Actions.adjustTemp(-WORLD.tempOffsetStep));
      break;
    case 'resetTemp':
      dispatch(Actions.resetTemp());
      break;
    default:
      break;
  }
});

// 统一 dispatch：reducer -> 新状态 -> 同步 UI 覆盖层与暂停态样式
function dispatch(action) {
  const next = reducer(state, action);
  if(['HARVEST','ACK_HARVEST'].includes(action.type)){
    if(initialError)throw new Error('旧存档读取失败，请先导出当前生态，避免覆盖原存档。');
    saveWorld(next);
  }
  state = next;
  editorUI.update(state);
  orgEditorUI.update(state);
  // 暂停样式跟随权威状态（apply / close 等动作也会改 paused，统一在此收敛）
  document.body.classList.toggle('paused', state.paused);
}

// ---- stage-15：群体与领地面板 + 交互（选中群体 / 下达指令 / 选落点）----
// UI 侧只保存「当前选中群体」与「正在等落点的群体」两个渲染态字段；
// 群体指令本身写进权威状态（state.tribes[i].order），因此跨 tick 存续、可被面板与渲染层读到。
let selectedTribeId = null;
let awaitTribeTarget = null;

function selectTribe(id) {
  if (!id) return;
  selectedTribeId = id;
  renderer.selectedTribeId = id; // 渲染层据此高亮领地圈 / 放大标记 / 显示指令落点
  if (awaitTribeTarget && awaitTribeTarget !== id) awaitTribeTarget = null;
}

const tribePanel = new TribePanel(document.getElementById('tribe-panel'), {
  onSelect: (id) => selectTribe(id),
  onOrder: (id, mode) => {
    selectTribe(id);
    if (mode === ORDER.MOVE) {
      // 「移动」需要落点：进入选址态，等玩家点地面（不立即 dispatch，避免瞎走）
      awaitTribeTarget = id;
      closeEnvMenu();
      return;
    }
    awaitTribeTarget = null;
    dispatch(Actions.setTribeOrder(id, mode)); // 采集 / 自由：立即生效
  },
  onToggleBreed: (id) => {
    selectTribe(id);
    dispatch(Actions.toggleTribeBreed(id));
  },
});

// ---- stage-16：文明与科技面板装配 ----
// 「继续观察」只上报「已读建城资料页」这一个意图，其余读数全部由面板只读 state.civ。
const civPanel = new CivPanel(
  document.getElementById('civ-panel'),
  document.getElementById('victory-root'),
  { onAckCity: () => dispatch(Actions.ackCity()) }
);




// ---- stage-06：细胞编辑器装配 ----
const editorUI = new EditorUI((action) => dispatch(action));
// ---- stage-09：生成编辑器（组装模式）装配 ----
const orgEditorUI = new OrganismEditorUI((action) => dispatch(action));

// 暂停/恢复（按 E 或点 HUD 按钮）；恢复时若面板还开着则连同编辑缓冲一起丢弃
function togglePause() {
  if (state.paused) {
    dispatch(Actions.closeEditor());
    if (state.orgEditor) {
      dispatch(Actions.closeOrgEditor()); // 该动作会恢复播放并丢弃组装缓冲
      return;
    }
  }
  dispatch(Actions.togglePause());
}
btnEditor.addEventListener('click', togglePause);
window.addEventListener('keydown', (e) => {
  if (e.key === 'e' || e.key === 'E') togglePause();
});

// ---- stage-09：生成编辑器入口（按 G 或点 HUD 按钮）----
// 打开时自动选中离世界中心最近的有机体作为组装目标；已打开则关闭（丢弃缓冲并恢复播放）
function toggleOrgEditor() {
  if (state.orgEditor) {
    dispatch(Actions.closeOrgEditor()); // 丢弃缓冲并恢复播放
    return;
  }
  if (!state.organisms.length) return; // 场上没有有机体可组装
  if (!state.paused) dispatch(Actions.togglePause());
  let target = state.organisms[0];
  let best = Infinity;
  for (const o of state.organisms) {
    const d = o.pos[0] * o.pos[0] + (o.pos[2] ?? o.pos[1]) * (o.pos[2] ?? o.pos[1]);
    if (d < best) {
      best = d;
      target = o;
    }
  }
  dispatch(Actions.openOrgEditor(target.id));
}
if (btnOrgEditor) btnOrgEditor.addEventListener('click', toggleOrgEditor);
window.addEventListener('keydown', (e) => {
  if (e.key === 'g' || e.key === 'G') toggleOrgEditor();
  // 组装模式按 Esc 等同“关闭（丢弃）”
  if (e.key === 'Escape' && state.orgEditor) dispatch(Actions.closeOrgEditor());
  // stage-15：Esc 取消「等待落点」的选址态（不改动已下达的群体指令）
  if (e.key === 'Escape' && awaitTribeTarget) awaitTribeTarget = null;
});

// ---- stage-07：手动投放随机有机体（上限保护在 reducer 内）----
btnSpawn.addEventListener('click', () => dispatch(Actions.spawnOrganism()));
window.addEventListener('keydown', (e) => {
  if (e.key === 'o' || e.key === 'O') dispatch(Actions.spawnOrganism());
});

// ---- stage-12：时间流速快捷键（1/2/3 对应 1x/2x/3x，与面板按钮同源动作）----
window.addEventListener('keydown', (e) => {
  if (WORLD.timeScaleOptions.includes(Number(e.key))) {
    dispatch(Actions.setTimeScale(Number(e.key)));
  }
});

// 暂停时单击细胞 -> 打开编辑器（载入该细胞基因）；换选其它细胞即重新载入
renderer.onPickCell = (instanceIndex) => {
  closeEnvMenu(); // 改选生物时收起干预菜单，避免两层 UI 抢焦点
  if (!state.paused) return;
  if (state.orgEditor) return; // 组装模式优先，避免误开细胞编辑器
  const cell = state.cells[instanceIndex];
  if (cell) dispatch(Actions.openEditor(cell.id));
};

// stage-09：暂停时点击有机体 -> 切换组装目标（不改变暂停状态外的任何世界状态）
renderer.onPickOrganism = (organismId) => {
  closeEnvMenu();
  // stage-15：点中个体即选中它所属的群体——「从个体跳到群体」的顺手指入口
  const org = state.organisms.find((o) => o.id === organismId);
  if (org && org.tribeId) selectTribe(org.tribeId);
  if (!state.paused) return;
  dispatch(Actions.openOrgEditor(organismId));
};

// stage-13：点击空地 -> 在该格弹出环境干预菜单并高亮落点
// （干预在运行/暂停下都可下达：调温要配合时间推进才能看到选择压力显现）
function closeEnvMenu() {
  if (envMenu.isOpen) envMenu.close();
  renderer.hideEnvMarker();
}

renderer.onPickGround = (tile, screenX, screenY) => {
  if (state.orgEditor) return; // 组装模式下不抢点击
  // stage-15：正在等「移动」落点 -> 这一下点击当作行军目标，不再弹干预菜单
  if (awaitTribeTarget) {
    dispatch(Actions.setTribeOrder(awaitTribeTarget, ORDER.MOVE, tile.x, tile.z));
    awaitTribeTarget = null;
    closeEnvMenu();
    return;
  }
  renderer.showEnvMarker(state.map, tile.gx, tile.gy);
  envMenu.open(tile, screenX, screenY);
};

renderer.render(state);
editorUI.update(state);
trendChart.update(state);
window.addEventListener('resize', () => {
  trendChart.resize();
  trendChart.update(state);
});

let last = performance.now();
let frames = 0;
let fpsTime = 0;

let disposed = false;
function loop(now) {
  if (disposed) return;
  requestAnimationFrame(loop);
  const dt = (now - last) / 1000;
  last = now;

  // 单向流：动作 -> reducer -> 新状态 -> 渲染（暂停时 reducer 冻结世界，渲染照常）
  state = reducer(state, Actions.tick(dt));
  spacePanel.update();
  renderer.render(state);
  // stage-12：经营面板每帧读数（随 tick 更新；暂停时数字静止，倍速时变化更快）
  ecoPanel.update(state);
  // stage-13：气候读数每帧刷新（基线温度/生产力折扣/冷-暖适应占比）
  climatePanel.update(state);
  // stage-15：群体面板每帧刷新（成员/池/指令/禁繁 + 选址提示）；群体消失则清空选中
  if (selectedTribeId && !(state.tribes || []).some((t) => t.id === selectedTribeId)) {
    selectedTribeId = null;
    renderer.selectedTribeId = null;
    awaitTribeTarget = null;
  }
  tribePanel.update(state, { selectedTribeId, awaitTargetFor: awaitTribeTarget });
  // stage-16：文明与科技面板每帧刷新（进度条/三类资源/研究点/科技/采集单位），建城资料页按 civic 状态自动弹出
  civPanel.update(state);

  hudCells.textContent = `细胞: ${state.cells.length}`;
  hudFood.textContent = `食物: ${state.foods.length}`;
  hudEnergy.textContent = `平均能量: ${Math.round(state.stats.avgEnergy)}`;
  hudSplit.textContent = `分裂: ${state.stats.split}`;
  hudCulled.textContent = `淘汰: ${state.stats.culled}`;
  hudEvoPoints.textContent = `进化点: ${state.evoPoints}`;
  // stage-15：群体读数每帧刷新（群体数/成员/公共能量池/指令中/禁繁拦截），
  // 放在逐帧段而非每秒段：这样即使浏览器虚拟时间被压缩，读数也立刻可见。
  if (hudTribe) {
    const ts = state.tribeStats || {};
    const s = tribeSummary(state.tribes || []);
    hudTribe.textContent =
      `群体: ${s.count}群 成员${s.members} · 池${Math.round(s.pooled)} ` +
      `· 移动${s.moving} 采集${s.gathering} · 禁繁${s.banned}(拦${ts.blocked || 0})`;
  }
  // stage-16：文明读数每帧刷新（进度/阶段/研究点/科技/采集单位与作用点），同样放在逐帧段
  if (hudCiv) {
    const civ = state.civ;
    const techs = civ
      ? [civ.techs?.fire ? '火种' : null, civ.techs?.tools ? '工具' : null].filter(Boolean).join('+') || '无'
      : '无';
    hudCiv.textContent = civ
      ? `文明: ${Math.round((civ.progress || 0) * 100)}%（${civ.stageCn}）· 研究${Math.round(civ.research || 0)} ` +
        `· 科技${techs} · 采集${civ.units || 0}单位/${civ.activeNodes || 0}点${civ.built ? ' · 已建城' : ''}`
      : '文明: --';
  }

  frames++;
  fpsTime += dt;
  if (fpsTime >= 1) {
    const g = state.stats.gene;
    const a = state.autoEvo;
    const lastRec = a.records.length ? a.records[a.records.length - 1] : null;
    const os = computeOrganismStats(state.organisms);
    hudFps.textContent = `FPS: ${Math.round(frames / fpsTime)}`;
    hudGene.textContent =
      `基因: 速${g.speedAvg.toFixed(1)} 感${g.senseAvg.toFixed(1)} ` +
      `体${g.sizeAvg.toFixed(2)} 色系${g.colorCount}`;
    // stage-08：行为分布独立展示于左下 hud-beh（觅/逃/压/光/巡）
    hudOrg.textContent =
      `有机体: ${os.count} · 均速${os.speedAvg.toFixed(1)} ` +
      `· 均叶绿${os.photoAvg.toFixed(1)}/s · 吸收${Math.round(state.orgStats.absorbed)} ` +
      `· 组装${state.orgStats.edited || 0}`;
    if (hudBeh) {
      hudBeh.textContent =
        `行为: 觅${os.beh.seek} 逃${os.beh.flee} 压${os.beh.chase} ` +
        `光${os.beh.photo} 巡${os.beh.wander}`;
    }
    // stage-14：神经网络个体读数——带脑占比 + 人均觅食收益的“NN vs 普通”对比。
    // 后者是验收标准（有脑个体更会觅食）的直接证据：比值 > 1 即认知优势成立。
    if (hudNn) {
      const st = state.orgStats || {};
      const nnAvg = st.nnForageSamples ? st.nnForage / st.nnForageSamples : 0;
      const plAvg = st.plainForageSamples ? st.plainForage / st.plainForageSamples : 0;
      const ratio = plAvg > 1e-6 ? nnAvg / plAvg : 0;
      const share = os.count ? Math.round((os.nnCount / os.count) * 100) : 0;
      hudNn.textContent =
        `神经: ${os.nnCount}/${os.count} (${share}%) · ` +
        `觅食/只 NN ${nnAvg.toFixed(2)} vs 普通 ${plAvg.toFixed(2)} (×${ratio.toFixed(2)})`;
    }
    // stage-11：生态金字塔——生产者（植物株数/生物量）与三个营养级的实时数量，
    // 以及累计取食（植物被啃）与捕杀次数，用于核验三层是否处于动态平衡。
    if (hudEco) {
      const biomass = Math.round(totalBiomass(state.plants || []));
      const st = state.orgStats || {};
      hudEco.textContent =
        `生态: 植物${(state.plants || []).length}株/${biomass}生量 · ` +
        `草食${os.diet.herbivore} 肉食${os.diet.carnivore} 光合${os.diet.phototroph} · ` +
        `取食${Math.round(st.plantBitten || 0)} 啃空${st.plantEaten || 0} 捕杀${st.predKills || 0}`;
    }
    // stage-10：三条营养带（富/中/贫）的存活数与平均模块数——贫瘠带模块少＝体型小
    if (hudZone) {
      const orgRecs = a.orgRecords || [];
      const rec = orgRecs.length ? orgRecs[orgRecs.length - 1] : null;
      const zones = (rec && rec.zones) || [];
      if (zones.length) {
        const lab = ['富', '中', '贫'];
        const alive = zones.map((z, i) => `${lab[i] || i}${z.count}`).join(' ');
        const mods = zones.map((z, i) => `${lab[i] || i}${z.moduleAvg.toFixed(1)}`).join(' ');
        hudZone.textContent = `分区存活: ${alive}\n体型(模块): ${mods}`;
      } else {
        hudZone.textContent = '分区存活: --\n体型(模块): --';
      }
    }
    // stage-10：世代趋势图（模块数走向，观察体型分异）
    trendChart.update(state);
    if (lastRec) {
      const arrow = a.trend > 0.02 ? '↑' : a.trend < -0.02 ? '↓' : '→';
      hudEvo.textContent =
        `世代 ${a.gen} · 活${lastRec.alive}\n` +
        `速${lastRec.speedAvg.toFixed(2)} ${arrow} 体${lastRec.sizeAvg.toFixed(2)}`;
    }
    frames = 0;
    fpsTime = 0;
  }
}

requestAnimationFrame(loop);
// 供统一壳无 iframe 挂载时卸载（停止循环）
window.__iridescentlyDispose = () => { disposed = true; };
