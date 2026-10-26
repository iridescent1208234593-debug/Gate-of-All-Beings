import { withRandomState } from './random.js';
import { createSpace, stepLingCycle, harvest } from './lingCycle.js';
import { ELEMENTS } from '@lxh/shared-types/world';
import { random } from './random.js';
// GameState 创建与 reducer：单向数据流（Action -> reducer -> state）
// stage-03：基因数据模型与随机变异——每个细胞携带 genome，
// 速度/体型/感知/代谢/色系均由基因推导；新个体继承父基因并小幅变异；
// 灭绝重播种以“存活平均基因池”为父本，保证基因有连续性、差异肉眼可见。
// stage-04：分裂繁殖与基础自然选择——能量满格一分为二（子代变异），
// 种群超上限按能量淘汰最弱，每 N 秒 auto-evo 结算一代存活基因统计。
// stage-06：细胞编辑器 MVP——暂停/打开编辑器/微调基因(耗进化点)/应用基因。
// stage-07：多细胞模块模型——引入 organisms[]：由 body/flagellum/mouth/chloroplast
// 模块粘合的有机体整体游动；移动/进食/被动产能体现模块加成（organism.js 合成）。
// stage-08：有机体自主行为——每 tick 由 behaviors.js 决策（觅食/逃离/压制/光合/
// 巡游，权值来自模块构成），行为差异体现在移动模式与行动成本（drainMul）。
// stage-09：生成编辑器——暂停时进入“组装模式”，在 3x3 网格上增删细胞模块
// （新增消耗进化点 + 应用时结算有机体能量），实时预览合成效果，应用后落回世界。
// stage-10：世代演化与体型趋势——环境按 x 轴分为富营养/过渡/贫瘠三个营养带
// （食物配额与再生速度随丰度递减，形成“食物稀缺压力”）；有机体能量达标即分裂
// 繁殖且子代模块布局发生变异（增/删/换），auto-evo 每 10 秒结算一代模块布局统计
// 与分区存活比例，并把该比例作为后续出生点权重（大个体富营养区占优、小个体贫瘠区存活）。
// stage-11：网格地形 + 生态金字塔——地图由种子噪声切成草地/水域/沙地三类瓦片；
// 草地自动生长植物（生产者，生物量口径），草食者（有口器无爪）吃植物、肉食者（有捕食爪）
// 掠食草食者，形成“植物 -> 草食 -> 肉食”的三级能量流；食性由模块构成决定，
// 各营养级的摄食收入口径按 diet 分流（肉食者几乎不能靠光合/碎屑过活）。
// stage-12：昼夜循环 + 时间流速 + 生态经营面板——一昼夜为一固定秒数周期，
// 光照系数由相位推出（昼亮夜暗），同时驱动三件事：叶绿体产能倍率、感知视野倍率、
// 渲染灯光与场景底色；地图温度随光照在夜/昼温度间插值。时间流速 1x/2x/3x
// 同比例作用于世界推进与昼夜钟。hud.js 的 DOM 面板实时读数（总能量/种群数/
// 多样性 Simpson/温度）用于观察经营状况。
// stage-13：环境干预——点击地面弹菜单，对**环境本身**动手（区别于 stage-06/09 对个体动手）：
//   1) 播种植物：在草地格直接补种一批植物（初级生产力不足时救急）；
//   2) 排水/注水：改写单格地表类型（水<->陆），改变植物可生长面积与陆地生物的通行/落位，
//      注水会清除该格植株；
//   3) 调温度：调节基线气候温度（±5℃/步，±25℃ 上限），并把它变成**选择压力**——
//      个体最适温度由体细胞数决定（多体细胞 = 保温型，耐寒），偏离最适温度超耐受带后
//      按 ℃ 折算额外维持耗能（可维持秒数缩短），于是升温会把冷适应（多体细胞）个体先筛掉，
//      种群适应型占比随环境漂移；同时温度还按偏离量给初级生产力打折（过冷/过热草地减产）。
import { COLORS, WORLD } from '../config/index.js';
import { lightFactor, temperatureOf, photoLightMul, visionLightMul } from './eco.js';
import { clampTempOffset, baseTemperatureOf, tempDrainMul, plantTempMul, mapTemperatureOf } from './climate.js';
import { createRandomGenome, mutate, deriveTraits, averageGenome } from './genome.js';
import { computeGeneration, computeOrganismGeneration } from './autoEvo.js';
import {
  createOrganism,
  createInitialOrganisms,
  createDemoOrganism,
  applyLayoutToOrganism,
  mutateLayout,
  trimLayoutToCap,
  countModules,
  gridCapacity,
  validateLayout,
  organismSizeScore,
  MODULE_TYPES,
  MODULE_CN,
  DIET,
  roleOf,
} from './organism.js';
import {
  createMap,
  isWaterAt,
  nearestLandPos,
  tileAtGrid,
  withTileChanged,
  TILE,
} from '../world/map.js';
import {
  createInitialPlants,
  growPlants,
  makePlant,
  plantZoneMul,
  totalBiomass,
} from '../world/plants.js';
import {
  ZONE_COUNT,
  zoneFoodQuota,
  zoneRichness,
  zoneModuleCap,
  zoneIndexAt,
  pickZone,
  randomPosInZone,
} from './environment.js';
import { stepOrganisms } from './behaviors.js';
// stage-14：神经网络个体——子代继承父代权重并变异；无脑父代有概率“突变出脑”
import { createBrain, mutateBrain } from './nn.js';
// stage-15：群体与领地——同基因簇个体聚成群体（成员/领地/公共能量池/指令队列）
import { buildTribes, applyOrders, shareEnergy, ORDER } from './tribe.js';
import { createCivState, stepCivilization, dispatchGatherers } from './civilization.js';

// stage-13：环境干预状态的零值（旧存档/缺字段时兜底，保证 reducer 不会读到 undefined）
const ENV_ZERO = Object.freeze({ tempOffset: 0, seeds: 0, drained: 0, filled: 0, tempAdjusted: 0 });

export function envOf(state) {
  return state && state.env ? state.env : ENV_ZERO;
}

function createWorld() {
  const cells = [];
  for (let i = 0; i < WORLD.cellStartCount; i++) {
    cells.push(makeCell(i));
  }
  // stage-10：食物池按各营养带配额分别铺满（富营养区多、贫瘠区少）
  const foods = [];
  let foodId = 0;
  for (let zi = 0; zi < ZONE_COUNT; zi++) {
    const quota = zoneFoodQuota(zi);
    for (let k = 0; k < quota; k++) foods.push(makeFood(foodId++, zi));
  }
  const startId = 100000;
  const orgSeed = createInitialOrganisms(startId);
  // stage-11：网格地形（草地/水域/沙地）——同种子可复现，一次生成后只读
  const map = createMap();
  // stage-11：生产者（植物）初始植被覆盖——只在草地萌发，id 段与细胞/有机体隔开便于排查
  const plantSeed = createInitialPlants(map, 500000);
  // stage-16：文明最小闭环——资源点以「初始有机体群」为锚点围成资源环（水/食物/矿物交替），
  // 开局游群就落在采集半径能覆盖的范围内，不必先跑半个地图才有产出。
  const civ = createCivState(
    map,
    orgSeed.organisms.map((o) => [o.pos[0], o.pos[2] ?? o.pos[1]])
  );
  return {
    cells,
    foods,
    organisms: orgSeed.organisms, // stage-07：有机体群（模块化多细胞）
    map,                          // stage-11：网格地形（只读）
    plants: plantSeed.plants,     // stage-11：草地植物（生产者，生物量口径）
    nextPlantId: plantSeed.nextId,
    plantAcc: 0,                  // stage-11：植物萌发的秒级累计器
    plantBorn: plantSeed.plants.length, // stage-11：累计萌发株数（含初始植被，HUD 观测）
    nextId: orgSeed.nextId + 1000,
    tick: 0,
    time: 0,
    // ---- stage-12：昼夜循环 + 时间流速（同比例作用于世界推进与昼夜钟）----
    timeScale: WORLD.timeScaleDefault, // 时间流速倍率（1x/2x/3x）
    dayPhase: WORLD.dayStartPhase,     // 昼夜相位 0..1（0=午夜，0.5=正午）
    light: lightFactor(WORLD.dayStartPhase), // 当前光照系数 0..1（渲染/产能/视野共用）
    temperature: temperatureOf(lightFactor(WORLD.dayStartPhase)), // 地图温度（℃，随昼夜波动）
    // ---- stage-13：环境干预状态 ----
    env: { ...ENV_ZERO },                   // 玩家干预累计（温度偏移 / 播种 / 排水 / 注水 / 调温次数）
    climateTemp: baseTemperatureOf(0),      // 基线气候温度（℃）：选择压力口径，不随昼夜波动
    paused: false,          // stage-06：编辑器暂停标记
    editor: null,           // stage-06：{ cellId, genome } 编辑缓冲
    orgEditor: null,        // stage-09：{ organismId, layout, selectedType, energySpent, message } 组装缓冲
    // ---- stage-15：群体与领地（同基因簇 + 空间邻近聚合的群体；指令/能量池随 tick 存续）----
    tribes: [],             // 群体列表：{ id, key, members, center, radius, pool, order, noBreed, ... }
    tribeSeq: 1,            // 群体 id 自增游标（跨 tick 保证 id 稳定，指令不会指到别的群体）
    tribeStats: {           // 群体累计读数（HUD/面板展示「能量共享可见」的凭据）
      given: 0,             // 累计上缴公共池的能量
      taken: 0,             // 累计从公共池领取的能量
      orders: 0,            // 累计下达的群体指令条数
      bans: 0,              // 累计“繁殖禁令”下达次数
      blocked: 0,           // 因繁殖禁令被拦下的分裂次数
    },
    // ---- stage-16：文明最小闭环（资源点 / 资源 / 研究点 / 科技 / 进度 / 城市）----
    civ,
    evoPoints: WORLD.evoStart, // stage-06：进化点（编辑器预算，分裂/吸收可累积）
    evoAcc: 0,              // stage-06：吸收能量到进化点的小数累计
    foodAcc: new Array(ZONE_COUNT).fill(0), // stage-10：各区食物再生的秒级累计器
    // stage-10：各营养带的出生采样权重（每代由各区存活比例刷新，初始均分）
    spawnWeights: new Array(ZONE_COUNT).fill(1 / ZONE_COUNT),
    genomePool: createRandomGenome(), // 灭绝重播种的父本基因池（逐 tick 记录存活均值）
    stats: {
      died: 0,          // 累计饿死数
      culled: 0,        // stage-04：种群压力淘汰数
      split: 0,         // stage-04：累计分裂次数
      absorbed: 0,      // 累计吸收能量
      eatenCount: 0,    // 累计吃掉的食物团数
      gene: { speedAvg: 0, senseAvg: 0, sizeAvg: 0, colorCount: 0 },
    },
    orgStats: {           // stage-07：有机体累计统计
      spawn: 0,           // 手动 spawn 次数
      died: 0,            // 有机体死亡数
      absorbed: 0,        // 有机体累计吸收能量
      edited: 0,          // stage-09：生成编辑器成功应用的组装次数
      split: 0,           // stage-10：有机体分裂繁殖次数
      culled: 0,          // stage-10：有机体种群上限淘汰数
    },
    autoEvo: {          // stage-04：世代结算记录
      gen: 0,
      nextAt: WORLD.autoEvoSeconds,
      records: [],
      trend: 0,         // 最近两代平均速度差（HUD 箭头用）
      // ---- stage-10：有机体世代（模块布局 / 体型趋势 / 分区分布）----
      orgGen: 0,
      orgNextAt: WORLD.orgAutoEvoSeconds,
      orgRecords: [],
      orgTrend: 0,      // 最近两代平均模块数差（体型趋势箭头用）
    },
  };
}

