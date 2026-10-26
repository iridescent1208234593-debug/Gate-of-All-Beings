import { random } from './random.js';
// 多细胞模块模型（stage-07）：
// 引入“有机体 organism”概念——由若干细胞模块粘合而成，模块类型决定行为加成：
//   body        体细胞：基础结构，提供储能上限与体积（耗能也上升）
//   flagellum   鞭毛：+移动速度（每个 +orgFlagSpeedBonus）
//   mouth       口器：+进食吸收量（每个 +orgMouthAbsorb）并稍增进食半径
//   chloroplast 叶绿体：被动光合产能（每个每秒 +orgPhotoPerSec）
// 有机体整体存在与游动；模块列表 -> synthesize() 合成表型数值。
import { COLORS, WORLD } from '../config/index.js';
import { createRandomGenome, deriveTraits } from './genome.js';
// stage-14：极简神经网络（[6,4,4] 前向）——部分个体带脑，权重随繁殖变异
import { createBrain } from './nn.js';
import { zoneRichness, zoneModuleCap, randomPosInZone, pickZone } from './environment.js';

export const MODULE_TYPES = ['body', 'flagellum', 'mouth', 'chloroplast', 'claw'];

// 模块中文名（编辑器 UI 与提示文案用）
export const MODULE_CN = {
  body: '体细胞',
  flagellum: '鞭毛',
  mouth: '口器',
  chloroplast: '叶绿体',
  claw: '捕食爪',
};

// 营养级（stage-11 食性）：由模块构成决定，决定摄食收入口径与捕食权
//   carnivore  肉食者：带捕食爪（claw），靠猎杀其它有机体获取能量
//   herbivore  草食者：带口器但无爪，主粮是草地植物（生产者）
//   phototroph 光合者：无口器无爪，靠叶绿体 + 悬浮营养团
export const DIET = {
  CARNIVORE: 'carnivore',
  HERBIVORE: 'herbivore',
  PHOTOTROPH: 'phototroph',
};

export const DIET_CN = {
  carnivore: '肉食',
  herbivore: '草食',
  phototroph: '光合',
};

// 由模块计数判定食性（organism 实例与合成表型都可用同一口径）
export function roleOf(o) {
  if ((o.clawCount || 0) > 0) return DIET.CARNIVORE;
  if ((o.mouthCount || 0) > 0) return DIET.HERBIVORE;
  return DIET.PHOTOTROPH;
}

// 三种演示布局（保证模块加成肉眼可对比）：游者/食者/光者
export const DEMO_LAYOUTS = {
  swimmer: [
    { gx: 1, gy: 1, type: 'body' },
    { gx: 0, gy: 0, type: 'flagellum' },
    { gx: 2, gy: 0, type: 'flagellum' },
    { gx: 0, gy: 2, type: 'flagellum' },
    { gx: 2, gy: 2, type: 'flagellum' },
    { gx: 1, gy: 0, type: 'mouth' },
  ],
  eater: [
    { gx: 1, gy: 1, type: 'body' },
    { gx: 0, gy: 1, type: 'body' },
    { gx: 0, gy: 0, type: 'mouth' },
    { gx: 2, gy: 0, type: 'mouth' },
    { gx: 0, gy: 2, type: 'mouth' },
    { gx: 2, gy: 2, type: 'mouth' },
    { gx: 2, gy: 1, type: 'mouth' },
  ],
  solar: [
    { gx: 1, gy: 1, type: 'body' },
    { gx: 0, gy: 1, type: 'body' },
    { gx: 0, gy: 0, type: 'chloroplast' },
    { gx: 2, gy: 0, type: 'chloroplast' },
    { gx: 0, gy: 2, type: 'chloroplast' },
    { gx: 2, gy: 2, type: 'chloroplast' },
    { gx: 2, gy: 1, type: 'flagellum' },
  ],
  // 猎手：带捕食爪的肉食者（stage-11 食物链顶层；身板大 -> 草食者见之即逃）
  hunter: [
    { gx: 1, gy: 1, type: 'body' },
    { gx: 0, gy: 1, type: 'body' },
    { gx: 2, gy: 1, type: 'body' },
    { gx: 1, gy: 0, type: 'body' },
    { gx: 0, gy: 0, type: 'claw' },
    { gx: 2, gy: 0, type: 'claw' },
    { gx: 0, gy: 2, type: 'claw' },
    { gx: 1, gy: 2, type: 'flagellum' },
    { gx: 2, gy: 2, type: 'flagellum' },
  ],
  // 压迫者：多 body 大块头（stage-08 追逐/逃散演示用）
  brute: [
    { gx: 1, gy: 1, type: 'body' },
    { gx: 0, gy: 1, type: 'body' },
    { gx: 2, gy: 1, type: 'body' },
    { gx: 1, gy: 0, type: 'body' },
    { gx: 1, gy: 2, type: 'body' },
    { gx: 0, gy: 0, type: 'flagellum' },
    { gx: 2, gy: 0, type: 'flagellum' },
    { gx: 0, gy: 2, type: 'mouth' },
    { gx: 2, gy: 2, type: 'mouth' },
  ],
};

