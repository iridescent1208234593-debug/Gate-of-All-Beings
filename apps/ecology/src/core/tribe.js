// stage-15：群体与领地（tribe）——纯函数模块，单向数据流的一环。
// 设计口径（任务书 Stage 15）：
//   1) 同基因簇个体形成群体：簇键 = 模块布局签名 + 食性角色；簇内再按空间邻近（tribeJoinDist）
//      贪心聚合，得到同时满足「同源」与「同地」的群体，成员清单 / 领地中心 / 领地半径一并产出。
//   2) 显示领地圈与群体标记：本模块只产出数据（center/radius/id），渲染由 renderer.updateTribes 负责。
//   3) 玩家可点击群体下达「移动 / 采集 / 繁殖禁令」：指令写进 state.tribes（Action -> reducer），
//      再由 applyOrders 投射到每个成员个体的 order 字段，供 behaviors.js 在决策阶段读取。
//   4) 群体共享能量：能量富余成员按速率上缴公共池，能量亏缺成员从公共池领取——
//      这是「能量共享可见」的物理实现，池量与累计给/取都会进 HUD 与面板读数。
// 本模块全部函数均为纯函数：不修改传入对象，返回新对象/新数组（不可变更新）。
import { WORLD } from '../config/index.js';
import { DIET_CN, MODULE_CN, roleOf } from './organism.js';

// 群体指令：移动（去目标点）/ 采集（在领地内优先收割植物）/ 自由（清除指令，恢复自主行为）
export const ORDER = {
  ROAM: 'roam',
  MOVE: 'move',
  GATHER: 'gather',
};

export const ORDER_CN = {
  roam: '自由',
  move: '移动',
  gather: '采集',
};

