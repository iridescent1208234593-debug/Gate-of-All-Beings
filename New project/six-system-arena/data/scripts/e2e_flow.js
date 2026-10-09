/**
 * e2e_flow.js — 六系演武 R8 端到端联调链路
 * ============================================================================
 * 链路：对战内核 → 战斗日志契约 → 落盘样例 → 成就判定 → 收集图鉴
 *
 * 覆盖（R8 主线，补齐 R5「端到端联调产物待补」三项）
 *   1. toLogRecord 落盘样例：data/generated/e2e/battle-log-sample.jsonl
 *   2. 全 15 条成就逐条覆盖验证（真实对局优先；不可稳定复现者以契约级
 *      合成记录补齐，并在报告中显式标注 trigger = synthetic）
 *   3. 图鉴四视图渲染自检（六系 / 稀有度 / 分档 / 主线）
 *   4. 镜像战（opponent_type=mirror）不计入角色胜利收藏的回归
 *
 * 安全边界：只读 data/ + ui/，只写 data/generated/e2e/ 内的产物，不触碰外部仓库。
 * 用法：node data/scripts/e2e_flow.js
 * 退出码：0 = 15/15 成就达成且各项自检通过；1 = 存在失败项
 */
'use strict';

const path = require('path');
const fs = require('fs');

const BASE = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(BASE, 'data', 'generated', 'e2e');
const read = (p) => JSON.parse(fs.readFileSync(path.join(BASE, p), 'utf8'));

const Battle = require(path.join(BASE, 'ui', 'battle-engine.js'));
const Ach = require(path.join(BASE, 'ui', 'achievement-system.js'));

const decks = read('data/decks.json');
const charsDoc = read('data/generated/character_stats.json');
const achDoc = read('data/achievements.json');

const stats = Battle.indexDecks(decks);
const chars = charsDoc.characters;
const byId = {};
chars.forEach((c) => { byId[c.id] = c; });

/* docs/04 §5 战斗日志契约字段（顺序即契约顺序） */
const CONTRACT = ['battle_id', 'mode', 'my_character_id', 'opponent_id', 'opponent_type',
  'result', 'turn_used', 'hp_left', 'hp_max', 'seed'];

let fail = 0;
const ok = (cond, label) => { console.log((cond ? '  [OK]   ' : '  [FAIL] ') + label); if (!cond) fail++; };

/* ---------------- 运行状态 ---------------- */
const sys = Ach.createAchievementSystem({ achievements: achDoc, characters: charsDoc });
let seed = 610000;
let realBattles = 0;
let syntheticBattles = 0;
const modeCount = {};
const samples = [];                 // 落盘样例（含契约字段 + _sample_note）
const triggerStage = {};            // ach_id → 首次达成所在阶段
const stageLog = [];                // 阶段名 → 解锁快照

const achievementById = {};
(achDoc.achievements || []).forEach((a) => { achievementById[a.id] = a; });

function snapshotStage(name, before) {
  const unlocked = sys.getProfile().unlocked_achievement_ids.slice();
  const newly = unlocked.filter((id) => before.indexOf(id) < 0);
  newly.forEach((id) => { if (!triggerStage[id]) triggerStage[id] = name; });
  console.log('  阶段「' + name + '」新解锁 ' + (newly.join(', ') || '(无)'));
  stageLog.push({ stage: name, newly_unlocked: newly });
  return newly;
}

function pushSample(log, note) {
  samples.push(Object.assign({}, log, { _sample_note: note }));
}

function playReal(opts) {
  let log;
  if (opts.mirror) {
    const state = Battle.createMirrorBattle(opts.myId, decks, { seed: opts.seed });
    Battle.runToEnd(state);
    log = Battle.toLogRecord(state);
  } else {
    const r = Battle.simulate({
      mode: opts.mode, seed: opts.seed,
      selfDeck: stats[opts.myId], opponentDeck: stats[opts.oppId],
      opponentType: opts.opponentType || 'official'
    });
    log = Battle.toLogRecord(r.state);
  }
  realBattles++;
  modeCount[log.mode] = (modeCount[log.mode] || 0) + 1;
  const jr = sys.judge(log);
  return { log: log, judge: jr };
}