function rand(lo, hi) {
  return lo + random() * (hi - lo);
}

function moduleRadius(type) {
  return type === 'body' ? WORLD.orgBodyRadius : WORLD.orgModuleRadius;
}

// 把模块相对网格偏移换算为世界 xz 偏移（以质心为原点）
function localOffset(m) {
  const c = (WORLD.orgGridSize - 1) / 2; // 中心格序号
  return [(m.gx - c) * WORLD.orgSpacing, (m.gy - c) * WORLD.orgSpacing];
}

// 模块计数：{ body, flagellum, mouth, chloroplast, claw, total }
export function countModules(modules) {
  const count = { body: 0, flagellum: 0, mouth: 0, chloroplast: 0, claw: 0, total: modules.length };
  for (const m of modules) if (m.type in count) count[m.type] += 1;
  return count;
}

// 由基因 + 模块布局合成表型：speed/感知继承基因，模块提供乘加加成；
// 能耗随体积（body 越多越重）与模块数上升，叶绿体被动产能抵消部分能耗。
// stage-09：导出为公开能力，供生成编辑器实时预览“速度/体积/耗能”预估
export function synthesizePhenotype(genome, modules) {
  const t = deriveTraits(genome);
  const count = countModules(modules);
  const total = count.total;
  return {
    speed: t.speed * (1 + count.flagellum * WORLD.orgFlagSpeedBonus),
    senseRange: t.senseRange,
    metabolismMul: t.metabolismMul,
    colorIndex: t.colorIndex,
    maxEnergy: WORLD.orgMaxEnergyBase + count.body * WORLD.orgBodyEnergy,
    drainPerSec:
      WORLD.drainBase *
      (0.35 +
        WORLD.orgDrainExtraBody * count.body +
        WORLD.orgDrainExtraModule * total +
        // stage-10：模块数二次项——结构堆叠的维持成本增速快于线性，
        // 让“本带供给能否养得起这种体型”成为真正的取舍（低产区养不起大块头）。
        WORLD.orgDrainQuadModule * total * total) *
      t.metabolismMul,
    absorbMul: 1 + count.mouth * WORLD.orgMouthAbsorb,
    // stage-10：本地初级生产力摄食收入——收入随摄食器官规模增长，
    // 在环境层再乘“所在营养带丰度”：富营养带的密度限制宽松，个体养得起大体型；
    // 贫瘠带生产率极低，大体型的维持成本无法覆盖，只有小体型收支为正。
    grazePerSec: WORLD.orgGrazePerSec * (1 + count.mouth * WORLD.orgMouthAbsorb),
    photoPerSec: count.chloroplast * WORLD.orgPhotoPerSec,
    eatRange:
      WORLD.orgEatRangeBase +
      count.body * WORLD.orgEatRangeBody +
      count.mouth * WORLD.orgEatRangeMouth +
      // stage-11：捕食爪兼作咬合器官，扩大接触（咬中）判定半径
      count.claw * WORLD.orgEatRangeClaw,
    bodyCount: count.body,
    flagCount: count.flagellum,
    mouthCount: count.mouth,
    chloroCount: count.chloroplast,
    clawCount: count.claw,
    // stage-11：攻击力（每个捕食爪 1 点）——肉食者判定与 HUD 展示共用
    attack: count.claw * WORLD.orgClawAttack,
    // stage-11：食性（营养级）由模块构成决定，摄食收入口径在 reducer 中按此分流
    diet:
      count.claw > 0 ? DIET.CARNIVORE : count.mouth > 0 ? DIET.HERBIVORE : DIET.PHOTOTROPH,
    moduleCount: total,
  };
}

