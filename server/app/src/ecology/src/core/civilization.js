import { random } from './random.js';
// stage-16：文明最小闭环 —— 资源点采集 → 资源入库 → 研究点解锁科技 → 文明进度 → 建城
//
// 设计约束（与全项目一致）：
//   1) 纯函数 + 不可变：本模块不修改任何入参，一律返回新对象（单向数据流，reducer 是唯一写入点）；
//   2) 不依赖 DOM / three.js：可在无头脚本里直接跑，便于验收断言（渲染另见 core/renderer.js）；
//   3) 不硬编码色值：本模块只产语义字段（kind / built / techs），一切颜色都在 ui/theme.js 的 COLORS；
//   4) 数值常量集中在 WORLD.civ*，调参不改逻辑。
//
// 闭环链路：部落成员在资源点半径内 → 按单位数产出入库（水/食物/矿物）
//           → 入库量折算研究点 → 研究点满足成本解锁「火种 → 工具」两级科技
//           → 资源 + 科技 + 聚落规模合成文明进度 → 进度满则建城（城邦落成，弹出资料页）

import { WORLD } from '../config/index.js';
import {
  TILE,
  tileAtGrid,
  worldToGrid,
  nearestLandPos,
} from '../world/map.js';
// stage-16：自动派遣复用 stage-15 的群体指令口径（ORDER），保证「一套指令语义、两处消费」
import { ORDER } from './tribe.js';

// 三类资源：水（生存）、食物（供养）、矿物（工具），三色语义见 COLORS.resource
export const RESOURCE_KINDS = ['water', 'food', 'mineral'];
export const RESOURCE_CN = { water: '水', food: '食物', mineral: '矿物' };

// 科技树：两级、串行解锁（先会用火，才谈得上造工具），成本单位为研究点
export const TECH_TREE = [
  {
    id: 'fire',
    tier: 1,
    name: '火种',
    cost: 45,
    requires: null,
    effect: '照明/烹饪：夜间采集不再折半，研究产出 +25%',
  },
  {
    id: 'tools',
    tier: 2,
    name: '工具',
    cost: 95,
    requires: 'fire',
    effect: '采集效率 ×1.6（石斧与容器让单位收集更快）',
  },
];

// 文明阶段：按进度分档（面板/HUD 直接展示中文，便于一眼判断处在哪个阶段）
export const CIV_STAGES = [
  { min: 1, key: 'city', cn: '城邦' },
  { min: 0.6, key: 'camp', cn: '聚落' },
  { min: 0.25, key: 'settle', cn: '定居' },
  { min: 0, key: 'wander', cn: '游群' },
];

export function stageOf(progress) {
  const p = Math.max(0, Math.min(1, progress || 0));
  for (const s of CIV_STAGES) if (p >= s.min) return s;
  return CIV_STAGES[CIV_STAGES.length - 1];
}

// 建城所需资源（与进度条同一口径，避免「进度满了却建不了城」的两套标准）
export const CIV_NEED = {
  water: WORLD.civBuildWater,
  food: WORLD.civBuildFood,
  mineral: WORLD.civBuildMineral,
};

// 资源存量上限：建城需求 × 系数。封顶后该资源不再入库（余量丢给环境），
// 这样进度条不会因为「屯得太多」而虚高，玩家也会自然转去开发别的资源点。
export const CIV_RES_CAP = {
  water: CIV_NEED.water * WORLD.civResCapMul,
  food: CIV_NEED.food * WORLD.civResCapMul,
  mineral: CIV_NEED.mineral * WORLD.civResCapMul,
};

function zOf(entity) {
  // 细胞用 pos[1] 存 z，有机体用 pos[2]，这里统一取值
  return entity.pos[2] ?? entity.pos[1];
}

// 在锚点周围按给定方位角找一个「非水域」落点（水域对陆地生物是硬障碍，落水里就没人采得到）。
// 拒绝采样：方位角与距离各自带抖动；若该方位角落水/出界，按 civNodeAngleStep 左右交替偏转再扫，
// 仍无解才退化为「环带中点附近的最近陆地」——绝不退化到全图随机，否则资源点会被甩到半个地图外，
// 游群够不着，闭环就永远走不完（stage-16 的“约 3~4 分钟建城”目标依赖点位可达）。
function findSpot(map, cx, cz, angle, rng) {
  const [dMin, dMax] = WORLD.civNodeSpread;
  for (let k = 0; k < WORLD.civNodeAngleTries; k++) {
    const turn = k === 0 ? 0 : Math.ceil(k / 2) * WORLD.civNodeAngleStep * (k % 2 ? 1 : -1);
    for (let i = 0; i < WORLD.civNodeSpotTries; i++) {
      const a = angle + turn + (rng() * 2 - 1) * WORLD.civNodeAngleJitter;
      const d = dMin + rng() * (dMax - dMin);
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (Math.abs(x) > map.half - map.cellSize || Math.abs(z) > map.half - map.cellSize) continue;
      const { gx, gy } = worldToGrid(map, x, z);
      if (tileAtGrid(map, gx, gy) === TILE.WATER) continue;
      return [x, z];
    }
  }
  const dMid = (dMin + dMax) / 2;
  return nearestLandPos(map, cx + Math.cos(angle) * dMid, cz + Math.sin(angle) * dMid);
}