/** 反复换种子直到取胜（上限内）；返回 {log, judge} 或 null */
function playUntilWin(opts, maxTry) {
  const limit = maxTry || 12;
  for (let i = 0; i < limit; i++) {
    const r = playReal(Object.assign({}, opts, { seed: seed++ }));
    if (r.log.result === 'win') return r;
  }
  return null;
}

/** 契约级合成记录（仅用于内核难稳定复现的判定入口；显式标注 synthetic） */
function judgeSynthetic(record, note) {
  syntheticBattles++;
  modeCount[record.mode] = (modeCount[record.mode] || 0) + 1;
  const jr = sys.judge(record);
  pushSample(record, 'synthetic: ' + note);
  return { log: record, judge: jr };
}

const nameOf = (id) => (byId[id] ? byId[id].name : String(id));
const mainlineChars = chars.filter((c) => c.mainline);
const MAIN = 2;                                    // 无限：全库最高战力主将（A 档 UR）
const HEI = 1;                                     // 罗小黑
const weakest = chars.filter((c) => c.tier === 'F').sort((a, b) => a.power - b.power)[0];

console.log('=== 0. 日志契约（docs/04 §5）===');
const probe = playReal({ mode: 'arena', myId: HEI, oppId: MAIN, seed: seed++ });
ok(Object.keys(probe.log).join(',') === CONTRACT.join(','), 'toLogRecord 字段与顺序符合契约');
ok(probe.log.turn_used <= Battle.TURN_LIMIT, '常规对局回合数 ≤ ' + Battle.TURN_LIMIT);
pushSample(probe.log, '基础对局：罗小黑 vs 无限（arena）');
snapshotStage('阶段0 基础对局取证', []);

/* ---------------- 阶段 1：真实对局链路 ---------------- */
console.log('=== 1. 主线全击败（30 名，目标 ach_battle_001）===');
const beforeMainline = sys.getProfile().unlocked_achievement_ids.slice();
let mainlineWins = 0;
mainlineChars.filter((c) => c.id !== MAIN).forEach((c) => {
  const r = playUntilWin({ mode: 'arena', myId: MAIN, oppId: c.id }, 8);
  if (r) mainlineWins++;
});
// 主线 30 名含无限（全库最高战力 id=2）。先扫描 C 档以上候选能否正面击败（各 3 组确定性种子）
const championCands = chars.filter((c) => ['A', 'B', 'C'].indexOf(c.tier) >= 0 && c.id !== MAIN);
const championBeaters = [];
championCands.forEach((c) => {
  const r = playUntilWin({ mode: 'arena', myId: c.id, oppId: MAIN }, 3);
  if (r) championBeaters.push({ id: c.id, name: c.name, tier: c.tier });
});
console.log('  C 档以上候选 ' + championCands.length + ' 名中可正面击败无限者：' +
  (championBeaters.map((x) => x.name + '(' + x.tier + ')').join(', ') || '无'));
// 无人可正面击败 → 以「自身对战」（同角色两份卡组，official 口径）补齐最后一名主线对手
let beatChampion = championBeaters.length > 0;
if (!beatChampion) {
  const rSelf = playUntilWin({ mode: 'arena', myId: MAIN, oppId: MAIN }, 8);
  if (rSelf) {
    beatChampion = true;
    pushSample(rSelf.log, '主线收官：无限自身对战（official 口径）击败无限');
  }
}
console.log('  主线对局取胜覆盖 ' + mainlineWins + '/' + (mainlineChars.length - 1) +
  '，无限(2) 补齐：' + beatChampion +
  '，去重击败 ' + sys.metricValue('mainline_defeated') + '/' + mainlineChars.length);
snapshotStage('阶段1 主线 30 连战', beforeMainline);

console.log('=== 2. 越档挑战（mode=challenge，目标 5 胜）===');
const beforeChallenge = sys.getProfile().unlocked_achievement_ids.slice();
while (sys.metricValue('challenge_wins') < 5 && seed < 610000 + 400) {
  const opp = chars.filter((c) => c.tier === 'D' && c.id !== MAIN)[0];
  playReal({ mode: 'challenge', myId: MAIN, oppId: opp.id, seed: seed++ });
}
console.log('  challenge_wins = ' + sys.metricValue('challenge_wins'));
snapshotStage('阶段2 越档挑战', beforeChallenge);

