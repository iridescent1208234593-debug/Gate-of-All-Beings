/**
 * 众生之门 · 聚灵 —— 规则引擎（世界观优化版）
 * ------------------------------------------------------------------
 * 灵分两种：物质灵（分五行：金木水火土）+ 生灵（生命象征）。
 * 灵质空间 = 储存灵的容器，大小随修为（阶段）增长 —— 变强的证明。
 * 聚灵填充灵质空间；满了则化形（精灵→妖精），空间扩大。
 * 天时（五行相位）决定聚灵时积累哪一行的物质灵。
 * 成仙后内视灵质空间（五行物质灵 + 生灵 + 六大系）。
 */

const ELEMENTS = ['木', '火', '土', '金', '水'];
const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };

const ELEMENT_ROLE = {
  金: '攻击·锋锐克木', 木: '生长·生机克土', 水: '控制·柔韧克火',
  火: '爆发·炽烈克金', 土: '防御·厚重克水',
};

// 御灵系五行能力（化形后生效的被动差异）
const ELEMENT_ABILITY = {
  金: { desc: '锋锐克木：克伐伤害+8，但生灵散逸+1', strikeBonus: 8, decayExtra: 1 },
  木: { desc: '生机克土：聚灵生灵+2，散逸-1', gatherS: 2, decayReduce: 1 },
  水: { desc: '柔韧克火：受击减免2', defend: 2 },
  火: { desc: '炽烈克金：克伐伤害+12，克伐后生灵-3', strikeBonus: 12, strikeCost: 3 },
  土: { desc: '厚重克水：受击减免3，聚灵物质灵+1', defend: 3, gatherW: 1 },
};

// 辅助系（化形时随机觉醒一个，提供额外被动；空间系稀有）
const SECONDARY_SYSTEMS = [
  { name: '生灵系', desc: '生灵散逸-1', decayReduce: 1, weight: 3 },
  { name: '造物系', desc: '聚灵物质灵+2', gatherW: 2, weight: 3 },
  { name: '心灵系', desc: '豪夺成功率+10%', seizeRate: 0.1, weight: 2 },
  { name: '锁御系', desc: '受击减免+2', defend: 2, weight: 2 },
  { name: '空间系', desc: '灵质空间容量+50（稀有）', capacityBonus: 50, weight: 1 },
];

// 天时相位：生灵积累 + 对应五行物质灵积累 + 生灵散逸
const PHASE_LING = {
  木: { flavor: '万物生发，生灵活跃', shengling: 5, wuzhi: '木', wuzhiGain: 5, decay: 1 },
  火: { flavor: '能量鼎盛，灵潮澎湃', shengling: 4, wuzhi: '火', wuzhiGain: 4, decay: 2 },
  土: { flavor: '中和稳定，大地厚载', shengling: 3, wuzhi: '土', wuzhiGain: 5, decay: 1 },
  金: { flavor: '肃杀收敛，物质凝练', shengling: 1, wuzhi: '金', wuzhiGain: 6, decay: 4 },
  水: { flavor: '收藏归藏，生灵潜息', shengling: 4, wuzhi: '水', wuzhiGain: 3, decay: 3 },
};

const DIFFICULTIES = {
  1: { label: '简单', decayMul: 0.5, gainMul: 1.2 },
  2: { label: '较易', decayMul: 0.75, gainMul: 1.1 },
  3: { label: '普通', decayMul: 1.0, gainMul: 1.0 },
  4: { label: '较难', decayMul: 1.25, gainMul: 0.9 },
  5: { label: '困难', decayMul: 1.5, gainMul: 0.8 },
};

const REALMS = [
  { name: '精灵', soul: 0, desc: '生灵初聚，尚无实体' },
  { name: '妖精', soul: 100, desc: '生灵与物质灵交织，化形为实体' },
  { name: '得道', soul: 500, desc: '灵质空间渐成，道行渐深' },
  { name: '仙人', soul: 1000, desc: '成仙！灵质空间自成一界' },
  { name: '神', soul: 3000, desc: '封神！凌驾天地，超脱轮回' },
];

