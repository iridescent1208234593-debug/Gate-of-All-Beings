#!/usr/bin/env node
/**
 * derive-from-db.mjs —— 从 worldview_luoxiaohei_v4.db 只读派生
 * 「角色 × 六大系」首批样例数值数据。
 *
 * 安全约定（不可协商）：
 *   1) 数据库以 readOnly 模式打开（node:sqlite DatabaseSync { readOnly: true }），
 *      全流程只执行 SELECT，**绝不写入、绝不 ALTER**。
 *   2) 输出只落在本工程 src/data/ 下，属可回滚派生结果。
 *   3) 每个角色的每条分数都带 evidence（命中关键词、片段、来源表），可追溯可推翻。
 *
 * 用法：
 *   node tools/derive-from-db.mjs            # 重新生成 src/data/*.json
 *   node tools/derive-from-db.mjs --check    # 只校验：现有 json 是否与重新派生结果一致
 *   node tools/derive-from-db.mjs --print    # 额外打印完整 JSON
 */

import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const DATA_DIR = join(PROJECT_ROOT, 'src', 'data');

/** 世界观事实源（只读） */
const DB_PATH = 'D:\\Projects\\罗小黑战记数据库\\db\\worldview_luoxiaohei_v4.db';

const ALGORITHM_VERSION = 'derive-v1.1.0';

/* ------------------------------------------------------------------ *
 * 首批样例角色（24 名）：id 为世界观库主键，name 仅作断言校验，
 * 防止库更新后 id 漂移导致错配。
 * ------------------------------------------------------------------ */
const SELECTION = [
  { id: 1, name: '罗小黑', group: '主线核心' },
  { id: 2, name: '无限', group: '主线核心' },
  { id: 3, name: '风息', group: '主线核心' },
  { id: 4, name: '老君', group: '主线核心' },
  { id: 5, name: '罗小白', group: '主线核心' },
  { id: 6, name: '阿根', group: '主线核心' },
  { id: 7, name: '谛听', group: '主线核心' },
  { id: 8, name: '鹿野', group: '主线核心' },
  { id: 18, name: '比丢', group: '主线核心' },
  { id: 19, name: '皇受', group: '主线核心' },
  { id: 11, name: '那伽', group: '会馆与神' },
  { id: 12, name: '玄离', group: '会馆与神' },
  { id: 14, name: '哪吒', group: '会馆与神' },
  { id: 141, name: '阎明', group: '会馆与神' },
  { id: 10, name: '山新', group: '社区群像' },
  { id: 15, name: '虚淮', group: '社区群像' },
  { id: 20, name: '鸠老', group: '社区群像' },
  { id: 23, name: '潘靖', group: '社区群像' },
  { id: 31, name: '花轮', group: '社区群像' },
  { id: 35, name: '画虎', group: '社区群像' },
  { id: 36, name: '泽宇', group: '社区群像' },
  { id: 37, name: '冠萱', group: '社区群像' },
  { id: 139, name: '羽夕', group: '社区群像' },
  { id: 9959, name: '李清凝', group: '社区群像' },
];

/* ------------------------------------------------------------------ *
 * 打分模型（v1.1）
 *
 * 设计目标：区分「有这一系」与「精于此系」，避免文本重复造成的分数虚高。
 *   raw = base + 存在分 + 复现分 + 具名分 + 分支分 + 叙事分
 *   - base       6..20     确定性个体差异（同输入同输出）
 *   - 存在分      +30      文本中出现「X系」或「X」
 *   - 复现分      +5/次   封顶 +10（第 2 次起，防止重复条目刷分）
 *   - 具名分      +8/次   封顶 +24（形如「空间系·传送」的具名分支，是最强信号）
 *   - 分支分      +5/个   封顶 +20（分支关键词命中）
 *   - 叙事分      +5/次   封顶 +15（最强/五五开/不战而降等实力叙述）
 * ------------------------------------------------------------------ */

const SYSTEM_LABEL = {
  yuling: '御灵',
  suoyu: '锁御',
  zaowu: '造物',
  xinling: '心灵',
  shengling: '生灵',
  kongjian: '空间',
};

/** 分支关键词：只保留「多字、有指向性」的词，避免单字误命中 */
const SYSTEM_BRANCH_KEYWORDS = {
  yuling: ['操纵金属', '金属', '控火', '御火', '控冰', '火焰', '五行', '植物', '藤蔓', '雷电'],
  suoyu: ['法宝', '法器', '灵器', '阵法', '封印', '制灵', '灵御', '定心镜', '蓝玉盘', '天明珠', '炼器', '乾坤圈', '混天绫', '风火轮'],
  zaowu: ['造物', '重构', '无中生有', '改变性质', '改变样貌', '重塑', '物质灵'],
  xinling: ['读心', '傀儡', '传音', '戏梦', '摄心', '精神力', '念控', '催眠', '幻术', '心誓'],
  shengling: ['洞察', '观灵', '豪夺', '隐匿', '治愈', '追毫', '追踪', '生命链接', '强化', '巨力', '迅身', '寻踪', '聆听', '感知', '薄音'],
  kongjian: ['灵质空间', '吞噬', '传送', '转移', '蕴藏', '领域', '时滞', '瞬移', '穿墙', '黑咻', '双空间系'],
};

