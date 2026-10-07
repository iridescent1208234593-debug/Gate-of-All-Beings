/**
 * settlement.js — 六系演武 · 胜负结算（R2 内核 / R5 台账注入）
 * ============================================================================
 * 对应文档：docs/04-成就系统.md §2（胜利结算）/ §3（失败结算）、
 *           docs/05-素材白名单.md、docs/10-表情包素材台账.md（R5 新增）
 *
 * 情绪设计三轨（R5 补齐平局）
 *   胜：罗小黑 + 比丢登场（约 3s）→ 正向反馈文案 → 成就解锁（错峰播放，避免打架）
 *   负：小黑安慰表情图 → 安慰文案 → 一键「再来一次」；不扣资源 / 不掉进度 / 不判定成就
 *   平：小黑平静表情图 → 平局文案 → 一键「再来一次」；同样零惩罚（R5 起独立成轨）
 *
 * 素材红线（docs/05 §5、docs/10）
 *   · 只用《罗小黑战记》官方图，全部取自 E:\Projects\assets\罗小黑战记数据库\images\
 *   · 一切角色形象必须为官方原图：不得改画、不得再生成、不得外链
 *   · R5 起安慰 / 平局表情图由 data/emoticons.json 台账登记，未登记或不合规的图不入池
 *
 * 零依赖，可用 <script> 引入或 CommonJS require。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SixSystemSettlement = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.1.0';

  /* ------------------------------------------------------------------ */
  /* 素材索引（全部为官方白名单路径，只读引用，不复制、不改画）           */
  /* ------------------------------------------------------------------ */

  var ASSET_ROOT = 'E:\\Projects\\assets\\罗小黑战记数据库\\images';

  var ASSETS = {
    root: ASSET_ROOT,
    luoxiaohei: {
      /** 胜利登场：主角全身立绘（官方原图） */
      entrance: ASSET_ROOT + '\\罗小黑\\罗小黑_全身_085.jpg',
      /** 失败 / 平局安慰：官方表情图（随机 1 张；R5 扩充至 3 张） */
      comfort: [
        ASSET_ROOT + '\\罗小黑\\罗小黑_表情_087.jpg',
        ASSET_ROOT + '\\罗小黑\\罗小黑_表情_088.jpg',
        ASSET_ROOT + '\\罗小黑\\罗小黑_剧照_000.jpg'
      ]
    },
    bidiu: {
      /** 胜利登场：比丢立绘（官方原图，无改画） */
      entrance: ASSET_ROOT + '\\比丢\\比丢.png',
      alt: ASSET_ROOT + '\\比丢\\比丢.gif'
    },
    /** 六系图标：复用 SixSystemPanel 内联图标，不依赖任何 AI 图目录 */
    icons: 'ui/six-system-icons.js',
    icon_panel: 'ui/SixSystemPanel.js'
  };

  /** 素材来源凭证（docs/05 §5 审查留痕） */
  var ASSET_PROVENANCE = {
    collector: 'local',
    collected_at: '2026-10-07',
    source: 'assets\\罗小黑战记数据库\\images（官方素材库，一级来源）',
    ledger: 'data/emoticons.json',
    review: {
      official_only: true,
      character_redraw: false,
      external_link: false,
      note: 'R5 起表情图以 data/emoticons.json 台账为准（逐张留痕）；本轮未联网采集新增表情包，comfort 池第 3 张为库内官方剧照。'
    }
  };

  /* ------------------------------------------------------------------ */
  /* R5：外置表情包台账装填                                              */
  /* ------------------------------------------------------------------ */

  /** 台账文件（真源）；运行时可通过 loadEmoticons() 注入已解析对象 */
  var EMOTICON_DOC = 'E:\\Projects\\new project\\six-system-arena\\data\\emoticons.json';

  /** 允许的官方素材子目录（正向白名单校验，非黑名单匹配） */
  var ALLOWED_ASSET_DIRS = ['罗小黑', '比丢'];

  var emoticonState = {
    loaded: false,
    source: 'builtin',
    doc_version: null,
    comfort: ASSETS.luoxiaohei.comfort.slice()
  };

  /** 正向校验：路径须位于官方素材库白名单子目录内 */
  function isOfficialPath(p) {
    if (!p || typeof p !== 'string') return false;
    if (p.indexOf('罗小黑战记数据库\\images\\') === -1) return false;
    for (var i = 0; i < ALLOWED_ASSET_DIRS.length; i++) {
      if (p.indexOf('\\' + ALLOWED_ASSET_DIRS[i] + '\\') !== -1) return true;
    }
    return false;
  }

  /**
   * 装填外置表情包台账（R5）。
   * @param {object|string} doc emoticons.json 对象或 JSON 原文
   * @returns {object} 装填摘要 { loaded, source, accepted, rejected, rejected_ids }
   */
  function loadEmoticons(doc) {
    if (typeof doc === 'string') doc = JSON.parse(doc);
    if (!doc || !doc.pool || !Array.isArray(doc.pool.comfort)) {
      throw new Error('emoticons 台账缺少 pool.comfort 段');
    }
    var accepted = [];
    var rejected = [];
    doc.pool.comfort.forEach(function (it) {
      var p = it && it.path;
      if (isOfficialPath(p)) accepted.push(p);
      else rejected.push((it && it.id) ? it.id : String(p));
    });
    if (accepted.length) {
      emoticonState.loaded = true;
      emoticonState.source = 'ledger';
      emoticonState.doc_version = doc.version || null;
      emoticonState.comfort = accepted;
    } else {
      emoticonState.loaded = false;
      emoticonState.source = 'builtin-fallback';
      emoticonState.comfort = ASSETS.luoxiaohei.comfort.slice();
    }
    return {
      loaded: emoticonState.loaded,
      source: emoticonState.source,
      accepted: accepted.length,
      rejected: rejected.length,
      rejected_ids: rejected
    };
  }

  /** 只读快照：当前运行时表情池状态 */
  function getEmoticonState() {
    return {
      loaded: emoticonState.loaded,
      source: emoticonState.source,
      doc_version: emoticonState.doc_version,
      doc: EMOTICON_DOC,
      comfort: emoticonState.comfort.slice()
    };
  }

  /* ------------------------------------------------------------------ */
  /* 时间轴                                                              */
  /* ------------------------------------------------------------------ */

  /** 胜利结算时间轴（docs/04 §2），总时长 3000ms */
  var WIN_DURATION = 3000;
  var WIN_TIMELINE = [
    { at: 0.0, key: 'freeze', desc: '战斗定格 + 六系图标高亮（胜方主属性）', asset: ASSETS.icons },
    { at: 0.5, key: 'bidiu_enter', desc: '比丢从侧边跑入，绕场一周', asset: ASSETS.bidiu.entrance },
    { at: 1.5, key: 'luoxiaohei_enter', desc: '罗小黑跃入中央，与比丢并排', asset: ASSETS.luoxiaohei.entrance },
    { at: 2.0, key: 'feedback', desc: '弹出正向反馈文案', asset: null },
    { at: 2.4, key: 'codex_intake', desc: '新收集品入账动画', asset: null }
  ];

  /** 失败结算时间轴（docs/04 §3），总时长 1800ms */
  var LOSE_DURATION = 1800;
  var LOSE_TIMELINE = [
    { at: 0.0, key: 'freeze_soft', desc: '战斗定格，画面转柔和', asset: null },
    { at: 0.4, key: 'comfort_sticker', desc: '展示小黑安慰表情图（官方表情图，随机 1 张）', asset: null },
    { at: 1.2, key: 'comfort_text', desc: '安慰文案 + 一键「再来一次」按钮', asset: null }
  ];

  /** 平局结算时间轴（R5 新增），总时长 1800ms；零惩罚原则同败局 */
  var DRAW_DURATION = 1800;
  var DRAW_TIMELINE = [
    { at: 0.0, key: 'freeze_soft', desc: '战斗定格，画面转柔和', asset: null },
    { at: 0.4, key: 'comfort_sticker', desc: '展示小黑平静表情图（官方表情图，随机 1 张）', asset: null },
    { at: 1.2, key: 'draw_text', desc: '平局文案 + 一键「再来一次」按钮', asset: null }
  ];

  /* ------------------------------------------------------------------ */
  /* 文案池（docs/04 §2 / §3，逐字对齐文档）                             */
  /* ------------------------------------------------------------------ */

  var WIN_LINES = {
    common: [
      '小黑比了个大拇指，比丢已经开心地转圈了。',
      '赢啦！小黑尾巴翘得老高，比丢的果子都忘了吃。',
      '这一场稳了。小黑把战绩记在了小本子的第一页。'
    ],
    first_defeat: [
      '第一次赢下「{name}」，小黑把这一战画进了自己的小本子。'
    ],
    challenge: [
      '越级挑战成功！比丢愣了三秒，然后跳得比谁都高。',
      '越档取胜，小黑难得地睁大了眼睛。'
    ],
    streak: [
      '三连胜。小黑假装淡定，尾巴藏不住。',
      '{streak} 连胜。比丢已经绕着场子跑第三圈了。'
    ],
    mirror: [
      '镜像战打赢了自己。小黑对着镜子里的自己点了点头。',
      '赢过自己的分身，小黑陷入了短暂的哲学思考。'
    ]
  };

  var LOSE_LINES = [
    '小黑拍拍你的头：我们再想个办法。',
    '比丢把好不容易藏起来的果子分了你一个。',
    '输了也没关系，妖灵会馆从不记这一笔。',
    '小黑把爪子搭在你肩上：下把我陪你一起上。'
  ];

  /** 平局文案（R5 新增，语气与败局区分：不劝慰、只是把这一场放下） */
  var DRAW_LINES = [
    '平局。小黑歪着头看了看场子，觉得这一场不算输。',
    '谁也没赢。比丢把果子又收回了口袋里。',
    '打平了。小黑原地坐下，尾巴慢慢晃了两下。'
  ];

  /* ------------------------------------------------------------------ */
  /* 工具                                                               */
  /* ------------------------------------------------------------------ */

  function hashSeed(str) {
    var h = 2166136261 >>> 0;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /** 确定性抽取：同种子同池子必同结果；exclude 用于避免连续重复 */
  function pickLine(pool, seed, exclude) {
    if (!pool || !pool.length) return null;
    var i = hashSeed(seed) % pool.length;
    if (exclude && pool.length > 1 && pool[i] === exclude) i = (i + 1) % pool.length;
    return pool[i];
  }

  function fill(tpl, ctx) {
    return String(tpl).replace(/\{(\w+)\}/g, function (m, k) {
      return (ctx && ctx[k] !== undefined && ctx[k] !== null) ? ctx[k] : m;
    });
  }

  /* ------------------------------------------------------------------ */
  /* 主体                                                               */
  /* ------------------------------------------------------------------ */

  /**
   * 生成一次结算演出描述。
   * @param {object} ctx
   *   ctx.result            'win' | 'lose' | 'draw'
   *   ctx.mode              story | arena | challenge | mirror
   *   ctx.opponent_type     official | mirror
   *   ctx.opponent_id       对手 id
   *   ctx.opponent_name     对手名（用于「第一次赢下『X』」）
   *   ctx.first_time_defeat 是否首次击败该对手（由 achievement-system.judge 回传）
   *   ctx.win_streak        当前连胜数（≥3 触发达成文案）
   *   ctx.seed              随机种子（决定文案与表情图）
   *   ctx.newly_unlocked    本场解锁的成就数组
   *   ctx.last_line         上一场用过的文案（避免连续重复）
   *   ctx.winner_element    胜方主属性 key（六系图标高亮）
   */
  function resolve(ctx) {
    ctx = ctx || {};
    var result = ctx.result || 'lose';
    var seed = ctx.seed === undefined || ctx.seed === null ? 1 : ctx.seed;

    if (result === 'win') {
      return buildWin(ctx, seed);
    }
    if (result === 'draw') {
      return buildDraw(ctx, seed);
    }
    // lose 走安抚流程（不惩罚）
    return buildLose(ctx, seed);
  }

  function buildWin(ctx, seed) {
    var line, category;
    if (ctx.opponent_type === 'mirror') {
      line = pickLine(WIN_LINES.mirror, seed + ':mirror', ctx.last_line);
      category = 'mirror';
    } else if (ctx.first_time_defeat) {
      line = fill(pickLine(WIN_LINES.first_defeat, seed + ':first'), {
        name: ctx.opponent_name || ('#' + ctx.opponent_id)
      });
      category = 'first_defeat';
    } else if (ctx.mode === 'challenge') {
      line = pickLine(WIN_LINES.challenge, seed + ':challenge', ctx.last_line);
      category = 'challenge';
    } else if ((ctx.win_streak || 0) >= 3) {
      line = fill(pickLine(WIN_LINES.streak, seed + ':streak', ctx.last_line), {
        streak: ctx.win_streak
      });
      category = 'streak';
    } else {
      line = pickLine(WIN_LINES.common, seed + ':common', ctx.last_line);
      category = 'common';
    }

    var timeline = WIN_TIMELINE.map(function (t) {
      return { at_ms: Math.round(t.at * 1000), key: t.key, desc: t.desc, asset: t.asset };
    });

    return {
      version: VERSION,
      result: 'win',
      duration_ms: WIN_DURATION,
      timeline: timeline,
      line: { text: line, category: category },
      feedback: {
        positive: true,
        cast: ['罗小黑', '比丢'],
        winner_element: ctx.winner_element || null,
        icons_ref: ASSETS.icons
      },
      assets: {
        luoxiaohei_entrance: ASSETS.luoxiaohei.entrance,
        bidiu_entrance: ASSETS.bidiu.entrance,
        icons: ASSETS.icons
      },
      achievement: {
        show_after_ms: WIN_DURATION,
        unlocked: ctx.newly_unlocked || [],
        play_order: 'cast_first_then_achievement'
      },
      retry: { enabled: true, label: '再来一次', action: 'retry_battle' },
      penalty: false,
      provenance: ASSET_PROVENANCE
    };
  }

  function buildLose(ctx, seed) {
    var line = pickLine(LOSE_LINES, seed + ':lose', ctx.last_line);
    var sticker = pickSticker(seed);
    var timeline = LOSE_TIMELINE.map(function (t) {
      return {
        at_ms: Math.round(t.at * 1000),
        key: t.key,
        desc: t.desc,
        asset: t.key === 'comfort_sticker' ? sticker : t.asset
      };
    });
    return {
      version: VERSION,
      result: 'lose',
      duration_ms: LOSE_DURATION,
      timeline: timeline,
      line: { text: line, category: 'comfort' },
      feedback: { positive: false, cast: ['罗小黑'], sticker: sticker },
      assets: {
        comfort_sticker: sticker,
        comfort_pool: emoticonState.comfort.slice(),
        icons: ASSETS.icons
      },
      achievement: { show_after_ms: null, unlocked: [], play_order: 'none_per_doc' },
      retry: { enabled: true, label: '再来一次', action: 'retry_battle' },
      penalty: false,
      no_penalty_detail: {
        deduct_resource: false,
        deduct_progress: false,
        deduct_codex: false,
        judge_achievement: false
      },
      provenance: ASSET_PROVENANCE
    };
  }

  /** 平局结算（R5）：结构对齐败局，便于接入层复用；文案与情绪独立成轨 */
  function buildDraw(ctx, seed) {
    var line = pickLine(DRAW_LINES, seed + ':draw', ctx.last_line);
    var sticker = pickSticker(seed);
    var timeline = DRAW_TIMELINE.map(function (t) {
      return {
        at_ms: Math.round(t.at * 1000),
        key: t.key,
        desc: t.desc,
        asset: t.key === 'comfort_sticker' ? sticker : t.asset
      };
    });
    return {
      version: VERSION,
      result: 'draw',
      duration_ms: DRAW_DURATION,
      timeline: timeline,
      line: { text: line, category: 'draw' },
      feedback: { positive: false, cast: ['罗小黑'], sticker: sticker },
      assets: {
        comfort_sticker: sticker,
        comfort_pool: emoticonState.comfort.slice(),
        icons: ASSETS.icons
      },
      achievement: { show_after_ms: null, unlocked: [], play_order: 'none_per_doc' },
      retry: { enabled: true, label: '再来一次', action: 'retry_battle' },
      penalty: false,
      no_penalty_detail: {
        deduct_resource: false,
        deduct_progress: false,
        deduct_codex: false,
        judge_achievement: false
      },
      provenance: ASSET_PROVENANCE
    };
  }

  /** 安慰 / 平局表情图：确定性随机 1 张官方表情图（池由 emoticons 台账决定） */
  function pickSticker(seed) {
    var pool = emoticonState.comfort;
    return pool[hashSeed('sticker:' + seed) % pool.length];
  }

  /** 供 UI 直接取用的文案池（只读副本） */
  function lines() {
    return {
      win: JSON.parse(JSON.stringify(WIN_LINES)),
      lose: LOSE_LINES.slice(),
      draw: DRAW_LINES.slice()
    };
  }

  return {
    VERSION: VERSION,
    ASSETS: ASSETS,
    ASSET_PROVENANCE: ASSET_PROVENANCE,
    EMOTICON_DOC: EMOTICON_DOC,
    WIN_TIMELINE: WIN_TIMELINE,
    LOSE_TIMELINE: LOSE_TIMELINE,
    DRAW_TIMELINE: DRAW_TIMELINE,
    WIN_DURATION: WIN_DURATION,
    LOSE_DURATION: LOSE_DURATION,
    DRAW_DURATION: DRAW_DURATION,
    WIN_LINES: WIN_LINES,
    LOSE_LINES: LOSE_LINES,
    DRAW_LINES: DRAW_LINES,
    loadEmoticons: loadEmoticons,
    getEmoticonState: getEmoticonState,
    isOfficialPath: isOfficialPath,
    resolve: resolve,
    buildDraw: buildDraw,
    pickLine: pickLine,
    pickSticker: pickSticker,
    lines: lines,
    hashSeed: hashSeed
  };
});