function rand(lo, hi) {
  return lo + random() * (hi - lo);
}

// stage-06：编辑器可上调/下调的基因属性（速度/感知/体型），其余基因只读展示
export const EDITABLE_KEYS = ['speed', 'perception', 'size'];

function randPos(floorY = 0) {
  const b = WORLD.bounds - 1;
  return [rand(-b, b), floorY, rand(-b, b)];
}

// stage-06：按编辑后基因重算某细胞的表型并落回（保留 id/位置/能量/速度方向）
function applyGenomeToCell(c, genome) {
  const t = deriveTraits(genome);
  return {
    ...c,
    genome: { ...genome },
    speed: t.speed,
    radius: t.radius,
    senseRange: t.senseRange,
    metabolismMul: t.metabolismMul,
    colorIndex: t.colorIndex,
    eatDist: t.radius + 0.2,
  };
}

function makeCell(id, parentGenome = null, spawn = null, energyOverride = null) {
  // 新细胞基因：有父本则“父基因小幅随机变异”，否则第一代随机初始化
  const genome = parentGenome ? mutate(parentGenome) : createRandomGenome();
  const t = deriveTraits(genome);
  const [e0, e1] = WORLD.energyStart;
  let pos;
  let vel;
  if (spawn) {
    // stage-04 分裂：子代出生在父附近，方向继承父行进方向并带随机扰动
    const a = random() * Math.PI * 2;
    pos = [
      spawn.pos[0] + Math.cos(a) * WORLD.splitOffset,
      spawn.pos[1],
      spawn.pos[2] + Math.sin(a) * WORLD.splitOffset,
    ];
    const ang = Math.atan2(spawn.vel[2], spawn.vel[0]) + (random() * 2 - 1) * 0.9;
    vel = [Math.cos(ang) * t.speed, 0, Math.sin(ang) * t.speed];
  } else {
    const heading = random() * Math.PI * 2;
    pos = randPos(WORLD.floorY + t.radius);
    vel = [Math.cos(heading) * t.speed, 0, Math.sin(heading) * t.speed];
  }
  return {
    id,
    genome,
    // 表型字段（由基因推导，行为/渲染直接消费）
    speed: t.speed,
    radius: t.radius,
    senseRange: t.senseRange,
    metabolismMul: t.metabolismMul,
    colorIndex: t.colorIndex,
    pos,
    vel,
    energy: energyOverride !== null && energyOverride !== undefined
      ? energyOverride
      : rand(e0, e1),
    maxEnergy: WORLD.maxEnergy,
    eatDist: t.radius + 0.2,
  };
}

// stage-10：食物按营养带生成——xz 落在指定区内（区配额由营养丰度决定）
function makeFood(id, zone = null) {
  const zi = zone === null || zone === undefined ? pickZone(null) : zone;
  const [x, z] = randomPosInZone(zi);
  const [r0, r1] = WORLD.foodRadius;
  const [e0, e1] = WORLD.foodEnergy;
  return {
    id,
    pos: [x, 0.35 + random() * 0.3, z],
    radius: rand(r0, r1),
    energy: rand(e0, e1),
    zone: zi, // 所属营养带（HUD/分区统计用）
  };
}

function drainPerSec(c) {
  // 体型越大、代谢基因越高 -> 单位时间能耗越高
  const jitter = 1 + (random() * 2 - 1) * WORLD.drainVar;
  return WORLD.drainBase * (0.6 + c.radius * 0.45) * c.metabolismMul * jitter;
}

function normXZ(x, z) {
  const l = Math.hypot(x, z) || 1e-6;
  return [x / l, z / l];
}

// 把速度方向朝目标 dir 旋转，最多转 maxTurn 弧度；返回新 vel
function steerToward(vel, targetDir, maxTurn, currentSpeed) {
  const [vx, vz] = normXZ(vel[0], vel[2]);
  const [tx, tz] = targetDir;
  let ang = Math.atan2(vz, vx);
  const want = Math.atan2(tz, tx);
  let d = want - ang;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const step = Math.max(-maxTurn, Math.min(maxTurn, d));
  ang += step;
  return [Math.cos(ang) * currentSpeed, 0, Math.sin(ang) * currentSpeed];
}

// 单个细胞：找最近食物 -> 有则转向趋向（近距减速），无则巡游小幅偏航；并扣能耗
// 感知半径来自 perception 基因：感知大的远距离锁敌直奔，感知小的只吃眼前
// stage-12：感知半径再乘光照视野倍率——夜里细胞“看不清”，只有近身的食物才被锁定
function stepCell(c, dt, foods, _map = null, visionMul = 1) {
  let best = null;
  let bestD = Infinity;
  for (const f of foods) {
    const dx = f.pos[0] - c.pos[0];
    const dz = f.pos[2] - c.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < bestD) {
      bestD = d;
      best = [f, dx / (d || 1), dz / (d || 1)];
    }
  }

  let speed = c.speed;
  let vel = c.vel;
  const weak = c.energy < c.maxEnergy * WORLD.weakEnergyFrac;
  const sense = c.senseRange * visionMul; // stage-12：有效视野随昼夜伸缩

  if (best && bestD < sense) {
    // 有感知目标：转向趋向；靠近后减速以稳定吸收
    if (bestD < WORLD.absorbSlowDist) speed = c.speed * WORLD.slowFactor;
    const turn = bestD < WORLD.absorbSlowDist ? WORLD.turnSeek * 0.8 : WORLD.turnSeek;
    vel = steerToward(c.vel, [best[1], best[2]], turn * dt, speed);
  } else {
    // 巡游：偶尔随机偏航
    if (random() < WORLD.wanderFreq * dt) {
      const spin = (random() * 2 - 1) * WORLD.turnWander;
      const [vx, vz] = normXZ(c.vel[0], c.vel[2]);
      let ang = Math.atan2(vz, vx) + spin;
      vel = [Math.cos(ang) * c.speed, 0, Math.sin(ang) * c.speed];
    }
    speed = c.speed;
  }

  if (weak) speed *= WORLD.weakSlowFactor; // 濒死几乎停住

  // 位置积分
  const b = WORLD.bounds - 0.2;
  let px = c.pos[0] + vel[0] * dt;
  let pz = c.pos[2] + vel[2] * dt;
  let vx = vel[0];
  let vz = vel[2];
  if (px > b) { px = b; vx = -Math.abs(vx); }
  if (px < -b) { px = -b; vx = Math.abs(vx); }
  if (pz > b) { pz = b; vz = -Math.abs(vz); }
  if (pz < -b) { pz = -b; vz = Math.abs(vz); }
  if (vx !== vel[0] || vz !== vel[2]) vel = [vx, vel[1], vz];

  const energy = c.energy - drainPerSec(c) * dt;
  return { ...c, pos: [px, c.pos[1], pz], vel, energy };
}

function computeGeneStats(cells) {
  const out = { speedAvg: 0, senseAvg: 0, sizeAvg: 0, colorCount: 0 };
  if (!cells.length) return out;
  let s = 0;
  let se = 0;
  let si = 0;
  const colorSet = new Set();
  for (const c of cells) {
    s += c.speed;
    se += c.senseRange;
    si += c.radius;
    colorSet.add(c.colorIndex);
  }
  out.speedAvg = s / cells.length;
  out.senseAvg = se / cells.length;
  out.sizeAvg = si / cells.length;
  out.colorCount = colorSet.size;
  return out;
}

// reducer 纯函数（允许内部使用 random 做生态随机）
// ---- stage-13：环境干预的内部实现（全部返回新 state，不原地改任何字段） ----

// 收集以 (gx,gy) 为中心、给定格半径内的草地格（供播种撒点用）
function grassSpotsNear(map, gx, gy, radiusCells) {
  const out = [];
  if (!map) return out;
  const r = Math.max(0, Math.ceil(radiusCells));
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const cx = gx + dx;
      const cy = gy + dy;
      if (cx < 0 || cy < 0 || cx >= map.cols || cy >= map.rows) continue;
      if (dx * dx + dy * dy > r * r) continue;
      if (map.tiles[cy * map.cols + cx] !== TILE.GRASS) continue;
      out.push({ gx: cx, gy: cy });
    }
  }
  return out;
}