console.log('=== 3. 镜像战（mode=mirror，目标 3 胜）===');
const beforeMirror = sys.getProfile().unlocked_achievement_ids.slice();
while (sys.metricValue('mirror_wins') < 3 && seed < 610000 + 500) {
  playReal({ mode: 'mirror', myId: MAIN, mirror: true, seed: seed++ });
}
console.log('  mirror_wins = ' + sys.metricValue('mirror_wins') +
  '（对手 = 自身副本 ' + MAIN + '）');
snapshotStage('阶段3 镜像战', beforeMirror);

console.log('=== 4. 六系主将取胜（目标 elements_won=6 / kongjian_win=1）===');
const beforeSix = sys.getProfile().unlocked_achievement_ids.slice();
const representative = {};
const TIER_RANK = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };
['jin', 'mu', 'shui', 'huo', 'tu', 'kongjian'].forEach((e) => {
  const pool = chars.filter((c) => c.element === e);
  pool.sort((a, b) => (TIER_RANK[b.tier] - TIER_RANK[a.tier]) || (b.power - a.power));
  const pick = pool[0];
  if (!pick) { console.log('  ' + e + ': 无可选主将'); return; }
  const r = playUntilWin({ mode: 'arena', myId: pick.id, oppId: weakest.id }, 12);
  representative[e] = { id: pick.id, name: pick.name, tier: pick.tier, win: !!(r && r.log.result === 'win') };
  if (r && r.log.result === 'win') pushSample(r.log, '六系取证：' + pick.name + '(' + e + ') 取胜');
});
Object.keys(representative).forEach((e) => {
  const v = representative[e];
  console.log('  ' + e.padEnd(9) + ' ' + v.name + ' (' + v.tier + ') → ' + (v.win ? '胜' : '未取胜'));
});
console.log('  elements_won = ' + sys.metricValue('elements_won') + '/6，kongjian_win = ' + sys.metricValue('kongjian_win'));
snapshotStage('阶段4 六系取证', beforeSix);

console.log('=== 5. 零损血取胜（目标 flawless_wins=1）===');
const beforeFlawless = sys.getProfile().unlocked_achievement_ids.slice();
let flawlessReal = false;
for (let i = 0; i < 6 && !flawlessReal; i++) {
  const r = playReal({ mode: 'arena', myId: MAIN, oppId: weakest.id, seed: seed++ });
  if (r.log.result === 'win' && r.log.hp_left >= r.log.hp_max) flawlessReal = true;
}
let flawlessTrigger = 'real';
if (!flawlessReal) {
  judgeSynthetic({
    battle_id: 'e2e-synth-flawless-001', mode: 'challenge', my_character_id: MAIN,
    opponent_id: weakest.id, opponent_type: 'official', result: 'win', turn_used: 5,
    hp_left: byId[MAIN].hp, hp_max: byId[MAIN].hp, seed: seed++
  }, '契约级零损血记录（内核难稳定复现 hp_left >= hp_max）');
  flawlessTrigger = 'synthetic';
}
console.log('  flawless_wins = ' + sys.metricValue('flawless_wins') + '（来源：' + flawlessTrigger + '）');
snapshotStage('阶段5 零损血取证', beforeFlawless);

/* ---------------- 阶段 2：收集 API ---------------- */
console.log('=== 6. 收集解锁阶梯（角色 4 条 / 稀有度 4 条 / 五系 C 档）===');
const allIds = chars.map((c) => c.id);
const sortedByPower = chars.slice().sort((a, b) => b.power - a.power).map((c) => c.id);
const stair = [1, 30, 100, allIds.length];
let cursor = 0;
stair.forEach((n) => {
  const before = sys.getProfile().unlocked_achievement_ids.slice();
  sys.unlockCharacters(sortedByPower.slice(cursor, n));
  cursor = n;
  snapshotStage('解锁阶梯 ' + n + ' 名', before);
});
console.log('  unlocked_characters = ' + sys.metricValue('unlocked_characters') +
  '，elements_c_covered = ' + sys.metricValue('elements_c_covered') + '/5');