const SIX_SYSTEMS = {
  御灵系: { desc: '最基本的能力，分支金木水火土', abilities: ['金·攻击', '木·生长', '水·控制', '火·爆发', '土·防御'] },
  生灵系: { desc: '与生命相关', abilities: ['洞察', '观灵', '豪夺', '隐匿', '治愈', '追毫'] },
  造物系: { desc: '重构物体，无中生有', abilities: ['重构', '画灵', '仿生'] },
  空间系: { desc: '空间不连续变化，无法后天习得', abilities: ['吞噬', '传送', '转移', '蕴藏', '领域'] },
  心灵系: { desc: '与精神力相关', abilities: ['读心', '傀儡', '摄心', '戏梦', '传音'] },
  锁御系: { desc: '与法宝法器相关', abilities: ['灵御', '制灵', '阵法'] },
};

const CFG = {
  PHASE_LENGTH: 6,
  INIT_SHENGLING: 20,
  BASE_GATHER_S: 4, BASE_GATHER_W: 3,
  BASE_DECAY: 2,
  CAPACITY_SPIRIT: 80,        // 精灵阶段灵质空间容量
  CAPACITY_FAIRY: 400,        // 妖精阶段灵质空间容量
  TRANSFORM_S: 40,            // 化形所需生灵
  TRANSFORM_W_TOTAL: 40,      // 化形所需物质灵总量
  ASCEND_TOTAL: 300,          // 成仙所需（生灵+物质灵总量）
  NPC_SPAWN_RATE: 0.3,
  NPC_SPIRIT: [30, 50],
  NPC_HIT: 8,
  STRIKE_DMG: 25, STRIKE_GAIN: 15,
  BOND_GAIN: 12,
  SEIZE_DMG: 30, SEIZE_GAIN: 20, SEIZE_RATE: 0.6, SEIZE_FAIL_COST: 12,
  RELIC_DROP_RATE: 0.3,
  SOUL_PER_REALM: 15,
};

const RELICS = {
  天明珠: { desc: '生灵 +10', onEquip: (p) => { p.shengling += 10; } },
  定心镜: { desc: '生灵散逸 -1', decayReduce: 1 },
  唤灵石: { desc: '聚灵物质灵 +2', gatherW: 2 },
  木系灵核: { desc: '木相生灵 +4', gatherS: 4 },
  青灵果: { desc: '生灵 +20', instant: 20 },
  琼圆盾: { desc: '受击生灵损失 -3', defend: 3 },
  斥冰焰: { desc: '克伐水系 +10', strikeIf: { 水: 10 } },
  蓝玉盘: { desc: '豪夺成功率 +15%', seizeRate: 0.15 },
};
const RELIC_NAMES = Object.keys(RELICS);

const EVENTS = [
  { w: 4, name: '灵潮涌动', desc: '天地生灵如溪水缓流，向你汇聚', run: (r) => addS(r, 8, '生灵如溪流汇入，+8') },
  { w: 3, name: '大地回春', desc: '大地深处的物质灵螺旋上升', run: (r) => addW(r, ELEMENTS[r.phaseIndex], 8, `物质灵自大地上升，${ELEMENTS[r.phaseIndex]}物质灵 +8`) },
  { w: 2, name: '相生之灵', desc: '一只友善的精灵与你亲近，分享生灵', run: (r) => addS(r, 10, '相生之灵分享生灵，+10') },
  { w: 2, name: '灵被争夺', desc: '有生命争夺你周围的灵气', run: (r) => { const d = 6 + (r.player.relics.some(n => RELICS[n].defend) ? -3 : 0); addS(r, -Math.max(1, d), `灵气被争夺，生灵 -${Math.max(1, d)}`); } },
  { w: 2, name: '风息化树', desc: '远处一片灵木静立，是强者散灵所化', run: (r) => { r.soulSeed = (r.soulSeed || 0) + 5; r.log.unshift('🌲 你感悟散灵归自然之理，魂灵种子 +5'); } },
  { w: 2, name: '人迹所扰', desc: '远处有人的气息，干扰了灵的流动', run: (r) => { r.log.unshift('🏙️ 人迹所扰，灵气流动受阻'); } },
];