// 播种植物：在点击格附近的草地上补种 interventionSeedCount 株；同时把附近**已有植株**
// 的生物量抬到 interventionSeedBiomass 下限。存量满员时允许临时溢出到
// plantTarget × interventionSeedOverflow，否则草地上食物充足时播种会毫无效果。
function seedPlantsNear(state, gx, gy) {
  const map = state.map;
  if (!map) return state;
  const radiusCells = WORLD.interventionSeedRadius / (map.cellSize || 1);
  const spots = grassSpotsNear(map, gx, gy, radiusCells);
  if (!spots.length) return state;
  const near = new Set(spots.map((t) => t.gy * map.cols + t.gx));
  const floor = WORLD.interventionSeedBiomass;
  let fedPlants = 0;
  let plants = state.plants.map((p) => {
    if (!near.has(p.gy * map.cols + p.gx)) return p;
    if (p.biomass >= floor) return p;
    fedPlants += 1;
    return { ...p, biomass: Math.min(p.maxBiomass, floor) };
  });
  const seedCap = Math.ceil(WORLD.plantTarget * WORLD.interventionSeedOverflow);
  const room = Math.max(0, seedCap - plants.length);
  const count = Math.min(WORLD.interventionSeedCount, room);
  let nextId = state.nextId;
  if (count > 0) {
    plants = plants.slice();
    for (let i = 0; i < count; i++) {
      const tile = spots[Math.floor(random() * spots.length)];
      plants.push(makePlant(nextId++, map, tile, random, floor));
    }
  }
  if (fedPlants === 0 && count === 0) return state;
  const env = envOf(state);
  return {
    ...state,
    plants,
    nextId,
    plantBorn: (state.plantBorn || 0) + count,
    env: { ...env, seeds: env.seeds + count + fedPlants },
  };
}

// 地表改写（排水/注水）：换 map（withTileChanged 返回新地图并递增 rev，渲染层据此重建地形），
// 注水时一并清除该格上的植株（被淹没），并累加对应干预计数。
function changeSurface(state, gx, gy, tile, counterKey) {
  const map = state.map;
  if (!map) return state;
  if (gx < 0 || gy < 0 || gx >= map.cols || gy >= map.rows) return state;
  const next = withTileChanged(map, gx, gy, tile);
  if (next === map) return state; // 已是指定地表，无变化
  const plants =
    tile === TILE.WATER
      ? state.plants.filter((p) => !(p.gx === gx && p.gy === gy))
      : state.plants;
  const env = envOf(state);
  return {
    ...state,
    map: next,
    plants,
    env: { ...env, [counterKey]: env[counterKey] + 1 },
  };
}

// 调温：delta 为步进方向（±1），偏移量夹在硬边界内；无变化则返回原 state
function shiftTemperature(state, delta) {
  const dir = delta > 0 ? 1 : delta < 0 ? -1 : 0;
  if (!dir) return state;
  const env = envOf(state);
  const tempOffset = clampTempOffset(env.tempOffset + dir * WORLD.tempOffsetStep);
  if (tempOffset === env.tempOffset) return state; // 已到边界
  return {
    ...state,
    env: { ...env, tempOffset, tempAdjusted: env.tempAdjusted + 1 },
    climateTemp: baseTemperatureOf(tempOffset),
    // 温度读数同步（暂停时不再走 TICK，读数仍要跟着调温立即变化）
    temperature: mapTemperatureOf(Number.isFinite(state.light) ? state.light : 1, tempOffset),
  };
}