// 资源点生成：围绕游群「质心锚点」均分方位角布置成资源环（水/食物/矿物交替）。
// 注意锚点要取质心而非逐个个体：若每个点各锚在一只个体上，六个点会被拉散到半张地图，
// 采集半径 12 就再也覆盖不到全部资源，闭环会长时间卡在缺某一种资源的死等状态。
export function createResourceNodes(map, anchors = [], rng = random) {
  if (!map) return [];
  const kinds = [];
  for (const k of RESOURCE_KINDS) {
    for (let i = 0; i < WORLD.civNodePerKind; i++) kinds.push(k);
  }
  let cx = 0;
  let cz = 0;
  if (anchors.length) {
    for (const a of anchors) {
      cx += a[0];
      cz += a[1];
    }
    cx /= anchors.length;
    cz /= anchors.length;
  }
  const nodes = [];
  for (let i = 0; i < kinds.length; i++) {
    const angle = (i / kinds.length) * Math.PI * 2;
    const [x, z] = findSpot(map, cx, cz, angle, rng);
    nodes.push({
      id: `res-${i + 1}`,
      kind: kinds[i],
      x,
      z,
      stock: WORLD.civNodeStock,
      max: WORLD.civNodeStock,
      gatherers: 0, // 本 tick 在该点采集的单位数（渲染脉动圈 / 面板读数都读它）
    });
  }
  return nodes;
}

export function createCivState(map, anchors = []) {
  return {
    nodes: createResourceNodes(map, anchors),
    resources: { water: 0, food: 0, mineral: 0 }, // 已入库资源
    research: 0,                                  // 当前可用研究点
    techs: { fire: false, tools: false },         // 已解锁科技
    progress: 0,                                  // 文明进度（0..1，建城条件）
    stageKey: 'wander',
    stageCn: '游群',
    built: false,                                 // 是否已建城
    builtAt: null,                                // 建城时刻（世界秒）
    city: null,                                   // { x, z, radius, name }
    gathered: 0,                                  // 累计入库资源（跨 tick 累计读数）
    rate: 0,                                      // 本 tick 采集速率（资源/秒）
    researchRate: 0,                              // 本 tick 研究点产出速率（点/秒）
    units: 0,                                     // 本 tick 参与采集的单位数
    unitsMax: 0,                                  // 历史最多参与单位数（进度 settle 项，单调不减）
    activeNodes: 0,                               // 本 tick 有单位在采的资源点数
    ackCity: false,                               // 玩家是否已读「建城」资料页
    milestones: [{ t: 0, text: '文明萌芽：游群开始在水、食物与矿物点采集' }],
  };
}

// 文明进度 = 资源入库 0.45 + 科技解锁 0.3 + 聚落规模 0.25
// 资源项取三类「各自完成度」的平均——缺一类就上不去，逼玩家同时经营水/食物/矿物。
export function civProgressOf({ resources = {}, techs = {}, unitsMax = 0 } = {}) {
  const resPart =
    RESOURCE_KINDS.reduce(
      (s, k) => s + Math.min(1, (resources[k] || 0) / CIV_NEED[k]),
      0
    ) / RESOURCE_KINDS.length;
  const techPart = TECH_TREE.filter((t) => techs[t.id]).length / TECH_TREE.length;
  const settlePart = Math.min(1, unitsMax / WORLD.civCityUnits);
  return (
    WORLD.civProgressWeightRes * resPart +
    WORLD.civProgressWeightTech * techPart +
    WORLD.civProgressWeightSettle * settlePart
  );
}

