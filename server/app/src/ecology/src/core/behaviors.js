import { random } from './random.js';
// 有机体行为系统（stage-08）：
// 行为权值由模块构成决定——
//   mouth        -> 主动觅食 seek（有口器更倾向追食物）
//   chloroplast  -> 倾向停留光合 photo（叶绿体多、能量足时原地“晒太阳”省能）
//   body/模块数  -> 体型分 sizeScore，差距大时：大者压制(chase)、小者逃离(flee)
// 每 tick：感知(perceive) -> 决策(decide) -> 移动(advance)；不同行为有不同行动成本(drainMul)。
// 与 cell 共用食物池感知；进食吸收仍由 reducer 统一判定。
import { WORLD } from '../config/index.js';
import { organismSizeScore, roleOf, DIET } from './organism.js';
import { zoneIndexAt, zoneCenterX } from './environment.js';
// stage-14：带脑个体优先走神经网络决策（encodeSenses 把感知折成 6 维输入）
import { decideBrain, encodeSenses } from './nn.js';
// stage-15：群体指令（tribe.js 定义 ORDER 常量）——本模块只读 o.order，不反向修改群体状态
import { ORDER } from './tribe.js';

export const BEHAVIOR = {
  SEEK: 'seek',     // 觅食：转向最近食物
  FLEE: 'flee',     // 逃离：远离体型显著更大的有机体
  CHASE: 'chase',   // 压制：体型显著更大的个体逼近小个体（不捕食，仅驱逐）
  PHOTO: 'photo',   // 光合：叶绿体多者停留原地被动产能（大幅省能）
  WANDER: 'wander', // 巡游：无目标随机漂移
  MOVE: 'move',     // stage-15：群体「移动」指令——朝群体指定落点行军（覆盖觅食/休憩倾向）
};

export const BEHAVIOR_CN = {
  seek: '觅',
  flee: '逃',
  chase: '压',
  photo: '光',
  wander: '巡',
  move: '令',       // stage-15：受群体指令驱动的行军个体
};

// 体型分（stage-10 起统一由 organism.js 提供，行为决策与世代统计共用同一口径）
function sizeScore(o) {
  return organismSizeScore(o);
}

function normXZ(x, z) {
  const l = Math.hypot(x, z) || 1e-6;
  return [x / l, z / l];
}

// 把当前速度朝目标方向(单位向量 tx,tz)旋转，最多转 maxTurn 弧度；返回新 vel
function steerToward(vel, tx, tz, maxTurn, currentSpeed) {
  const [vx, vz] = normXZ(vel[0], vel[2]);
  let ang = Math.atan2(vz, vx);
  const want = Math.atan2(tz, tx);
  let d = want - ang;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const step = Math.max(-maxTurn, Math.min(maxTurn, d));
  ang += step;
  return [Math.cos(ang) * currentSpeed, 0, Math.sin(ang) * currentSpeed];
}

// 感知：找最近威胁（更大有机体）、最近猎物（更小有机体）、最近食物与最近植物
// 位置约定：有机体 pos 为二维 [x, z]；食物为三维 [x, y, z]；植物为二维 [x, z]。统一用 zOf 取 z。
// stage-11：肉食者（clawCount>0）独享更低的猎物体型比与更大的捕猎视野；
// 非肉食者额外感知最近植物（草地生产者）——草食者的主粮。
function zOf(o) {
  return o.pos[2] ?? o.pos[1];
}