function reduceStep(state, action) {
  switch (action.type) {
    case 'TICK': {
      // stage-06：编辑器暂停时世界冻结，场景静止供玩家挑选/编辑细胞
      if (state.paused) return state;
      // stage-12：时间流速倍率作用于世界步长（步长设上限，避免倍速下积分过大失真）
      const dt = action.dt;
      const birthBudget=Math.floor(state.space.lifeLing/.1);
      // stage-12：昼夜推进——光照系数由相位推出，温度随光照在夜/昼温度间插值
      const dayPhase = ((state.dayPhase || 0) + dt / WORLD.dayCycleSeconds) % 1;
      const light = lightFactor(dayPhase);
      // stage-13：环境干预读数——基线气候温度（选择压力口径，不随昼夜波动）与干预累计
      const env = envOf(state);
      const tempOffset = clampTempOffset(env.tempOffset);
      const climateTemp = baseTemperatureOf(tempOffset);
      // 地图温度 = 昼夜波动 + 玩家温度偏移（调温后 HUD 与生态面板读数整体升降）
      const temperature = mapTemperatureOf(light, tempOffset);
      // stage-12：当帧光照派生的两个倍率——产能（叶绿体）与视野（所有生物感知）
      const lightMul = photoLightMul(light);
      const visionMul = visionLightMul(light);
      const plantMul = plantTempMul(climateTemp) * ({mu:1.15,shui:1.1,tu:1,jin:.9,huo:.95}[state.space.element] || 1) * state.space.concentration * Math.min(1, state.space.materialLing / 40); // 温度对初级生产力的折扣（过冷/过热减产）
      let cells = state.cells;
      let foods = state.foods;
      let nextId = state.nextId;

      // 0) stage-11 生产者生长：草地植物按时间恢复生物量，并在存量不足时于草地萌发新株。
      //    植物只在草地瓦片上存在（地图只读），是整条食物链的能量入口。
      const map = state.map || null;
      let plants = Array.isArray(state.plants) ? state.plants : [];
      let nextPlantId = state.nextPlantId ?? 500000;
      let plantAcc = state.plantAcc || 0;
      let plantBorn = state.plantBorn || 0;
      if (map) {
        const grown = growPlants(plants, map, dt, plantAcc, nextPlantId, random, plantMul);
        plants = grown.plants;
        nextPlantId = grown.nextId;
        plantAcc = grown.acc;
        plantBorn += grown.spawned;
      }

      // 1) stage-10 食物再生：改为按营养带独立结算——各区配额 = foodTarget × 丰度占比，
      //    再生速率随丰度递减（富营养区 1.4x、贫瘠区 0.4x），贫瘠区因此长期缺食。
      let foodAcc = Array.isArray(state.foodAcc) && state.foodAcc.length === ZONE_COUNT
        ? state.foodAcc.slice()
        : new Array(ZONE_COUNT).fill(0);
      {
        const zoneCounts = new Array(ZONE_COUNT).fill(0);
        for (const f of foods) zoneCounts[zoneIndexAt(f.pos[0])] += 1;
        for (let zi = 0; zi < ZONE_COUNT; zi++) {
          const quota = zoneFoodQuota(zi);
          if (zoneCounts[zi] >= quota) {
            foodAcc[zi] = 0;
            continue;
          }
          foodAcc[zi] += WORLD.foodRegenPerSec * (WORLD.foodRegenZoneBase + zoneRichness(zi)) * dt;
          const add = Math.min(Math.floor(foodAcc[zi]), quota - zoneCounts[zi]);
          if (add > 0) {
            foodAcc[zi] -= add;
            for (let k = 0; k < add; k++) {
              foods = [...foods, makeFood(nextId++, zi)];
              zoneCounts[zi] += 1;
            }
          }
        }
      }

      // 2) 细胞移动 + 能耗 + 进食吸收
      const eatenIds = new Set();
      let absorbed = 0;
      let eatenCount = 0;
      cells = cells.map((c) => {
        let nc = stepCell(c, dt, foods, map, visionMul);
        let energy = nc.energy;
        for (const f of foods) {
          if (eatenIds.has(f.id)) continue;
          const dx = nc.pos[0] - f.pos[0];
          const dz = nc.pos[2] - f.pos[2];
          const d = Math.hypot(dx, dz);
          if (d < nc.eatDist + f.radius + WORLD.absorbGap) {
            energy = Math.min(WORLD.maxEnergy, energy + f.energy);
            absorbed += f.energy;
            eatenCount += 1;
            eatenIds.add(f.id);
          }
        }
        return { ...nc, energy };
      });

      // ---- stage-07/08：有机体移动 + 行为决策(behaviors.js) + 进食吸收 ----
      // ---- stage-15 A) 群体聚合 + 指令投射（基于本 tick 起始快照）----
      // 先按「同基因簇 + 空间邻近」聚出群体（id/能量池/指令由上 tick 的群体复用），
      // 再把群体指令写成每个成员个体的 order 字段——behaviors.js 决策阶段读取它。
      // 放在移动之前，指令才在当 tick 生效（而不是延迟一 tick 才看到群体行动）。
      let tribeSeq = state.tribeSeq || 1;
      let tribes = [];
      {
        const built = buildTribes(state.organisms, state.tribes || [], { seq: tribeSeq });
        tribes = built.tribes;
        tribeSeq = built.seq;
      }
      const orderedOrganisms = applyOrders(state.organisms, tribes);

      // stage-08：stepOrganisms 基于同帧快照统一决策行为并推进移动/能耗/光合，
      // 行为(seek/flee/chase/photo/wander)记录在 o.behavior 供 HUD/验证读取。
      let organisms = stepOrganisms(orderedOrganisms, foods, dt, {
        // stage-10：初级生产力按所在营养带折算（贫瘠带约为富营养带的四成），
        // 与食物配额一起构成“食物稀缺压力”，大体型在低产区难以维持。
        photoZoneMul: (o) => {
          const r = zoneRichness(zoneIndexAt(o.pos[0]));
          return WORLD.orgPhotoZoneBase + (1 - WORLD.orgPhotoZoneBase) * r;
        },
        // stage-11：植物（生产者）参与感知——草食者优先趋向草地植物取食
        plants,
        // stage-11：网格地形的可通行约束——水域阻断陆地生物的去路，岸边自然形成栖息带
        isBlocked: map ? (x, z) => isWaterAt(map, x, z) : null,
        // stage-12：光照同时调叶绿体产能与感知视野——夜里晒不动、也看不清远处
        lightMul,
        visionMul,
      });
      let orgAbsorbed = 0;
      // stage-14：逐个体觅食收益累计（只统计营养团吸收 + 植物收割，不含光合与腐肉），
      // tick 末尾按“是否带脑”分别求人均，作为“有脑个体更会觅食”的量化证据。
      const forageById = new Map();
      organisms = organisms.map((no) => {
        let energy = no.energy;
        const nz = no.pos[2] ?? no.pos[1]; // organism.pos 二维 [x,z]，兼容三维
        // stage-11：营养级摄食折扣——草食者的主粮是植物、肉食者靠捕猎，
        // 二者对“初级生产力/悬浮营养团”的利用效率都显著低于光合者。
        const diet = no.diet || roleOf(no);
        const grazeMul =
          diet === DIET.CARNIVORE
            ? WORLD.carnivoreGrazeMul
            : diet === DIET.HERBIVORE
              ? WORLD.herbivoreGrazeMul
              : 1;
        const foodMul =
          diet === DIET.CARNIVORE
            ? WORLD.carnivoreFoodMul
            : diet === DIET.HERBIVORE
              ? WORLD.herbivoreFoodMul
              : 1;
        // stage-10：本地初级生产力摄食收入——按“摄食基速 × 本带丰度”实时补给，
        // 这是密度限制摄食的生态学近似：富营养带个体撑得起更大体型，
        // 贫瘠带的收入不足以覆盖大块头的维持成本，体型因此被环境筛小。
        const grazeGain =
          (no.grazePerSec || 0) * zoneRichness(zoneIndexAt(no.pos[0])) * grazeMul * dt;
        if (grazeGain > 0) {
          energy = Math.min(no.maxEnergy, energy + grazeGain);
          orgAbsorbed += grazeGain;
        }
        for (const f of foods) {
          if (eatenIds.has(f.id)) continue;
          const dx = no.pos[0] - f.pos[0];
          const dz = nz - f.pos[2];
          const d = Math.hypot(dx, dz);
          if (d < no.eatRange + f.radius) {
            // mouth 模块加成吸收量；叶绿体产能上限随 maxEnergy 在 step 已封顶
            // stage-10：食物营养密度随所在营养带递减（贫瘠带食源稀薄），
            // “食物稀缺压力”因此真正落到大体型个体身上，而非只靠配额数量限制。
            const zMul =
              WORLD.orgFoodZoneBase +
              (1 - WORLD.orgFoodZoneBase) * zoneRichness(zoneIndexAt(no.pos[0]));
            const take = f.energy * no.absorbMul * foodMul * zMul;
            energy = Math.min(no.maxEnergy, energy + take);
            orgAbsorbed += take;
            eatenIds.add(f.id);
            // stage-14：逐个体记录“本 tick 吃到的营养团能量”，用于 NN / 普通个体的人均觅食对比
            forageById.set(no.id, (forageById.get(no.id) || 0) + take);
          }
        }
        // stage-11：捕猎冷却推进（huntCd 减到 0 才能再次捕杀，保住猎物种群）
        return { ...no, energy, huntCd: Math.max(0, (no.huntCd || 0) - dt) };
      });

      // ---- stage-11：生态金字塔的第二/第三级能量流 ----
      // 2c) 草食者取食草地植物：按“生物量”收割（植物量口径，同一株可被多只分食，
      //     啃空后由草地重新萌发补位）；能量 = 收割生物量 × 换算系数 × 本带初级生产力。
      let plantBitten = 0;
      let orgGrazed = 0;
      let plantEatenCount = 0; // 本 tick 被啃空移除的植株数
      if (plants.length) {
        const bitten = new Map(); // plantId -> 本 tick 被收割的生物量（同帧不重复计算）
        organisms = organisms.map((no) => {
          const diet = no.diet || roleOf(no);
          if (diet === DIET.CARNIVORE || (no.clawCount || 0) > 0) return no;
          if ((no.mouthCount || 0) <= 0) return no; // 无口器无法进食植物
          const nz = no.pos[2] ?? no.pos[1];
          let best = null;
          let bestD = Infinity;
          for (const p of plants) {
            const remain = p.biomass - (bitten.get(p.id) || 0);
            if (remain <= 0) continue;
            const d = Math.hypot(no.pos[0] - p.pos[0], nz - p.pos[1]);
            if (d < no.eatRange + WORLD.plantRadius + WORLD.plantBiteGap && d < bestD) {
              bestD = d;
              best = p;
            }
          }
          if (!best) return no;
          const remain = Math.max(0, best.biomass - (bitten.get(best.id) || 0));
          const take = Math.min(remain, WORLD.plantBitePerSec * (no.absorbMul || 1) * dt);
          if (take <= 0) return no;
          bitten.set(best.id, (bitten.get(best.id) || 0) + take);
          plantBitten += take;
          const base = take * WORLD.plantEnergyPerBiomass * plantZoneMul(no.pos[0]);
          // stage-14：带脑个体的取食效率加成（认知优势落到“单位时间摄入更多能量”）
          const gain = no.brain ? base * WORLD.nnForageMul : base;
          // stage-14：植物收割计入这只的觅食收益（草食者的主粮）
          forageById.set(no.id, (forageById.get(no.id) || 0) + gain);
          return { ...no, energy: Math.min(no.maxEnergy, no.energy + gain) };
        });
        if (plantBitten > 0) orgGrazed = plantBitten * WORLD.plantEnergyPerBiomass;
        if (bitten.size > 0) {
          const kept = plants.filter((p) => {
            if (!bitten.has(p.id)) return true;
            return p.biomass - bitten.get(p.id) > WORLD.plantMinBiomass;
          });
          plantEatenCount += plants.length - kept.length;
          plants = kept.map((p) =>
            bitten.has(p.id) ? { ...p, biomass: p.biomass - bitten.get(p.id) } : p
          );
        }
      }

      // 2d) 肉食掠食：带捕食爪的个体咬中（eatRange + carnivoreContactGap 内）最近的非肉食个体，
      //     猎物整只出局，捕食者按同化率获得其存量能量 + 每模块的肉量补偿，并进入捕猎冷却。
      //     每 tick 全场最多发生 maxKillsPerTick 次捕食（捕食节律，防瞬间清场）。
      let predKills = 0;
      let predGain = 0;
      if (organisms.length > 1 && WORLD.maxKillsPerTick > 0) {
        const killedIds = new Set();
        const gainById = new Map();
        for (const p of organisms) {
          if (predKills >= WORLD.maxKillsPerTick) break;
          const isCarn = p.diet === DIET.CARNIVORE || (p.clawCount || 0) > 0;
          if (!isCarn) continue;
          if ((p.huntCd || 0) > 0) continue; // 捕猎冷却中
          if ((p.energy || 0) >= p.maxEnergy * WORLD.carnivoreSatietyFrac) continue; // 饱腹不屠场
          const pz = p.pos[2] ?? p.pos[1];
          let victim = null;
          let vd = Infinity;
          for (const o of organisms) {
            if (o.id === p.id || killedIds.has(o.id)) continue;
            if (o.diet === DIET.CARNIVORE || (o.clawCount || 0) > 0) continue; // 不捕食同类肉食者
            const d = Math.hypot(o.pos[0] - p.pos[0], (o.pos[2] ?? o.pos[1]) - pz);
            // 大猎物更易被咬中：判定半径随猎物模块数放大（体型即靶面）
            const biteR =
              p.eatRange +
              WORLD.carnivoreContactGap +
              (o.moduleCount || 0) * WORLD.carnivoreContactPerModule;
            if (d < biteR && d < vd) {
              vd = d;
              victim = o;
            }
          }
          if (!victim) continue;
          // 体型/攻击力影响捕食效率：猎物模块越多越难拿下（同化率按攻击-体型比缩放）
          const atk = Math.max(1, p.attack || p.clawCount || 1);
          const bulk = Math.max(1, organismSizeScore(victim) * 0.25);
          const eff = Math.max(WORLD.carnivoreMinEff, Math.min(1, atk / bulk));
          const gain =
            victim.energy * WORLD.carnivoreAssimilation * eff +
            (victim.moduleCount || 0) * WORLD.carnivoreBiomassBonus -
            WORLD.carnivoreEnergyCost;
          killedIds.add(victim.id);
          gainById.set(p.id, (gainById.get(p.id) || 0) + Math.max(0, gain));
          predKills += 1;
          predGain += Math.max(0, gain);
        }
        if (killedIds.size > 0 || gainById.size > 0) {
          organisms = organisms
            .filter((o) => !killedIds.has(o.id))
            .map((o) =>
              gainById.has(o.id)
                ? {
                    ...o,
                    energy: Math.min(o.maxEnergy, o.energy + gainById.get(o.id)),
                    huntCd: WORLD.carnivoreKillCooldown,
                  }
                : o
            );
        }
      }

      // 2e) stage-13 气候胁迫：把「偏离最适温度」折算成额外维持耗能记在个体上——
      //     tempDrainMul 同时进入下面第 6b 步的“可维持秒数”判据（orgVitality），
      //     于是升温后保温型（多体细胞、最适温度偏低）先跌破生存线被筛掉，
      //     种群适应型占比随环境漂移——这正是“温度是选择压力”的可见证据。
      let orgTempLoss = 0;
      organisms = organisms.map((o) => {
        const mul = tempDrainMul(o, climateTemp);
        if (mul <= 1) {
          return o.tempDrainMul === 1 ? o : { ...o, tempDrainMul: 1 };
        }
        const loss = (o.drainPerSec || 0) * (mul - 1) * dt;
        orgTempLoss += loss;
        return { ...o, tempDrainMul: mul, energy: Math.max(0, o.energy - loss) };
      });

      // 3) 移除被吃掉的食物与饿死的细胞/有机体
      if (eatenIds.size > 0) foods = foods.filter((f) => !eatenIds.has(f.id));
      const before = cells.length;
      cells = cells.filter((c) => c.energy > 0);
      const died = before - cells.length;
      const orgBefore = organisms.length;
      organisms = organisms.filter((o) => o.energy > 0);
      const orgDied = orgBefore - organisms.length;

      // 4) 全灭保护：以“存活平均基因池”为父本，变异重生一批后代
      if (state.settings.reseed && cells.length === 0) {
        for (let i = 0; i < WORLD.reseedCount; i++) {
          cells = [...cells, makeCell(nextId++, state.genomePool)];
        }
      }
      // stage-07：有机体全灭保护——重新播入少量随机有机体，保证多细胞层持续可见
      // stage-10：播入位置按上一代各区存活比例加权（演化出的分布会被继承）
      if (state.settings.reseed && organisms.length === 0) {
        for (let i = 0; i < WORLD.orgReseedCount; i++) {
          organisms = [
            ...organisms,
            createOrganism(nextId++, { zoneWeights: state.spawnWeights }),
          ];
        }
      }
      // stage-11：顶层消费者全灭保护——食物链不能断头，场上没有肉食者时补播「猎手」，
      // 让“植物 -> 草食 -> 肉食”三级结构持续可观察（否则金字塔顶层一消失就退化两级）。
      // 补播还要求猎物尚有一小撮存栏（carnivoreReseedMinPrey）：猎物已被吃空的区段不再空降
      // 天敌，否则「空投捕食者」会把刚靠变异恢复的草食层再次清零，金字塔长期倒置。
      if (
        organisms.length > 0 &&
        state.settings.reseed && WORLD.orgCarnivoreReseed > 0 &&
        organisms.filter((o) => roleOf(o) === DIET.HERBIVORE).length >=
          WORLD.carnivoreReseedMinPrey &&
        !organisms.some((o) => o.diet === DIET.CARNIVORE || (o.clawCount || 0) > 0)
      ) {
        for (let i = 0; i < WORLD.orgCarnivoreReseed; i++) {
          organisms = [...organisms, createDemoOrganism(nextId++, 'hunter', 0)];
        }
      }

      // 5) stage-04 分裂繁殖：能量满格细胞一分为二（子代继承变异基因），
      //    父子各保留一半能量，避免同 tick 连环分裂；
      //    允许暂时超出种群上限（溢出个体交由第 6 步压力淘汰削峰，形成更替）。
      let splitCount = 0;
      let splitThisTick = 0;
      const parents = cells.slice(); // 只对分裂前的细胞判一次，新子代不在本 tick 再分
      for (const c of parents) {
        if (splitThisTick >= WORLD.maxSplitPerTick || splitThisTick >= birthBudget) break;
        if (c.energy >= WORLD.maxEnergy * WORLD.splitEnergyFrac) {
          const child = makeCell(nextId++, c.genome, c, c.energy * WORLD.splitChildFrac);
          c.energy = c.energy * (1 - WORLD.splitChildFrac);
          cells = [...cells, child];
          splitCount += 1;
          splitThisTick += 1;
        }
      }

      // 6) 种群压力淘汰：超出上限时移除能量最低者（自然选择压力）
      let culled = 0;
      while (cells.length > WORLD.maxCells) {
        let wi = 0;
        for (let i = 1; i < cells.length; i++) {
          if (cells[i].energy < cells[wi].energy) wi = i;
        }
        cells = [...cells.slice(0, wi), ...cells.slice(wi + 1)];
        culled += 1;
      }

      // 6b) stage-10 有机体繁殖与变异 + 种群压力淘汰
      //     能量达标 -> 一分为二：子代继承父代模块布局并做一次变异（增/删/换模块），
      //     父子各留一半能量；允许本 tick 少量溢出上限，再由淘汰循环按能量维持度削峰，
      //     否则“种群一满就停止繁殖”会让选择压力失效、体型分异无从发生。
      let orgSplit = 0;
      // 成熟期递减：刚分裂过的个体在冷却期内不再分裂（splitCd 为不可变更新后的新对象）
      organisms = organisms.map((o) => ({
        ...o,
        splitCd: Math.max(0, (o.splitCd || 0) - dt),
      }));
      const orgParents = organisms.slice(); // 只对本 tick 已有个体判定一次
      // stage-11：捕食者配额——顶层消费者的繁殖名额受猎物（草食者）数量约束，
      // 数量不超过 max(1, ceil(草食数 * carnivoreShareCap))。生态意义：一只能量充足的
      // 肉食者若不受猎物量限制，会持续分裂到把草食层吃空，金字塔倒置（肉食多于草食）；
      // 按猎物比例封顶后，肉食者数量随草食层涨落而滞后跟随，三层才形成动态平衡。
      const orgDietCount = { carnivore: 0, herbivore: 0, phototroph: 0 };
      for (const o of organisms) orgDietCount[roleOf(o)] += 1;
      const carnivoreQuota = Math.max(
        1,
        Math.ceil(orgDietCount.herbivore * WORLD.carnivoreShareCap)
      );
      let orgCarnSplit = 0; // 本 tick 已出生的肉食子代数（配额计数用）
      // stage-15：被下了「繁殖禁令」的群体成员名单——禁令在繁殖结算处生效，
      // 拦下的分裂计入 tribeStats.blocked（面板可见），被拦个体不进入冷却、能量不扣。
      const banSet = (() => {
        const s = new Set();
        for (const t of tribes) {
          if (t.noBreed) for (const mid of t.members) s.add(mid);
        }
        return s;
      })();
      let banBlocked = 0;
      for (const o of orgParents) {
        if (orgSplit >= WORLD.orgMaxSplitPerTick || orgSplit + splitThisTick >= birthBudget) break;
        if ((o.splitCd || 0) > 0) continue;
        if (banSet.has(o.id)) {
          banBlocked += 1;
          continue; // 群体「繁殖禁令」生效：本个体暂不分裂
        }
        if (
          roleOf(o) === DIET.CARNIVORE &&
          orgDietCount.carnivore + orgCarnSplit >= carnivoreQuota
        ) {
          continue; // 猎物不够就养不起新天敌：捕食者暂停繁殖（不是不能捕猎）
        }
        const frac = WORLD.orgSplitEnergyFrac;
        if (o.energy < o.maxEnergy * frac) continue;
        const zone = zoneIndexAt(o.pos[0]);
        const homeZone = Number.isInteger(o.zone) ? o.zone : zone;
        const cap = zoneModuleCap(homeZone);
        // stage-14：大脑遗传——有脑父代把权重（含变异）传给子代；无脑父代有
        // nnEvolveChance 的概率“突变出神经网络”（认知谱系起源），其余子代保持无脑。
        const childBrain = o.brain
          ? random() < WORLD.nnLossChance
            ? null // 子代丢失神经网络（与“突变出脑”形成双向流动，保证两类谱系长期共存可比）
            : mutateBrain(
                o.brain,
                random,
                WORLD.nnWeightMutateRate,
                WORLD.nnWeightMutateAmount,
                WORLD.nnWeightLimit
              )
          : random() < WORLD.nnEvolveChance
            ? createBrain()
            : null;
        const seed = createOrganism(nextId++, {
          zone: homeZone,
          brain: childBrain,
          hasBrain: !!childBrain,
        });
        // 子代布局 = 父代布局变异一次（mutateLayout 内部保证合法性，非法则回退父布局），
        // 再按本带模块承载力裁剪：低产区养不起的大块头布局会被削到该区上限之内。
        const childLayout = trimLayoutToCap(
          mutateLayout(o.layout, random, cap),
          cap
        );
        let child = applyLayoutToOrganism(seed, childLayout, 0);
        // 变异也可能把草食/光合子代变成天敌（长出捕食爪），必须在“出生”这一刻同样校验配额：
        // 猎物不足时这类变异个体不落地，否则配额只拦得住肉食亲代、拦不住变异新生的天敌。
        if (
          roleOf(child) === DIET.CARNIVORE &&
          orgDietCount.carnivore + orgCarnSplit >= carnivoreQuota
        ) {
          continue;
        }
        const a = random() * Math.PI * 2;
        const b = WORLD.bounds - 0.5;
        const px = Math.max(-b, Math.min(b, o.pos[0] + Math.cos(a) * WORLD.orgSplitOffset));
        const pz = Math.max(-b, Math.min(b, o.pos[1] + Math.sin(a) * WORLD.orgSplitOffset));
        child = { ...child, pos: [px, pz], splitCd: WORLD.orgSplitCooldown };
        child.energy = o.energy * WORLD.orgSplitChildFrac;
        o.energy = o.energy * (1 - WORLD.orgSplitChildFrac);
        o.splitCd = WORLD.orgSplitCooldown;
        organisms = [...organisms, child];
        orgSplit += 1;
        if (roleOf(child) === DIET.CARNIVORE) orgCarnSplit += 1;
      }
      // 淘汰口径：按“可维持秒数”最低者剔除——模块越多耗能越高、存量能撑的时间越短，
      // 食物稀缺时比例率先崩塌，于是贫瘠带只留得住小体型、富营养带容得下大体型。
      // stage-10：上限按营养带分摊（营养承载力）——贫瘠带容量小，区内竞争直接与本地供给
      // 挂钩，跨区觅食再也不能把“养不起的大块头”摊平到别处，体型分异因此稳定可见。
      // 承载权重取营养丰度的平方根（边际递减），让贫瘠带也留得住一小撮小体型个体。
      let orgCulled = 0;
      // stage-10 出局口径：用“可维持秒数”(energy / drainPerSec) 衡量个体状态。
      // 模块越多 -> drainPerSec 越高 -> 同样存量能撑的时间越短；低产区补给慢，
      // 大块头先撑不住，小体型得以留种。若用能量比例(energy/maxEnergy)，
      // 大个体因 maxEnergy 高反而下降更慢，会把体型分异的方向拉反。
      const orgVitality = (o) =>
        o.energy / Math.max(0.001, (o.drainPerSec || 0.001) * (o.tempDrainMul || 1));
      // stage-10 满员削峰口径（WORLD.orgCullMode）：
      //  'vitality' = 比“可维持秒数”，耗能高的大体型先出局（会把各区体型一律压向最小）；
      //  'reserve'  = 比“能量储量”绝对值，营养充足时大体型 maxEnergy 高、储量天然更高，
      //               富营养带的承载名额因此向大体型倾斜，贫瘠带则因大块头撑不住、
      //               储量长期贴地而先行出局——同一把尺子在两端给出相反方向的选择压力。
      // 饥饿出局（可维持秒数跌破生存线）不受此开关影响，始终生效。
      const orgScore =
        WORLD.orgCullMode === 'vitality'
          ? (o) => orgVitality(o)
          : (o) => o.energy;
      const capWeight = (z) => Math.sqrt(zoneRichness(z));
      const zoneIds = Array.from({ length: ZONE_COUNT }, (_, z) => z);
      const orgCapSum = zoneIds.reduce((s, z) => s + capWeight(z), 0) || 1;
      const orgZoneCap = (z) =>
        Math.max(WORLD.orgZoneCapMin, Math.round((WORLD.orgMax * capWeight(z)) / orgCapSum));
      const cullWeakest = (match) => {
        let wi = -1;
        for (let i = 0; i < organisms.length; i++) {
          if (match && !match(organisms[i])) continue;
          if (wi === -1 || orgScore(organisms[i]) < orgScore(organisms[wi])) wi = i;
        }
        if (wi < 0) return false;
        organisms = [...organisms.slice(0, wi), ...organisms.slice(wi + 1)];
        orgCulled += 1;
        return true;
      };
      // stage-10：饥饿死亡——可维持秒数跌破生存线的个体直接出局。与“按区容量削峰”叠加后，
      // 贫瘠带的稀疏供给才真正变成选择压力：耗能高的大体型先撑不住，能效更高的小体型留种。
      const starveLine = WORLD.orgStarveSeconds;
      const beforeStarve = organisms.length;
      organisms = organisms.filter((o) => orgVitality(o) >= starveLine);
      orgCulled += beforeStarve - organisms.length;
      for (let z = 0; z < ZONE_COUNT; z++) {
        // stage-10：按“出生带归属”而非当前位置分组削峰——每个营养带的承载名额留给本地
        // 谱系（贫瘠带户口天生小体型），外来大体型无法挤占，环境分异才按谱系稳定累积。
        const inZone = (o) => (Number.isInteger(o.zone) ? o.zone : zoneIndexAt(o.pos[0])) === z;
        let over = organisms.filter(inZone).length - orgZoneCap(z);
        while (over > 0 && cullWeakest(inZone)) over -= 1;
      }
      while (organisms.length > WORLD.orgMax && cullWeakest(null)) { /* 全局兜底削峰 */ }

      // 6c) stage-11：水中落位兜底——本 tick 内新生的个体（分裂子代 / 全灭补播 / 分区殖民）
      //     与初始播入都可能落在水域瓦片上。这里统一把「站在水里」的个体搬到最近陆地格心，
      //     保证「水域不可通行」这条规则不会把任何个体一出生就困死在海里。
      if (map) {
        const settleOnLand = (arr, is2d) =>
          arr.map((o) => {
            const oz = o.pos[2] ?? o.pos[1];
            if (!isWaterAt(map, o.pos[0], oz)) return o;
            const [nx, nz] = nearestLandPos(map, o.pos[0], oz);
            return { ...o, pos: is2d ? [nx, nz] : [nx, o.pos[1], nz] };
          });
        cells = settleOnLand(cells, false);
        organisms = settleOnLand(organisms, true);
      }

      // 7) 统计 + 更新基因池（灭绝后保留灭绝前均值作父本）
      const stats = {
        died: (state.stats?.died || 0) + died,
        culled: (state.stats?.culled || 0) + culled,
        split: (state.stats?.split || 0) + splitCount,
        absorbed: (state.stats?.absorbed || 0) + absorbed,
        eatenCount: (state.stats?.eatenCount || 0) + eatenCount,
        avgEnergy: cells.length
          ? cells.reduce((s, c) => s + c.energy, 0) / cells.length
          : 0,
        gene: computeGeneStats(cells),
      };
      const genomePool = cells.length
        ? averageGenome(cells.map((c) => c.genome))
        : state.genomePool;

      // stage-14：认知谱系本 tick 切片——按“是否带脑”分别汇总觅食收益与样本数，
      // 供 HUD/统计给出人均对比（NN vs 普通），这是“有脑个体更会觅食”的量化证据。
      let nnForageNow = 0;
      let nnSamplesNow = 0;
      let plainForageNow = 0;
      let plainSamplesNow = 0;
      // 按营养带（富/过渡/贫）分层累计：规避“个体分布在不同带”对人均对比的干扰，
      // 验收时用带内加权人均比较，才是同类情境下的认知优势证据。
      const nnZoneForage = [0, 0, 0];
      const nnZoneSamples = [0, 0, 0];
      const plainZoneForage = [0, 0, 0];
      const plainZoneSamples = [0, 0, 0];
      for (const o of organisms) {
        const got = forageById.get(o.id) || 0;
        const zi = Math.max(0, Math.min(2, zoneIndexAt(o.pos[0])));
        if (o.brain) {
          nnForageNow += got;
          nnSamplesNow += 1;
          nnZoneForage[zi] += got;
          nnZoneSamples[zi] += 1;
        } else {
          plainForageNow += got;
          plainSamplesNow += 1;
          plainZoneForage[zi] += got;
          plainZoneSamples[zi] += 1;
        }
      }

      // ---- stage-15 B) 群体刷新 + 公共能量池结算 ----
      // 成员的出生（分裂子代）与出局（淘汰）都已落定，此时按存活个体重建群体：
      // id / 指令 / 能量池 / 累计读数自上一版群体复用，所以“指令不是一次性的”、
      // 池量也不会每 tick 归零。随后做能量共享——富余者上缴、亏缺者领取。
      // tribeGiven / tribeTaken 为本 tick 实际转移量，交给 orgStats 累加成累计读数。
      let tribeGiven = 0;
      let tribeTaken = 0;
      {
        const refreshed = buildTribes(organisms, tribes, { seq: tribeSeq });
        tribes = refreshed.tribes;
        tribeSeq = refreshed.seq;
        // stage-16：文明层自动派遣——把「自由状态」群体派往仍缺口的资源点（玩家指令优先，建城后停止），
        // 让「资源点 → 单位自动采集 → 资源入库」在无人干预下也闭环（见 civilization.dispatchGatherers）。
        tribes = dispatchGatherers(tribes, state.civ);
        organisms = applyOrders(organisms, tribes);
        const shared = shareEnergy(organisms, tribes, dt);
        organisms = shared.organisms;
        tribes = shared.tribes;
        tribeGiven = shared.given;
        tribeTaken = shared.taken;
      }

      // 8d) stage-16 文明结算：部落成员在资源点采集 → 资源入库 → 折算研究点解锁科技
      //     → 资源/科技/聚落规模合成文明进度，进度满则建城。
      //     仍走不可变更新（stepCivilization 不改入参，返回新 civ 对象）。
      const civ = stepCivilization(state.civ, {
        organisms,
        tribes,
        map: state.map,
        light: typeof light === 'number' ? light : state.light ?? 1,
        time: state.time + dt,
        dt,
      });

      // stage-07：有机体累计统计
      const orgStats = {
        spawn: state.orgStats?.spawn || 0,
        died: (state.orgStats?.died || 0) + orgDied,
        absorbed: (state.orgStats?.absorbed || 0) + orgAbsorbed,
        edited: state.orgStats?.edited || 0, // stage-09：组装应用计数（跨 tick 保留）
        split: (state.orgStats?.split || 0) + orgSplit,   // stage-10：有机体繁殖次数
        culled: (state.orgStats?.culled || 0) + orgCulled, // stage-10：有机体淘汰数
        // ---- stage-11：生态金字塔能量流统计 ----
        plantBitten: (state.orgStats?.plantBitten || 0) + plantBitten, // 累计取食生物量
        plantEaten: (state.orgStats?.plantEaten || 0) + plantEatenCount, // 累计被啃空的植株数
        plantBorn, // 累计萌发株数（含初始植被；直接用权威累计值，避免与 state.plantBorn 二次累加）
        grazed: (state.orgStats?.grazed || 0) + orgGrazed,       // 草食者由植物获得的能量
        predKills: (state.orgStats?.predKills || 0) + predKills, // 累计捕食次数
        predGain: (state.orgStats?.predGain || 0) + predGain,    // 捕获者累计获得的能量
        // ---- stage-13：气候胁迫统计 ----
        tempLoss: (state.orgStats?.tempLoss || 0) + orgTempLoss, // 累计“温度不适”额外耗能
        // ---- stage-14：认知谱系统计（觅食收益按“带脑/无脑”分开累计，供人均对比）----
        nnForage: (state.orgStats?.nnForage || 0) + nnForageNow,
        nnForageSamples: (state.orgStats?.nnForageSamples || 0) + nnSamplesNow,
        plainForage: (state.orgStats?.plainForage || 0) + plainForageNow,
        plainForageSamples: (state.orgStats?.plainForageSamples || 0) + plainSamplesNow,
        nnAlive: nnSamplesNow, // 当前带脑存活数（瞬时值）
        nnShare: organisms.length ? nnSamplesNow / organisms.length : 0,
        // ---- stage-15：群体与领地统计（瞬时值：群体数/成员数/公共池总量/指令分布）----
        tribeCount: tribes.length,
        tribeMembers: tribes.reduce((s, t) => s + t.count, 0),
        tribePooled: tribes.reduce((s, t) => s + (t.pool || 0), 0),
        tribeMoving: tribes.filter((t) => t.order && t.order.mode === ORDER.MOVE).length,
        tribeGathering: tribes.filter((t) => t.order && t.order.mode === ORDER.GATHER).length,
        tribeBanned: tribes.filter((t) => t.noBreed).length,
        tribeGiven, // 本 tick 上缴量（由 state.tribeStats 累计成总读数）
        tribeTaken, // 本 tick 领取量
        // ---- stage-16：文明读数（进度/阶段/采集单位/采集速率/是否建城）----
        civProgress: civ.progress,
        civStage: civ.stageCn,
        civUnits: civ.units,
        civRate: civ.rate,
        civBuilt: civ.built,
        // 分区累计（营养带 × 带脑/无脑），验收脚本据此算带内加权人均，剔除分布差异
        nnZoneForage: (state.orgStats?.nnZoneForage || [0, 0, 0]).map((v, i) => v + nnZoneForage[i]),
        nnZoneSamples: (state.orgStats?.nnZoneSamples || [0, 0, 0]).map((v, i) => v + nnZoneSamples[i]),
        plainZoneForage: (state.orgStats?.plainZoneForage || [0, 0, 0]).map((v, i) => v + plainZoneForage[i]),
        plainZoneSamples: (state.orgStats?.plainZoneSamples || [0, 0, 0]).map((v, i) => v + plainZoneSamples[i]),
      };

      // 8) stage-04 auto-evo：每 N 秒结算一代存活统计，供演化趋势观测
      let autoEvo = state.autoEvo;
      if (state.time >= autoEvo.nextAt) {
        const rec = computeGeneration(cells, autoEvo.gen + 1, state.time);
        const prev = autoEvo.records.length ? autoEvo.records[autoEvo.records.length - 1] : null;
        rec.trend = prev ? rec.speedAvg - prev.speedAvg : 0;
        autoEvo = {
          ...autoEvo,
          gen: rec.gen,
          nextAt: state.time + WORLD.autoEvoSeconds,
          records: [...autoEvo.records, rec].slice(-120),
          trend: rec.trend,
        };
      }

      // 8b) stage-10 有机体世代结算：每 orgAutoEvoSeconds 秒记录一代模块布局/体型/分区分布，
      //     并用各区存活比例平滑刷新出生点权重（环境分异的个体更容易留下后代）。
      let spawnWeights = Array.isArray(state.spawnWeights) && state.spawnWeights.length === ZONE_COUNT
        ? state.spawnWeights
        : new Array(ZONE_COUNT).fill(1 / ZONE_COUNT);
      const orgNextAt = autoEvo.orgNextAt ?? WORLD.orgAutoEvoSeconds;
      if (state.time >= orgNextAt) {
        const rec = computeOrganismGeneration(organisms, (autoEvo.orgGen || 0) + 1, state.time, {
          climateTemp,
          tempOffset,
          temperature,
          plantMul,
        });
        const prevOrg = autoEvo.orgRecords && autoEvo.orgRecords.length
          ? autoEvo.orgRecords[autoEvo.orgRecords.length - 1]
          : null;
        rec.trend = prevOrg ? rec.moduleAvg - prevOrg.moduleAvg : 0;
        autoEvo = {
          ...autoEvo,
          orgGen: rec.gen,
          orgNextAt: state.time + WORLD.orgAutoEvoSeconds,
          orgRecords: [...(autoEvo.orgRecords || []), rec].slice(-WORLD.orgEvoHistoryMax),
          orgTrend: rec.trend,
        };
        if (rec.alive > 0) {
          // 上一代存活比例以 orgSpawnWeightSmooth 系数平滑进出生权重，
          // 并设 orgSpawnMinWeight 下限防止某区权重归零后彻底绝育（仍有 5% 采样概率）。
          const k = WORLD.orgSpawnWeightSmooth;
          spawnWeights = rec.zones.map((row, i) =>
            Math.max(WORLD.orgSpawnMinWeight, spawnWeights[i] * (1 - k) + row.ratio * k)
          );
          // 分区殖民（孢子扩散）：某营养带整代无存活时播入少量殖民者，出生布局随该区
          // 丰度自动偏小（贫瘠带 -> 小体型），避免贫瘠带被永久清空而看不到小型化策略。
          const emptyZones = rec.zones.filter((z) => z.count === 0).map((z) => z.zone);
          for (const zi of state.settings.reseed ? emptyZones : []) {
            for (let k2 = 0; k2 < WORLD.orgPioneerCount; k2++) {
              if (organisms.length >= WORLD.orgMax) break;
              organisms = [...organisms, createOrganism(nextId++, { zone: zi })];
            }
          }
        }
      }

      // stage-06：进化点累积——吸收能量（每 evoEnergyPerPoint 能量 1 点，小数
      // 计入 evoAcc 跨 tick 结转）+ 每次分裂繁殖 +evoPointPerSplit 点
      let evoAcc = (state.evoAcc || 0) + absorbed / WORLD.evoEnergyPerPoint;
      const evoGained = Math.floor(evoAcc);
      evoAcc -= evoGained;
      const evoPoints = (state.evoPoints ?? WORLD.evoStart)
        + evoGained
        + splitCount * WORLD.evoPointPerSplit;

      return {
        ...state,
        cells,
        foods,
        organisms,
        plants,          // stage-11：生产者（草地植物）新数组
        nextPlantId,
        plantAcc,
        plantBorn,
        nextId,
        stats,
        orgStats,
        genomePool,
        autoEvo,
        evoPoints,
        evoAcc,
        foodAcc,
        spawnWeights,
        tick: state.tick + 1,
        time: state.time + dt,
        // stage-12：昼夜与时间流速随 tick 收敛（HUD 面板、渲染灯光读这三个字段）
        timeScale: state.timeScale || WORLD.timeScaleDefault,
        dayPhase,
        light,
        temperature,
        // stage-13：环境干预状态与基线气候温度（干预后立即反映到面板/菜单读数）
        env: { ...env, tempOffset },
        climateTemp,
        // stage-15：群体与领地（群体列表 / id 游标 / 累计读数，跨 tick 存续）
        tribes,
        tribeSeq,
        tribeStats: {
          given: (state.tribeStats?.given || 0) + (orgStats.tribeGiven ?? 0),
          taken: (state.tribeStats?.taken || 0) + (orgStats.tribeTaken ?? 0),
          orders: state.tribeStats?.orders || 0,
          bans: state.tribeStats?.bans || 0,
          blocked: (state.tribeStats?.blocked || 0) + banBlocked,
        },
        // stage-16：文明状态（资源点/资源/研究点/科技/进度/城市，跨 tick 存续）
        civ,
      };
    }
    case 'SET_TIME_SCALE': {
      // stage-12：切换时间流速（1x/2x/3x）——世界推进与昼夜钟同比例加速
      const scale = Number(action.scale);
      if (!WORLD.timeScaleOptions.includes(scale)) return state;
      if (scale === state.timeScale) return state;
      return { ...state, timeScale: scale };
    }
    case 'TOGGLE_PAUSE': {
      // 进入暂停：保留现场供编辑器使用；退出暂停：丢弃未完成的编辑/组装缓冲
      const paused = !state.paused;
      return {
        ...state,
        paused,
        editor: paused ? state.editor : null,
        orgEditor: paused ? state.orgEditor : null,
      };
    }
    case 'OPEN_EDITOR': {
      // 仅暂停时可选中细胞并载入其基因到编辑缓冲（与组装模式互斥，避免双面板）
      if (!state.paused) return state;
      const cell = state.cells.find((c) => c.id === action.cellId);
      if (!cell) return state;
      return {
        ...state,
        editor: { cellId: cell.id, genome: { ...cell.genome } },
        orgEditor: null,
      };
    }
    // ---- stage-13：环境干预（作用于环境本身，不改动任何个体基因） ----
    case 'SEED_PLANTS': {
      // 播种植物：在点击格附近的草地上补种一批植株（初级生产力不足时救急）
      return seedPlantsNear(state, action.gx, action.gy);
    }
    case 'DRAIN_TILE': {
      // 排水成陆：把点中的水域格改写成草地，扩大植物可生长面积与陆地通行范围
      return changeSurface(state, action.gx, action.gy, TILE.GRASS, 'drained');
    }
    case 'FILL_TILE': {
      // 注水成海：把点中的陆地格改写成水域（该格植株一并清除），压缩生境
      return changeSurface(state, action.gx, action.gy, TILE.WATER, 'filled');
    }
    case 'ADJUST_TEMP': {
      // 调温：基线气候温度按 ±tempOffsetStep 步进，夹在 ±tempOffsetLimit 内
      return shiftTemperature(state, action.delta);
    }
    case 'RESET_TEMP': {
      // 温度复位：把基线气候拉回默认值
      const e0 = envOf(state);
      if (e0.tempOffset === 0) return state;
      return {
        ...state,
        env: { ...e0, tempOffset: 0, tempAdjusted: e0.tempAdjusted + 1 },
        climateTemp: baseTemperatureOf(0),
        temperature: mapTemperatureOf(Number.isFinite(state.light) ? state.light : 1, 0),
      };
    }
    // ---- stage-15：群体与领地——玩家对群体下达指令（移动 / 采集），繁殖禁令单独开关 ----
    case 'SET_TRIBE_ORDER': {
      // 群体指令：mode = 'roam'（恢复自主）| 'move'（去落点）| 'gather'（领地内采集）
      // 指令写进 state.tribes[i].order 而非直接改个体——个体 order 由 applyOrders 统一投射，
      // 单向数据流不变；群体 id 与指令也因此能跨 tick 存续（不是一次性动作）。
      const id = action.tribeId;
      const target = (state.tribes || []).find((t) => t.id === id);
      if (!target) return state;
      const mode =
        action.mode === ORDER.MOVE || action.mode === ORDER.GATHER ? action.mode : ORDER.ROAM;
      const tx = mode === ORDER.MOVE && Number.isFinite(action.tx) ? action.tx : null;
      const tz = mode === ORDER.MOVE && Number.isFinite(action.tz) ? action.tz : null;
      const tribes = state.tribes.map((t) =>
        // stage-16：玩家指令落地即打上 manual 标记——之后文明层自动派遣不再碰这个群体（尊重玩家意图）
        t.id === id ? { ...t, order: { mode, tx, tz }, auto: false, work: null, manual: true } : t
      );
      // 个体 order 立即投射（否则要等下一 tick 才看到群体起步，操作反馈会“发木”）
      const organisms = applyOrders(state.organisms, tribes);
      return {
        ...state,
        tribes,
        organisms,
        tribeStats: {
          ...(state.tribeStats || {}),
          orders: (state.tribeStats?.orders || 0) + 1,
        },
      };
    }
    case 'TOGGLE_TRIBE_BREED': {
      // 繁殖禁令开关：开启后该群体成员在繁殖结算处被拦下（orgStats 里可见 blocked 计数）
      const id = action.tribeId;
      const target = (state.tribes || []).find((t) => t.id === id);
      if (!target) return state;
      const noBreed = !target.noBreed;
      const tribes = state.tribes.map((t) => (t.id === id ? { ...t, noBreed } : t));
      const organisms = applyOrders(state.organisms, tribes);
      return {
        ...state,
        tribes,
        organisms,
        tribeStats: {
          ...(state.tribeStats || {}),
          bans: (state.tribeStats?.bans || 0) + (noBreed ? 1 : 0),
        },
      };
    }
    case 'ACK_CITY': {
      // stage-16：玩家已读「建城」资料页（只记已读标记，文明状态本身不变）
      if (!state.civ || state.civ.ackCity) return state;
      return { ...state, civ: { ...state.civ, ackCity: true } };
    }
    case 'EDIT_GENE': {
      // 微调三个可编辑属性（速度/感知/体型）之一：每步扣 1 进化点并夹回 [0,1]
      const ed = state.editor;
      if (!ed) return state;
      if (!EDITABLE_KEYS.includes(action.key)) return state;
      if (state.evoPoints < WORLD.editorCostPerStep) return state;
      const step = (action.dir > 0 ? 1 : -1) * WORLD.editorAttrStep;
      const value = Math.min(1, Math.max(0, ed.genome[action.key] + step));
      if (value === ed.genome[action.key]) return state; // 已达边界，无可调
      const genome = { ...ed.genome, [action.key]: value };
      return {
        ...state,
        evoPoints: state.evoPoints - WORLD.editorCostPerStep,
        editor: { ...ed, genome },
      };
    }
    case 'APPLY_GENOME': {
      // 确认应用：更新所选细胞基因，向场景投放少量展示子代（带小变异），
      // 关闭面板并恢复播放，让玩家立刻看到编辑结果。
      const ed = state.editor;
      if (!ed) return state;
      const base = state.cells.find((c) => c.id === ed.cellId);
      if (!base) return state;
      let cells = state.cells.map((c) =>
        c.id === ed.cellId ? applyGenomeToCell(c, ed.genome) : c
      );
      let nextId = state.nextId;
      for (let i = 0; i < WORLD.editorShowCount; i++) {
        cells = [...cells, makeCell(nextId++, ed.genome, base, WORLD.maxEnergy * 0.6)];
      }
      return {
        ...state,
        cells,
        nextId,
        paused: false,
        editor: null,
      };
    }
    case 'CLOSE_EDITOR': {
      return { ...state, editor: null };
    }
    case 'SPAWN_ORGANISM': {
      // stage-07：玩家手动向场景投放一只随机有机体（上限保护）
      if (state.organisms.length >= WORLD.orgMax) return state;
      const org = createOrganism(state.nextId++, {});
      return {
        ...state,
        organisms: [...state.organisms, org],
        nextId: state.nextId,
        orgStats: {
          ...state.orgStats,
          spawn: (state.orgStats?.spawn || 0) + 1,
        },
      };
    }
    // ================= stage-09：生成编辑器（组装模式）=================
    case 'OPEN_ORG_EDITOR': {
      // 仅暂停时进入组装模式：把目标有机体的模块布局载入编辑缓冲
      if (!state.paused) return state;
      const org = state.organisms.find((o) => o.id === action.organismId);
      if (!org) return state;
      return {
        ...state,
        editor: null, // 与细胞编辑器互斥
        orgEditor: {
          organismId: org.id,
          layout: org.layout.map((m) => ({ ...m })), // 编辑缓冲（原始布局在 state.organisms 中不动）
          selectedType: state.orgEditor?.selectedType || 'body',
          energySpent: 0, // 应用时一次性结算的组装能量开销
          message: `已载入有机体 #${org.id}（${org.layout.length} 模块），选类型后点格子增删`,
        },
      };
    }
    case 'SET_MODULE_TYPE': {
      // 状态机第 1 步：选择要放置的模块类型
      const ed = state.orgEditor;
      if (!ed) return state;
      if (!MODULE_TYPES.includes(action.moduleType)) return state;
      return {
        ...state,
        orgEditor: {
          ...ed,
          selectedType: action.moduleType,
          message: `待放置：${MODULE_CN[action.moduleType]}（点空格子放下，点已有格子移除）`,
        },
      };
    }
    case 'TOGGLE_MODULE_CELL': {
      // 状态机第 2 步：点格子 -> 空位添加(消耗进化点/能量预算) 或 已有模块移除
      const ed = state.orgEditor;
      if (!ed) return state;
      const org = state.organisms.find((o) => o.id === ed.organismId);
      if (!org) return state;
      const { gx, gy } = action;
      const cap = gridCapacity();
      if (gx < 0 || gx >= WORLD.orgGridSize || gy < 0 || gy >= WORLD.orgGridSize) {
        return { ...state, orgEditor: { ...ed, message: '格子越界' } };
      }
      const hit = ed.layout.find((m) => m.gx === gx && m.gy === gy);

      // --- 移除已有模块 ---
      if (hit) {
        if (hit.type === 'body' && countModules(ed.layout).body <= WORLD.orgEditorMinBody) {
          return { ...state, orgEditor: { ...ed, message: '至少保留 1 个体细胞，无法移除' } };
        }
        const layout = ed.layout.filter((m) => m !== hit);
        const err = validateLayout(layout);
        if (err) return { ...state, orgEditor: { ...ed, message: err } };
        // 本次新加的格子被移除时退还进化点；原有格子移除不退（拆除重建不赚点）
        const isNew = !org.layout.some((m) => m.gx === gx && m.gy === gy);
        const refund = isNew ? WORLD.orgEditorAddCost : 0;
        return {
          ...state,
          evoPoints: state.evoPoints + refund,
          orgEditor: {
            ...ed,
            layout,
            energySpent: Math.max(0, (ed.energySpent || 0) - (isNew ? WORLD.orgEditorAddEnergy : 0)),
            message: `移除 ${MODULE_CN[hit.type]} (${gx},${gy})${refund ? ` · 退回 ${refund} 进化点` : ''}`,
          },
        };
      }

      // --- 空位添加模块 ---
      if (ed.layout.length >= cap) {
        return { ...state, orgEditor: { ...ed, message: `网格已满（${cap} 格）` } };
      }
      if (state.evoPoints < WORLD.orgEditorAddCost) {
        return { ...state, orgEditor: { ...ed, message: `进化点不足（需 ${WORLD.orgEditorAddCost}）` } };
      }
      const spent = (ed.energySpent || 0) + WORLD.orgEditorAddEnergy;
      if (org.energy - spent < WORLD.orgEditorMinEnergy) {
        return {
          ...state,
          orgEditor: { ...ed, message: `能量不足（组装后需 ≥ ${WORLD.orgEditorMinEnergy}）` },
        };
      }
      const layout = [...ed.layout, { gx, gy, type: ed.selectedType }];
      const err2 = validateLayout(layout);
      if (err2) return { ...state, orgEditor: { ...ed, message: err2 } };
      return {
        ...state,
        evoPoints: state.evoPoints - WORLD.orgEditorAddCost,
        orgEditor: {
          ...ed,
          layout,
          energySpent: spent,
          message: `添加 ${MODULE_CN[ed.selectedType]} (${gx},${gy}) · 消耗 ${WORLD.orgEditorAddCost} 进化点`,
        },
      };
    }
    case 'APPLY_LAYOUT': {
      // 应用：重算表型 + 结算组装能量开销，落回世界并恢复播放（可立刻看到成品游动）
      const ed = state.orgEditor;
      if (!ed) return state;
      const org = state.organisms.find((o) => o.id === ed.organismId);
      if (!org) return state;
      const err = validateLayout(ed.layout);
      if (err) return { ...state, orgEditor: { ...ed, message: err } };
      const organisms = state.organisms.map((o) =>
        o.id === ed.organismId
          ? applyLayoutToOrganism(o, ed.layout, ed.energySpent || 0)
          : o
      );
      return {
        ...state,
        organisms,
        orgEditor: null,
        paused: false,
        orgStats: {
          ...state.orgStats,
          edited: (state.orgStats?.edited || 0) + 1,
        },
      };
    }
    case 'CLOSE_ORG_EDITOR': {
      // 关闭组装面板：丢弃编辑缓冲（原始有机体未被改动）并恢复播放
      if (!state.orgEditor) return state;
      return { ...state, orgEditor: null, paused: false };
    }
    default:
      return state;
  }
}