// 每 tick 的文明结算（纯函数）。
// ctx: { organisms, tribes, map, light, time, dt }
//   - light：stage-12 的昼夜光照（0 夜 → 1 昼），未掌握火科技时采集随光照衰减（夜间视野差）；
//   - tribes：stage-15 的部落；有部落则只有成员算劳动力，未成部落时全体有机体都是游群劳动力。
export function stepCivilization(civ, ctx = {}) {
  if (!civ) return civ;
  const { organisms = [], tribes = [], map, light = 1, time = 0, dt = 0 } = ctx;
  if (!(dt > 0)) return civ;

  const fire = !!civ.techs.fire;
  const tools = !!civ.techs.tools;
  // 夜间衰减：火=照明，掌握火种后夜间不再受影响
  const l = Math.max(0, Math.min(1, light));
  const lightMul = fire ? 1 : WORLD.civNightGatherMul + (1 - WORLD.civNightGatherMul) * l;
  const techMul = (tools ? WORLD.civToolsGatherMul : 1) * (fire ? WORLD.civFireGatherMul : 1);

  // 劳动力口径：优先「部落成员」（组织化采集）；尚未形成部落时全部有机体都是流动力
  const workerIds = new Set();
  for (const t of tribes) for (const id of t.members) workerIds.add(id);
  const workers = workerIds.size
    ? organisms.filter((o) => workerIds.has(o.id))
    : organisms.slice();

  const gain = { water: 0, food: 0, mineral: 0 };
  const busy = new Set();
  let rate = 0;
  let activeNodes = 0;
  let harvested = 0;
  const r2 = WORLD.civNodeRadius * WORLD.civNodeRadius;

  const nodes = (civ.nodes || []).map((n) => {
    if (n.stock <= 0) return { ...n, gatherers: 0 }; // 采空即枯竭，需另寻矿点
    const near = [];
    for (const o of workers) {
      const dx = o.pos[0] - n.x;
      const dz = zOf(o) - n.z;
      if (dx * dx + dz * dz <= r2) near.push(o.id);
    }
    // 单点采集单位上限：边际递减，避免开局把全群压在一个点上爆速通关
    const gatherers = Math.min(near.length, WORLD.civNodeUnitCap);
    if (gatherers <= 0) return { ...n, gatherers: 0 };
    for (let i = 0; i < gatherers; i++) busy.add(near[i]);
    const nodeRate = gatherers * WORLD.civNodeGatherPerSec * lightMul * techMul;
    // 存量上限内才入库（余量丢弃 -> 该资源封顶时玩家自然转去开发别的点）
    const room = Math.max(
      0,
      CIV_RES_CAP[n.kind] - (civ.resources?.[n.kind] || 0) - gain[n.kind]
    );
    const take = Math.min(n.stock, nodeRate * dt, room);
    if (take <= 0) return { ...n, gatherers: 0 };
    gain[n.kind] += take;
    harvested += take;
    rate += nodeRate;
    activeNodes += 1;
    return { ...n, gatherers, stock: n.stock - take };
  });

  const units = busy.size;

  // 研究点：入库资源折算（火=烹饪，额外 +25%）
  const researchMul = WORLD.civHarvestResearch * (fire ? WORLD.civFireResearchMul : 1);
  let research = (civ.research || 0) + harvested * researchMul;
  const researchRate = dt > 0 ? (harvested * researchMul) / dt : 0;

  // 科技解锁：串行前置，够成本即解锁并扣费
  const techs = { ...civ.techs };
  const milestones = (civ.milestones || []).slice();
  for (const tech of TECH_TREE) {
    if (techs[tech.id]) continue;
    if (tech.requires && !techs[tech.requires]) continue;
    if (research < tech.cost) continue;
    research -= tech.cost;
    techs[tech.id] = true;
    milestones.push({ t: time, text: `科技解锁：${tech.name} —— ${tech.effect}` });
  }

  const resources = {
    water: (civ.resources?.water || 0) + gain.water,
    food: (civ.resources?.food || 0) + gain.food,
    mineral: (civ.resources?.mineral || 0) + gain.mineral,
  };
  const unitsMax = Math.max(civ.unitsMax || 0, units);
  const progress = civProgressOf({ resources, techs, unitsMax });
  const st = stageOf(progress);

  // 建城：进度满 -> 城邦落成（位置取规模最大的部落中心，或世界原点附近的最近陆地）
  let built = !!civ.built;
  let builtAt = civ.builtAt ?? null;
  let city = civ.city || null;
  let ackCity = !!civ.ackCity;
  if (!built && progress >= 1 && map) {
    const home = tribes.length
      ? tribes.reduce((a, t) => (t.count > a.count ? t : a), tribes[0]).center
      : [0, 0];
    const spot = nearestLandPos(map, home[0], home[1]);
    built = true;
    builtAt = time;
    ackCity = false; // 建城即刻待读，弹资料页
    city = { x: spot[0], z: spot[1], radius: WORLD.civCityRadius, name: '初火城' };
    milestones.push({
      t: time,
      text: `建城：「${city.name}」落成于 (${spot[0].toFixed(0)}, ${spot[1].toFixed(0)})，文明进入城邦阶段`,
    });
  }
  if (milestones.length > 40) milestones.splice(0, milestones.length - 40);

  return {
    ...civ,
    nodes,
    resources,
    research,
    techs,
    progress,
    stageKey: st.key,
    stageCn: st.cn,
    built,
    builtAt,
    city,
    ackCity,
    gathered: (civ.gathered || 0) + harvested,
    rate,
    researchRate,
    units,
    unitsMax,
    activeNodes,
    milestones,
  };
}