const NPC_NAMES = ['清凝', '风息', '虚淮', '小黑', '鹿野', '鸠老', '玄离', '谛听', '老君', '阎明', '若水', '翠竹', '府先生'];

function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function rand(min, max) { return Math.floor(min + Math.random() * (max - min + 1)); }
function clamp(v) { return Math.max(0, v); }

function createRun(soul = 0, difficulty = 3) {
  const soulBonus = Math.min(20, Math.floor(soul / 100) * 5);   // 每100魂灵，转世初始生灵+5（封顶20）
  const p = {
    shengling: CFG.INIT_SHENGLING + soulBonus,
    wuzhi: { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 },
    stage: '精灵', element: null, secondary: null, relics: [],
  };
  const run = {
    run: 1, phaseIndex: 0, phaseProgress: 0, phaseLength: CFG.PHASE_LENGTH, tick: 0,
    soul, soulSeed: 0, difficulty, player: p, npc: null, status: 'running', summary: null, log: [],
  };
  if (soulBonus > 0) run.log.unshift(`🌌 魂灵转世：前世修为凝而不散，初始生灵 +${soulBonus}`);
  if (soul >= 500) {
    const el = pick(ELEMENTS);
    p.wuzhi[el] += 10;
    run.log.unshift(`✨ 得道转世：前世${el}物质灵随之苏醒，+10`);
  }
  return run;
}

function diffCfg(r) { return DIFFICULTIES[r.difficulty] || DIFFICULTIES[3]; }
function getRealmStage(soul) { let cur = REALMS[0]; for (const r of REALMS) { if (soul >= r.soul) cur = r; } return cur; }
function phaseInfo(r) { return PHASE_LING[ELEMENTS[r.phaseIndex]]; }

function addS(r, v, msg) { const p = r.player; p.shengling = clamp(p.shengling + v); if (msg) r.log.unshift(msg); }
function addW(r, el, v, msg) { const p = r.player; p.wuzhi[el] = clamp(p.wuzhi[el] + v); if (msg) r.log.unshift(msg); }

function wuzhiTotal(p) { return Object.values(p.wuzhi).reduce((a, b) => a + b, 0); }
function totalLing(p) { return p.shengling + wuzhiTotal(p); }
function capacity(r) {
  let cap = r.player.stage === '精灵' ? CFG.CAPACITY_SPIRIT : CFG.CAPACITY_FAIRY;
  if (r.player.secondary && r.player.secondary.capacityBonus) cap += r.player.secondary.capacityBonus;
  return cap;
}

// 聚灵：汇聚生灵 + 天时对应五行物质灵
function doGather(r) {
  const ph = phaseInfo(r), diff = diffCfg(r), p = r.player;
  let gs = Math.round((CFG.BASE_GATHER_S + ph.shengling) * diff.gainMul);
  let gw = Math.round((CFG.BASE_GATHER_W + ph.wuzhiGain) * diff.gainMul);
  for (const n of p.relics) { const rl = RELICS[n]; if (rl.gatherS) gs += rl.gatherS; if (rl.gatherW) gw += rl.gatherW; }
  if (p.element) { const ab = ELEMENT_ABILITY[p.element]; if (ab.gatherS) gs += ab.gatherS; if (ab.gatherW) gw += ab.gatherW; }
  if (p.secondary && p.secondary.gatherW) gw += p.secondary.gatherW;
  addS(r, gs);
  addW(r, ph.wuzhi, gw);
  r.log.unshift(`🌿 聚灵：生灵 +${gs}，${ph.wuzhi}物质灵 +${gw}（生灵${p.shengling} · 物质灵${wuzhiTotal(p)}）`);
}

function spawnNpc(r) {
  return { name: pick(NPC_NAMES), element: pick(ELEMENTS), spirit: rand(CFG.NPC_SPIRIT[0], CFG.NPC_SPIRIT[1]), hostile: Math.random() < 0.6 };
}