export function perceive(org, others, foods, plants = [], visionMul = 1) {
  const my = sizeScore(org);
  const ox = org.pos[0];
  const oz = zOf(org);
  const isCarn = (org.clawCount || 0) > 0;
  const preyRatio = isCarn ? WORLD.carnivorePreyRatio : WORLD.orgChaseSizeRatio;
  const preyRange = isCarn ? WORLD.carnivoreHuntRange : WORLD.orgChaseRange;
  // stage-12：有效视野 = 基因感知半径 × 光照视野倍率（夜里看不清，白天看得远）
  // stage-14：带神经网络的个体再乘 nnSenseRangeMul 视野加成——更早发现食物与威胁，
  // 这是“有脑个体更会觅食”能被统计验证的物理基础（认知优势落到可测量的感知半径上）。
  const brainMul = org.brain ? WORLD.nnSenseRangeMul : 1;
  const sense = org.senseRange * visionMul * brainMul;
  // 威胁感知：基因感知半径放大，且不低于保底半径（大个体逼近时必能察觉并逃散）
  const fleeRange = Math.max(sense * WORLD.orgFleeSenseMul, WORLD.orgFleeMinRange);
  let threat = null;
  let prey = null;
  for (const o of others) {
    if (o.id === org.id) continue;
    const dx = o.pos[0] - ox;
    const dz = zOf(o) - oz;
    const d = Math.hypot(dx, dz);
    const os = sizeScore(o);
    const ratio = os / Math.max(0.001, my);
    if (ratio >= WORLD.orgFleeSizeRatio && d < fleeRange) {
      if (!threat || d < threat.d) {
        threat = { o, dx, dz, d, dir: [dx / (d || 1), dz / (d || 1)] };
      }
    } else if (
      // 肉食者不捕食同类肉食者（避免同类相残把顶层消费者一次清空）
      (isCarn ? (o.clawCount || 0) === 0 : true) &&
      my / Math.max(0.001, os) >= preyRatio &&
      d < preyRange
    ) {
      if (!prey || d < prey.d) {
        prey = { o, dx, dz, d, dir: [dx / (d || 1), dz / (d || 1)] };
      }
    }
  }
  let food = null;
  const myZone = Number.isInteger(org.zone) ? org.zone : zoneIndexAt(ox);
  for (const f of foods) {
    const dx = f.pos[0] - ox;
    const dz = f.pos[2] - oz;
    const raw = Math.hypot(dx, dz);
    // stage-10：跨营养带觅食惩罚——个体最熟悉本带食源，外带食物按等效距离折算，
    // 于是“贫瘠带的稀疏供给”真正约束留在贫瘠带的个体，体型分异不会被跨区觅食抹平。
    const d = zoneIndexAt(f.pos[0]) === myZone ? raw : raw + WORLD.orgCrossZoneFoodPenalty;
    if (!food || d < food.d) {
      food = { f, dx, dz, d, dir: [dx / (raw || 1), dz / (raw || 1)] };
    }
  }
  // stage-11：植物（生产者）感知——只看本基因感知半径内最近的一株，作为草食者的首选目标
  let plant = null;
  const role = org.diet || roleOf(org);
  if (role !== DIET.CARNIVORE && (org.mouthCount || 0) > 0) {
    for (const p of plants) {
      const dx = p.pos[0] - ox;
      const dz = p.pos[1] - oz;
      const d = Math.hypot(dx, dz);
      if (d < sense && (!plant || d < plant.d)) {
        plant = { p, dx, dz, d, dir: [dx / (d || 1), dz / (d || 1)] };
      }
    }
  }
  return { threat, prey, food, plant };
}