// stage-16：文明层「单位自动采集」派遣——让「资源点 → 单位自动采集 → 资源入库」在无人干预下也能闭环。
// 为什么要这一层：资源环是围绕游群质心均分方位角铺开的，游群会自主游走/觅食，早晚会飘离某些资源点，
// 于是出现「食物、矿物在采、水点长期无人」的死等状态，进度条卡在缺某一类资源上永远走不到建城。
// 规则（玩家永远优先）：
//   1) 只派「自由状态（ROAM）」或「上一次由本函数派遣（tribe.auto）」的群体，玩家下过指令的群体一律不动；
//   2) 目标只从「仍有缺口且未枯竭（stock > 0）」的资源点里挑（缺口口径与进度条一致，都是 CIV_NEED）；
//   3) 群体中心已进入作业半径（civNodeRadius × civAutoArriveMul）就不驱赶，免得把正在采集的成员赶走；
//   4) 已派往的点带黏性打分（civAutoStickyMul），避免两群在同一 tick 互换目标来回抖动；
//   5) 建城后停止派遣（文明阶段结束，群体恢复自主行为）。
// 纯函数：不改入参；无变化时原样返回入参（避免每 tick 无谓分配）。
export function dispatchGatherers(tribes, civ, opts = {}) {
  const on = opts.force ?? WORLD.civAutoDispatch;
  if (!on) return tribes;
  if (!civ || civ.built || !Array.isArray(tribes) || !tribes.length) return tribes;
  const need = RESOURCE_KINDS.filter((k) => (civ.resources?.[k] || 0) < CIV_NEED[k]);
  if (!need.length) return tribes;
  const open = (civ.nodes || []).filter((n) => n.stock > 0 && need.includes(n.kind));
  if (!open.length) return tribes;

  const arrive = WORLD.civNodeRadius * WORLD.civAutoArriveMul;
  const sticky = WORLD.civNodeRadius * WORLD.civAutoStickyMul;
  let changed = false;
  const next = tribes.map((t) => {
    const ord = t.order || { mode: ORDER.ROAM };
    if (t.manual) return t; // 玩家亲自下过指令的群体，自动派遣永不干预
    if (ord.mode !== ORDER.ROAM && !t.auto) return t; // 玩家指令优先，绝不覆盖
    let best = null;
    let bestScore = Infinity;
    for (const n of open) {
      const d = Math.hypot(n.x - t.center[0], n.z - t.center[1]);
      const score = d - (t.work && t.work.x === n.x && t.work.z === n.z ? sticky : 0);
      if (score < bestScore) {
        bestScore = score;
        best = n;
      }
    }
    if (!best) return t;
    const d = Math.hypot(best.x - t.center[0], best.z - t.center[1]);
    if (d <= arrive) return t; // 已在作业半径内，保持不动
    const same = t.work && t.work.x === best.x && t.work.z === best.z;
    if (same && ord.mode === ORDER.MOVE && ord.tx === best.x && ord.tz === best.z) return t;
    changed = true;
    return {
      ...t,
      auto: true, // 标记「本群指令由文明层自动下达」，玩家下指令时清除
      work: { x: best.x, z: best.z, kind: best.kind },
      order: { mode: ORDER.MOVE, tx: best.x, tz: best.z },
    };
  });
  return changed ? next : tribes;
}

// 面板/HUD 展示用：科技树视图（含当前是否「差研究点」的可读状态）
export function techView(civ) {
  const techs = civ?.techs || {};
  const research = civ?.research || 0;
  return TECH_TREE.map((t) => {
    const unlocked = !!techs[t.id];
    const gated = !!(t.requires && !techs[t.requires]);
    return {
      id: t.id,
      tier: t.tier,
      name: t.name,
      cost: t.cost,
      effect: t.effect,
      requires: t.requires,
      unlocked,
      gated,
      ready: !unlocked && !gated && research >= t.cost,
      short: unlocked ? 0 : Math.max(0, t.cost - research),
    };
  });
}

// 一句话摘要（.progress.json 与最终汇报共用口径）
export function civSummary(civ) {
  if (!civ) return '文明未初始化';
  const techs = TECH_TREE.filter((t) => civ.techs?.[t.id]).map((t) => t.name).join('+') || '无';
  const res = RESOURCE_KINDS.map((k) => `${RESOURCE_CN[k]}${Math.round(civ.resources?.[k] || 0)}`).join('/');
  return `进度 ${Math.round((civ.progress || 0) * 100)}%（${civ.stageCn}）· 资源 ${res} · 研究 ${Math.round(civ.research || 0)} · 科技 ${techs}${civ.built ? ' · 已建城' : ''}`;
}