// 个体所属基因簇键：食性角色 + 优势模块（body 之外出现次数最多的模块类型）。
// 用「优势模块」而非精确布局签名做同源判定：精确签名每次繁殖变异都可能被改写（增/删/换模块），
// 那样几乎永不满足「同簇」条件、群体无法稳定成立；优势模块是表型层面稳定可辨的谱系特征，
// 既守住「同源近似」的语义，又让领地圈/群体指令在整局里持续可用。
export function dominantModuleOf(org) {
  const counts = new Map();
  for (const m of org.layout || []) {
    if (!m || m.type === 'body') continue;
    counts.set(m.type, (counts.get(m.type) || 0) + 1);
  }
  let best = 'naked';
  let bestN = 0;
  for (const [type, n] of [...counts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (n > bestN) {
      best = type;
      bestN = n;
    }
  }
  return best;
}

export function tribeKeyOf(org) {
  return `${roleOf(org)}|${dominantModuleOf(org)}`;
}

// 群体显示名：食性 + 优势模块（如「草食 鞭毛」，一眼看出源流）
export function tribeNameOf(t) {
  const mod = MODULE_CN[t.signature] || (t.signature === 'naked' ? '无模块' : t.signature);
  return `${DIET_CN[t.diet] || '未定'} ${mod}`;
}

function zOf(o) {
  return o.pos[2] ?? o.pos[1];
}

function centerOf(members) {
  let sx = 0;
  let sz = 0;
  for (const o of members) {
    sx += o.pos[0];
    sz += zOf(o);
  }
  const n = members.length || 1;
  return [sx / n, sz / n];
}

// 领地半径 = 成员到中心的最大距离 × 系数，并收敛到 [tribeRadiusMin, tribeRadiusMax]
function radiusOf(members, center) {
  let maxD = 0;
  for (const o of members) {
    const d = Math.hypot(o.pos[0] - center[0], zOf(o) - center[1]);
    if (d > maxD) maxD = d;
  }
  return Math.min(
    WORLD.tribeRadiusMax,
    Math.max(WORLD.tribeRadiusMin, maxD * WORLD.tribeRadiusMul)
  );
}

// 群体聚合：同基因簇 + 空间邻近 -> 群体列表。
// 传入上一 tick 的 tribes 以复用 id / 能量池 / 指令 / 累计读数（保证「指令不是一次性的」）。
// 返回 { tribes, seq }：seq 为群体 id 自增游标，由调用方（reducer）随 state 保存。
export function buildTribes(organisms, prevTribes = [], opts = {}) {
  const joinDist = opts.joinDist ?? WORLD.tribeJoinDist;
  const minMembers = opts.minMembers ?? WORLD.tribeMinMembers;
  let seq = opts.seq || 1;
  const prev = Array.isArray(prevTribes) ? prevTribes : [];
  const usedPrev = new Set();
  // 成员 -> 上一 tick 所属群体 id：用于「成员延续性」匹配（见步骤 4）
  const prevOfMember = new Map();
  for (const t of prev) {
    for (const mid of t.members || []) if (!prevOfMember.has(mid)) prevOfMember.set(mid, t.id);
  }
  const prevById = new Map(prev.map((t) => [t.id, t]));

  // 1) 先按基因簇键分桶（键排序保证遍历顺序确定，输出可复现）
  const buckets = new Map();
  for (const o of organisms) {
    const key = tribeKeyOf(o);
    let b = buckets.get(key);
    if (!b) {
      b = [];
      buckets.set(key, b);
    }
    b.push(o);
  }

  const tribes = [];
  for (const key of [...buckets.keys()].sort()) {
    const bucket = buckets.get(key).slice().sort((a, b) => a.id - b.id);
    const [diet, signature] = key.split('|');
    // 2) 簇内贪心聚合：逐个个体并入最近且不超 joinDist 的簇，否则另起一簇
    const clusters = [];
    for (const o of bucket) {
      let best = null;
      let bestD = Infinity;
      for (const c of clusters) {
        const d = Math.hypot(c.center[0] - o.pos[0], c.center[1] - zOf(o));
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (best && bestD <= joinDist) {
        best.members.push(o);
        best.center = centerOf(best.members);
      } else {
        clusters.push({ members: [o], center: [o.pos[0], zOf(o)] });
      }
    }
    // 3) 只有达到最少成员数的簇才成为「群体」；落单个体不显示领地（也不接受指令）
    for (const c of clusters) {
      if (c.members.length < minMembers) continue;
      const center = centerOf(c.members);
      // 4) 复用上一 tick 的群体，让能量池 / 玩家指令 / 累计读数跨 tick 存续。
      //    4a) 优先「成员延续性」：新簇过半成员来自同一个旧群体即视为同一群体。
      //        簇键 = 食性 + 优势模块，会随演化（增/删/换模块）漂移；只按键匹配的话，
      //        谱系一演化群体 id 就翻新，玩家的移动/采集/禁繁指令与能量池会被静默清空。
      //    4b) 退化路径：键相同且中心最近（距离 <= joinDist × tribeMatchMul），用于新簇。
      //    两条路径都匹配不到才分配新 id。
      let match = null;
      const need = Math.max(minMembers, Math.ceil(c.members.length * 0.5));
      const overlap = new Map();
      for (const o of c.members) {
        const pid = prevOfMember.get(o.id);
        if (pid) overlap.set(pid, (overlap.get(pid) || 0) + 1);
      }
      let bestOverlap = 0;
      for (const [pid, n] of [...overlap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        if (usedPrev.has(pid)) continue;
        if (n > bestOverlap) {
          bestOverlap = n;
          match = prevById.get(pid) || null;
        }
      }
      if (match && bestOverlap < need) match = null;
      if (!match) {
        let matchD = Infinity;
        for (const t of prev) {
          if (t.key !== key || usedPrev.has(t.id)) continue;
          const d = Math.hypot(t.center[0] - center[0], t.center[1] - center[1]);
          if (d < matchD) {
            matchD = d;
            match = t;
          }
        }
        if (!(match && matchD <= joinDist * WORLD.tribeMatchMul)) match = null;
      }
      if (match) usedPrev.add(match.id);
      const id = match ? match.id : `tribe-${seq++}`;
      const order = match && match.order ? match.order : { mode: ORDER.ROAM, tx: null, tz: null };
      tribes.push({
        id,
        key,
        signature,
        diet,
        name: tribeNameOf({ signature, diet }),
        members: c.members.map((o) => o.id),
        count: c.members.length,
        center,
        radius: radiusOf(c.members, center),
        pool: match ? match.pool : 0,
        order,
        // stage-16：文明层自动派遣状态随群体跨 tick 存续（work = 正在作业的资源点，auto = 指令由文明层下达，
        //          manual = 玩家已亲自下过指令，自动派遣此后不再干预该群体）
        auto: !!(match && match.auto),
        work: match && match.work ? match.work : null,
        manual: !!(match && match.manual),
        noBreed: !!(match && match.noBreed),
        age: match ? (match.age || 0) + 1 : 1,
        // 累计读数：给 / 取（供面板与 HUD 展示「能量共享可见」）
        given: match ? match.given || 0 : 0,
        taken: match ? match.taken || 0 : 0,
      });
    }
  }
  // 成员数降序（并列按 id 稳定排序），渲染与面板直接取前 N
  tribes.sort((a, b) => b.count - a.count || (a.id < b.id ? -1 : 1));
  return { tribes, seq };
}

// 指令投射：把群体指令写到每个成员个体的 order 字段上（behaviors.js 决策时读取）。
// order 字段口径：{ tribeId, mode, tx/tz（移动落点）, cx/cz（领地中心，采集时归队用）, noBreed }
// 只对 order 发生变化的个体做浅拷贝，其余原对象复用——保持单向数据流且避免无谓分配。
export function applyOrders(organisms, tribes) {
  const byId = new Map();
  for (const t of tribes) {
    for (const mid of t.members) byId.set(mid, t);
  }
  return organisms.map((o) => {
    const t = byId.get(o.id);
    const mode = t ? t.order.mode : ORDER.ROAM;
    const tx = t && t.order.tx != null ? t.order.tx : null;
    const tz = t && t.order.tz != null ? t.order.tz : null;
    // 领地中心只在「采集」指令下参与决策（无食可采时归队），其余模式置空——
    // 避免每 tick 因中心微动而重建全体成员的 order（无谓分配）。
    const cx = t && mode === ORDER.GATHER ? t.center[0] : null;
    const cz = t && mode === ORDER.GATHER ? t.center[1] : null;
    const noBreed = t ? t.noBreed : false;
    // 非成员一律置空 tribeId（不沿用旧值）——离群个体若残留群体标识，会被渲染当作成员偏色，
    // 也会让「点中成员即选中其群体」的逻辑选错群，因此这里必须显式清除。
    const tribeId = t ? t.id : null;
    const cur = o.order;
    // 从未入群、也无历史指令的个体：无可投射内容，直接复用原对象（每 tick 零无谓分配）
    if (!t && !cur && !o.tribeId) return o;
    if (
      cur &&
      cur.mode === mode &&
      cur.tx === tx &&
      cur.tz === tz &&
      cur.cx === cx &&
      cur.cz === cz &&
      cur.noBreed === noBreed &&
      cur.tribeId === tribeId
    ) {
      return o;
    }
    return { ...o, tribeId, order: { tribeId, mode, tx, tz, cx, cz, noBreed } };
  });
}

// 群体共享能量池结算（每 tick 一次）：
//   上缴：成员能量高于 maxEnergy × tribeEmitFrac 的「超额部分」按 tribeEmitPerSec 比例注入公共池；
//   领取：成员能量低于 maxEnergy × tribeDrawFrac 的「缺口」按 tribeDrawPerSec 比例从池中补足。
//   两个方向都受池容量（按成员数伸缩，封顶 tribePoolMax）与成员能量上限约束。
// 返回 { organisms, tribes, given, taken }（given/taken 为本 tick 实际转移量，累计在 tribes[i] 上）。
export function shareEnergy(organisms, tribes, dt, opts = {}) {
  const poolPerMember = opts.poolPerMember ?? WORLD.tribePoolPerMember;
  const poolMaxCap = opts.poolMax ?? WORLD.tribePoolMax;
  if (!tribes.length) {
    return { organisms, tribes, given: 0, taken: 0 };
  }
  const tribeById = new Map(tribes.map((t) => [t.id, t]));
  const pools = new Map(tribes.map((t) => [t.id, t.pool || 0]));
  const givenById = new Map();
  const takenById = new Map();
  const emitStep = Math.min(1, WORLD.tribeEmitPerSec * dt);
  const drawStep = Math.min(1, WORLD.tribeDrawPerSec * dt);

  // 先算每个成员所属群体（成员清单来自 buildTribes，可能已含本 tick 新生儿）
  const membersByTribe = new Map();
  for (const o of organisms) {
    const t = o.tribeId ? tribeById.get(o.tribeId) : null;
    if (!t) continue;
    let arr = membersByTribe.get(t.id);
    if (!arr) {
      arr = [];
      membersByTribe.set(t.id, arr);
    }
    arr.push(o);
  }

  const nextOrgs = organisms.map((o) => {
    const t = o.tribeId ? tribeById.get(o.tribeId) : null;
    if (!t) return o;
    const members = membersByTribe.get(t.id) || [];
    const cap = Math.min(poolMaxCap, poolPerMember * members.length);
    const high = o.maxEnergy * WORLD.tribeEmitFrac;
    const low = o.maxEnergy * WORLD.tribeDrawFrac;
    let energy = o.energy;
    let pool = pools.get(t.id) || 0;
    let changed = false;
    if (energy > high && pool < cap) {
      const give = Math.min((energy - high) * emitStep, cap - pool);
      if (give > 1e-6) {
        energy -= give;
        pool += give;
        givenById.set(t.id, (givenById.get(t.id) || 0) + give);
        changed = true;
      }
    }
    if (energy < low) {
      const take = Math.min((low - energy) * drawStep, pool, o.maxEnergy - energy);
      if (take > 1e-6) {
        energy += take;
        pool -= take;
        takenById.set(t.id, (takenById.get(t.id) || 0) + take);
        changed = true;
      }
    }
    if (!changed) return o;
    pools.set(t.id, pool);
    return { ...o, energy };
  });

  let given = 0;
  let taken = 0;
  const nextTribes = tribes.map((t) => {
    const g = givenById.get(t.id) || 0;
    const k = takenById.get(t.id) || 0;
    given += g;
    taken += k;
    const pool = Math.max(0, pools.get(t.id) || 0);
    if (g === 0 && k === 0 && pool === (t.pool || 0)) return t;
    return { ...t, pool, given: (t.given || 0) + g, taken: (t.taken || 0) + k };
  });

  return { organisms: nextOrgs, tribes: nextTribes, given, taken };
}

// 群体只读汇总（HUD / 面板读数用；不修改任何状态）
export function tribeSummary(tribes = []) {
  const sum = {
    count: tribes.length,
    members: 0,
    pooled: 0,
    moving: 0,
    gathering: 0,
    banned: 0,
    given: 0,
    taken: 0,
    largest: 0,
  };
  for (const t of tribes) {
    sum.members += t.count;
    sum.pooled += t.pool || 0;
    sum.given += t.given || 0;
    sum.taken += t.taken || 0;
    if (t.order && t.order.mode === ORDER.MOVE) sum.moving += 1;
    else if (t.order && t.order.mode === ORDER.GATHER) sum.gathering += 1;
    if (t.noBreed) sum.banned += 1;
    if (t.count > sum.largest) sum.largest = t.count;
  }
  return sum;
}