// stage-14：带脑个体的神经网络决策——把感知折成 6 维输入做一次前向，再把得分最高的
// 动作翻译成与规则分支同构的行为对象。返回 null 表示“网络想做的动作这一帧不可执行”
// （没有威胁却想逃、没有叶绿体却想光合、没有目标却想觅食），由调用方回退规则决策，
// 避免有脑个体因为输出不合法而原地发呆。
function decideByBrain(org, per, visionMul) {
  const input = encodeSenses({
    foodDist: per.food ? per.food.d : Infinity,
    foodDir: per.food ? per.food.dir : null,
    threatDist: per.threat ? per.threat.d : Infinity,
    threatDir: per.threat ? per.threat.dir : null,
    energyFrac: org.maxEnergy > 0 ? org.energy / org.maxEnergy : 0,
    // 视野倍率与光照同源（昼高夜低）：作为“天时”输入，让网络有机会学会夜里少远行
    light: visionMul,
    senseRange: Math.max(1e-3, org.senseRange * visionMul * WORLD.nnSenseRangeMul),
  });
  // stage-14：视野内出现食物/植物时叠加觅食先验，让“有脑”体现为更主动的觅食倾向
  const nearFood = !!(per.food || per.plant);
  const { action } = decideBrain(org.brain, input, {
    seekBias: (WORLD.nnSeekBias || 0) + (nearFood ? WORLD.nnSeekBiasNearFood || 0 : 0),
  });
  const isCarn = (org.clawCount || 0) > 0;
  switch (action) {
    case BEHAVIOR.FLEE:
      if (!per.threat) return null;
      return {
        type: BEHAVIOR.FLEE,
        target: per.threat,
        drainMul: WORLD.orgDrainMulFlee,
        speedMul: WORLD.orgFleeBoost,
        turnMul: 1.3,
        photoMul: 1,
      };
    case BEHAVIOR.CHASE: {
      if (!per.prey) return null;
      const chaseFrac = isCarn ? WORLD.carnivoreChaseEnergyFrac : WORLD.orgChaseEnergyFrac;
      if (org.energy <= org.maxEnergy * chaseFrac) return null; // 力气不够就回退规则分支
      return {
        type: BEHAVIOR.CHASE,
        target: per.prey,
        targetKind: isCarn ? 'prey' : 'drive',
        drainMul: WORLD.orgDrainMulChase,
        speedMul: isCarn ? 1.05 : 1,
        turnMul: 0.95,
        photoMul: 1,
      };
    }
    case BEHAVIOR.PHOTO:
      if ((org.chloroCount || 0) <= 0) return null; // 没有叶绿体，光合动作无法执行
      return {
        type: BEHAVIOR.PHOTO,
        target: null,
        drainMul: WORLD.orgDrainMulPhoto,
        speedMul: 0.08,
        turnMul: 0.3,
        photoMul: WORLD.orgPhotoRestMul,
      };
    case BEHAVIOR.SEEK: {
      if (!per.food && !per.plant) return null;
      // 与规则分支同口径：够得着的植株优先收割，否则去吸悬浮营养团
      const usePlant = !!per.plant && (!per.food || per.plant.d <= per.food.d);
      return {
        type: BEHAVIOR.SEEK,
        target: usePlant ? per.plant : per.food,
        targetKind: usePlant ? 'plant' : 'food',
        drainMul: WORLD.orgDrainMulSeek,
        speedMul: 1,
        turnMul: 1,
        photoMul: 1,
      };
    }
    default:
      return null; // 巡游（或非法输出）：交回规则分支，规则分支同样以巡游收尾
  }
}

// stage-15：群体指令决策——把群体下达的「移动 / 采集」翻译成个体行为。
// 位置约定：order.tx/tz 为指令落点（移动），order.cx/cz 为群体领地中心（采集时无食可采的归队点）。
// 返回 null 表示「本帧指令不产生额外行为」，交回规则/神经网络分支自主决策（例如已抵达落点）。
function decideByOrder(org, per, sense) {
  const ord = org.order;
  if (!ord || !ord.mode || ord.mode === ORDER.ROAM) return null;
  if (ord.mode === ORDER.GATHER) {
    // 采集指令：领地/感知范围内有植株或营养团就先收割（沿用规则分支的取食口径），
    // 都没有则朝群体中心归队——「聚在资源边上干活」而不是四散巡游。
    if (per.plant && per.plant.d < sense) {
      return {
        type: BEHAVIOR.SEEK,
        target: per.plant,
        targetKind: 'plant',
        drainMul: WORLD.orgDrainMulSeek,
        speedMul: 1,
        turnMul: 1,
        photoMul: 1,
      };
    }
    if (per.food && per.food.d < sense) {
      return {
        type: BEHAVIOR.SEEK,
        target: per.food,
        targetKind: 'food',
        drainMul: WORLD.orgDrainMulSeek,
        speedMul: 1,
        turnMul: 1,
        photoMul: 1,
      };
    }
    const back = orderVector(org, ord.cx, ord.cz);
    if (!back || back.target.d <= WORLD.absorbSlowDist) return null;
    return {
      type: BEHAVIOR.MOVE,
      target: back.target,
      targetKind: 'tribe', // 归队（回领地中心），与「移动到落点」同为指令驱动
      drainMul: WORLD.orgDrainMulSeek,
      speedMul: 1,
      turnMul: 1,
      photoMul: 1,
      orderDriven: true,
    };
  }
  if (ord.mode === ORDER.MOVE) {
    const to = orderVector(org, ord.tx, ord.tz);
    // 已抵达落点（进入吸收减速距离以内）就不再硬挤，恢复自主行为，避免在目标点反复抽搐
    if (!to || to.target.d <= WORLD.absorbSlowDist) return null;
    return {
      type: BEHAVIOR.MOVE,
      target: to.target,
      targetKind: 'order',
      drainMul: WORLD.orgDrainMulSeek,
      speedMul: 1,
      turnMul: 1.1,
      photoMul: 1,
      orderDriven: true,
    };
  }
  return null;
}