// 按权重随机觉醒一个辅助系
function pickSecondary() {
  const total = SECONDARY_SYSTEMS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const x of SECONDARY_SYSTEMS) { r -= x.weight; if (r <= 0) return x; }
  return SECONDARY_SYSTEMS[0];
}

function grantRelic(r, prefix) {
  const name = pick(RELIC_NAMES), relic = RELICS[name];
  r.player.relics.push(name);
  if (relic.onEquip) relic.onEquip(r.player);
  if (relic.instant) addS(r, relic.instant);
  r.log.unshift(`✨ ${prefix}【${name}】${relic.desc}`);
}

function applyAction(r, action, element) {
  const p = r.player;
  switch (action) {
    case 'gather': doGather(r); break;
    case 'transform': {
      if (p.stage !== '精灵') { r.log.unshift('你已化形'); break; }
      if (p.shengling < CFG.TRANSFORM_S || wuzhiTotal(p) < CFG.TRANSFORM_W_TOTAL) {
        r.log.unshift(`化形尚缺：生灵还需 ${Math.max(0, CFG.TRANSFORM_S - p.shengling)}，物质灵还需 ${Math.max(0, CFG.TRANSFORM_W_TOTAL - wuzhiTotal(p))}`);
        break;
      }
      p.stage = '妖精';
      p.element = element || '木';
      p.secondary = pickSecondary();
      const ab = ELEMENT_ABILITY[p.element];
      r.log.unshift(`✨ 生灵与物质灵交织，你【化形】为${p.element}系妖精！灵质空间扩大至 ${CFG.CAPACITY_FAIRY}（${ab.desc}）`);
      r.log.unshift(`🌟 你觉醒辅助系【${p.secondary.name}】：${p.secondary.desc}`);
      grantRelic(r, '化形时天地馈赠法器：');
      break;
    }
    case 'strike': {
      if (p.stage !== '妖精') { r.log.unshift('化形之后才能克伐'); break; }
      const npc = r.npc;
      if (!npc) { r.log.unshift('没有可克伐的对象'); break; }
      if (KE[p.element] !== npc.element) { r.log.unshift(`克伐失败：${p.element}不克${npc.element}`); break; }
      let dmg = CFG.STRIKE_DMG;
      const ab = ELEMENT_ABILITY[p.element];
      if (ab.strikeBonus) dmg += ab.strikeBonus;
      for (const n of p.relics) { const rl = RELICS[n]; if (rl.strikeIf && rl.strikeIf[npc.element]) dmg += rl.strikeIf[npc.element]; }
      npc.spirit -= dmg;
      r.log.unshift(`⚔️ 你克伐${npc.name}(${npc.element})，-${dmg}`);
      if (ab.strikeCost) addS(r, -ab.strikeCost, `🔥 爆发反噬，生灵 -${ab.strikeCost}`);
      if (npc.spirit <= 0) { r.log.unshift(`💫 你击败了${npc.name}！`); addW(r, npc.element, CFG.STRIKE_GAIN, `  掠夺其${npc.element}物质灵 +${CFG.STRIKE_GAIN}`); if (Math.random() < CFG.RELIC_DROP_RATE) grantRelic(r, `${npc.name}掉落法器：`); r.npc = null; }
      break;
    }
    case 'bond': {
      if (p.stage !== '妖精') { r.log.unshift('化形之后才能相生'); break; }
      const npc = r.npc;
      if (!npc) { r.log.unshift('没有可相生的对象'); break; }
      if (!(SHENG[p.element] === npc.element || SHENG[npc.element] === p.element)) { r.log.unshift(`相生失败：${p.element}与${npc.element}非相生`); break; }
      addS(r, CFG.BOND_GAIN, `🤝 你与${npc.name}相生，生灵 +${CFG.BOND_GAIN}`);
      if (!npc.hostile) { r.log.unshift(`${npc.name}回赠灵光，+5`); addS(r, 5); }
      break;
    }
    case 'seize': {
      if (p.stage !== '妖精') { r.log.unshift('化形之后才能豪夺'); break; }
      const npc = r.npc;
      if (!npc) { r.log.unshift('没有可豪夺的对象'); break; }
      let rate = CFG.SEIZE_RATE;
      for (const n of p.relics) { const rl = RELICS[n]; if (rl.seizeRate) rate += rl.seizeRate; }
      if (p.secondary && p.secondary.seizeRate) rate += p.secondary.seizeRate;
      if (Math.random() < rate) {
        const taken = Math.min(npc.spirit, CFG.SEIZE_DMG);
        npc.spirit -= taken;
        addW(r, npc.element, CFG.SEIZE_GAIN, `🔥 你豪夺${npc.name}成功！${npc.element}物质灵 +${CFG.SEIZE_GAIN}`);
        if (npc.spirit <= 0) { r.log.unshift(`💫 你击败了${npc.name}！`); if (Math.random() < CFG.RELIC_DROP_RATE) grantRelic(r, `${npc.name}掉落法器：`); r.npc = null; }
      } else {
        addS(r, -CFG.SEIZE_FAIL_COST, `💥 豪夺失败，被反噬，生灵 -${CFG.SEIZE_FAIL_COST}`);
      }
      break;
    }
  }
}

