#!/usr/bin/env node
/**
 * derive-all-stats.mjs —— 从 worldview_luoxiaohei_v4.db 【只读】派生
 * 「全量角色 × 六大系数值 + 技能标签」→ data/character-stats.json
 *
 * 与 tools/derive-from-db.mjs 的关系
 *   derive-from-db.mjs  : 24 名样例角色 → src/data/characters.json（首批样例，v1.1 模型）
 *   derive-all-stats.mjs: **全部 488 行角色** → data/character-stats.json（本文件，v2.0 模型）
 *   两者共用同一套打分内核（base/存在/复现/具名/分支/叙事 六项），因此 24 名样例
 *   的分数在 v2.0 下与 v1.1 保持可比。
 *
 * 安全约定（不可协商）：
 *   1) 数据库以 readOnly 模式打开（node:sqlite DatabaseSync { readOnly: true }），
 *      全流程只执行 SELECT，绝不写入、绝不 ALTER、绝不创建表。
 *   2) 输出只落在本工程 data/ 目录下，属可回滚派生结果；世界观事实源始终是 .db。
 *   3) 每条分值都附带 evidence（命中关键词 / 来源字段 / 标签原文），可追溯可推翻。
 *
 * 口径锁定（不可协商）：
 *   六大系 id 与中文名对齐 D:\Projects\shared-types\world.js 的 ABILITY_SYSTEMS
 *   （yuling 御灵 / shengling 生灵 / zaowu 造物 / kongjian 空间 / xinling 心灵 / suoyu 锁御），
 *   词汇表本身来自本工程 src/world/six-systems.js（运行时 import，单一事实源，不复制字典）。
 *   脚本启动时对键集合做断言，一旦两侧漂移立即报错退出。
 *
 * 用法：
 *   node tools/derive-all-stats.mjs           # 重新生成 data/character-stats.json
 *   node tools/derive-all-stats.mjs --check    # 只校验现有 json 是否与重新派生结果一致
 */

import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

// 六大系词汇表：单一事实源
import { SIX_SYSTEMS, SIX_SYSTEM_IDS } from '../src/world/six-systems.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const OUT_DIR = join(PROJECT_ROOT, 'data');
const OUT_PATH = join(OUT_DIR, 'character-stats.json');

/** 世界观事实源（只读） */
const DB_PATH = 'D:\\Projects\\罗小黑战记数据库\\db\\worldview_luoxiaohei_v4.db';

const SCHEMA_VERSION = 1;
const ALGORITHM_VERSION = 'derive-full-v2.0.0';

/* ------------------------------------------------------------------ *
 * 口径锁定断言
 * ------------------------------------------------------------------ */
/** D:\Projects\shared-types\world.js → ABILITY_SYSTEMS 的键（顺序照抄，便于人眼比对） */
const LOCKED_ABILITY_SYSTEM_KEYS = Object.freeze(['yuling', 'shengling', 'zaowu', 'kongjian', 'xinling', 'suoyu']);
/** D:\Projects\shared-types\world.js → ELEMENTS */
const LOCKED_ELEMENTS = Object.freeze({ jin: '金', mu: '木', shui: '水', huo: '火', tu: '土' });
/** 任务口径的展示顺序（与 src/world/six-systems.js 的 SIX_SYSTEM_IDS 一致） */
const DISPLAY_ORDER = Object.freeze([...SIX_SYSTEM_IDS]);
/** 雷达图轴序（对齐 shared-ui/lxh-ui.js radar6 默认轴序） */
const RADAR_AXIS_ORDER = Object.freeze(['yuling', 'xinling', 'kongjian', 'suoyu', 'zaowu', 'shengling']);

(function assertScopeLock() {
  const local = new Set(Object.keys(SIX_SYSTEMS));
  const locked = new Set(LOCKED_ABILITY_SYSTEM_KEYS);
  for (const k of locked) {
    if (!local.has(k)) throw new Error(`口径漂移：shared-types 声明的系「${k}」在 src/world/six-systems.js 中缺失`);
  }
  if (local.size !== locked.size) {
    throw new Error(`口径漂移：本地六系数量 ${local.size} ≠ shared-types ${locked.size}`);
  }
  if (DISPLAY_ORDER.length !== 6 || DISPLAY_ORDER.some((id) => !locked.has(id))) {
    throw new Error('口径漂移：展示顺序与锁定的六大系 id 不一致');
  }
})();