// 随机布局：3x3 网格内不重复占位，保证至少 1 body，其余模块按类型权重随机。
// stage-10：初始体型随所在区营养丰度偏移——富营养区出生的个体倾向携带更多模块
// （大体型耗能高，只有富营养区养得起），贫瘠区出生的则偏小，形成体型分异的起点。
function randomLayout(rng = random, richness = 0.5, moduleCap = gridCapacity()) {
  const all = [];
  for (let gx = 0; gx < WORLD.orgGridSize; gx++) {
    for (let gy = 0; gy < WORLD.orgGridSize; gy++) all.push({ gx, gy });
  }
  const rich = Math.max(0, Math.min(1, richness));
  // stage-10：体型起点随所在区营养丰度单调递增——贫瘠带只养得起 3~5 模块的小个体，
  // 富营养带才撑得起 7~9 模块的大块头；保留 30% 随机浮动避免同区个体完全同质。
  // moduleCap 为该营养带的模块承载力上限（低产区上限更低，见 environment.zoneModuleCap）。
  const upper = Math.min(gridCapacity(), 9, Math.max(WORLD.orgMinModules, moduleCap | 0));
  const span = Math.max(1, upper - WORLD.orgMinModules);
  const extra = Math.round(rich * span * 0.7 + rng() * span * 0.3);
  const n = Math.max(WORLD.orgMinModules, Math.min(upper, WORLD.orgMinModules + extra));
  const chosen = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * all.length);
    chosen.push(all.splice(idx, 1)[0]);
  }
  // 第一个占位固定 body，保证每个有机体有基础结构
  const modules = [{ ...chosen[0], type: 'body' }];
  const weights = [
    { type: 'body', w: 0.3 },
    { type: 'flagellum', w: 0.25 },
    { type: 'mouth', w: 0.25 },
    { type: 'chloroplast', w: 0.2 },
    // stage-11：捕食爪低频出现——肉食是演化分支（少数个体），默认生态以草食/光合为主
    { type: 'claw', w: WORLD.clawEvolveChance },
  ];
  let sum = weights.reduce((s, x) => s + x.w, 0);
  for (let i = 1; i < chosen.length; i++) {
    let r = rng() * sum;
    let type = 'body';
    for (const x of weights) {
      r -= x.w;
      if (r <= 0) {
        type = x.type;
        break;
      }
    }
    modules.push({ ...chosen[i], type });
  }
  return modules;
}

// 创建有机体（含合成表型）；opts.layout 缺省时随机布局。
// stage-10：新增 opts.zone（环境分区）/ opts.zoneWeights（分区采样权重），
// 出生位置与初始体型都随所在区的营养丰度而定；opts.pos 优先。
export function createOrganism(id, opts = {}) {
  const genome = opts.genome || createRandomGenome();
  const zone = Number.isInteger(opts.zone)
    ? Math.max(0, opts.zone)
    : pickZone(opts.zoneWeights);
  const modules =
    opts.layout || randomLayout(random, zoneRichness(zone), zoneModuleCap(zone));
  const syn = synthesizePhenotype(genome, modules);
  const p = opts.pos || randomPosInZone(zone);
  const heading = opts.heading ?? random() * Math.PI * 2;
  // stage-14：极简大脑（可选）——opts.brain 用于繁殖时继承父代（已变异）权重；
  // 未注入时按 opts.hasBrain 显式指定，或按 nnSpawnChance 随机决定这一只是否“长脑”。
  // 无脑个体 brain=null，行为决策继续走 behaviors.js 的规则分支。
  let brain = opts.brain || null;
  if (!brain) {
    const want = opts.hasBrain !== undefined ? opts.hasBrain : random() < WORLD.nnSpawnChance;
    if (want) brain = createBrain();
  }
  return {
    id,
    genome,
    layout: modules,          // [{gx,gy,type}] 模块布局（可被编辑器/繁殖复用）
    brain,                    // stage-14：[6,4,4] 网络权重 {w1,b1,w2,b2} 或 null
    hasNN: !!brain,           // 渲染 / HUD 快速判读用
    zone,                     // 出生/当前所在环境分区（由 pos 推导，随移动漂移）
    ...syn,                   // 合成表型：speed/senseRange/…/moduleCount
    pos: p,                   // [x, z]
    vel: [Math.cos(heading) * syn.speed, 0, Math.sin(heading) * syn.speed],
    energy: opts.energy ?? rand(80, syn.maxEnergy * 0.85),
    splitCd: 0,               // stage-10：分裂成熟期（>0 时不可再分裂，避免种群高频翻烧）
  };
}