function checkDeath(r) {
  if (r.status === 'running' && r.player.shengling <= 0) {
    r.player.shengling = 0;
    r.status = 'dead';
    endRun(r);
  }
}

function tick(r, action, element) {
  if (r.status !== 'running') return;

  // 1. 天时推进
  r.phaseProgress++;
  while (r.phaseProgress >= r.phaseLength) {
    r.phaseProgress -= r.phaseLength;
    r.phaseIndex++;
    if (r.phaseIndex >= ELEMENTS.length) r.phaseIndex = 0;
  }

  // 2. 玩家动作
  if (action) applyAction(r, action, element);
  if (r.status !== 'running') return;

  // 3. 生灵自然散逸
  const ph = phaseInfo(r), diff = diffCfg(r);
  let decay = Math.round((CFG.BASE_DECAY + ph.decay) * diff.decayMul);
  for (const n of r.player.relics) { const rl = RELICS[n]; if (rl.decayReduce) decay -= rl.decayReduce; }
  if (r.player.element) { const ab = ELEMENT_ABILITY[r.player.element]; if (ab.decayReduce) decay -= ab.decayReduce; if (ab.decayExtra) decay += ab.decayExtra; }
  if (r.player.secondary && r.player.secondary.decayReduce) decay -= r.player.secondary.decayReduce;
  decay = Math.max(0, decay);
  if (decay > 0) addS(r, -decay, `🌫️ 生灵散逸 -${decay}`);
  checkDeath(r);
  if (r.status !== 'running') return;

  // 4. 妖精阶段：NPC 遭遇 + 反击
  if (r.player.stage === '妖精') {
    if (!r.npc && Math.random() < CFG.NPC_SPAWN_RATE) {
      r.npc = spawnNpc(r);
      r.log.unshift(`${r.npc.hostile ? '⚠️' : '🕊️'} 一只${r.npc.element}系妖精「${r.npc.name}」出现，带着${r.npc.hostile ? '敌意' : '友善'}`);
    }
    if (r.npc && r.npc.hostile) {
      let hit = CFG.NPC_HIT;
      for (const n of r.player.relics) { const rl = RELICS[n]; if (rl.defend) hit -= rl.defend; }
      if (r.player.element) { const ab = ELEMENT_ABILITY[r.player.element]; if (ab.defend) hit -= ab.defend; }
      if (r.player.secondary && r.player.secondary.defend) hit -= r.player.secondary.defend;
      hit = Math.max(1, hit);
      addS(r, -hit, `🗡️ ${r.npc.name}反击，你生灵 -${hit}`);
      checkDeath(r);
      if (r.status !== 'running') return;
    }
  }

  // 5. 生态事件（低频）
  if (Math.random() < 0.35) {
    const ev = weightedEvent();
    r.log.unshift(`📜【${ev.name}】${ev.desc}`);
    ev.run(r);
    checkDeath(r);
    if (r.status !== 'running') return;
  }

  // 6. 成仙判定
  if (r.player.stage === '妖精' && totalLing(r.player) >= CFG.ASCEND_TOTAL) {
    r.player.stage = '仙';
    r.status = 'won';
    endRun(r);
    return;
  }

  r.tick++;
  r.npc = null;
}