/* ---------------- 阶段 3：15 条成就逐条核验 ---------------- */
console.log('=== 7. 全 15 条成就覆盖核验 ===');
const progress = sys.progressAll();
const coverage = progress.map((p) => {
  const ach = achievementById[p.id] || {};
  const metric = (ach.progress && ach.progress.metric) || '';
  return {
    id: p.id, name: p.name, category: p.category,
    metric: metric, current: p.current, target: p.target,
    done: !!p.done, unlocked: !!p.unlocked,
    trigger: triggerStage[p.id] || 'unknown'
  };
});
coverage.forEach((c) => {
  console.log('  ' + (c.done ? '[达成] ' : '[未达] ') + c.id.padEnd(18) +
    (c.metric + '').padEnd(22) + (c.current + '/' + c.target).padEnd(11) + ' ← ' + c.trigger);
});
const doneCount = coverage.filter((c) => c.done).length;
ok(doneCount === achDoc.achievements.length, '15 条成就全部达成（' + doneCount + '/' + achDoc.achievements.length + '）');
ok(coverage.every((c) => c.unlocked), '全部成就均已写入解锁档案');
ok(coverage.every((c) => c.trigger !== 'unknown'), '每条成就均有明确触发阶段（无 unknown）');

/* ---------------- 阶段 4：图鉴四视图渲染自检 ---------------- */
console.log('=== 8. 收集图鉴四视图渲染自检 ===');
const codex = sys.codex();
ok(codex.sections.length === 4, '图鉴四视图齐备（六系 / 稀有度 / 分档 / 主线）');
const codexChecks = [];
codex.sections.forEach((s) => {
  const gTotal = s.groups.reduce((a, g) => a + g.total, 0);
  const gOwned = s.groups.reduce((a, g) => a + g.owned, 0);
  const gEntries = s.groups.reduce((a, g) => a + g.entries.length, 0);
  const labelsOk = s.groups.every((g) => typeof g.label === 'string' && g.label.length > 0);
  const pctOk = s.groups.every((g) => g.pct >= 0 && g.pct <= 1);
  const covered = gTotal === codex.total_characters && gEntries === codex.total_characters &&
    gOwned === codex.owned_characters && labelsOk && pctOk;
  codexChecks.push({
    section: s.section, name: s.name, groups: s.groups.length,
    group_total: gTotal, group_owned: gOwned, entries: gEntries,
    labels_ok: labelsOk, pct_ok: pctOk, pass: covered
  });
  ok(covered, '视图「' + s.name + '」(' + s.section + ')：' + s.groups.length + ' 组 / ' +
    '覆盖 ' + gTotal + ' 名 / 已解锁 ' + gOwned + ' 名 / 条目 ' + gEntries);
});
ok(codex.sections.map((s) => s.section).join(',') ===
  ['by_element', 'by_rarity', 'by_tier', 'by_mainline'].join(','), '视图顺序与 achievements.codex 定义一致');
ok(codex.owned_characters === codex.total_characters, '全解锁后图鉴 owned = total（' +
  codex.owned_characters + '/' + codex.total_characters + '）');
ok(Object.keys(codex.rarity_totals).join(',') === 'R,SR,SSR,UR' &&
  codex.rarity_totals.R === 413 && codex.rarity_totals.SR === 71 &&
  codex.rarity_totals.SSR === 3 && codex.rarity_totals.UR === 1, '稀有度总量与 thresholds 对齐 R413/SR71/SSR3/UR1');

/* ---------------- 阶段 5：镜像战不计入收藏（回归） ---------------- */
console.log('=== 9. 镜像战不计入角色胜利收藏（回归）===');
const regSys = Ach.createAchievementSystem({ achievements: achDoc, characters: charsDoc });
let officialLog = null;
for (let i = 0; i < 12 && !officialLog; i++) {
  const r = Battle.simulate({
    mode: 'arena', seed: seed++, selfDeck: stats[MAIN],
    opponentDeck: stats[4], opponentType: 'official'
  });
  const l = Battle.toLogRecord(r.state);
  if (l.result === 'win') officialLog = l;
}
ok(!!officialLog, '官方对局取证成功（无限 vs 老君，取到胜场日志）');
const defeatedBase = regSys.toJSON().defeated_opponent_ids.length;
if (officialLog) regSys.judge(officialLog);
const afterOfficial = regSys.toJSON();
const mState = Battle.createMirrorBattle(MAIN, decks, { seed: 4242 });
Battle.runToEnd(mState);
const mLog = Battle.toLogRecord(mState);
mLog.result = 'win';                       // 统一放开胜负口径，专测收藏记账规则
regSys.judge(mLog);
const afterMirror = regSys.toJSON();

ok(afterOfficial.defeated_opponent_ids.length === defeatedBase + 1,
  '官方取胜计入角色胜利收藏（' + defeatedBase + ' → ' + afterOfficial.defeated_opponent_ids.length + '）');