/** 实力叙述词（整体基线加成，证据来自原文） */
const NARRATIVE_POWER_WORDS = ['最强', '五五开', '不战而降', '无敌', '封神', '传说级', '第一', '妖尊', '城主', '会长', '上古'];

/** 五行判定关键词（多字优先） */
const ELEMENT_KEYWORDS = {
  jin: ['金属', '金系', '御灵系·金', '御灵系-金', '钢', '刀剑'],
  mu: ['木系', '御灵系·木', '御灵系-木', '藤蔓', '植物', '森林'],
  shui: ['水系', '御灵系·水', '御灵系-水', '冰', '寒', '雪'],
  huo: ['火系', '御灵系·火', '御灵系-火', '火焰', '炎', '燃'],
  tu: ['土系', '御灵系·土', '御灵系-土', '岩石', '大地', '沙'],
};
const ELEMENT_ORDER = ['jin', 'mu', 'shui', 'huo', 'tu'];

/** 境界标记 */
const TRIBULATION_MARKERS = ['上古神兽', '龙之九子', '北域神明', '妖尊', '上古神明'];
const DEITY_MARKERS = ['神兽', '神明', '上古'];

const LIMITS = {
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
};

/* ------------------------------------------------------------------ *
 * 工具函数
 * ------------------------------------------------------------------ */

/** FNV-1a 32bit → [0,1)，用于生成「确定性个体差异」：同输入 → 同输出 */
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

/* ------------------------------------------------------------------ *
 * 读取与打分
 * ------------------------------------------------------------------ */

function openReadOnly() {
  if (!existsSync(DB_PATH)) throw new Error(`世界观数据库不存在：${DB_PATH}`);
  // 关键：readOnly = true，从驱动层杜绝任何写操作
  return new DatabaseSync(DB_PATH, { readOnly: true });
}

function collectText(char, abilityRows, extRows) {
  const parts = [];
  if (char.abilities_summary) parts.push({ from: 'abilities_summary', text: char.abilities_summary });
  if (char.notes) parts.push({ from: 'characters.notes', text: char.notes });
  if (char.story_summary) parts.push({ from: 'story_summary', text: char.story_summary });
  if (char.species) parts.push({ from: 'characters.species', text: char.species });
  if (char.residence) parts.push({ from: 'characters.residence', text: char.residence });
  for (const r of abilityRows) if (r.ability) parts.push({ from: 'character_abilities', text: r.ability });
  for (const r of extRows) {
    if (r.ability) parts.push({ from: 'character_abilities_ext', text: r.ability });
    if (r.description) parts.push({ from: 'character_abilities_ext', text: r.description });
  }
  return parts;
}