export function createDemoOrganism(id, kind, zone = 0) {
  return createOrganism(id, { layout: DEMO_LAYOUTS[kind], zone });
}

// stage-15：群体出生位置——在母体邻域内取一个斜角偏移点，避免与母体完全重叠
// （同源 + 近邻 = buildTribes 的成群体条件，保证一开局就能看到领地圈）
// 注意：个体 pos 口径是 [x, z]（两元），不是 [x, y, z]。
function nearPos(base, k, total) {
  const ang = (k / Math.max(1, total)) * Math.PI * 2 + random() * 0.3;
  const r = 1.6 + random() * 1.6;
  return [base[0] + Math.cos(ang) * r, base[1] + Math.sin(ang) * r];
}

// 初始种群：演示体（游/食/光/猎/压迫）+ 若干随机体。
// stage-10：演示体分散到不同营养带（富营养 2 只、过渡 1 只、贫瘠 1 只），
// 便于一开始就观察“富营养区体型大 / 贫瘠区体型小”的分异雏形。
// stage-11：加入 1 只「猎手」（带捕食爪）——食物链顶层消费者一开场即在位，
// 与草食者（食者/游者/压迫者）同场，肉食-草食-植物三层关系立即可观察。
// stage-15：演示体「成对出生」——游者/食者各自再带 2 只同布局同胞，在母体近旁落地，
// 于是开局即有 2 个可见群体（成员数 ≥ tribeMinMembers），玩家可立即点选并下达指令。
export function createInitialOrganisms(startId) {
  const orgs = [];
  // 草食/光合演示体（富营养 2 只、过渡 1 只、贫瘠 1 只）——
  // 顶层消费者数量由 WORLD.orgStartCarnivores 决定，保证食物链一开场即成立。
  const demo = [
    { kind: 'swimmer', zone: 0, brood: 2 },
    { kind: 'eater', zone: 0, brood: 2 },
    { kind: 'solar', zone: 1 },
  ];
  const hunters = Math.max(1, WORLD.orgStartCarnivores);
  for (let i = 0; i < hunters; i++) {
    demo.push({ kind: 'hunter', zone: i % 2 === 0 ? 0 : 1 });
  }
  demo.push({ kind: 'brute', zone: 2 });
  let id = startId;
  for (const d of demo) {
    const base = createDemoOrganism(id++, d.kind, d.zone);
    orgs.push(base);
    // stage-15：同源同胞（同 layout / 同基因簇）就近出生 -> 开局即成群体
    const brood = d.brood || 0;
    for (let k = 0; k < brood; k++) {
      orgs.push(
        createOrganism(id++, {
          layout: d.kind ? DEMO_LAYOUTS[d.kind].map((m) => ({ ...m })) : undefined,
          zone: d.zone,
          pos: nearPos(base.pos, k, brood),
          energy: base.energy,
        })
      );
    }
  }
  while (orgs.length < WORLD.orgStartCount) {
    orgs.push(createOrganism(id++, {}));
  }
  return { organisms: orgs, nextId: id };
}

export function moduleRadiusOf(m) {
  return moduleRadius(m.type);
}

// 网格容量（3x3 -> 9 个模块上限），编辑器与 reducer 校验共用
export function gridCapacity() {
  return WORLD.orgGridSize * WORLD.orgGridSize;
}

// 布局合法性校验：格子不重复、坐标在网格内、模块类型合法、至少 1 个 body
export function validateLayout(modules) {
  if (!Array.isArray(modules) || modules.length === 0) return '布局为空';
  if (modules.length > gridCapacity()) return '超出网格容量';
  const seen = new Set();
  let body = 0;
  for (const m of modules) {
    if (!MODULE_TYPES.includes(m.type)) return '未知模块类型';
    if (!Number.isInteger(m.gx) || !Number.isInteger(m.gy)) return '格子坐标非法';
    if (m.gx < 0 || m.gx >= WORLD.orgGridSize || m.gy < 0 || m.gy >= WORLD.orgGridSize) {
      return '格子越界';
    }
    const key = m.gx + ',' + m.gy;
    if (seen.has(key)) return '格子重复占用';
    seen.add(key);
    if (m.type === 'body') body += 1;
  }
  if (body < WORLD.orgEditorMinBody) return '至少保留 1 个体细胞';
  return null;
}