/** 系 id → 中文短名（去掉「系」字，用于正则与展示） */
const SYSTEM_LABEL = Object.freeze(
  Object.fromEntries(Object.keys(SIX_SYSTEMS).map((id) => [id, SIX_SYSTEMS[id].name.replace(/系$/, '')])),
);

/* ------------------------------------------------------------------ *
 * 打分模型（v2.0 = v1.1 内核，扩展到全量）
 *
 *   raw = base + 存在分 + 复现分 + 具名分 + 分支分 + 叙事分
 *   - base       6..20     确定性个体差异（FNV-1a(name#sysId) → 同输入同输出）
 *   - 存在分      +30      文本中出现「X系」或「X」
 *   - 复现分      +5/次   封顶 +10（第 2 次起，防重复条目刷分）
 *   - 具名分      +8/次   封顶 +24（形如「空间系·传送」的具名分支，最强信号）
 *   - 分支分      +5/个   封顶 +20（分支关键词命中）
 *   - 叙事分      +5/个   封顶 +15（最强 / 五五开 / 不战而降 等实力叙述）
 *   空间系为 innate（无法后天习得）：无任何文本证据时强制归零。
 * ------------------------------------------------------------------ */
const LIMITS = Object.freeze({
  baseMin: 6,
  baseSpan: 14,
  presence: 30,
  repeatEach: 5,
  repeatCap: 10,
  namedEach: 8,
  namedCap: 24,
  branchEach: 5,
  branchCap: 20,
  narrativeEach: 5,
  narrativeCap: 15,
});

/** 分支关键词：只保留多字、有指向性的词，避免单字误命中 */
const SYSTEM_BRANCH_KEYWORDS = Object.freeze({
  yuling: ['操纵金属', '金属', '控火', '御火', '控冰', '火焰', '五行', '植物', '藤蔓', '雷电'],
  suoyu: ['法宝', '法器', '灵器', '阵法', '封印', '制灵', '灵御', '定心镜', '蓝玉盘', '天明珠', '炼器', '乾坤圈', '混天绫', '风火轮'],
  zaowu: ['造物', '重构', '无中生有', '改变性质', '改变样貌', '重塑', '物质灵'],
  xinling: ['读心', '傀儡', '传音', '戏梦', '摄心', '精神力', '念控', '催眠', '幻术', '心誓'],
  shengling: ['洞察', '观灵', '豪夺', '隐匿', '治愈', '追毫', '追踪', '生命链接', '强化', '巨力', '迅身', '寻踪', '聆听', '感知', '薄音'],
  kongjian: ['灵质空间', '吞噬', '传送', '转移', '蕴藏', '领域', '时滞', '瞬移', '穿墙', '黑咻', '双空间系'],
});

/** 实力叙述词（整体基线加成，证据来自原文） */
const NARRATIVE_POWER_WORDS = Object.freeze(['最强', '五五开', '不战而降', '无敌', '封神', '传说级', '第一', '妖尊', '城主', '会长', '上古']);

/** 五行判定关键词（多字优先） */
const ELEMENT_KEYWORDS = Object.freeze({
  jin: ['金属', '金系', '御灵系·金', '御灵系-金', '钢', '刀剑'],
  mu: ['木系', '御灵系·木', '御灵系-木', '藤蔓', '植物', '森林'],
  shui: ['水系', '御灵系·水', '御灵系-水', '冰', '寒', '雪'],
  huo: ['火系', '御灵系·火', '御灵系-火', '火焰', '炎', '燃'],
  tu: ['土系', '御灵系·土', '御灵系-土', '岩石', '大地', '沙'],
});
const ELEMENT_ORDER = Object.freeze(['jin', 'mu', 'shui', 'huo', 'tu']);

/** 境界标记（DB 无「角色→境界」字段，只能由物种 / 神格推断，多为 unknown） */
const TRIBULATION_MARKERS = Object.freeze(['上古神兽', '龙之九子', '北域神明', '妖尊', '上古神明']);
const DEITY_MARKERS = Object.freeze(['神兽', '神明', '上古']);

