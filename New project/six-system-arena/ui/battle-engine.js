/**
 * battle-engine.js — 六系演武 · 确定性对战内核（R2）
 * ============================================================================
 * 对应文档：docs/03-对战系统.md / docs/04-成就系统.md §5 字段契约
 *
 * 设计四原则（与 docs/03 §1 一一对应）
 *   1. 忠于世界观   —— 六系 = 金 / 木 / 水 / 火 / 土 / 空间；锚点「御灵系」与「领域」
 *   2. 数据驱动     —— 双方数值全部来自 data/generated/character_stats.json 与 data/decks.json
 *   3. 确定性可复现 —— 同一套 (角色 + 卡组 + 种子) 必然复现同一场战斗
 *   4. 主属性克制   —— 多系角色以 systems[0] 作为主属性参与克制环
 *
 * 战斗规则
 *   · 六系克制环  金 → 木 → 土 → 水 → 火 → 金（克制 ×1.25，被克 ×0.85）
 *   · 空间系      不被克制也不克制他人（×1.00），但其技能穿透 20% 防御
 *   · 回合上限    30（镜像战 20；超时判血量百分比高者胜，完全相同判平局）
 *   · 能量        每回合 +1（上限 10；镜像战 12），用于释放技能卡
 *   · 暴击        10% 概率 ×1.5，由种子决定，不看运气面板
 *   · 基础伤害    max(1, attack × 系数 - defense × 0.45)
 *   · 领域终极技  每场限一次，需充能满 + 能量足够
 *
 * 两种对手
 *   · 官方角色（opponent_type = 'official'）：对手取自 488 名角色
 *   · 自身镜像（opponent_type = 'mirror'）  ：对手为自身卡组的精确副本
 *
 * 运行环境：纯函数式、零依赖，可用 <script> 引入或 CommonJS require。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SixSystemBattle = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ENGINE_VERSION = '1.0.0';
  var RULES_VERSION = '2.0.0';

  /* ------------------------------------------------------------------ */
  /* 常量                                                                */
  /* ------------------------------------------------------------------ */

  /** 六系克制环：key 克制 value（docs/03 §3） */
  var COUNTER_RING = { jin: 'mu', mu: 'tu', tu: 'shui', shui: 'huo', huo: 'jin' };
  var COUNTER_BONUS = 1.25;   // 克制方伤害倍率
  var COUNTERED_PENALTY = 0.85; // 被克方伤害倍率
  var KONGJIAN = 'kongjian';
  var KONGJIAN_PIERCE = 0.20; // 空间系技能无视 20% 防御
  var NONE = 'none';

  var TURN_LIMIT = 30;          // 常规回合上限
  var TURN_LIMIT_MIRROR = 20;   // 镜像战回合上限
  var ENERGY_MAX = 10;          // 常规能量上限
  var ENERGY_MAX_MIRROR = 12;   // 镜像战能量上限
  var ENERGY_START = 6;         // 起手能量
  var ENERGY_REGEN = 1;         // 每回合回复

  var CRIT_RATE = 0.10;         // 暴击率
  var CRIT_MULT = 1.5;          // 暴击倍率
  var DEF_FACTOR = 0.45;        // 防御减伤系数
  var BASIC_COEFF = 1.0;        // 普攻系数
  var BOND_ATK_CAP = 0.40;      // 羁绊攻击加成上限（防叠加失衡）
  var HEAL_CAP_RATIO = 0.12;    // 单次治疗上限（占最大血量比）

  var ULT_CHARGE_PER_TURN = 10; // 终极技每回合充能
  var ULT_CHARGE_MAX = 100;     // 充能满（第 10 回合可用）
  var ULT_ENERGY_COST = 8;      // 终极技能量消耗（卡面 cost 优先）
  var ULT_COEFF_FALLBACK = 2.2; // 卡面缺失时的终极技系数

  var MODES = { story: '剧情战', arena: '演武场', challenge: '挑战赛', mirror: '镜像战' };

  /* ------------------------------------------------------------------ */
  /* 工具：确定性伪随机（mulberry32）                                     */
  /* ------------------------------------------------------------------ */

  function makeRng(seed) {
    var s = (seed >>> 0) || 0x9e3779b9;
    return function rng() {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 由主种子派生稳定的整数种子（便于回放时按子用途拆分随机流） */
  function deriveSeed(seed, salt) {
    var h = 2166136261 >>> 0;
    var str = String(seed) + '|' + String(salt);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ------------------------------------------------------------------ */
  /* 六系克制                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * 计算攻击方主属性对防守方主属性的克制系数。
   * 空间系：不被克制，也不克制他人 → 恒为 1.00（穿透另行计算）。
   * 无系：不参与克制 → 恒为 1.00。同系 → 1.00。
   */
  function elementFactor(attackerElement, defenderElement) {
    var a = attackerElement || NONE;
    var d = defenderElement || NONE;
    if (a === KONGJIAN || d === KONGJIAN) return 1.00;
    if (a === NONE || d === NONE) return 1.00;
    if (a === d) return 1.00;
    if (COUNTER_RING[a] === d) return COUNTER_BONUS;
    if (COUNTER_RING[d] === a) return COUNTERED_PENALTY;
    return 1.00;
  }

  /** 该系是否克制对方（用于 UI 提示与成就判定） */
  function counters(a, d) { return elementFactor(a, d) === COUNTER_BONUS; }

  /* ------------------------------------------------------------------ */
  /* 卡组 → 战斗单位                                                     */
  /* ------------------------------------------------------------------ */

  /**
   * 由 data/decks.json 的单条卡组构造战斗单位。
   * @param {object} deck     decks.json 的 decks[i]
   * @param {object} [opts]   { fullDeck:boolean } 是否无视解锁直接使用全部技能卡
   */
  function buildFighter(deck, opts) {
    opts = opts || {};
    var skills = (deck.skills || []).filter(function (s) {
      return opts.fullDeck ? true : s.unlocked !== false;
    });
    var bondAtk = 0;
    if (deck.bond && deck.bond.effect && typeof deck.bond.effect.attack_pct === 'number') {
      bondAtk = clamp(deck.bond.effect.attack_pct, 0, BOND_ATK_CAP);
    }
    return {
      character_id: deck.character_id,
      name: deck.name,
      element: deck.element || NONE,
      systems: (deck.systems || []).slice(),
      rarity: deck.rarity,
      tier: deck.tier,
      mainline: !!deck.mainline,
      portrait: deck.portrait || null,

      hp_max: deck.general.stats.hp,
      hp: deck.general.stats.hp,
      attack: deck.general.stats.attack,
      defense: deck.general.stats.defense,
      shield: 0,

      bond_atk_pct: bondAtk,
      bond_name: deck.bond ? deck.bond.name : null,

      skills: skills,
      skills_all: (deck.skills || []).slice(),
      bond: deck.bond || null,
      ultimate: deck.ultimate || null,
      ultimate_used: false,
      ult_charge: 0,

      energy: ENERGY_START,
      energy_max: ENERGY_MAX,
      alive: true
    };
  }

  /** 羁绊加成后的实际攻击力 */
  function effAttack(f) { return f.attack * (1 + f.bond_atk_pct); }

  /** 速度：defense × 0.5 + attack × 0.5（docs/03 §2） */
  function speedOf(f) { return f.defense * 0.5 + f.attack * 0.5; }

  /* ------------------------------------------------------------------ */
  /* 伤害结算                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * 计算一次攻击的伤害。
   * @returns {{damage:number, crit:boolean, factor:number, pierce:number}}
   */
  function computeDamage(attacker, defender, action, rng) {
    var cardElement = action.element || attacker.element;
    var pierce = action.pierce || 0;
    // 空间系技能额外穿透 20% 防御（与卡面 pierce 取较大值，避免重复叠加）
    if (cardElement === KONGJIAN) pierce = Math.max(pierce, KONGJIAN_PIERCE);
    pierce = clamp(pierce, 0, 0.8);

    var factor = elementFactor(attacker.element, defender.element);
    var coeff = typeof action.coeff === 'number' ? action.coeff : BASIC_COEFF;

    var effDef = defender.defense * (1 - pierce);
    var raw = Math.max(1, effAttack(attacker) * coeff * factor - effDef * DEF_FACTOR);

    var crit = rng() < CRIT_RATE;
    if (crit) raw = raw * CRIT_MULT;

    return {
      damage: Math.max(1, Math.round(raw)),
      crit: crit,
      factor: factor,
      pierce: pierce
    };
  }

  function applyDamage(target, amount) {
    var absorbed = 0;
    if (target.shield > 0) {
      absorbed = Math.min(target.shield, amount);
      target.shield -= absorbed;
      amount -= absorbed;
    }
    var before = target.hp;
    target.hp = Math.max(0, target.hp - amount);
    if (target.hp <= 0) target.alive = false;
    return { absorbed: absorbed, hp_lost: before - target.hp, hp_after: target.hp };
  }

  function maxHeal(target) { return Math.round(target.hp_max * HEAL_CAP_RATIO); }

  /* ------------------------------------------------------------------ */
  /* AI：确定性行动选择                                                  */
  /* ------------------------------------------------------------------ */

  /**
   * 从可支付的动作中按"期望收益"排序取最优，纯确定性（同状态必同选择）。
   * 评分 = 期望伤害 + 治疗×0.8 + 护盾×0.6；平分时按 cost 升序、card_id 升序。
   */
  function pickAction(self, foe) {
    var cands = [];

    // 普攻（永远可用的兜底）
    cands.push({
      kind: 'basic',
      card_id: 'BASIC',
      name: '普攻',
      element: self.element,
      coeff: BASIC_COEFF,
      cost: 0,
      pierce: 0,
      heal: 0,
      shield: 0
    });

    // 技能
    for (var i = 0; i < self.skills.length; i++) {
      var s = self.skills[i];
      if (s.cost <= self.energy) {
        cands.push({
          kind: 'skill', card_id: s.card_id, name: s.name, element: s.element,
          coeff: s.coeff, cost: s.cost, pierce: s.pierce || 0,
          heal: s.heal || 0, shield: s.shield || 0, slot: s.slot
        });
      }
    }

    // 领域终极技
    if (self.ultimate && !self.ultimate_used && self.ult_charge >= ULT_CHARGE_MAX) {
      var uCost = self.ultimate.cost || ULT_ENERGY_COST;
      if (uCost <= self.energy) {
        cands.push({
          kind: 'ultimate', card_id: self.ultimate.card_id, name: self.ultimate.name,
          element: self.ultimate.element, coeff: self.ultimate.coeff || ULT_COEFF_FALLBACK,
          cost: uCost, pierce: self.ultimate.pierce || 0,
          heal: self.ultimate.heal || 0, shield: self.ultimate.shield || 0
        });
      }
    }

    var best = null, bestScore = -Infinity;
    for (var j = 0; j < cands.length; j++) {
      var c = cands[j];
      var expDmg = Math.max(1, effAttack(self) * c.coeff *
        elementFactor(self.element, foe.element) - foe.defense * 0.45);
      var score = expDmg + c.heal * 0.8 + c.shield * 0.6;
      // 残血保命：治疗权重提升
      if (c.heal > 0 && self.hp < self.hp_max * 0.4) score += c.heal * 1.2;
      if (score > bestScore + 1e-9 ||
        (Math.abs(score - bestScore) < 1e-9 && best && c.cost < best.cost) ||
        (Math.abs(score - bestScore) < 1e-9 && best && c.cost === best.cost &&
          String(c.card_id) < String(best.card_id))) {
        best = c; bestScore = score;
      }
    }
    return best;
  }

  /* ------------------------------------------------------------------ */
  /* 战斗主循环                                                          */
  /* ------------------------------------------------------------------ */

  function makeBattleId(seed, aId, bId, mode) {
    return 'B' + (seed >>> 0).toString(36).toUpperCase() + '-' + aId + '-' + bId + '-' + mode;
  }

  /**
   * 创建一场战斗。
   * @param {object} cfg
   *   cfg.mode          'story' | 'arena' | 'challenge' | 'mirror'
   *   cfg.seed          整数随机种子（必填，否则不可复现）
   *   cfg.selfDeck      decks.json 中我方卡组
   *   cfg.opponentDeck  decks.json 中对手卡组（镜像战传自身卡组即可）
   *   cfg.opponentType  'official' | 'mirror'
   *   cfg.fullDeck      [可选] 双方是否使用全部技能卡（默认 false，按解锁）
   *   cfg.battle_id     [可选] 覆盖自动生成的对局 id
   */
  function createBattle(cfg) {
    if (!cfg || !cfg.selfDeck || !cfg.opponentDeck) {
      throw new Error('createBattle: 需要 selfDeck 与 opponentDeck');
    }
    var mode = cfg.mode || 'arena';
    var seed = (cfg.seed === undefined || cfg.seed === null) ? 1 : (cfg.seed | 0);
    var full = !!cfg.fullDeck;

    var A = buildFighter(cfg.selfDeck, { fullDeck: full });
    var B = buildFighter(cfg.opponentDeck, { fullDeck: full });

    var isMirror = mode === 'mirror';
    A.energy_max = isMirror ? ENERGY_MAX_MIRROR : ENERGY_MAX;
    B.energy_max = isMirror ? ENERGY_MAX_MIRROR : ENERGY_MAX;
    A.energy = Math.min(A.energy, A.energy_max);
    B.energy = Math.min(B.energy, B.energy_max);

    var state = {
      engine_version: ENGINE_VERSION,
      rules_version: RULES_VERSION,
      battle_id: cfg.battle_id || makeBattleId(seed, A.character_id, B.character_id, mode),
      mode: mode,
      mode_name: MODES[mode] || mode,
      seed: seed,
      turn: 0,
      turn_limit: isMirror ? TURN_LIMIT_MIRROR : TURN_LIMIT,
      is_mirror: isMirror,
      opponent_type: cfg.opponentType || (isMirror ? 'mirror' : 'official'),
      finished: false,
      winner: null,
      reason: null,
      events: [],
      rng: makeRng(deriveSeed(seed, A.character_id + ':' + B.character_id + ':' + mode)),
      fighters: { a: A, b: B }
    };

    // 先手：速度快者；相同则 attack 高者；再相同则我方（a）先手，保证确定性
    var sa = speedOf(A), sb = speedOf(B);
    var first;
    if (sa !== sb) first = sa > sb ? 'a' : 'b';
    else if (A.attack !== B.attack) first = A.attack > B.attack ? 'a' : 'b';
    else first = 'a';
    state.first = first;
    state.order = first === 'a' ? ['a', 'b'] : ['b', 'a'];
    return state;
  }

  function other(side) { return side === 'a' ? 'b' : 'a'; }

  /** 执行一个回合；返回该回合的事件列表 */
  function resolveTurn(state) {
    if (state.finished) return [];
    state.turn += 1;
    var evs = [];
    var A = state.fighters.a, B = state.fighters.b;

    // 回合开始：充能 + 回能
    ['a', 'b'].forEach(function (side) {
      var f = state.fighters[side];
      if (!f.alive) return;
      f.ult_charge = Math.min(ULT_CHARGE_MAX, f.ult_charge + ULT_CHARGE_PER_TURN);
      f.energy = Math.min(f.energy_max, f.energy + ENERGY_REGEN);
    });

    for (var i = 0; i < state.order.length; i++) {
      var side = state.order[i];
      var atk = state.fighters[side];
      var def = state.fighters[other(side)];
      if (!atk.alive || !def.alive) continue;

      var action = pickAction(atk, def);
      atk.energy = Math.max(0, atk.energy - (action.cost || 0));

      var res = computeDamage(atk, def, action, state.rng);
      var applied = applyDamage(def, res.damage);

      var healed = 0, gained = 0;
      if (action.heal > 0) {
        healed = Math.min(maxHeal(atk), Math.round(effAttack(atk) * action.heal));
        var before = atk.hp;
        atk.hp = Math.min(atk.hp_max, atk.hp + healed);
        healed = atk.hp - before;
      }
      if (action.shield > 0) {
        gained = Math.round(atk.defense * action.shield);
        atk.shield += gained;
      }

      atk.stat_damage = (atk.stat_damage || 0) + applied.hp_lost;
      def.stat_taken = (def.stat_taken || 0) + applied.hp_lost;
      if (res.crit) atk.stat_crits = (atk.stat_crits || 0) + 1;
      if ((atk.stat_max_hit || 0) < res.damage) atk.stat_max_hit = res.damage;
      if (action.kind === 'ultimate') atk.ultimate_used = true;

      var ev = {
        turn: state.turn,
        actor: side,
        actor_id: atk.character_id,
        actor_name: atk.name,
        target: other(side),
        target_id: def.character_id,
        action: {
          kind: action.kind,
          card_id: action.card_id,
          name: action.name,
          element: action.element,
          cost: action.cost || 0
        },
        damage: applied.hp_lost,
        raw_damage: res.damage,
        crit: res.crit,
        counter: res.factor,
        pierce: res.pierce,
        absorbed: applied.absorbed,
        heal: healed,
        shield: gained,
        hp_after: { a: A.hp, b: B.hp },
        energy_after: { a: A.energy, b: B.energy },
        defeated: !def.alive
      };
      evs.push(ev);

      if (!def.alive) {
        finish(state, side, 'ko');
        break;
      }
    }

    if (!state.finished && state.turn >= state.turn_limit) {
      var ra = A.hp / A.hp_max, rb = B.hp / B.hp_max;
      if (ra === rb) finish(state, null, 'draw');
      else finish(state, ra > rb ? 'a' : 'b', 'timeout');
    }

    state.events = state.events.concat(evs);
    return evs;
  }

  function finish(state, winner, reason) {
    state.finished = true;
    state.winner = winner;
    state.reason = reason;
    state.events.push({
      type: 'end',
      turn: state.turn,
      winner: winner,
      reason: reason,
      hp: { a: state.fighters.a.hp, b: state.fighters.b.hp },
      hp_pct: {
        a: state.fighters.a.hp / state.fighters.a.hp_max,
        b: state.fighters.b.hp / state.fighters.b.hp_max
      }
    });
  }

  /** 跑到战斗结束（内部使用；对外建议逐步 step 以便播放动画） */
  function runToEnd(state) {
    var guard = 0;
    while (!state.finished && guard++ < 200) resolveTurn(state);
    return state;
  }

  /**
   * 生成符合 docs/04 §5 字段契约的战斗日志记录。
   * @param {object} state  战斗状态
   * @param {string} [perspective] 'a' 或 'b'，默认 'a'（我方）
   */
  function toLogRecord(state, perspective) {
    var p = perspective || 'a';
    var me = state.fighters[p];
    var foe = state.fighters[other(p)];
    var result;
    if (state.winner === null) result = 'draw';
    else result = state.winner === p ? 'win' : 'lose';
    return {
      battle_id: state.battle_id,
      mode: state.mode,
      my_character_id: me.character_id,
      opponent_id: state.is_mirror ? me.character_id : foe.character_id,
      opponent_type: state.opponent_type,
      result: result,
      turn_used: state.turn,
      hp_left: me.hp,
      hp_max: me.hp_max,
      seed: state.seed
    };
  }

  /** 战斗摘要（供 UI 与审计展示） */
  function summarize(state) {
    var A = state.fighters.a, B = state.fighters.b;
    return {
      battle_id: state.battle_id,
      mode: state.mode,
      seed: state.seed,
      turns: state.turn,
      reason: state.reason,
      winner: state.winner,
      finish_turn: state.turn,
      a: {
        character_id: A.character_id, name: A.name, element: A.element,
        hp: A.hp, hp_max: A.hp_max, damage: A.stat_damage || 0,
        max_hit: A.stat_max_hit || 0, crits: A.stat_crits || 0,
        ultimate_used: !!A.ultimate_used
      },
      b: {
        character_id: B.character_id, name: B.name, element: B.element,
        hp: B.hp, hp_max: B.hp_max, damage: B.stat_damage || 0,
        max_hit: B.stat_max_hit || 0, crits: B.stat_crits || 0,
        ultimate_used: !!B.ultimate_used
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* 便捷入口：官方对战 / 镜像战                                         */
  /* ------------------------------------------------------------------ */

  function indexDecks(decksDoc) {
    var map = {};
    var list = (decksDoc && decksDoc.decks) || decksDoc || [];
    for (var i = 0; i < list.length; i++) map[list[i].character_id] = list[i];
    return map;
  }

  /** 与官方角色对战 */
  function createOfficialBattle(selfId, opponentId, decksDoc, opts) {
    opts = opts || {};
    var map = indexDecks(decksDoc);
    if (!map[selfId]) throw new Error('未找到我方卡组: ' + selfId);
    if (!map[opponentId]) throw new Error('未找到对手卡组: ' + opponentId);
    return createBattle({
      mode: opts.mode || 'arena',
      seed: opts.seed,
      selfDeck: map[selfId],
      opponentDeck: map[opponentId],
      opponentType: 'official',
      fullDeck: opts.fullDeck,
      battle_id: opts.battle_id
    });
  }

  /**
   * 与自身镜像对战：对手为自身卡组的精确副本（docs/03 §5.2）。
   * 镜像战规则差异：双方同系 → 无克制加成；能量上限 12；回合上限 20。
   */
  function createMirrorBattle(selfId, decksDoc, opts) {
    opts = opts || {};
    var map = indexDecks(decksDoc);
    if (!map[selfId]) throw new Error('未找到我方卡组: ' + selfId);
    var mirrorDeck = JSON.parse(JSON.stringify(map[selfId]));
    mirrorDeck.name = map[selfId].name + '（镜像）';
    return createBattle({
      mode: 'mirror',
      seed: opts.seed,
      selfDeck: map[selfId],
      opponentDeck: mirrorDeck,
      opponentType: 'mirror',
      fullDeck: opts.fullDeck,
      battle_id: opts.battle_id
    });
  }

  /** 一步到位：直接跑完并返回日志契约 + 摘要（便于脚本化验证） */
  function simulate(cfg) {
    var st = createBattle(cfg);
    runToEnd(st);
    return { state: st, log: toLogRecord(st), summary: summarize(st) };
  }

  /** 同一输入重复模拟校验可复现性（审计用） */
  function verifyDeterminism(cfg, times) {
    times = times || 2;
    var first = simulate(cfg), ok = true;
    var sig = JSON.stringify(first.summary) + JSON.stringify(first.log);
    for (var i = 1; i < times; i++) {
      var again = simulate(cfg);
      var s = JSON.stringify(again.summary) + JSON.stringify(again.log);
      if (s !== sig) { ok = false; break; }
    }
    return { deterministic: ok, signature: first.summary, log: first.log };
  }

  /* ------------------------------------------------------------------ */
  /* 导出                                                                */
  /* ------------------------------------------------------------------ */

  return {
    ENGINE_VERSION: ENGINE_VERSION,
    RULES_VERSION: RULES_VERSION,
    COUNTER_RING: COUNTER_RING,
    COUNTER_BONUS: COUNTER_BONUS,
    COUNTERED_PENALTY: COUNTERED_PENALTY,
    KONGJIAN_PIERCE: KONGJIAN_PIERCE,
    TURN_LIMIT: TURN_LIMIT,
    TURN_LIMIT_MIRROR: TURN_LIMIT_MIRROR,
    ENERGY_MAX: ENERGY_MAX,
    ENERGY_MAX_MIRROR: ENERGY_MAX_MIRROR,
    CRIT_RATE: CRIT_RATE,
    CRIT_MULT: CRIT_MULT,
    MODES: MODES,

    // 纯函数
    makeRng: makeRng,
    deriveSeed: deriveSeed,
    elementFactor: elementFactor,
    counters: counters,
    buildFighter: buildFighter,
    effAttack: effAttack,
    speedOf: speedOf,
    computeDamage: computeDamage,
    pickAction: pickAction,

    // 战斗流程
    createBattle: createBattle,
    resolveTurn: resolveTurn,
    runToEnd: runToEnd,
    toLogRecord: toLogRecord,
    summarize: summarize,

    // 便捷入口
    indexDecks: indexDecks,
    createOfficialBattle: createOfficialBattle,
    createMirrorBattle: createMirrorBattle,
    simulate: simulate,
    verifyDeterminism: verifyDeterminism
  };
});