// stage-09：把生成编辑器拼好的布局落回有机体——
// 重算表型（速度/上限/耗能/吸收/光合）、按新上限夹住能量并结算组装能量开销、
// 速度方向按新巡航速度重新归一（保证“拼出来的有机体立刻能游动”）。
export function applyLayoutToOrganism(org, modules, energyCost = 0) {
  const syn = synthesizePhenotype(org.genome, modules);
  const len = Math.hypot(org.vel[0], org.vel[2]) || 1e-6;
  const ux = org.vel[0] / len;
  const uz = org.vel[2] / len;
  const z = org.pos[2] ?? org.pos[1];
  return {
    ...org,
    layout: modules.map((m) => ({ ...m })),
    ...syn,
    pos: [org.pos[0], z],
    vel: [ux * syn.speed, 0, uz * syn.speed],
    energy: Math.max(1, Math.min(syn.maxEnergy, org.energy - energyCost)),
  };
}

// stage-10：体型分（行为决策与世代统计共用）——body 是大块头（权重高），其余模块略计
export function organismSizeScore(org) {
  return (
    (org.bodyCount || 0) * WORLD.orgSizeBodyWeight +
    (org.moduleCount || 0) * WORLD.orgSizeModuleWeight
  );
}

// stage-10：布局签名（世代统计用），形如 "b2f1m1c0"，便于识别“最优势布局”
// stage-11：带捕食爪的谱系追加 "k{爪数}" 后缀（肉食谱系一眼可辨）
export function layoutSignature(layout) {
  const c = { body: 0, flagellum: 0, mouth: 0, chloroplast: 0, claw: 0 };
  for (const m of layout) if (m.type in c) c[m.type] += 1;
  return `b${c.body}f${c.flagellum}m${c.mouth}c${c.chloroplast}` + (c.claw > 0 ? `k${c.claw}` : '');
}

function randomModuleType(rng = random) {
  // 体细胞在变异算子中权重略低（结构骨架不宜频繁增减）
  const table = [
    { type: 'body', w: 0.18 },
    { type: 'flagellum', w: 0.29 },
    { type: 'mouth', w: 0.29 },
    { type: 'chloroplast', w: 0.24 },
    // stage-11：突变也能长出捕食爪（低频）——肉食谱系可由草食谱系演化而来
    { type: 'claw', w: WORLD.clawEvolveChance },
  ];
  const sum = table.reduce((s, x) => s + x.w, 0);
  let r = rng() * sum;
  for (const x of table) {
    r -= x.w;
    if (r <= 0) return x.type;
  }
  return 'flagellum';
}

// stage-10：繁殖时的模块布局变异（遗传 + 突变）。三种算子随机选一：
//   add    在空格新增一个模块（体型变大；已达该营养带承载力上限时不再提供该算子）
//   remove 删除一个非核心模块（体型变小，仍保证至少 1 body）
//   swap   把某个非 body 模块改换成别的类型（结构重组）
// 结果必须通过 validateLayout，否则回退为父代原布局（保守遗传）。
export function mutateLayout(layout, rng = random, moduleCap = gridCapacity()) {
  const parent = layout.map((m) => ({ ...m }));
  if (validateLayout(parent)) return parent; // 父布局异常时不冒险

  const cap = Math.min(gridCapacity(), Math.max(WORLD.orgMinModules, moduleCap | 0));
  const next = parent.map((m) => ({ ...m }));
  const occupied = new Set(next.map((m) => `${m.gx},${m.gy}`));
  const empties = [];
  for (let gy = 0; gy < WORLD.orgGridSize; gy++) {
    for (let gx = 0; gx < WORLD.orgGridSize; gx++) {
      if (!occupied.has(`${gx},${gy}`)) empties.push({ gx, gy });
    }
  }
  const bodies = next.filter((m) => m.type === 'body').length;

  const ops = [];
  if (empties.length > 0) ops.push('add');
  if (next.length > WORLD.orgMinModules) ops.push('remove');
  if (next.some((m) => m.type !== 'body')) ops.push('swap');
  if (!ops.length) return parent;

  const op = ops[Math.min(ops.length - 1, Math.floor(rng() * ops.length))];
  if (op === 'add') {
    const cell = empties[Math.min(empties.length - 1, Math.floor(rng() * empties.length))];
    next.push({ gx: cell.gx, gy: cell.gy, type: randomModuleType(rng) });
  } else if (op === 'remove') {
    // 优先删非 body；只有 body 富余时才允许删 body
    const cand = next
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.type !== 'body' || bodies > WORLD.orgEditorMinBody);
    if (!cand.length) return parent;
    const pick = cand[Math.min(cand.length - 1, Math.floor(rng() * cand.length))];
    next.splice(pick.i, 1);
  } else {
    const cand = next
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.type !== 'body');
    const pick = cand[Math.min(cand.length - 1, Math.floor(rng() * cand.length))];
    let type = randomModuleType(rng);
    let guard = 0;
    while (type === pick.m.type && guard++ < 6) type = randomModuleType(rng);
    next[pick.i] = { ...pick.m, type };
  }
  return validateLayout(next) ? parent : next;
}

