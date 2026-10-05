/**
 * achievement-system.js — 六系演武 · 成就判定与收集图鉴（R2）
 * ============================================================================
 * 对应文档：docs/04-成就系统.md
 *
 * 职责
 *   1. 读取战斗日志契约字段（battle_id / mode / my_character_id / opponent_id /
 *      opponent_type / result / turn_used / hp_left / hp_max / seed）做成就判定
 *   2. 维护玩家收集档案（unlocked / element_wins / mode_wins / defeated / flawless）
 *   3. 输出收集图鉴（六系 / 稀有度 / 分档 / 主线四条视图）
 *
 * 硬性规则
 *   · 失败不惩罚：result !== 'win' 时**不触发任何成就判定**，也不改收集进度（docs/04 §1、§6）
 *   · 镜像战胜负不计入「角色胜利收藏」，但计入「操作评价」（docs/03 §5.2）
 *   · 判定只用战斗日志 + character_stats 的确定性字段，不做随机掉率判定
 *
 * 数据依赖：data/achievements.json、data/generated/character_stats.json
 * 零依赖，可用 <script> 引入或 CommonJS require。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SixSystemAchievement = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var SIX = ['jin', 'mu', 'shui', 'huo', 'tu', 'kongjian'];
  var FIVE_ELEMENT = ['jin', 'mu', 'shui', 'huo', 'tu'];
  var C_TIER_OR_ABOVE = ['C', 'B', 'A'];
  var RARITY_ORDER = ['R', 'SR', 'SSR', 'UR'];
  var TIER_ORDER = ['F', 'E', 'D', 'C', 'B', 'A'];
  var SYSTEM_CN = { jin: '金系', mu: '木系', shui: '水系', huo: '火系', tu: '土系', kongjian: '空间系', none: '无系' };

  function uniq(arr) {
    var seen = {}, out = [];
    (arr || []).forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  }
  function has(arr, v) { return (arr || []).indexOf(v) >= 0; }

  /* ------------------------------------------------------------------ */
  /* 玩家收集档案                                                        */
  /* ------------------------------------------------------------------ */

  function defaultProfile() {
    return {
      version: VERSION,
      unlocked_character_ids: [],
      element_wins: {},           // 主属性 key → 取胜次数
      mode_wins: {},              // story / arena / challenge / mirror → 取胜次数
      defeated_opponent_ids: [],  // 击败过的官方角色 id（不含镜像）
      flawless_wins: 0,           // 零损血取胜场次
      battles: 0,
      wins: 0,
      losses: 0,
      unlocked_achievement_ids: []
    };
  }

  /* ------------------------------------------------------------------ */
  /* 主体                                                               */
  /* ------------------------------------------------------------------ */

  /**
   * @param {object} config
   *   config.achievements  data/achievements.json 解析对象
   *   config.characters    data/generated/character_stats.json 解析对象
   *   config.profile       [可选] 已存档的收集档案
   *   config.onUnlock      [可选] 成就解锁回调 fn(achievement, result)
   */
  function createAchievementSystem(config) {
    config = config || {};
    if (!config.achievements || !config.characters) {
      throw new Error('createAchievementSystem: 需要 achievements 与 characters 数据');
    }
    var achDoc = config.achievements;
    var achievements = achDoc.achievements || [];
    var metricsDef = achDoc.metrics || {};
    var chars = config.characters.characters || [];
    var byId = {};
    chars.forEach(function (c) { byId[c.id] = c; });

    var profile = config.profile ? normalizeProfile(config.profile) : defaultProfile();

    function normalizeProfile(p) {
      var d = defaultProfile();
      for (var k in d) if (!(k in p)) p[k] = d[k];
      return p;
    }

    /* ---------------- 派生集合 ---------------- */

    function characterOf(id) { return byId[id] || null; }
    function elementOf(id) {
      var c = byId[id];
      return c ? (c.element || 'none') : null;
    }
    function isMainline(id) { var c = byId[id]; return !!(c && c.mainline); }
    function tierAtLeastC(id) {
      var c = byId[id];
      return !!(c && C_TIER_OR_ABOVE.indexOf(c.tier) >= 0);
    }
    function hasSystem(id, sys) {
      var c = byId[id];
      return !!(c && (c.systems || []).indexOf(sys) >= 0);
    }

    function ownedIds() { return uniq(profile.unlocked_character_ids); }

    function mainlineIds() {
      return chars.filter(function (c) { return c.mainline; }).map(function (c) { return c.id; });
    }
    function rarityTotal(r) {
      return chars.filter(function (c) { return c.rarity === r; }).length;
    }

    /* ---------------- 指标计算（对应 achievements.json 的 metrics 表） ---------------- */

    function metricValue(metric) {
      var owned = ownedIds();
      switch (metric) {
        case 'unlocked_characters':
          return owned.length;

        case 'elements_c_covered': {
          // 五系各至少 1 名 C 档以上角色
          var covered = 0;
          FIVE_ELEMENT.forEach(function (s) {
            var hit = owned.some(function (id) {
              return elementOf(id) === s && tierAtLeastC(id);
            });
            if (hit) covered++;
          });
          return covered;
        }

        case 'kongjian_win': {
          var own = owned.some(function (id) { return hasSystem(id, 'kongjian'); });
          var win = (profile.element_wins.kongjian || 0) > 0;
          return (own && win) ? 1 : 0;
        }

        case 'elements_won': {
          var n = 0;
          SIX.forEach(function (s) { if ((profile.element_wins[s] || 0) > 0) n++; });
          return n;
        }

        case 'mainline_defeated': {
          var set = {};
          mainlineIds().forEach(function (id) { set[id] = 1; });
          return uniq(profile.defeated_opponent_ids).filter(function (id) {
            return set[id];
          }).length;
        }

        case 'challenge_wins': return profile.mode_wins.challenge || 0;
        case 'mirror_wins': return profile.mode_wins.mirror || 0;
        case 'flawless_wins': return profile.flawless_wins || 0;

        case 'rarity_complete_R': return owned.filter(function (id) { var c = byId[id]; return c && c.rarity === 'R'; }).length;
        case 'rarity_complete_SR': return owned.filter(function (id) { var c = byId[id]; return c && c.rarity === 'SR'; }).length;
        case 'rarity_complete_SSR': return owned.filter(function (id) { var c = byId[id]; return c && c.rarity === 'SSR'; }).length;
        case 'rarity_complete_UR': return owned.filter(function (id) { var c = byId[id]; return c && c.rarity === 'UR'; }).length;

        default:
          throw new Error('未登记的 metric: ' + metric);
      }
    }

    /** 按 condition 独立复核（双通道，避免 metric 与 condition 语义漂移） */
    function conditionMet(ach) {
      var c = ach.condition || {};
      var owned = ownedIds();
      switch (c.type) {
        case 'collection_count':
          return owned.length >= c.value;

        case 'element_coverage':
          return (c.elements || []).every(function (s) {
            return owned.filter(function (id) {
              return elementOf(id) === s && tierAtLeastC(id);
            }).length >= (c.min_count_per_element || 1);
          });

        case 'first_win_by_element': {
          var ownsSystem = owned.some(function (id) { return hasSystem(id, c.element); });
          return ownsSystem && (profile.element_wins[c.element] || 0) >= 1;
        }

        case 'element_win_coverage':
          return (c.elements || []).every(function (s) {
            return (profile.element_wins[s] || 0) >= (c.min_count_per_element || 1);
          });

        case 'distinct_defeat': {
          var filter = c.opponent_filter || {};
          var pool = chars.filter(function (ch) {
            if (filter.mainline !== undefined && !!ch.mainline !== !!filter.mainline) return false;
            return true;
          }).map(function (ch) { return ch.id; });
          var dset = {};
          uniq(profile.defeated_opponent_ids).forEach(function (id) { dset[id] = 1; });
          var hits = pool.filter(function (id) { return dset[id]; }).length;
          return hits >= (c.count || 0);
        }

        case 'mode_win_count':
          return (profile.mode_wins[c.mode] || 0) >= (c.count || 0);

        case 'battle_condition':
          return (profile.flawless_wins || 0) >= (c.count || 1);

        case 'rarity_complete': {
          var n = owned.filter(function (id) {
            var ch = byId[id]; return ch && ch.rarity === c.rarity;
          }).length;
          return n >= (c.total || 0);
        }

        default:
          return false;
      }
    }

    /* ---------------- 进度与判定 ---------------- */

    function progressOf(ach) {
      var metric = ach.progress.metric;
      var cur = metricValue(metric);
      var target = ach.progress.target;
      var done = !!(conditionMet(ach) && cur >= target);
      return {
        id: ach.id,
        name: ach.name,
        category: ach.category,
        current: Math.min(cur, target),
        raw_current: cur,
        target: target,
        unit: ach.progress.unit,
        pct: target > 0 ? Math.min(1, cur / target) : 0,
        done: done,
        unlocked: has(profile.unlocked_achievement_ids, ach.id)
      };
    }

    function progressAll() { return achievements.map(progressOf); }

    /**
     * 结算一场战斗并判定成就。
     * @param {object} record  战斗日志契约记录
     * @returns {object} { judged, reason, context, newly_unlocked, progress_delta }
     */
    function judge(record) {
      if (!record || !record.result) throw new Error('judge: 需要战斗日志记录');

      // 失败不惩罚、也不判定（docs/04 §1 / §6）
      if (record.result !== 'win') {
        profile.battles += 1;
        profile.losses += 1;
        return {
          judged: false,
          reason: 'lose-no-penalty',
          note: '失败不触发成就判定，不扣资源 / 不扣进度',
          context: { mode: record.mode, opponent_type: record.opponent_type, win_streak: 0 },
          newly_unlocked: [],
          progress_delta: []
        };
      }

      var before = {};
      achievements.forEach(function (a) { before[a.id] = metricValue(a.progress.metric) >= a.progress.target; });

      // —— 更新档案 ——
      var myId = record.my_character_id;
      var myElement = elementOf(myId) || 'none';
      var isMirror = record.opponent_type === 'mirror';
      var firstTimeDefeat = !isMirror && !has(profile.defeated_opponent_ids, record.opponent_id);

      profile.battles += 1;
      profile.wins += 1;
      profile.element_wins[myElement] = (profile.element_wins[myElement] || 0) + 1;
      profile.mode_wins[record.mode] = (profile.mode_wins[record.mode] || 0) + 1;
      if (!isMirror && record.opponent_id !== null && record.opponent_id !== undefined) {
        if (!has(profile.defeated_opponent_ids, record.opponent_id)) {
          profile.defeated_opponent_ids.push(record.opponent_id);
        }
      }
      if (typeof record.hp_left === 'number' && typeof record.hp_max === 'number' &&
        record.hp_left >= record.hp_max) {
        profile.flawless_wins += 1;
      }
      // 胜利也计入图鉴解锁（我方主将）
      if (!has(profile.unlocked_character_ids, myId)) {
        profile.unlocked_character_ids.push(myId);
      }

      // —— 判定 ——
      var newly = [], delta = [];
      progressAll().forEach(function (p) {
        var nowDone = p.done;
        if (!before[p.id] && nowDone && !p.unlocked) {
          profile.unlocked_achievement_ids.push(p.id);
          var ach = achievements.filter(function (a) { return a.id === p.id; })[0];
          newly.push(ach);
          if (typeof config.onUnlock === 'function') config.onUnlock(ach, p);
        }
        if (!p.unlocked || nowDone) {
          delta.push({ id: p.id, name: p.name, current: p.current, target: p.target, done: nowDone });
        }
      });

      return {
        judged: true,
        reason: 'win',
        context: {
          mode: record.mode,
          opponent_type: record.opponent_type,
          opponent_id: record.opponent_id,
          first_time_defeat: firstTimeDefeat,
          win_streak: computeWinStreak(record),
          my_character_id: myId,
          my_element: myElement
        },
        newly_unlocked: newly,
        progress_delta: delta
      };
    }

    /** 最近一场胜利是否为连胜（按 mode_wins 无法直接回溯，故由调用方传入 streak 更准；此处返回累计胜场） */
    function computeWinStreak() { return profile.wins; }

    /** 登记新解锁角色（收集 / 经营玩法调用） */
    function unlockCharacters(ids) {
      var changed = [];
      (ids || []).forEach(function (id) {
        if (byId[id] && !has(profile.unlocked_character_ids, id)) {
          profile.unlocked_character_ids.push(id);
          changed.push(id);
        }
      });
      return recheckAfterUnlock(changed);
    }

    /** 新解锁后重新判定（不依赖战斗日志，仅收集类成就受益） */
    function recheckAfterUnlock(changed) {
      var newly = [];
      progressAll().forEach(function (p) {
        if (p.done && !p.unlocked) {
          profile.unlocked_achievement_ids.push(p.id);
          var ach = achievements.filter(function (a) { return a.id === p.id; })[0];
          newly.push(ach);
          if (typeof config.onUnlock === 'function') config.onUnlock(ach, p);
        }
      });
      return { changed_characters: changed || [], newly_unlocked: newly };
    }

    /* ---------------- 收集图鉴 ---------------- */

    /** 单角色图鉴条目 */
    function codexEntry(id) {
      var c = byId[id];
      if (!c) return null;
      return {
        id: c.id, name: c.name, element: c.element, element_name: c.element_name,
        systems: c.systems, systems_label: c.systems_label,
        rarity: c.rarity, tier: c.tier, tier_name: c.tier_name,
        realm_name: c.realm_name, mainline: c.mainline,
        unlocked: has(ownedIds(), id)
      };
    }

    /** 指定视图的收集进度 */
    function codexSection(sectionKey) {
      var owned = ownedIds();
      var groups = {};
      var def = (achDoc.codex && achDoc.codex.sections || []).filter(function (s) {
        return s.key === sectionKey;
      })[0];
      var order = def ? def.order : null;

      chars.forEach(function (c) {
        var key;
        switch (sectionKey) {
          case 'by_element': key = c.element; break;
          case 'by_rarity': key = c.rarity; break;
          case 'by_tier': key = c.tier; break;
          case 'by_mainline': key = c.mainline ? 'true' : 'false'; break;
          default: key = 'all';
        }
        if (!groups[key]) groups[key] = { key: key, total: 0, owned: 0, entries: [] };
        groups[key].total += 1;
        var isOwned = has(owned, c.id);
        if (isOwned) groups[key].owned += 1;
        groups[key].entries.push({
          id: c.id, name: c.name, rarity: c.rarity, tier: c.tier,
          element: c.element, mainline: c.mainline, unlocked: isOwned
        });
      });

      var keys = Object.keys(groups);
      if (order) {
        keys.sort(function (x, y) {
          var ix = order.indexOf(sectionKey === 'by_mainline'
            ? (x === 'true') : x);
          var iy = order.indexOf(sectionKey === 'by_mainline'
            ? (y === 'true') : y);
          return (ix < 0 ? 999 : ix) - (iy < 0 ? 999 : iy);
        });
      }
      return {
        section: sectionKey,
        name: def ? def.name : sectionKey,
        total: chars.length,
        owned: owned.length,
        groups: keys.map(function (k) {
          var g = groups[k];
          g.label = labelOf(sectionKey, k);
          g.pct = g.total ? g.owned / g.total : 0;
          return g;
        })
      };
    }

    function labelOf(section, key) {
      if (section === 'by_element') return SYSTEM_CN[key] || key;
      if (section === 'by_rarity') return key;
      if (section === 'by_tier') return key + ' 档';
      if (section === 'by_mainline') return key === 'true' ? '主线角色' : '非主线角色';
      return key;
    }

    /** 图鉴总览：四条视图 + 成就完成度 */
    function codex() {
      var sections = (achDoc.codex && achDoc.codex.sections || []).map(function (s) {
        return codexSection(s.key);
      });
      var prog = progressAll();
      var byCat = {};
      prog.forEach(function (p) {
        if (!byCat[p.category]) byCat[p.category] = { total: 0, done: 0 };
        byCat[p.category].total += 1;
        if (p.done) byCat[p.category].done += 1;
      });
      return {
        total_characters: chars.length,
        owned_characters: ownedIds().length,
        rarity_totals: RARITY_ORDER.reduce(function (acc, r) {
          acc[r] = rarityTotal(r); return acc;
        }, {}),
        sections: sections,
        achievement_summary: {
          total: achievements.length,
          done: prog.filter(function (p) { return p.done; }).length,
          by_category: byCat
        }
      };
    }

    /* ---------------- 存档 ---------------- */

    function toJSON() { return JSON.parse(JSON.stringify(profile)); }
    function loadJSON(p) { profile = normalizeProfile(p); return profile; }
    function getProfile() { return profile; }
    function reset() { profile = defaultProfile(); return profile; }

    return {
      VERSION: VERSION,
      judge: judge,
      progressOf: progressOf,
      progressAll: progressAll,
      metricValue: metricValue,
      conditionMet: conditionMet,
      unlockCharacters: unlockCharacters,
      recheck: recheckAfterUnlock,
      codex: codex,
      codexSection: codexSection,
      codexEntry: codexEntry,
      characterOf: characterOf,
      getProfile: getProfile,
      toJSON: toJSON,
      loadJSON: loadJSON,
      reset: reset,
      mainlineIds: mainlineIds
    };
  }

  return { createAchievementSystem: createAchievementSystem, defaultProfile: defaultProfile, VERSION: VERSION };
});
