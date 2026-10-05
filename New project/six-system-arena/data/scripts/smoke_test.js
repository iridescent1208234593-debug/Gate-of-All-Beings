/**
 * smoke_test.js — 六系演武 R2 冒烟测试（三模块联动契约）
 * ============================================================================
 * 覆盖：
 *   1. battle-engine：官方对战可跑通、日志字段符合 docs/04 §5 契约、回合上限
 *   2. 确定性复现：同种子多次模拟结果完全一致
 *   3. 六系克制环 + 空间系穿透 20% 防御
 *   4. 镜像战：回合上限 20 / 能量上限 12 / 对手为自身副本
 *   5. achievement-system：读战斗日志判定、失败不惩罚不判定、收集图鉴四视图
 *   6. settlement：胜利 3s 登场流程与正向文案、失败安慰图与「再来一次」
 *   7. 素材白名单路径存在性（只用官方图，无 AI 生图）
 *
 * 用法：node data/scripts/smoke_test.js
 * 退出码：0 = 全部通过；1 = 存在失败项
 */
'use strict';

const path = require('path');
const fs = require('fs');

const BASE = path.resolve(__dirname, '..', '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(BASE, p), 'utf8'));

const Battle = require(path.join(BASE, 'ui', 'battle-engine.js'));
const Ach = require(path.join(BASE, 'ui', 'achievement-system.js'));
const Settle = require(path.join(BASE, 'ui', 'settlement.js'));

const decks = read('data/decks.json');
const charsDoc = read('data/generated/character_stats.json');
const achDoc = read('data/achievements.json');
const deckIndex = Battle.indexDecks(decks);

let fail = 0;
const ok = (cond, label) => { console.log((cond ? '  [OK]   ' : '  [FAIL] ') + label); if (!cond) fail++; };
const idOf = (name) => { const c = charsDoc.characters.find(x => x.name === name); return c ? c.id : null; };

const LUOXIAOHEI = 1;
const WUXIAN = idOf('无限') || 2;

/* 1. 官方对战 */
console.log('=== 1. 与官方角色对战 ===');
const r1 = Battle.simulate({
  mode: 'arena', seed: 20261005,
  selfDeck: deckIndex[LUOXIAOHEI], opponentDeck: deckIndex[WUXIAN], opponentType: 'official'
});
const log1 = Battle.toLogRecord(r1.state);
console.log('  battle_id=' + log1.battle_id + ' turns=' + log1.turn_used + ' result=' + log1.result);
const CONTRACT = ['battle_id', 'mode', 'my_character_id', 'opponent_id', 'opponent_type', 'result', 'turn_used', 'hp_left', 'hp_max', 'seed'];
ok(Object.keys(log1).join(',') === CONTRACT.join(','), '日志字段与 docs/04 §5 契约一致');
ok(log1.turn_used <= Battle.TURN_LIMIT, '回合数不超过常规上限 ' + Battle.TURN_LIMIT);
ok(['win', 'lose', 'draw'].indexOf(log1.result) >= 0, 'result 取值合法');

/* 2. 确定性 */
console.log('=== 2. 确定性复现 ===');
const det = Battle.verifyDeterminism({
  mode: 'arena', seed: 424242,
  selfDeck: deckIndex[LUOXIAOHEI], opponentDeck: deckIndex[WUXIAN], opponentType: 'official'
}, 3);
ok(det.deterministic, '同输入 3 次模拟结果完全一致');

/* 3. 克制环 */
console.log('=== 3. 六系克制环 / 空间穿透 ===');
ok(Battle.elementFactor('jin', 'mu') === 1.25, '金 → 木 ×1.25');
ok(Battle.elementFactor('mu', 'tu') === 1.25, '木 → 土 ×1.25');
ok(Battle.elementFactor('tu', 'shui') === 1.25, '土 → 水 ×1.25');
ok(Battle.elementFactor('shui', 'huo') === 1.25, '水 → 火 ×1.25');
ok(Battle.elementFactor('huo', 'jin') === 1.25, '火 → 金 ×1.25');
ok(Battle.elementFactor('mu', 'jin') === 0.85, '被克制侧 ×0.85');
ok(Battle.elementFactor('kongjian', 'jin') === 1.0 && Battle.elementFactor('jin', 'kongjian') === 1.0, '空间系双向 ×1.00');
ok(Battle.elementFactor('jin', 'jin') === 1.0, '同系 ×1.00');
ok(Battle.KONGJIAN_PIERCE === 0.20, '空间系穿透 20% 防御');

/* 4. 镜像战 */
console.log('=== 4. 镜像战 ===');
const mState = Battle.createMirrorBattle(LUOXIAOHEI, decks, { seed: 777 });
ok(mState.turn_limit === 20, '镜像战回合上限 = 20');
ok(mState.fighters.a.energy_max === 12 && mState.fighters.b.energy_max === 12, '镜像战能量上限 = 12');
Battle.runToEnd(mState);
const mLog = Battle.toLogRecord(mState);
ok(mLog.opponent_type === 'mirror' && mLog.opponent_id === mLog.my_character_id, '镜像战对手 = 自身副本');

/* 5. 成就系统 */
console.log('=== 5. 成就系统 ===');
const sys = Ach.createAchievementSystem({ achievements: achDoc, characters: charsDoc });
const mainline = charsDoc.characters.filter(c => c.mainline);
let seed = 1000, wins = 0;
mainline.forEach(m => {
  const st = Battle.simulate({ mode: 'arena', seed: seed++, selfDeck: deckIndex[LUOXIAOHEI], opponentDeck: deckIndex[m.id], opponentType: 'official' });
  const lg = Battle.toLogRecord(st.state);
  if (lg.result === 'win') wins++;
  sys.judge(lg);
});
console.log('  主线对局 ' + mainline.length + ' 场，胜 ' + wins + ' 场');
ok(sys.metricValue('mainline_defeated') > 0, '主线击败计数可累计（' + sys.metricValue('mainline_defeated') + '）');
for (let i = 0; i < 8; i++) {
  const st = Battle.simulate({ mode: 'challenge', seed: seed++, selfDeck: deckIndex[LUOXIAOHEI], opponentDeck: deckIndex[WUXIAN], opponentType: 'official' });
  sys.judge(Battle.toLogRecord(st.state));
}
for (let i = 0; i < 6; i++) {
  const st = Battle.createMirrorBattle(LUOXIAOHEI, decks, { seed: seed++ });
  Battle.runToEnd(st);
  sys.judge(Battle.toLogRecord(st));
}
console.log('  challenge=' + sys.metricValue('challenge_wins') + ' mirror=' + sys.metricValue('mirror_wins') + ' flaw=' + sys.metricValue('flawless_wins'));

const unlocked = sys.unlockCharacters(charsDoc.characters.map(c => c.id));
console.log('  解锁全角色后新成就：' + (unlocked.newly_unlocked.map(a => a.id).join(', ') || '(无)'));
ok(sys.metricValue('unlocked_characters') === charsDoc.characters.length, '解锁角色数 = ' + charsDoc.characters.length);
ok(unlocked.newly_unlocked.length > 0, '收集类成就可被触发');

/* 6. 收集图鉴 */
console.log('=== 6. 收集图鉴 ===');
const codex = sys.codex();
ok(codex.sections.length === 4, '图鉴四视图齐备（六系 / 稀有度 / 分档 / 主线）');
console.log('  已解锁 ' + codex.owned_characters + '/' + codex.total_characters +
  ' | 分组 ' + codex.sections.map(s => s.groups.length).join('/'));

/* 7. 结算 */
console.log('=== 7. 结算 ===');
const w = Settle.resolve({
  result: 'win', mode: 'arena', opponent_type: 'official', opponent_id: WUXIAN,
  opponent_name: '无限', first_time_defeat: true, win_streak: 1, seed: 20261005,
  winner_element: 'jin', newly_unlocked: unlocked.newly_unlocked.slice(0, 1)
});
ok(w.duration_ms === 3000, '胜利结算约 3s');
ok(w.timeline.some(t => t.key === 'bidiu_enter') && w.timeline.some(t => t.key === 'luoxiaohei_enter'), '比丢 + 罗小黑 依次登场');
ok(w.achievement.show_after_ms === w.duration_ms, '成就解锁在登场动画之后（不打架）');
console.log('  胜：' + w.line.text);

const l = Settle.resolve({ result: 'lose', mode: 'arena', opponent_type: 'official', opponent_id: WUXIAN, seed: 20261005 });
ok(l.penalty === false && l.no_penalty_detail.judge_achievement === false, '失败不惩罚、不判定成就');
ok(l.retry.enabled === true && l.retry.label === '再来一次', '提供一键「再来一次」');
console.log('  负：' + l.line.text);
console.log('  安慰图：' + l.assets.comfort_sticker);

/* 8. 败局不判定 */
console.log('=== 8. 败局不判定 ===');
const sys2 = Ach.createAchievementSystem({ achievements: achDoc, characters: charsDoc });
const before = sys2.getProfile().flawless_wins;
const jr = sys2.judge({ battle_id: 'X', mode: 'arena', my_character_id: LUOXIAOHEI, opponent_id: WUXIAN, opponent_type: 'official', result: 'lose', turn_used: 9, hp_left: 0, hp_max: 6176, seed: 1 });
ok(jr.judged === false && jr.newly_unlocked.length === 0, '败局不判定成就');
ok(sys2.getProfile().flawless_wins === before, '败局不改收集进度');

/* 9. 素材白名单 */
console.log('=== 9. 素材核验（官方图，禁止 AI 生图）===');
[
  ['罗小黑 表情 087', Settle.ASSETS.luoxiaohei.comfort[0]],
  ['罗小黑 表情 088', Settle.ASSETS.luoxiaohei.comfort[1]],
  ['罗小黑 全身 085', Settle.ASSETS.luoxiaohei.entrance],
  ['比丢 png', Settle.ASSETS.bidiu.entrance],
  ['比丢 gif', Settle.ASSETS.bidiu.alt]
].forEach(pair => {
  const p = pair[1];
  const blocked = /ai-art|ai image|ai-avatars|同人图|疑似同人/i.test(p);
  ok(fs.existsSync(p) && !blocked, pair[0] + ' → ' + p);
});

console.log('\n================ 结果 ================');
console.log(fail === 0 ? '冒烟测试全部通过' : ('冒烟测试失败 ' + fail + ' 项'));
process.exit(fail === 0 ? 0 : 1);