// stage-10：把布局裁剪到某营养带的模块承载力上限内。
// 超过上限时优先移除“只耗能、不增长储能上限”的非 body 模块（鞭毛/口器/叶绿体），
// body 骨架最后才动且至少保留 1 个；裁剪结果非法时回退原布局。
export function trimLayoutToCap(layout, moduleCap, rng = random) {
  const cap = Math.min(gridCapacity(), Math.max(WORLD.orgMinModules, moduleCap | 0));
  const src = layout.map((m) => ({ ...m }));
  if (src.length <= cap) return src;
  const next = src.map((m) => ({ ...m }));
  let guard = 0;
  while (next.length > cap && guard++ < 64) {
    const bodies = next.filter((m) => m.type === 'body').length;
    let cand = next.map((m, i) => ({ m, i })).filter(({ m }) => m.type !== 'body');
    if (!cand.length) {
      cand = next
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m.type === 'body' && bodies > WORLD.orgEditorMinBody);
    }
    if (!cand.length) break;
    const pick = cand[Math.min(cand.length - 1, Math.floor(rng() * cand.length))];
    next.splice(pick.i, 1);
  }
  return validateLayout(next) ? src : next;
}

// 世界坐标：模块贴地放置，球心 y = floorY + 自身半径；xz 按质心平移
// organism.pos 为二维 [x, z]（无 y），此处兼容三/二维取 z。
export function moduleWorldPos(org, m) {
  const [lx, lz] = localOffset(m);
  const r = moduleRadius(m.type);
  const z = org.pos[2] ?? org.pos[1];
  return [org.pos[0] + lx, WORLD.floorY + r, z + lz];
}

// stage-08：有机体移动/行为决策已迁移至 behaviors.js（stepOrganisms 每 tick
// 统一决策并推进）；本文件保留模块布局、表型合成、世界坐标与统计等静态能力。

// HUD/验证辅助：对一组有机体求平均速度/叶绿体产能/行为计数（stage-08）
export function computeOrganismStats(organisms) {
  const out = {
    count: organisms.length,
    speedAvg: 0,
    photoAvg: 0,
    flagAvg: 0,
    mouthAvg: 0,
    moduleAvg: 0,
    clawAvg: 0,   // stage-11：平均捕食爪数（肉食化程度）
    // ---- stage-14：神经网络个体占比（认知谱系规模）----
    nnCount: 0,
    nnShare: 0,
    diet: { carnivore: 0, herbivore: 0, phototroph: 0 }, // stage-11：营养级结构
    beh: { seek: 0, flee: 0, chase: 0, photo: 0, wander: 0 },
  };
  if (!organisms.length) return out;
  let s = 0;
  let p = 0;
  let f = 0;
  let m = 0;
  let mod = 0;
  let claw = 0;
  let nn = 0; // stage-14：带脑个体计数
  for (const o of organisms) {
    s += o.speed;
    p += o.photoPerSec;
    f += o.flagCount;
    m += o.mouthCount;
    mod += o.moduleCount || 0;
    claw += o.clawCount || 0;
    if (o.brain) nn += 1; // stage-14：带神经网络（“会思考”）的个体
    const diet = o.diet || roleOf(o);
    if (diet in out.diet) out.diet[diet] += 1;
    else out.diet.phototroph += 1;
    const key = o.behavior || 'wander';
    if (key in out.beh) out.beh[key] += 1;
    else out.beh.wander += 1;
  }
  out.speedAvg = s / organisms.length;
  out.photoAvg = p / organisms.length;
  out.flagAvg = f / organisms.length;
  out.mouthAvg = m / organisms.length;
  out.clawAvg = claw / organisms.length;  // stage-11：肉食化程度均值
  out.moduleAvg = mod / organisms.length; // stage-10：HUD 体型（模块数）均值
  return out;
}