// 朝世界坐标 (tx,tz) 的单位方向目标（与感知目标同构：带 dir/d，供 advanceOrganism 复用转向逻辑）
function orderVector(org, tx, tz) {
  if (tx == null || tz == null) return null;
  const dx = tx - org.pos[0];
  const dz = tz - zOf(org);
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return null;
  return { target: { o: null, dx, dz, d, dir: [dx / d, dz / d] } };
}

// 决策：模块构成 -> 行为权值；威胁 > 捕猎/压制 > 光合 > 取食（植物/食物）> 巡游
// stage-14：带脑个体先由神经网络出招（decideByBrain），出招不可执行时再走规则分支——
// “有脑”是一条额外的决策通道，而不是取代既有生态规则的并行系统。
// stage-15：群体指令优先于自主觅食/休憩/神经网络，但让位于近距离威胁（保命优先，
// 否则一条命令会把整群赶进天敌的嘴里）；「繁殖禁令」不在这里处理，它在繁殖结算处生效。
export function decideOrganismBehavior(org, others, foods, dt = 0.016, plants = [], visionMul = 1) {
  const per = perceive(org, others, foods, plants, visionMul);
  // stage-12：取食判定半径同样受光照影响（夜里只能吃眼前的东西，白天能锁定远处的食物）
  const sense = org.senseRange * visionMul;
  const isCarn = (org.clawCount || 0) > 0;
  // stage-15：群体指令（无威胁时才服从；有威胁则落到下方规则分支 1 逃跑）
  if (!per.threat) {
    const ordered = decideByOrder(org, per, sense);
    if (ordered) return ordered;
  }
  // stage-14：神经网络优先——有脑个体先问自己的“脑子”，合法决策直接采用
  if (org.brain) {
    const brainBeh = decideByBrain(org, per, visionMul);
    if (brainBeh) return brainBeh;
  }
  // 1) 附近有体型显著更大的个体 -> 逃跑（优先于觅食/光合）
  if (per.threat) {
    return {
      type: BEHAVIOR.FLEE,
      target: per.threat,
      drainMul: WORLD.orgDrainMulFlee,
      speedMul: WORLD.orgFleeBoost,
      turnMul: 1.3,
      photoMul: 1,
    };
  }
  // 2) 体型占优时压制/捕猎附近小个体。
  //    stage-11：肉食者（有爪）捕猎不设能量门槛——饿着也要出击，否则只能等死；
  //    草食者沿用 stage-08 的 45% 能量门槛（吃饱后才有力气驱逐同类）。
  const chaseFrac = isCarn ? WORLD.carnivoreChaseEnergyFrac : WORLD.orgChaseEnergyFrac;
  if (per.prey && org.energy > org.maxEnergy * chaseFrac) {
    return {
      type: BEHAVIOR.CHASE,
      target: per.prey,
      targetKind: isCarn ? 'prey' : 'drive',
      drainMul: WORLD.orgDrainMulChase,
      speedMul: isCarn ? 1.05 : 1,
      turnMul: 0.95,
      photoMul: 1,
    };
  }
  const nearFood = per.food && per.food.d < sense;
  // 3) 叶绿体驱动：有叶绿体且(没有口器 或 能量充裕)时倾向停留光合；
  //    叶绿体>=2 时即使近处有食物也优先“晒”而不是抢
  const wantPhoto =
    org.chloroCount > 0 &&
    (org.mouthCount === 0 || org.energy > org.maxEnergy * WORLD.orgPhotoEnergyFrac);
  if (wantPhoto && (!nearFood || org.chloroCount >= WORLD.orgPhotoChloroPref)) {
    return {
      type: BEHAVIOR.PHOTO,
      target: null,
      drainMul: WORLD.orgDrainMulPhoto,
      speedMul: 0.08,
      turnMul: 0.3,
      photoMul: WORLD.orgPhotoRestMul,
    };
  }
  // 4) stage-11 草食：感知内有草地植物（生产者）优先取食——这是草食者的主粮
  if (per.plant && per.plant.d < sense) {
    return {
      type: BEHAVIOR.SEEK,
      target: per.plant,
      targetKind: 'plant',
      drainMul: WORLD.orgDrainMulSeek,
      speedMul: 1,
      turnMul: 1,
      photoMul: 1,
    };
  }
  // 5) 感知内有食物 -> 觅食
  if (per.food) {
    return {
      type: BEHAVIOR.SEEK,
      target: per.food,
      targetKind: 'food',
      drainMul: WORLD.orgDrainMulSeek,
      speedMul: 1,
      turnMul: 1,
      photoMul: 1,
    };
  }
  // 6) 巡游
  return {
    type: BEHAVIOR.WANDER,
    target: null,
    drainMul: WORLD.orgDrainMulWander,
    speedMul: 1,
    turnMul: 1,
    photoMul: 1,
  };
}