/** Seed and fixed steps make snapshots replayable across frame rates. */
export function createInitialState(seed = 20260927) {
  if (!Number.isInteger(seed)) throw new Error('Invalid world seed');
  const result = withRandomState(seed, createWorld);
  const state = result.value;
  const worldId = `eco-${seed >>> 0}`;
  return {...state, version:2, seed:seed>>>0, rng:result.rng, worldId, pendingDt:0,
    settings:{reseed:false}, space:createSpace(state.map,worldId),
    ecology:{sequence:0,harvest:{food:0,herb:0,spirit:0},recycled:0,inflow:0,deaths:0,lastExport:null}};
}
export function reducer(state, action) {
  if (!action || typeof action.type !== 'string') return state;
  if (action.type === 'HARVEST') return harvest(state);
  if (action.type === 'ACK_HARVEST') return {...state,ecology:{...state.ecology,
    pendingExports:(state.ecology.pendingExports||[]).filter(p=>!(p.worldId===action.worldId&&p.sequence===action.sequence))}};
  if (action.type === 'TOGGLE_RESEED') return {...state,settings:{...state.settings,reseed:!state.settings.reseed}};
  if (action.type === 'SET_SPACE') {
    if (!(action.element in ELEMENTS) || !Number.isFinite(action.concentration) || action.concentration < .25 || action.concentration > 3) return state;
    return {...state,space:{...state.space,element:action.element,concentration:action.concentration}};
  }
  if (action.type === 'TICK' && (state.paused || !Number.isFinite(action.dt) || action.dt <= 0 || action.dt > 60)) return state;
  const result = withRandomState(state.rng, () => {
    if (action.type !== 'TICK') return reduceStep(state, action);
    let pending = Math.round((state.pendingDt + action.dt * state.timeScale) * 1e10) / 1e10;
    let next = state, steps = 0;
    while (pending >= .05 - 1e-10 && steps++ < 200) {
      next = stepLingCycle(next, reduceStep(next, {type:'TICK',dt:.05}), .05);
      pending = Math.round((pending - .05) * 1e10) / 1e10;
    }
    return {...next,pendingDt:Math.abs(pending)<1e-8?0:Math.max(0,pending)};
  });
  return result.value === state ? state : {...result.value,rng:result.rng};
}