function weightedEvent() {
  const total = EVENTS.reduce((s, e) => s + e.w, 0);
  let x = Math.random() * total;
  for (const e of EVENTS) { x -= e.w; if (x <= 0) return e; }
  return EVENTS[0];
}

function endRun(r) {
  if (r.summary) return;
  const p = r.player;
  const gainedSoul = Math.floor(totalLing(p) / 20) + (p.stage === '妖精' ? 20 : 0) + (p.stage === '仙' ? 100 : 0) + (r.soulSeed || 0);
  r.soul += gainedSoul;
  r.summary = {
    status: r.status, stage: p.stage, turns: r.tick,
    shengling: p.shengling, wuzhi: wuzhiTotal(p),
    soulGained: gainedSoul, totalSoul: r.soul,
    cause: r.status === 'won' ? '生灵与物质灵圆满交织，你修炼成仙' : '生灵散尽，回归自然',
  };
  r.log.unshift(`🏁 ${r.status === 'won' ? '🎉 成仙' : '🕯️ 散灵'}！生灵${p.shengling} · 物质灵${wuzhiTotal(p)} · 魂灵 +${gainedSoul}（累计 ${r.soul}）`);
}

function getState(r) {
  const p = r.player;
  const stage = getRealmStage(r.soul);
  const phase = ELEMENTS[r.phaseIndex];
  const cap = capacity(r);
  const available = ['gather'];
  if (p.stage === '精灵' && p.shengling >= CFG.TRANSFORM_S && wuzhiTotal(p) >= CFG.TRANSFORM_W_TOTAL) available.push('transform');
  if (p.stage === '妖精' && r.npc) {
    if (KE[p.element] === r.npc.element) available.push('strike');
    if (SHENG[p.element] === r.npc.element || SHENG[r.npc.element] === p.element) available.push('bond');
    available.push('seize');
  }
  return {
    run: r.run, tick: r.tick,
    phase, phaseIndex: r.phaseIndex, phaseProgress: r.phaseProgress, phaseLength: r.phaseLength,
    phaseFlavor: PHASE_LING[phase].flavor, phaseWuzhi: PHASE_LING[phase].wuzhi,
    status: r.status, difficulty: r.difficulty,
    realmStage: stage,
    canInnerView: stage.name === '仙人' || stage.name === '神',
    player: {
      shengling: p.shengling, wuzhi: p.wuzhi, wuzhiTotal: wuzhiTotal(p), total: totalLing(p),
      capacity: cap, stage: p.stage, element: p.element,
      role: p.element ? ELEMENT_ROLE[p.element] : '未化形，无御灵能力',
      ability: p.element ? ELEMENT_ABILITY[p.element].desc : null,
      secondary: p.secondary ? { name: p.secondary.name, desc: p.secondary.desc } : null,
      relics: p.relics.map((n) => ({ name: n, desc: RELICS[n].desc })),
      transformNeed: { s: CFG.TRANSFORM_S, w: CFG.TRANSFORM_W_TOTAL },
      ascendNeed: { total: CFG.ASCEND_TOTAL },
    },
    npc: r.npc,
    soul: r.soul, summary: r.summary,
    available, log: r.log.slice(0, 50),
    elements: ELEMENTS, elementRoles: ELEMENT_ROLE,
    sixSystems: SIX_SYSTEMS, difficulties: DIFFICULTIES, realms: REALMS,
  };
}

module.exports = {
  ELEMENTS, SHENG, KE, ELEMENT_ROLE, ELEMENT_ABILITY, SECONDARY_SYSTEMS, PHASE_LING, DIFFICULTIES, REALMS, SIX_SYSTEMS, CFG, RELICS, EVENTS,
  createRun, tick, getState, getRealmStage,
};