// 按已决策行为推进单个有机体：转向/移动 + 位置积分 + 边界反弹 + 能耗/光合
function advanceOrganism(o, beh, dt, opts = {}) {
  const baseSpeed = o.speed * (beh.speedMul ?? 1);
  const turn = WORLD.turnSeek * (beh.turnMul ?? 1);
  let vel = o.vel;

  if (
    (beh.type === BEHAVIOR.SEEK || beh.type === BEHAVIOR.CHASE || beh.type === BEHAVIOR.MOVE) &&
    beh.target
  ) {
    // 觅食靠近时轻微减速便于吸收；压制保持巡航；stage-15 群体「移动」指令全速行军
    let spd = baseSpeed;
    if (beh.type === BEHAVIOR.SEEK && beh.target.d < WORLD.absorbSlowDist * 1.4) {
      spd = baseSpeed * WORLD.slowFactor;
    }
    vel = steerToward(o.vel, beh.target.dir[0], beh.target.dir[1], turn * dt, spd);
  } else if (beh.type === BEHAVIOR.FLEE && beh.target) {
    // 逃向威胁反方向
    vel = steerToward(
      o.vel,
      -beh.target.dir[0],
      -beh.target.dir[1],
      turn * dt,
      baseSpeed
    );
  } else if (beh.type === BEHAVIOR.PHOTO) {
    // 原地“晒太阳”：极慢漂移，保留当前朝向 + 微弱随机
    const [vx, vz] = normXZ(o.vel[0], o.vel[2]);
    const ang = Math.atan2(vz, vx) + (random() * 2 - 1) * 0.25;
    vel = [Math.cos(ang) * baseSpeed, 0, Math.sin(ang) * baseSpeed];
  } else {
    // WANDER：偶尔随机偏航
    if (random() < WORLD.wanderFreq * dt) {
      const spin = (random() * 2 - 1) * WORLD.turnWander;
      const [vx, vz] = normXZ(o.vel[0], o.vel[2]);
      const ang = Math.atan2(vz, vx) + spin;
      vel = [Math.cos(ang) * o.speed, 0, Math.sin(ang) * o.speed];
    }
  }

  // stage-10：营养带归巢——个体倾向留在出生带（本地适应），让“所在位置”与“所属营养带”
  // 长期一致；否则所有个体都会涌向富营养带觅食，贫瘠带的稀疏供给就筛不出小体型。
  // stage-15：受群体「移动」指令驱动的个体暂停归巢牵引——否则族群的迁移会被出生带拉回，
  // “成员跟随指令移动”就无从成立（指令期间以群体的落点为准）。
  {
    const cx = zoneCenterX(Number.isInteger(o.zone) ? o.zone : zoneIndexAt(o.pos[0]));
    const pull = (cx - o.pos[0]) * (beh.orderDriven ? 0 : WORLD.orgHomePull);
    let nx = vel[0] + pull;
    let nz = vel[2];
    const ns = Math.hypot(nx, nz);
    const cap = Math.max(0.01, o.speed) * (beh.orderDriven ? Math.max(1, WORLD.orgHomeSpeedCap) : WORLD.orgHomeSpeedCap);
    if (ns > cap) {
      nx = (nx / ns) * cap;
      nz = (nz / ns) * cap;
    }
    vel = [nx, vel[1] || 0, nz];
  }

  // 位置积分 + 边界反弹（organism.pos 为 [x, z] 二维；此处容忍三维输入取 z 基准）
  const b = WORLD.bounds - 0.2;
  const oz = o.pos[2] ?? o.pos[1] ?? 0;
  let px = o.pos[0] + vel[0] * dt;
  let pz = oz + vel[2] * dt;
  let vx = vel[0];
  let vz = vel[2];
  if (px > b) { px = b; vx = -Math.abs(vx); }
  if (px < -b) { px = -b; vx = Math.abs(vx); }
  if (pz > b) { pz = b; vz = -Math.abs(vz); }
  if (pz < -b) { pz = -b; vz = Math.abs(vz); }
  if (vx !== vel[0] || vz !== vel[2]) vel = [vx, vel[1], vz];

  // stage-11：水域不可通行（陆地/浅滩生物的地形约束）——若积分后的落点是水域，
  // 本次位移作废并沿法向反弹，个体被留在岸边。仅当「当前已在陆地」时才拦截，
  // 否则出生在水里的个体会被自己的位置判死、永远卡住（出生落位见 map.nearestLandPos）。
  if (opts.isBlocked && !opts.isBlocked(o.pos[0], oz) && opts.isBlocked(px, pz)) {
    px = o.pos[0];
    pz = oz;
    vel = [-vx, vel[1] || 0, -vz];
  }

  // 能量：行动成本 = 行为耗能乘子(drainMul) × 基础维持；光合乘子放大叶绿体产能
  const jitter = 1 + (random() * 2 - 1) * WORLD.drainVar;
  const drain = o.drainPerSec * (beh.drainMul ?? 1) * jitter * dt;
  // stage-10：初级生产力随所在营养带递减（贫瘠带光照/养分稀薄），
  // 大型叶绿体个体无法在低产区“躺着长个”，体型分异由供给驱动而非随机漂移。
  const zoneMul = opts.photoZoneMul ? opts.photoZoneMul(o) : 1;
  // stage-12：叶绿体产能再乘光照倍率——太阳落山后光合作用大幅减产
  const lightMul = opts.lightMul ?? 1;
  const gain = o.photoPerSec * (beh.photoMul ?? 1) * zoneMul * lightMul * dt;
  const energy = Math.min(o.maxEnergy, o.energy - drain + gain);
  // 保持二维 [x, z] 语义，与 createOrganism/感知/吸收/渲染的 pos[0]/pos[2] 用法一致
  // stage-11：把本 tick 的行为目标（含类型）挂到个体上——reducer 据此判定
  // 「草食者是否正够到植株」「肉食者是否追上猎物」，渲染层据此给取食/捕猎个体着色。
  return {
    ...o,
    pos: [px, pz],
    vel,
    energy,
    behavior: beh.type,
    behaviorTargetId: beh.target && beh.target.o ? beh.target.o.id : null,
    behaviorTargetKind: beh.targetKind || null,
  };
}

// 整组推进（stage-08）：基于同一快照对全体决策，保证公平；返回新数组
export function stepOrganisms(organisms, foods, dt, opts = {}) {
  // stage-11：植物（生产者）作为感知输入参与决策；opts.plants 缺省为空数组（向后兼容）
  const plants = opts.plants || [];
  const visionMul = opts.visionMul ?? 1; // stage-12：光照视野倍率（昼远夜近）
  return organisms.map((o) => {
    const beh = decideOrganismBehavior(o, organisms, foods, dt, plants, visionMul);
    return advanceOrganism(o, beh, dt, opts);
  });
}

// 空态辅助：新播入/手动 spawn 的有机体默认巡游
export function initialBehavior() {
  return BEHAVIOR.WANDER;
}