/** 打分所采纳的文本字段（与 v1.1 一致，保证分数可比） */
const SCORE_TEXT_FIELDS = Object.freeze(['abilities_summary', 'notes', 'story_summary', 'species', 'residence']);

/* ------------------------------------------------------------------ *
 * 工具函数
 * ------------------------------------------------------------------ */

/** FNV-1a 32bit → [0,1)：确定性个体差异来源 */
function hash01(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 4294967296;
}

function countOccur(text, needle) {
  if (!text || !needle) return 0;
  let c = 0;
  let i = 0;
  for (;;) {
    const p = text.indexOf(needle, i);
    if (p === -1) break;
    c += 1;
    i = p + needle.length;
  }
  return c;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uniq = (arr) => [...new Set(arr)];
const truncate = (s, n) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** 官方分支名去掉括注：「金（攻击）」→「金」 */
const OFFICIAL_BRANCHES = Object.freeze(
  Object.fromEntries(
    Object.keys(SIX_SYSTEMS).map((id) => [id, new Set((SIX_SYSTEMS[id].branches || []).map((b) => b.replace(/（.*?）/g, '').trim()))]),
  ),
);

/* ------------------------------------------------------------------ *
 * 读取与打分
 * ------------------------------------------------------------------ */

function openReadOnly() {
  if (!existsSync(DB_PATH)) throw new Error(`世界观数据库不存在：${DB_PATH}`);
  // 关键：readOnly = true，从驱动层杜绝任何写操作
  return new DatabaseSync(DB_PATH, { readOnly: true });
}

/** 打分语料：字段名 + 文本 */
function collectScoreText(char, abilityRows, extRows) {
  const parts = [];
  for (const f of SCORE_TEXT_FIELDS) {
    if (char[f]) parts.push({ from: `characters.${f}`, text: String(char[f]) });
  }
  for (const r of abilityRows) if (r.ability) parts.push({ from: 'character_abilities', text: r.ability });
  for (const r of extRows) {
    if (r.ability) parts.push({ from: 'character_abilities_ext', text: r.ability });
    if (r.description) parts.push({ from: 'character_abilities_ext', text: r.description });
  }
  return parts;
}

/** 清洗分支名：「金（跟无限学的）」→「金」，「领域：外放…」→「领域」 */
function cleanBranch(s) {
  return String(s)
    .replace(/[（(].*$/g, '')
    .replace(/[：:·].*$/g, '')
    .replace(/[【\[].*$/g, '')
    .replace(/[，,。；;、\s]+$/g, '')
    .trim()
    .slice(0, 12);
}

/**
 * 从能力条目中抽取技能标签。
 * 三类：
 *   - 具名标签：`御灵系·金` / `空间系-时滞` / `生灵系–念控` → system + branch
 *   - 泛系标签：`心灵系` / `御灵系全系（金木水火土）` → system + branch=null
 *   - 双系标签：`双系技能·灵誓（心灵系+生灵系）` → dual
 *   - 未归属标签：`尾巴分裂：尾巴可分裂成有独立意识的黑咻` → 无任何「X系」关键词的能力名
 */
function extractSkillTags(abilityRows, extRows) {
  const sourceOf = (r) => (r.table === 'character_abilities' ? 'character_abilities' : 'character_abilities_ext');
  const items = [
    ...abilityRows.map((r) => ({ ability: r.ability, description: null, table: 'character_abilities' })),
    ...extRows.map((r) => ({ ability: r.ability, description: r.description, table: 'character_abilities_ext' })),
  ].filter((it) => it.ability);

  /** system|branch|source → 标签（同一标签的 ·/-/– 不同写法合并进 rawVariants） */
  const tagMap = new Map();
  const addTag = (tag) => {
    const key = `${tag.system}|${tag.branch ?? ''}|${tag.source}`;
    const hit = tagMap.get(key);
    if (hit) {
      if (!hit.rawVariants.includes(tag.raw)) hit.rawVariants.push(tag.raw);
      return;
    }
    tagMap.set(key, { ...tag, rawVariants: [tag.raw] });
  };
  const looseSkills = [];
  const dualTags = [];
  const unknownBranches = [];

  for (const it of items) {
    const text = String(it.ability);
    let matchedAny = false;

    // 双系合技：`双系技能·灵誓（心灵系+生灵系）`
    if (/双系/.test(text)) {
      const systemsInText = Object.keys(SIX_SYSTEMS).filter((id) => text.includes(`${SYSTEM_LABEL[id]}系`));
      const nameM = text.match(/双系[·\-–—]?\s*([\u4e00-\u9fa5]{1,8})/);
      dualTags.push({
        name: nameM ? nameM[1] : truncate(text, 12),
        systems: systemsInText,
        raw: truncate(text, 40),
        source: sourceOf(it),
      });
      matchedAny = true;
    }

    for (const id of DISPLAY_ORDER) {
      const label = SYSTEM_LABEL[id];
      const namedRe = new RegExp(`${label}系\\s*[·\\-–—]\\s*([\\u4e00-\\u9fa5]{1,8})`, 'g');
      const named = [...text.matchAll(namedRe)];
      if (named.length) {
        for (const m of named) {
          const branch = cleanBranch(m[1]);
          // 「金木水火土」这类五行并列写法 → 拆成多个分支标签
          const branches = /^[金木水火土]{2,5}$/.test(branch) ? [...branch] : [branch];
          for (const b of branches) {
            const known = OFFICIAL_BRANCHES[id].has(b);
            if (!known) unknownBranches.push(`${label}系·${b}`);
            addTag({
              system: id,
              branch: b || null,
              branchKnown: known,
              named: true,
              raw: truncate(m[0], 40),
              source: sourceOf(it),
            });
          }
        }
        matchedAny = true;
      } else if (text.includes(`${label}系`)) {
        addTag({
          system: id,
          branch: null,
          branchKnown: null,
          named: false,
          raw: `${label}系`,
          source: sourceOf(it),
        });
        matchedAny = true;
      }
    }

    if (!matchedAny) {
      const head = String(it.ability).split(/[：:]/)[0].replace(/[（(].*$/g, '').trim();
      if (head && !looseSkills.some((s) => s.name === truncate(head, 24))) {
        looseSkills.push({ name: truncate(head, 24), source: sourceOf(it) });
      }
    }
  }

  return {
    systemTags: [...tagMap.values()].map((t) => ({ ...t, raw: t.rawVariants[0] })),
    dualTags: uniq(dualTags.map((t) => JSON.stringify(t))).map((s) => JSON.parse(s)),
    looseSkills,
    unknownBranches: uniq(unknownBranches),
  };
}

function scoreCharacter(char, abilityRows, extRows) {
  const parts = collectScoreText(char, abilityRows, extRows);
  const joined = parts.map((p) => p.text).join(' | ');
  const L = LIMITS;

  const narrativeHits = NARRATIVE_POWER_WORDS.filter((w) => joined.includes(w));
  const narrativeBonus = Math.min(L.narrativeCap, narrativeHits.length * L.narrativeEach);

  const systems = {};
  const matchedKeywords = {};
  const innateZeroed = [];
  let explicitTotal = 0;

  for (const sysId of DISPLAY_ORDER) {
    const label = SYSTEM_LABEL[sysId];
    const explicitHits = countOccur(joined, `${label}系`);
    const looseHits = Math.max(0, countOccur(joined, label) - explicitHits);
    const mentionHits = explicitHits + looseHits;

    const namedRe = new RegExp(`${label}系\\s*[·\\-–—]\\s*[\\u4e00-\\u9fa5]{1,6}`, 'g');
    const namedHits = (joined.match(namedRe) || []).length;

    const branchHits = (SYSTEM_BRANCH_KEYWORDS[sysId] || []).filter((kw) => joined.includes(kw));

    const base = L.baseMin + hash01(`${char.name}#${sysId}`) * L.baseSpan;
    const raw =
      base +
      (mentionHits > 0 ? L.presence : 0) +
      Math.min(L.repeatCap, Math.max(0, mentionHits - 1) * L.repeatEach) +
      Math.min(L.namedCap, namedHits * L.namedEach) +
      Math.min(L.branchCap, branchHits.length * L.branchEach) +
      narrativeBonus;

    let score = clamp(Math.round(raw), 0, 100);

    // 世界观硬规则：空间系无法后天习得 → 无文本证据一律归零
    if (sysId === 'kongjian' && mentionHits === 0 && namedHits === 0 && branchHits.length === 0) {
      score = 0;
      innateZeroed.push(sysId);
    }

    systems[sysId] = score;
    explicitTotal += explicitHits;
    matchedKeywords[sysId] = {
      explicitMentions: explicitHits,
      looseMentions: looseHits,
      namedMentions: namedHits,
      branchKeywords: branchHits,
    };
  }

  // 五行属性
  const elementHits = {};
  for (const el of ELEMENT_ORDER) {
    elementHits[el] = (ELEMENT_KEYWORDS[el] || []).reduce((s, kw) => s + countOccur(joined, kw), 0);
  }
  let element = 'none';
  let best = 0;
  for (const el of ELEMENT_ORDER) {
    if (elementHits[el] > best) {
      best = elementHits[el];
      element = el;
    }
  }

  const realm = inferRealm(char, joined, explicitTotal);

  const snippets = parts
    .filter((p) => p.from.startsWith('character_abilities'))
    .slice(0, 3)
    .map((p) => ({ from: p.from, text: truncate(p.text, 60) }));

  return {
    systems,
    element,
    realm,
    evidence: {
      sourceTables: ['characters', 'character_abilities', 'character_abilities_ext'],
      textSources: uniq(parts.map((p) => p.from)),
      textLength: joined.length,
      matchedKeywords,
      abilitySnippets: snippets,
      innateZeroed,
      narrativeHits,
      narrativeBonus,
      elementHits,
      inferred: snippets.length === 0,
    },
  };
}

function inferRealm(char, joined, explicitTotal) {
  const species = char.species || '';
  const isHuman = char.category === '人类';
  if (TRIBULATION_MARKERS.some((k) => species.includes(k))) return 'tribulation';
  if (char.deity === '神' || char.deity === '仙') {
    if (!isHuman && TRIBULATION_MARKERS.some((k) => joined.includes(k))) return 'tribulation';
    return 'deity';
  }
  if (species.includes('成仙')) return 'deity';
  if (!isHuman && DEITY_MARKERS.some((k) => species.includes(k) || joined.includes(k))) return 'deity';
  if (isHuman && !/御灵系|锁御系|造物系|心灵系|生灵系|空间系/.test(joined)) return 'mortal';
  return 'unknown';
}

/** 评级计算：与 src/world/rating.js 同一算法（内联以避免构建期依赖） */
function computeRating(systems, realm) {
  const list = DISPLAY_ORDER.map((id) => ({ id, score: clamp(Math.round(systems[id] || 0), 0, 100) }));
  const total = list.reduce((s, x) => s + x.score, 0);
  const average = total / list.length;
  const sorted = [...list].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const stdev = Math.sqrt(list.reduce((s, x) => s + (x.score - average) ** 2, 0) / list.length);
  const composite = sorted[0].score * 0.5 + average * 0.3 + sorted[1].score * 0.2;
  const REALM_ORDER = { mortal: 0, qi: 1, foundation: 2, golden: 3, nascent: 4, deity: 5, tribulation: 6 };
  const realmBonus = (REALM_ORDER[realm] || 0) * 2;
  const GRADES = [
    ['S', '绝品', 85],
    ['A', '上品', 70],
    ['B', '良品', 55],
    ['C', '中品', 38],
    ['D', '下品', 20],
    ['E', '微末', 0],
  ];
  const g = GRADES.find((x) => composite >= x[2]) || GRADES[GRADES.length - 1];
  return {
    total,
    average: Math.round(average * 10) / 10,
    peak: sorted[0].score,
    peakSystem: sorted[0].id,
    secondary: sorted[1].score,
    secondarySystem: sorted[1].id,
    stdev: Math.round(stdev * 10) / 10,
    balance: Math.round(Math.max(0, Math.min(1, 1 - stdev / 40)) * 100) / 100,
    focus: Math.round((sorted[0].score - average) * 10) / 10,
    composite: Math.round(composite * 10) / 10,
    power: Math.min(150, Math.round(composite + realmBonus)),
    realmBonus,
    grade: g[0],
    gradeName: g[1],
  };
}

/* ------------------------------------------------------------------ *
 * 统计
 * ------------------------------------------------------------------ */

function summarize(records) {
  const perSystem = {};
  for (const id of DISPLAY_ORDER) {
    const vals = records.map((r) => r.systems[id]);
    const sorted = [...vals].sort((a, b) => a - b);
    const nonzero = vals.filter((v) => v > 0);
    perSystem[id] = {
      name: SIX_SYSTEMS[id].name,
      innate: Boolean(SIX_SYSTEMS[id].innate),
      mean: Math.round((vals.reduce((s, v) => s + v, 0) / (vals.length || 1)) * 10) / 10,
      median: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
      max: sorted.length ? sorted[sorted.length - 1] : 0,
      min: sorted.length ? sorted[0] : 0,
      nonzeroCount: nonzero.length,
      gte60Count: vals.filter((v) => v >= 60).length,
      gte80Count: vals.filter((v) => v >= 80).length,
      tagCount: records.filter((r) => r.skillTags.some((t) => t.system === id)).length,
    };
  }
  const tagCounts = {};
  for (const id of DISPLAY_ORDER) tagCounts[SYSTEM_LABEL[id]] = records.filter((r) => r.skillTags.some((t) => t.system === id)).length;
  const elementCounts = { none: records.filter((r) => r.element === 'none').length };
  for (const el of ELEMENT_ORDER) elementCounts[el] = records.filter((r) => r.element === el).length;
  return { perSystem, tagCounts, elementCounts };
}

/* ------------------------------------------------------------------ *
 * 主流程
 * ------------------------------------------------------------------ */

function derive() {
  const db = openReadOnly();
  const dbStat = statSync(DB_PATH);
  const sha256 = createHash('sha256').update(readFileSync(DB_PATH)).digest('hex');

  try {
    const charRows = db.prepare('SELECT * FROM characters ORDER BY id ASC').all();
    const abRows = db.prepare('SELECT character_id, ability FROM character_abilities').all();
    const extRows = db.prepare('SELECT character_id, ability, description FROM character_abilities_ext').all();

    const byChar = new Map();
    const ensure = (id) => {
      if (!byChar.has(id)) byChar.set(id, { ab: [], ext: [] });
      return byChar.get(id);
    };
    for (const r of abRows) ensure(r.character_id).ab.push(r);
    for (const r of extRows) ensure(r.character_id).ext.push(r);

    const idToName = new Map(charRows.map((c) => [c.id, c.name]));
    const records = [];

    for (const char of charRows) {
      const bag = byChar.get(char.id) || { ab: [], ext: [] };
      const { systems, element, realm, evidence } = scoreCharacter(char, bag.ab, bag.ext);
      const tags = extractSkillTags(bag.ab, bag.ext);
      const rating = computeRating(systems, realm);

      const status = char.merged_to != null ? 'merged' : char.category === '非角色' ? 'non-character' : 'active';

      // 证据等级：tagged=有结构化技能标签 / textual=有系关键词命中 / baseline=仅有 base 项
      const hasMention = DISPLAY_ORDER.some((id) => {
        const m = evidence.matchedKeywords[id];
        return m.explicitMentions + m.looseMentions + m.namedMentions + m.branchKeywords.length > 0;
      });
      const confidence =
        tags.systemTags.length > 0 || tags.dualTags.length > 0 ? 'tagged' : hasMention ? 'textual' : 'baseline';

      records.push({
        schemaVersion: SCHEMA_VERSION,
        id: char.id,
        name: char.name,
        aliases: char.aliases || null,
        category: char.category ?? null,
        species: char.species ?? null,
        affiliation: char.affiliation ?? null,
        status,
        confidence,
        mergedInto:
          char.merged_to != null
            ? { id: char.merged_to, name: idToName.get(char.merged_to) ?? null }
            : null,
        element,
        realm,
        systems,
        skillTags: tags.systemTags.slice(0, 24),
        dualTags: tags.dualTags.slice(0, 8),
        looseSkills: tags.looseSkills.slice(0, 16),
        unknownBranches: tags.unknownBranches.slice(0, 8),
        rating,
        evidence,
        provisional: true,
      });
    }

    const active = records.filter((r) => r.status === 'active');
    const counts = {
      totalRows: records.length,
      active: active.length,
      merged: records.filter((r) => r.status === 'merged').length,
      nonCharacter: records.filter((r) => r.status === 'non-character').length,
      withSkillTags: records.filter((r) => r.skillTags.length > 0).length,
      withDualTags: records.filter((r) => r.dualTags.length > 0).length,
      withLooseSkills: records.filter((r) => r.looseSkills.length > 0).length,
      withAbilityEvidence: records.filter((r) => r.evidence.inferred === false).length,
      zeroAcrossAllSystems: records.filter((r) => DISPLAY_ORDER.every((id) => r.systems[id] === 0)).length,
      byConfidence: {
        tagged: records.filter((r) => r.confidence === 'tagged').length,
        textual: records.filter((r) => r.confidence === 'textual').length,
        baseline: records.filter((r) => r.confidence === 'baseline').length,
      },
    };

    const stats = summarize(active);
    const leaderboard = [...active]
      .sort((a, b) => b.rating.composite - a.rating.composite || a.id - b.id)
      .slice(0, 12)
      .map((r, i) => ({
        rank: i + 1,
        id: r.id,
        name: r.name,
        grade: r.rating.grade,
        composite: r.rating.composite,
        peakSystem: r.rating.peakSystem,
        peak: r.rating.peak,
      }));

    const out = {
      schemaVersion: SCHEMA_VERSION,
      algorithmVersion: ALGORITHM_VERSION,
      generatedAt: new Date().toISOString(),
      generatedBy: 'tools/derive-all-stats.mjs',
      source: {
        kind: 'worldview-db',
        path: DB_PATH,
        sizeBytes: dbStat.size,
        mtime: dbStat.mtime.toISOString(),
        sha256,
        accessMode: 'readOnly',
        tables: ['characters', 'character_abilities', 'character_abilities_ext'],
        authoritativeNote: '世界观事实源始终是 worldview_luoxiaohei_v4.db；本文件为只读派生结果，可随时重算覆盖。',
      },
      scopeLock: {
        abilitySystems: LOCKED_ABILITY_SYSTEM_KEYS.reduce((acc, k) => ({ ...acc, [k]: SIX_SYSTEMS[k].name }), {}),
        abilitySystemKeys: [...LOCKED_ABILITY_SYSTEM_KEYS],
        displayOrder: [...DISPLAY_ORDER],
        elements: LOCKED_ELEMENTS,
        alignedWith: ['D:\\Projects\\shared-types\\world.js#ABILITY_SYSTEMS', 'src/world/six-systems.js#SIX_SYSTEMS'],
        radarAxisOrder: [...RADAR_AXIS_ORDER],
      },
      derivationRules: {
        summary:
          '六大系数值 = 六项加分之和（base + 存在分 + 复现分 + 具名分 + 分支分 + 叙事分），裁剪到 0..100；' +
          '技能标签 = 从能力条目原文用「X系·分支」正则抽取的结构化标签。',
        inputs: {
          scoreTextFields: [...SCORE_TEXT_FIELDS],
          abilityTables: ['character_abilities.ability', 'character_abilities_ext.ability', 'character_abilities_ext.description'],
          tagExtractFields: ['character_abilities.ability', 'character_abilities_ext.ability'],
        },
        limits: { ...LIMITS },
        innateZeroRule: {
          systems: ['kongjian'],
          rule: '空间系无法后天习得：当「X系」提及、具名分支、分支关键词三项全部为 0 时，该系分数强制归零。',
        },
        determinism:
          'base 项由 FNV-1a(name#systemId) 生成，同输入必得同输出；同一 DB 快照下重复运行结果逐字节一致（可 --check 验证）。',
        elementRule: '五行取「五行关键词命中次数最多者」，全为 0 记 none；五行与六大系是两个独立坐标轴。',
        tagRule:
          '技能标签由能力条目原文抽取：「X系·分支」为具名标签、「X系」为泛系标签、「双系技能·xxx（A系+B系）」为双系合技；无「X系」字样的能力名进入 looseSkills。同一 (系, 分支, 来源表) 的不同分隔符写法（· / - / –）合并，原文保留在 rawVariants；「金木水火土」并列写法拆为 5 个分支标签。',
        realmRule:
          'DB 无「角色→境界」字段，境界由物种 category/species/deity 推断：tribulation(劫) > deity(神) > mortal(凡人) > unknown。',
        ratingRule: 'composite = peak*0.5 + average*0.3 + secondary*0.2；power = composite + 境界加成(每级 +2，上限 150)。',
        gradeThresholds: { S: 85, A: 70, B: 55, C: 38, D: 20, E: 0 },
        confidenceLevels: {
          tagged: '有能力条目结构化标签（「X系·分支」），数值最可信',
          textual: '无结构化标签，但在 abilities_summary/notes/story_summary/species/residence 中命中系名或分支关键词',
          baseline: '全库无任何系证据，六系分值仅由 base 项（6..20）构成，游戏层应视为「未觉醒/待考据」',
        },
        limitations: [
          '分值只反映「能力文本证据强度」，不等于剧情战力排名。',
          '角色条目的文本完整度极不均衡（大量角色仅有一句话介绍），低分不代表弱，只代表证据少。',
          'merged（merged_to 非空）为库内已合并的重复条目，本文件保留但标记 status=merged，不参与统计与排行。',
          '所有分值为 provisional=true，可随考据迭代覆盖。',
        ],
      },
      counts,
      stats,
      leaderboard,
      characters: records,
    };
    return out;
  } finally {
    db.close();
  }
}

/** 稳定序列化：键排序，便于 --check 幂等比对 */
function stableStringify(obj) {
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      return Object.keys(v)
        .sort()
        .reduce((acc, k) => {
          acc[k] = walk(v[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(walk(obj));
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const out = derive();

  if (check) {
    if (!existsSync(OUT_PATH)) {
      console.log('[check] data/character-stats.json 不存在');
      process.exit(1);
    }
    const stored = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
    const a = { ...stored, generatedAt: '' };
    const b = { ...out, generatedAt: '' };
    const same = stableStringify(a) === stableStringify(b);
    const sameSha = stored.source?.sha256 === out.source.sha256;
    console.log(`[check] 与重新派生结果一致: ${same}`);
    console.log(`[check] 数据源 sha256 一致: ${sameSha}`);
    console.log(`[check] 记录数: ${out.counts.totalRows}（有效 ${out.counts.active}）`);
    process.exit(same && sameSha ? 0 : 1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');

  const c = out.counts;
  console.log(`已写入 ${OUT_PATH}`);
  console.log(`算法 ${out.algorithmVersion} · DB sha256 ${out.source.sha256.slice(0, 12)}…`);
  console.log(
    `角色 ${c.totalRows} 行：有效 ${c.active} / 已合并 ${c.merged} / 非角色 ${c.nonCharacter}；有技能标签 ${c.withSkillTags}；有双系合技 ${c.withDualTags}；无能力条目 ${c.totalRows - c.withAbilityEvidence}`,
  );
  console.log(
    `证据等级：tagged ${c.byConfidence.tagged} / textual ${c.byConfidence.textual} / baseline ${c.byConfidence.baseline}（仅 base 项，游戏层按「待考据」处理）`,
  );
  console.log('\n各系分布（有效角色）：');
  for (const id of DISPLAY_ORDER) {
    const s = out.stats.perSystem[id];
    console.log(
      `  ${s.name.padEnd(4)} 均值 ${String(s.mean).padStart(5)}  中位 ${String(s.median).padStart(3)}  峰值 ${String(s.max).padStart(3)}  非零 ${String(s.nonzeroCount).padStart(3)} 人  ≥60 分 ${String(s.gte60Count).padStart(3)} 人  有标签 ${String(s.tagCount).padStart(3)} 人`,
    );
  }
  console.log('\n战力榜（前 12，有效角色）：');
  for (const r of out.leaderboard) {
    console.log(`  #${String(r.rank).padStart(2)} ${r.name.padEnd(10)} ${r.grade}  composite ${String(r.composite).padStart(5)}  峰值系 ${SYSTEM_LABEL[r.peakSystem]}(${r.peak})`);
  }
}

main();
