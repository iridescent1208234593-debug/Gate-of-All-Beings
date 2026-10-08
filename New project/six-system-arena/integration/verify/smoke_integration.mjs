#!/usr/bin/env node
/* ============================================================================
   smoke_integration.mjs — 集成包运行时冒烟自检（R3）
   ----------------------------------------------------------------------------
   在 arena 目录内直接运行，用 node:vm 沙箱加载四个运行时脚本（不改盘、不联网），
   校验：图标注册 / 结算契约 / 对战内核 / 成就判定 / 数据规模 / 素材红线。

   用法：
     node integration/verify/smoke_integration.mjs
     node integration/verify/smoke_integration.mjs --json     # 只输出 JSON
   ============================================================================ */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const P = (...p) => path.join(ROOT, ...p);
const JSON_ONLY = process.argv.includes('--json');

const results = [];
let failed = 0;

function check(name, fn) {
  try {
    const detail = fn();
    results.push({ ok: true, name, detail: typeof detail === 'string' ? detail : '' });
  } catch (e) {
    failed += 1;
    results.push({ ok: false, name, detail: String((e && e.message) || e) });
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/* ---------------------------------------------------------------- 沙箱 */

function makeSandbox() {
  const sandbox = { console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {} };
  vm.createContext(sandbox);
  vm.runInContext(
    `var window = this; var self = this;
     var document = {
       readyState: 'complete',
       addEventListener: function(){}, removeEventListener: function(){},
       createElement: function(){ return { style:{}, setAttribute:function(){}, appendChild:function(){}, classList:{add:function(){},remove:function(){}}, innerHTML:'' }; },
       body: { appendChild: function(){} }
     };
     var Image = function(){ this.onload=null; this.onerror=null; };
     Object.defineProperty(Image.prototype,'src',{ set:function(){ if(this.onerror) this.onerror(); }, get:function(){ return ''; } });
     var LXHUI = { ICONS: { star:'<svg id="star"></svg>', map:'<svg id="map"></svg>', radar:'<svg id="radar"></svg>' } };`,
    sandbox,
  );
  return sandbox;
}

function loadScript(sandbox, rel) {
  vm.runInContext(readFileSync(P(rel), 'utf8'), sandbox, { filename: rel });
}

const SIX_KEYS = ['jin', 'mu', 'shui', 'huo', 'tu', 'kongjian'];
const GLYPH = { jin: '金', mu: '木', shui: '水', huo: '火', tu: '土', kongjian: '域' };
const FORBIDDEN = [/ai-art/i, /ai-avatars/i, /AI image/, /https?:\/\//];

/** 从 sixsys-assets.ts 解析官方素材白名单（origin 相对路径 与 站点文件名） */
function parseWhitelist() {
  const src = readFileSync(P('integration/src/sixsys-assets.ts'), 'utf8');
  const origins = [...src.matchAll(/origin:\s*'([^']+)'/g)].map((m) => m[1]);
  const files = [...src.matchAll(/^\s*file:\s*'([^']+)'/gm)].map((m) => m[1]);
  assert(origins.length >= 5, `白名单 origin 条目不足（${origins.length}）`);
  assert(files.length >= 5, `白名单 file 条目不足（${files.length}）`);
  return { origins, files, base: (/OFFICIAL_ASSET_BASE\s*=\s*'([^']+)'/.exec(src) || [])[1] || '' };
}

const whitelist = { origins: [], files: [], base: '' };
try {
  Object.assign(whitelist, parseWhitelist());
} catch (e) {
  failed += 1;
  results.push({ ok: false, name: '0. 解析素材白名单', detail: String((e && e.message) || e) });
}

/* ---------------------------------------------------------------- 1 加载 */

const sandbox = makeSandbox();
const SCRIPTS = [
  'ui/six-system-icons.js',
  'ui/SixSystemPanel.js',
  'ui/settlement.js',
  'ui/battle-engine.js',
  'ui/achievement-system.js',
];

check('1. 运行时脚本可加载（沙箱内求值）', () => {
  const loaded = [];
  for (const rel of SCRIPTS) {
    assert(existsSync(P(rel)), `缺少源文件 ${rel}`);
    loadScript(sandbox, rel);
    loaded.push(rel);
  }
  const G = vm.runInContext('this', sandbox);
  for (const g of ['SixSystemIcons', 'SixSystemPanel', 'SixSystemSettlement', 'SixSystemBattle', 'SixSystemAchievement']) {
    assert(G[g], `全局 ${g} 未导出`);
  }
  return `${loaded.length} 个脚本，5 个全局对象就位`;
});

const G = vm.runInContext('this', sandbox);

/* ---------------------------------------------------------------- 2 图标 */

check('2. 六系图标注册到 LXHUI.ICONS（原有键不动）', () => {
  const before = { ...G.LXHUI.ICONS };
  G.SixSystemIcons.registerIcons();
  const icons = G.LXHUI.ICONS;
  for (const k of SIX_KEYS) assert(typeof icons[k] === 'string' && icons[k].length > 50, `图标键 ${k} 缺失或过短`);
  for (const k of Object.keys(before)) assert(icons[k] === before[k], `原有键 ${k} 被改动`);
  return `新增 6 键，原 ${Object.keys(before).length} 键逐字节未变`;
});

check('3. 图标 SVG 合法（自包含渐变 + 字形 + viewBox）', () => {
  for (const k of SIX_KEYS) {
    const svg = G.LXHUI.ICONS[k];
    assert(/<svg/.test(svg) && /viewBox=/.test(svg), `${k} 缺少 svg/viewBox`);
    assert(svg.includes(`ssBg-${k}`), `${k} 渐变 id 未去重（应为 ssBg-${k}）`);
    assert(svg.includes(GLYPH[k]), `${k} 缺少字形「${GLYPH[k]}」`);
  }
  return '6 键 SVG 结构与渐变 id 去重校验通过';
});

/* ---------------------------------------------------------------- 4/5/6 结算 */

const winCtx = {
  result: 'win', mode: 'arena', opponent_type: 'official', opponent_id: 3,
  opponent_name: '风息', first_time_defeat: true, win_streak: 3, winner_element: 'jin', seed: 20261005,
  newly_unlocked: ['ach_battle_001'],
};
const loseCtx = { result: 'lose', mode: 'arena', opponent_type: 'official', opponent_id: 2, opponent_name: '无限', seed: 20261005 };

check('4. 胜利结算契约（小黑 + 比丢正向反馈）', () => {
  const r = G.SixSystemSettlement.resolve(winCtx);
  assert(r && r.result === 'win', 'result 应为 win');
  assert(typeof r.version === 'string' && typeof r.duration_ms === 'number' && r.duration_ms > 0, 'version/duration_ms 异常');
  assert(Array.isArray(r.timeline) && r.timeline.length >= 3, 'timeline 过短');
  let last = -1;
  for (const t of r.timeline) {
    assert(typeof t.at_ms === 'number' && t.at_ms >= last, `timeline 非单调：${t.at_ms} < ${last}`);
    last = t.at_ms;
    assert('asset' in t && 'desc' in t && 'key' in t, 'timeline 条目字段不全');
  }
  assert(r.line && typeof r.line.text === 'string' && r.line.text.length > 0, '缺少结算文案');
  assert(r.feedback && r.feedback.positive === true, 'feedback.positive 应为 true');
  assert(r.penalty === false, '胜利不应有惩罚');
  const castText = JSON.stringify(r.feedback.cast || []) + JSON.stringify(r.assets || {});
  assert(/比丢|bidiu/i.test(castText), '胜利反馈缺少比丢');
  assert(/罗小黑|luoxiaohei/i.test(castText), '胜利反馈缺少罗小黑');
  return `timeline ${r.timeline.length} 段 / ${r.duration_ms}ms，cast=${JSON.stringify(r.feedback.cast || [])}`;
});

check('5. 失败结算契约（小黑安慰 + 不惩罚）', () => {
  const r = G.SixSystemSettlement.resolve(loseCtx);
  assert(r && r.result === 'lose', 'result 应为 lose');
  assert(r.feedback && r.feedback.positive === false, '失败 feedback.positive 应为 false');
  assert(r.penalty === false, '失败必须不惩罚');
  assert(r.no_penalty_detail && typeof r.no_penalty_detail === 'object', '缺少 no_penalty_detail 说明');
  assert(r.retry && r.retry.enabled === true, '失败应提供重试入口');
  const sticker = r.feedback.sticker || '';
  assert(sticker, '缺少安慰表情素材');
  const base = path.basename(String(sticker).replace(/\\/g, '/'));
  assert(whitelist.origins.some((o) => o.split('\\').pop() === base), `安慰表情不在官方白名单：${base}`);
  return `安慰素材 ${base}，文案「${r.line.text}」`;
});

check('6. 结算确定性（同 seed 同结果）', () => {
  const a = G.SixSystemSettlement.resolve(winCtx);
  const b = G.SixSystemSettlement.resolve({ ...winCtx });
  assert(JSON.stringify(a) === JSON.stringify(b), '同 seed 两次结果不一致');
  const s1 = G.SixSystemSettlement.pickSticker(20261005);
  const s2 = G.SixSystemSettlement.pickSticker(20261005);
  assert(s1 === s2, 'pickSticker 不确定');
  return `内容版 ${a.version}，pickSticker 稳定`;
});

check('7. 结算素材全部落在官方白名单内（红线）', () => {
  const doc = JSON.stringify({
    win: G.SixSystemSettlement.resolve(winCtx),
    lose: G.SixSystemSettlement.resolve(loseCtx),
    raw: G.SixSystemSettlement.ASSETS,
  });
  for (const re of FORBIDDEN) assert(!re.test(doc), `结算数据命中禁用特征：${re}`);
  const names = [...doc.matchAll(/([^"\\/]+\.(?:jpg|png|gif))/gi)].map((m) => m[1]);
  assert(names.length > 0, '未检出任何素材引用');
  const allowed = new Set(whitelist.origins.map((o) => o.split('\\').pop()));
  const bad = names.filter((n) => !allowed.has(n));
  assert(bad.length === 0, `非白名单素材：${[...new Set(bad)].join(', ')}`);
  return `引用 ${[...new Set(names)].length} 个素材，全部在白名单（${allowed.size} 项）内`;
});

/* ------------------------------------------------------ 7b 平局轨（R5） */

const drawCtx = { result: 'draw', mode: 'arena', opponent_type: 'official', opponent_id: 5, seed: 20261005 };

check('7b. 平局结算独立轨（不判负 / 不惩罚 / 素材合规，R5）', () => {
  const r = G.SixSystemSettlement.resolve(drawCtx);
  assert(r && r.result === 'draw', 'result 应为 draw');
  assert(r.penalty === false, '平局不得惩罚');
  assert(r.feedback && r.feedback.positive === false, '平局 feedback.positive 应为 false');
  const getState = G.SixSystemSettlement.getEmoticonState;
  assert(typeof getState === 'function', '缺少 getEmoticonState（R5 台账接口）');
  const st = getState();
  assert(st && Array.isArray(st.comfort) && st.comfort.length >= 2, `表情台账未装填（comfort ${(st && st.comfort || []).length} 张）`);
  const names = [...JSON.stringify(r).matchAll(/([^"\\/]+\.(?:jpg|png|gif))/gi)].map((m) => m[1]);
  const allowed = new Set(whitelist.origins.map((o) => o.split('\\').pop()));
  const bad = names.filter((n) => !allowed.has(n));
  assert(bad.length === 0, `平局素材不在白名单：${[...new Set(bad)].join(', ')}`);
  return `平局独立轨成立（${r.duration_ms}ms），素材引用 ${[...new Set(names)].length} 处全合规，comfort 池 ${st.comfort.length} 张`;
});

/* ---------------------------------------------------------------- 8 对战内核 */

const statsDoc = readJson(P('data/generated/character_stats.json'));
const decksDoc = readJson(P('data/decks.json'));
const achDoc = readJson(P('data/achievements.json'));

check('8. 对战内核（克制环 + 可复现 + 日志契约）', () => {
  const B = G.SixSystemBattle;
  assert(B.elementFactor('jin', 'mu') === 1.25, '金克木 倍率应为 1.25');
  assert(B.elementFactor('mu', 'jin') === 0.85, '木被金克 倍率应为 0.85');
  assert(B.elementFactor('kongjian', 'jin') === 1.0, '空间系不应参与克制');
  assert(B.elementFactor('none', 'jin') === 1.0, '无系不应参与克制');

  const decks = decksDoc.decks.slice().sort((a, b) => a.character_id - b.character_id);
  const cfg = { mode: 'arena', seed: 424242, selfDeck: decks[0], opponentDeck: decks[1], opponentType: 'official' };
  const det = B.verifyDeterminism(cfg, 3);
  assert(det.deterministic === true, '同输入三次模拟结果不一致');
  const log = G.SixSystemBattle.simulate(cfg).log;
  for (const f of ['battle_id', 'mode', 'my_character_id', 'opponent_id', 'opponent_type', 'result', 'turn_used', 'hp_left', 'seed']) {
    assert(f in log, `战斗日志缺少契约字段 ${f}`);
  }
  const mirror = B.createMirrorBattle(decks[0].character_id, decksDoc, { seed: 7 });
  assert(mirror.is_mirror === true && mirror.opponent_type === 'mirror', '镜像战标记异常');
  return `${log.my_character_id} vs ${log.opponent_id} · ${log.result} · ${log.turn_used} 回合（确定性 3 次一致）`;
});

/* ---------------------------------------------------------------- 9 成就 */

check('9. 成就系统（失败不判定 / 胜利判定 / 土系 C 档复核 · R7 缺口已解除）', () => {
  const A = G.SixSystemAchievement.createAchievementSystem({ achievements: achDoc, characters: statsDoc });
  assert(achDoc.achievements.length === 15, `成就条数应为 15，实为 ${achDoc.achievements.length}`);

  const lose = A.judge({ battle_id: 'B1', mode: 'arena', my_character_id: 1, opponent_id: 2, opponent_type: 'official', result: 'lose', turn_used: 5, hp_left: 0, hp_max: 100, seed: 1 });
  assert(lose.judged === false, '失败不应触发成就判定');
  assert(lose.newly_unlocked.length === 0, '失败不应解锁成就');

  const win = A.judge({ battle_id: 'B2', mode: 'challenge', my_character_id: 1, opponent_id: 3, opponent_type: 'official', result: 'win', turn_used: 6, hp_left: 120, hp_max: 120, seed: 2 });
  assert(win.judged === true, '胜利应触发判定');
  assert(win.context.my_element === 'jin', '应回传我方主属性');

  A.unlockCharacters(statsDoc.characters.map((c) => c.id));
  const covered = A.metricValue('elements_c_covered');
  assert(covered === 5, `五系 C 档覆盖应为 5（R7 土系缺口已解除），实为 ${covered}`);
  const tuC = statsDoc.characters.filter((c) => c.element === 'tu' && ['C', 'B', 'A'].includes(c.tier)).length;
  assert(tuC >= 1, `土系 C 档以上应 >= 1（R7 复核），实为 ${tuC}`);
  return `15 条成就；全量解锁后五系覆盖 ${covered}/5（土系 ${tuC} 名 C 档以上，ach_system_001 静态可达成）`;
});

/* ---------------------------------------------------------------- 10 数据规模 */

check('10. 数据规模一致（数值 / 卡组 / 成就一一对应）', () => {
  assert(statsDoc.characters.length === 488, `角色应为 488，实为 ${statsDoc.characters.length}`);
  assert(decksDoc.decks.length === 488, `卡组应为 488，实为 ${decksDoc.decks.length}`);
  const statIds = new Set(statsDoc.characters.map((c) => c.id));
  const missing = decksDoc.decks.filter((d) => !statIds.has(d.character_id)).map((d) => d.character_id);
  assert(missing.length === 0, `卡组存在无对应数值的角色：${missing.slice(0, 5).join(',')}`);
  const mainline = statsDoc.characters.filter((c) => c.mainline).length;
  return `角色 488 / 卡组 488 / 成就 15 / 主线 ${mainline}`;
});

/* ---------------------------------------------------------------- 11 红线 */

check('11. 集成包源码红线扫描（无 AI 目录引用 / 无外链）', () => {
  const files = [
    'integration/src/sixsys-types.ts',
    'integration/src/sixsys-assets.ts',
    'integration/src/sixsys-data.ts',
    'integration/src/SixSystemPanel.tsx',
    'integration/src/SettlementStage.tsx',
    'integration/src/AchievementBanner.tsx',
    'integration/src/index.ts',
  ];
  const hits = [];
  for (const rel of files) {
    assert(existsSync(P(rel)), `缺少交付文件 ${rel}`);
    const src = readFileSync(P(rel), 'utf8');
    for (const re of FORBIDDEN) if (re.test(src)) hits.push(`${rel} → ${re}`);
  }
  assert(hits.length === 0, `命中禁用特征：${hits.join(' | ')}`);
  assert(whitelist.base === '/sixsys/official/', `素材根路径应为 /sixsys/official/，实为 ${whitelist.base}`);
  assert(readFileSync(P('integration/src/sixsys-data.ts'), 'utf8').includes("'/sixsys/data/'"), '数据根路径应为 /sixsys/data/');
  return `${files.length} 个交付文件通过；素材根 ${whitelist.base}`;
});

/* ---------------------------------------------------------------- 输出 */

const summary = {
  ok: failed === 0,
  total: results.length,
  failed,
  checks: results.map((r) => ({ ok: r.ok, name: r.name })),
};

if (JSON_ONLY) {
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
} else {
  console.log('sixsys × zszm 集成包 · 运行时冒烟自检\n');
  for (const r of results) {
    console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  }
  console.log(`\n共 ${results.length} 项，失败 ${failed} 项 → ${failed === 0 ? '全部通过' : '存在失败'}`);
}
process.exit(failed === 0 ? 0 : 1);
