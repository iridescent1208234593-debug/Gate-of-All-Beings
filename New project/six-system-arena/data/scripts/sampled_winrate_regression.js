'use strict';
/**
 * R10-Q5 本地模拟抽样回归：主战阵容胜率分布
 * 基于 ui/battle-engine.js（确定性内核，seed 驱动），只读 data/decks.json 与
 * data/generated/character_stats.json，只写 data/generated/winrate/。
 * 红线：本脚本不做任何数值 / 卡组 / 成就数据修改。
 */
const path = require('path');
const fs = require('fs');
const BASE = path.resolve(__dirname, '..', '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(BASE, p), 'utf8'));
const Battle = require(path.join(BASE, 'ui', 'battle-engine.js'));
const OUT_DIR = path.join(BASE, 'data', 'generated', 'winrate');

const decks = read('data/decks.json');
const charDoc = read('data/generated/character_stats.json');
const characters = (charDoc && charDoc.characters) || [];
const deckIndex = Battle.indexDecks(decks);

const MAIN_ID = 1;          // 罗小黑：主战阵容（P5 约定）
const SAMPLE_N = 100;       // 抽样对手数
const SEEDS_PER_OPP = 3;    // 每对手独立种子数
const SEED_BASE = 61009;
const TARGET_MIN = 45;
const TARGET_MAX = 55;

function pickOpponents() {
  const ids = [];
  const n = characters.length;
  for (let i = 0; i < n && ids.length < SAMPLE_N; i++) {
    const idx = (i * 7 + 3) % n;
    const id = characters[idx].id;
    if (id !== MAIN_ID && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function tierOf(id) {
  const rec = characters.find((c) => c.id === id);
  return rec ? String(rec.tier || rec.rarity || '?') : '?';
}

function nameOf(id) {
  const d = deckIndex[id];
  return d ? String(d.name || d.character_name || id) : String(id);
}

function simulateOfficial(oppId, seed) {
  const out = Battle.simulate({
    mode: 'arena',
    seed: seed,
    selfDeck: deckIndex[MAIN_ID],
    opponentDeck: deckIndex[oppId],
    opponentType: 'official'
  });
  return out.log;
}

function simulateMirror(seed) {
  const st = Battle.createMirrorBattle(MAIN_ID, decks, { seed: seed });
  Battle.runToEnd(st);
  return Battle.toLogRecord(st);
}

function main() {
  const oppIds = pickOpponents();
  const rows = [];
  const byTier = {};
  let wins = 0, battles = 0, draws = 0;

  oppIds.forEach((oppId, k) => {
    for (let s = 0; s < SEEDS_PER_OPP; s++) {
      const seed = SEED_BASE + k * SEEDS_PER_OPP + s;
      const log = simulateOfficial(oppId, seed);
      battles++;
      if (log.result === 'win') wins++;
      else if (log.result === 'draw') draws++;
      const t = tierOf(oppId);
      byTier[t] = byTier[t] || { battles: 0, wins: 0 };
      byTier[t].battles++;
      if (log.result === 'win') byTier[t].wins++;
      rows.push({
        opponent_id: oppId,
        opponent_name: nameOf(oppId),
        opponent_tier: t,
        seed: seed,
        result: log.result,
        turn_used: log.turn_used
      });
    }
  });

  let mWins = 0, mBattles = 0, mDraws = 0;
  const mirrorRows = [];
  for (let s = 0; s < 20; s++) {
    const seed = SEED_BASE + 90000 + s;
    const log = simulateMirror(seed);
    mBattles++;
    if (log.result === 'win') mWins++;
    else if (log.result === 'draw') mDraws++;
    mirrorRows.push({ seed: seed, result: log.result, turn_used: log.turn_used });
  }

  const winRate = battles ? (wins / battles) * 100 : 0;
  const drawRate = battles ? (draws / battles) * 100 : 0;
  const mirrorRate = mBattles ? (mWins / mBattles) * 100 : 0;
  const withinTarget = winRate >= TARGET_MIN && winRate <= TARGET_MAX;

  const byTierSummary = {};
  Object.keys(byTier)
    .sort()
    .forEach((t) => {
      byTierSummary[t] = {
        battles: byTier[t].battles,
        wins: byTier[t].wins,
        win_rate_pct: Number(((byTier[t].wins / byTier[t].battles) * 100).toFixed(2))
      };
    });

  const loseRows = rows.filter((r) => r.result === 'lose');
  const winRows = rows.filter((r) => r.result === 'win');
  const uniqById = (arr) => {
    const seen = {};
    return arr
      .filter((r) => !seen[r.opponent_id] && (seen[r.opponent_id] = 1))
      .map((r) => ({ opponent_id: r.opponent_id, opponent_name: r.opponent_name, opponent_tier: r.opponent_tier }))
      .slice(0, 10);
  };

  const report = {
    title: 'R10-Q5 本地模拟抽样回归（胜率分布）',
    generated_at: new Date().toISOString(),
    engine: { engine_version: Battle.ENGINE_VERSION, rules_version: Battle.RULES_VERSION },
    method: {
      main_character_id: MAIN_ID,
      main_deck_name: nameOf(MAIN_ID),
      sample_opponents: SAMPLE_N,
      seeds_per_opponent: SEEDS_PER_OPP,
      total_battles: battles,
      sampling: '对 488 名角色按固定步长 (i*7+3) 抽取 100 名（不含自身），每对手 3 个确定性种子（seed 可复现）',
      mirror_battles: mBattles,
      target: { min: TARGET_MIN, max: TARGET_MAX }
    },
    aggregate: {
      battles: battles,
      wins: wins,
      draws: draws,
      losses: battles - wins - draws,
      win_rate_pct: Number(winRate.toFixed(2)),
      draw_rate_pct: Number(drawRate.toFixed(2)),
      within_target: withinTarget
    },
    by_tier: byTierSummary,
    mirror: {
      battles: mBattles,
      wins: mWins,
      draws: mDraws,
      win_rate_pct: Number(mirrorRate.toFixed(2)),
      note: '镜像战为同卡组对战基准，胜率应接近 50%（不计入主战阵容胜率）'
    },
    conclusion: withinTarget
      ? '回归通过：主战阵容（罗小黑）抽样胜率落在 P5 目标区间 45%~55% 内，未触发数值调整。'
      : '回归偏离：主战阵容抽样胜率不在 P5 目标区间 45%~55% 内。按工程红线本轮只记录分析结论，不改任何数值。',
    analysis: {
      strongest_opponents: uniqById(loseRows),
      weak_opponents: uniqById(winRows)
    },
    rows: rows,
    mirror_rows: mirrorRows,
    redline: '本轮未修改任何数值 / 卡组 / 成就数据'
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, 'winrate-regression-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('=== R10-Q5 本地模拟抽样回归 ===');
  console.log('引擎: battle-engine v' + Battle.ENGINE_VERSION + ' / rules v' + Battle.RULES_VERSION);
  console.log('主战: id=' + MAIN_ID + ' ' + nameOf(MAIN_ID));
  console.log('对局: ' + battles + ' 场（' + oppIds.length + ' 名对手 x ' + SEEDS_PER_OPP + ' 种子）; 胜 ' + wins + ' / 平 ' + draws + ' / 负 ' + (battles - wins - draws));
  console.log('胜率: ' + winRate.toFixed(2) + '%（目标区间 ' + TARGET_MIN + '%~' + TARGET_MAX + '%） -> ' + (withinTarget ? '回归通过' : '回归偏离（仅记录，不改数值）'));
  console.log('镜像基准: ' + mirrorRate.toFixed(2) + '%（' + mBattles + ' 场）');
  Object.keys(byTierSummary)
    .sort()
    .forEach((t) => console.log('  ' + t + ' 档: ' + byTierSummary[t].win_rate_pct + '% (' + byTierSummary[t].wins + '/' + byTierSummary[t].battles + ')'));
  console.log('报告: ' + outPath);
}

main();