function scoreCharacter(char, abilityRows, extRows) {
  const parts = collectText(char, abilityRows, extRows);
  const joined = parts.map((p) => p.text).join(' | ');
  const L = LIMITS;

  const narrativeHits = NARRATIVE_POWER_WORDS.filter((w) => joined.includes(w));
  const narrativeBonus = Math.min(L.narrativeCap, narrativeHits.length * L.narrativeEach);

  const systems = {};
  const matchedKeywords = {};
  const innateZeroed = [];
  let explicitTotal = 0;

  for (const sysId of Object.keys(SYSTEM_LABEL)) {
    const label = SYSTEM_LABEL[sysId];
    const explicitHits = countOccur(joined, `${label}系`);
    const looseHits = Math.max(0, countOccur(joined, label) - explicitHits);
    const mentionHits = explicitHits + looseHits;

    const namedRe = new RegExp(`${label}系\\s*[·\\-–—]\\s*[\\u4e00-\\u9fa5]{1,6}`, 'g');
    const namedHits = (joined.match(namedRe) || []).length;

    const branchHits = (SYSTEM_BRANCH_KEYWORDS[sysId] || []).filter((kw) => joined.includes(kw));

    const base = L.baseMin + hash01(`${char.name}#${sysId}`) * L.baseSpan;
    let raw =
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
      explicitHits,
      looseHits,
      namedHits,
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

  return {
    systems,
    element,
    realm,
    evidence: {
      source: 'worldview_luoxiaohei_v4.db',
      sourceTables: ['characters', 'character_abilities', 'character_abilities_ext'],
      abilitySnippets: parts.slice(0, 6).map((p) => ({ from: p.from, text: p.text })),
      matchedKeywords,
      innateZeroed,
      narrativeHits,
      narrativeBonus,
      elementHits,
      textSources: [...new Set(parts.map((p) => p.from))],
      inferred: parts.length === 0,
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
  const ids = Object.keys(SYSTEM_LABEL);
  const list = ids.map((id) => ({ id, score: clamp(Math.round(systems[id] || 0), 0, 100) }));
  const total = list.reduce((s, x) => s + x.score, 0);
  const average = total / ids.length;
  const sorted = [...list].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const stdev = Math.sqrt(list.reduce((s, x) => s + (x.score - average) ** 2, 0) / ids.length);
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
 * 主流程
 * ------------------------------------------------------------------ */

function derive() {
  const db = openReadOnly();
  const dbStat = statSync(DB_PATH);
  const sha256 = createHash('sha256').update(readFileSync(DB_PATH)).digest('hex');
  try {
    const records = [];
    const warnings = [];
    const stmtChar = db.prepare('SELECT * FROM characters WHERE id = ?');
    const stmtAb = db.prepare('SELECT ability FROM character_abilities WHERE character_id = ?');
    const stmtExt = db.prepare('SELECT ability, description FROM character_abilities_ext WHERE character_id = ?');

    for (const sel of SELECTION) {
      const char = stmtChar.get(sel.id);
      if (!char) {
        warnings.push(`id=${sel.id} 未找到，跳过`);
        continue;
      }
      if (char.name !== sel.name) {
        warnings.push(`id=${sel.id} 名称漂移：期望「${sel.name}」实际「${char.name}」，按实际名称继续`);
      }
      const abilityRows = stmtAb.all(sel.id);
      const extRows = stmtExt.all(sel.id);
      const { systems, element, realm, evidence } = scoreCharacter(char, abilityRows, extRows);
      const rating = computeRating(systems, realm);
      records.push({
        schemaVersion: 1,
        id: char.id,
        name: char.name,
        category: char.category ?? null,
        species: char.species ?? null,
        affiliation: char.affiliation ?? null,
        element,
        realm,
        systems,
        rating,
        evidence,
        provisional: true,
        extra: { group: sel.group, deity: char.deity ?? null },
      });
    }

    const provenance = {
      schemaVersion: 1,
      algorithmVersion: ALGORITHM_VERSION,
      generatedAt: new Date().toISOString(),
      source: {
        path: DB_PATH,
        sizeBytes: dbStat.size,
        mtime: dbStat.mtime.toISOString(),
        sha256,
        accessMode: 'readOnly',
      },
      selection: SELECTION.map((s) => ({ id: s.id, name: s.name, group: s.group })),
      scoreModel: {
        rawScoreRange: [0, 100],
        limits: LIMITS,
        presenceBonus: LIMITS.presence,
        innateZeroedSystems: ['kongjian'],
        gradeModel: 'composite = peak*0.5 + average*0.3 + secondary*0.2',
        gradeThresholds: { S: 85, A: 70, B: 55, C: 38, D: 20, E: 0 },
        narrativePowerWords: NARRATIVE_POWER_WORDS,
      },
      notes: [
        '本文件为只读派生结果，世界观事实源仍是 worldview_luoxiaohei_v4.db。',
        '所有分值为首批样例，provisional=true，可随剧情考据迭代覆盖。',
        '空间系无文本证据时强制归零（无法后天习得）。',
        '境界为推断值：DB 无「角色→境界」字段，多数角色为 unknown。',
        '分数只反映「能力文本证据强度」，不等于剧情战力排名；人工校准层见 docs/01。',
      ],
      warnings,
    };
    return { records, provenance, warnings };
  } finally {
    db.close();
  }
}

/** 稳定序列化：键排序，便于 --check 做幂等比对 */
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
  return JSON.stringify(walk(obj), null, 2);
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const print = args.includes('--print');
  const { records, provenance, warnings } = derive();

  const charactersPath = join(DATA_DIR, 'characters.json');
  const provenancePath = join(DATA_DIR, '_provenance.json');

  if (check) {
    const okChars =
      existsSync(charactersPath) &&
      stableStringify(JSON.parse(readFileSync(charactersPath, 'utf8'))) === stableStringify(records);
    const storedProv = existsSync(provenancePath) ? JSON.parse(readFileSync(provenancePath, 'utf8')) : null;
    const okProv = Boolean(storedProv) && storedProv.algorithmVersion === provenance.algorithmVersion;
    console.log(`[check] characters.json 与重新派生结果一致: ${okChars}`);
    console.log(`[check] _provenance.algorithmVersion 一致: ${okProv}`);
    console.log(`[check] 记录数: ${records.length}`);
    process.exit(okChars && okProv ? 0 : 1);
  }

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(charactersPath, JSON.stringify(records, null, 2) + '\n', 'utf8');
  writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + '\n', 'utf8');

  console.log(`已写入 ${charactersPath}（${records.length} 名角色）`);
  console.log(`已写入 ${provenancePath}`);
  if (warnings.length) console.log('警告：\n  - ' + warnings.join('\n  - '));
  console.log('\nid    名称       属性  境界        评级  战力  御灵/锁御/造物/心灵/生灵/空间');
  for (const r of records) {
    const s = ['yuling', 'suoyu', 'zaowu', 'xinling', 'shengling', 'kongjian']
      .map((k) => String(r.systems[k]).padStart(3))
      .join('/');
    console.log(
      `${String(r.id).padStart(5)} ${r.name.padEnd(10)} ${r.element.padEnd(5)} ${r.realm.padEnd(11)} ${r.rating.grade}    ${String(r.rating.power).padStart(3)}   ${s}`,
    );
  }
  if (print) console.log('\n' + JSON.stringify(records, null, 2));
}

main();