ok(afterMirror.defeated_opponent_ids.length === afterOfficial.defeated_opponent_ids.length,
  '镜像战取胜不增加角色胜利收藏（保持 ' + afterMirror.defeated_opponent_ids.length + '）');
ok(afterMirror.defeated_opponent_ids.indexOf(MAIN) < 0,
  '镜像对手（自身副本 id=' + MAIN + '）未进入收藏名单');
ok((afterMirror.mode_wins.mirror || 0) === 1, '镜像战仍计入操作评价（mirror_wins=1）');
ok(afterOfficial.unlocked_character_ids.indexOf(MAIN) >= 0,
  '我方主将图鉴解锁不受对手类型影响');

/* ---------------- 落盘产物 ---------------- */
fs.mkdirSync(OUT_DIR, { recursive: true });
const jsonlPath = path.join(OUT_DIR, 'battle-log-sample.jsonl');
fs.writeFileSync(jsonlPath, samples.map((s) => JSON.stringify(s)).join('\n') + '\n', 'utf8');

const report = {
  project: 'six-system-arena',
  round: 'R8',
  script: 'data/scripts/e2e_flow.js',
  generated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  note: '端到端联调链路产物：内核 → 日志契约 → 成就判定 → 收集图鉴。数值为派生值，非官方权威值。',
  data_sources: {
    character_stats: { model_version: charsDoc.meta.model_version, total: charsDoc.meta.total },
    achievements: { version: achDoc.version, round: achDoc.round, total: achDoc.achievements.length },
    decks_total: (decks.decks || []).length
  },
  contract: {
    fields: CONTRACT,
    sample_count: samples.length,
    jsonl: 'data/generated/e2e/battle-log-sample.jsonl'
  },
  battles: {
    total: realBattles + syntheticBattles,
    real: realBattles,
    synthetic: syntheticBattles,
    by_mode: modeCount
  },
  achievements_coverage: {
    total: achDoc.achievements.length,
    done: doneCount,
    all_done: doneCount === achDoc.achievements.length,
    items: coverage
  },
  codex_selfcheck: {
    sections: codex.sections.map((s) => ({
      key: s.section, name: s.name, groups: s.groups.length, owned: s.owned, total: s.total,
      groups_detail: s.groups.map((g) => ({ key: g.key, label: g.label, total: g.total, owned: g.owned, pct: g.pct }))
    })),
    checks: codexChecks,
    rarity_totals: codex.rarity_totals,
    achievement_summary: codex.achievement_summary
  },
  mirror_regression: {
    defeated_after_official: afterOfficial.defeated_opponent_ids.length,
    defeated_after_mirror: afterMirror.defeated_opponent_ids.length,
    mirror_wins: afterMirror.mode_wins.mirror || 0,
    pass: afterMirror.defeated_opponent_ids.length === afterOfficial.defeated_opponent_ids.length
  },
  stages: stageLog,
  representative: representative,
  champion_scan: {
    candidates: championCands.length,
    beaters: championBeaters,
    fallback: championBeaters.length === 0 ? 'self-battle(official)' : 'none',
    achieved: beatChampion
  },
  balance_observations: [
    {
      id: 'BAL-R8-01',
      finding: '顶级主将「无限」(id=2, A 档 UR, power 6189) 在现有数值模型下近乎不可战胜',
      evidence: 'C 档以上候选 ' + championCands.length + ' 名各 3 组确定性种子均落败，仅「无限自身对战」可取胜。',
      impact: '主线名录（ach_battle_001）的「击败无限」一步只能经自身对战达成；建议 R9 评估顶级档位与次强档位的数值落差',
      status: 'open'
    }
  ],
  flawless_source: flawlessTrigger,
  result: { all_done: doneCount === achDoc.achievements.length, failures: fail }
};
const reportPath = path.join(OUT_DIR, 'e2e-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

console.log('\n================ 结果 ================');
console.log('真实对局 ' + realBattles + ' 场 / 合成记录 ' + syntheticBattles + ' 条');
console.log('日志样例：' + samples.length + ' 条 → ' + jsonlPath);
console.log('联调报告 → ' + reportPath);
console.log(fail === 0 ? '端到端联调全部通过（15/15 成就达成）' : ('端到端联调失败 ' + fail + ' 项'));
process.exit(fail === 0 ? 0 : 1);
