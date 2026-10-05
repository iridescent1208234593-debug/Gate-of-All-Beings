/**
 * @file shared-types 契约校验脚本（零依赖，Node ESM）。
 * 运行：node verify/contract.mjs（或在包目录执行 npm run verify）
 * 输出 PASS / FAIL / SKIP 汇总；存在 FAIL 时 process.exitCode = 1。
 * DB 比对一律以只读 URI（file:...?mode=ro）打开，禁止任何写操作；不可读时降级为 SKIP。
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WUXING,
  WUXING_KEYS,
  WUXING_LABELS,
  toWuxingKey,
  toWuxingLabel,
  isWuxing,
  wuxingRole,
} from '../wuxing.js';
import {
  EXTENDED_ELEMENTS,
  GENERIC_ELEMENT_KEY,
  ELEMENT_LABELS,
  ELEMENT_IDS,
  toElementId,
  isElementId,
  elementLabel,
  isWuxingElement,
  SPIRIT_SPACE_KIND,
  BASE_SPIRIT_SPACE,
  SPIRIT_SPACE_NODE,
  resolveSpiritSpaceKind,
} from '../element.js';
import {
  RESOURCE_DOMAINS,
  RESOURCE_DOMAIN_IDS,
  resourcesOf,
  resourceLabel,
  isResourceId,
  findResourceDomains,
} from '../resource.js';
import {
  SYSTEMS,
  SYSTEM_NAMES,
  ID_PREFIX,
  makeId,
  parseId,
  isIdOf,
  isNamespacedId,
} from '../id.js';
import {
  REALMS,
  REALM_KEYS,
  realmByKey,
  realmByName,
  realmOrder,
  nextRealm,
  compareRealm,
} from '../realm.js';
import { tick, createTicker, assertTickResult, TICK_UNITS } from '../tick.js';

/** 可选本地 DB（只读比对用；大型素材目录不由 Git 管理）。 */
const DB_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../assets/罗小黑战记数据库/db/worldview_luoxiaohei_v4.db');

/** 浮点比较容差。 */
const EPS = 1e-9;

/**
 * 标记「降级跳过」。
 */
class SkipError extends Error {}

/**
 * 抛出 SKIP（不计失败）。
 * @param {string} reason 跳过原因
 * @returns {never} 永不返回
 */
function skip(reason) {
  throw new SkipError(reason);
}

/**
 * @type {{name: string, status: 'PASS'|'FAIL'|'SKIP', detail: string}[]}
 */
const results = [];

/**
 * 执行单个校验项并记录结果。
 * @param {string} name 校验项名称
 * @param {() => (void|Promise<void>)} fn 校验函数（断言失败即抛错）
 * @returns {Promise<void>} 无
 */
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, status: 'PASS', detail: '' });
    console.log(`PASS  ${name}`);
  } catch (error) {
    if (error instanceof SkipError) {
      results.push({ name, status: 'SKIP', detail: error.message });
      console.log(`SKIP  ${name} — ${error.message}`);
      return;
    }
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'FAIL', detail });
    console.log(`FAIL  ${name} — ${detail}`);
  }
}

/* ------------------------------------------------------------------ *
 * 1. 五行基础表
 * ------------------------------------------------------------------ */

await check("1-a WUXING_KEYS 恰为 ['jin','mu','shui','huo','tu']", () => {
  assert.deepEqual([...WUXING_KEYS], ['jin', 'mu', 'shui', 'huo', 'tu']);
  assert.equal(WUXING_KEYS.length, 5);
});

await check('1-b WUXING 每项 key 与键名一致，label/role 齐全', () => {
  assert.deepEqual(Object.keys(WUXING).sort(), ['huo', 'jin', 'mu', 'shui', 'tu']);
  for (const key of WUXING_KEYS) {
    assert.equal(WUXING[key].key, key, `WUXING.${key}.key 应为 '${key}'`);
    assert.equal(typeof WUXING[key].label, 'string');
    assert.equal(typeof WUXING[key].role, 'string');
    assert.ok(WUXING[key].label.length > 0 && WUXING[key].role.length > 0);
  }
});

await check('1-c 5 个 label 唯一且均为单个中文字', () => {
  const labels = WUXING_KEYS.map((key) => WUXING[key].label);
  assert.equal(new Set(labels).size, 5, `label 应唯一，实际：${labels.join('/')}`);
  for (const label of labels) {
    assert.match(label, /^[\u4e00-\u9fa5]$/, `label '${label}' 应为单个中文字`);
  }
});

await check('1-d 常量冻结，WUXING_LABELS 与 WUXING 派生一致', () => {
  assert.ok(Object.isFrozen(WUXING), 'WUXING 未冻结');
  assert.ok(Object.isFrozen(WUXING_KEYS), 'WUXING_KEYS 未冻结');
  assert.ok(Object.isFrozen(WUXING_LABELS), 'WUXING_LABELS 未冻结');
  for (const key of WUXING_KEYS) {
    assert.ok(Object.isFrozen(WUXING[key]), `WUXING.${key} 未冻结`);
    assert.equal(WUXING_LABELS[key], WUXING[key].label);
  }
  assert.deepEqual(Object.keys(WUXING_LABELS), ['jin', 'mu', 'shui', 'huo', 'tu']);
});

/* ------------------------------------------------------------------ *
 * 2. toWuxingKey 归一化
 * ------------------------------------------------------------------ */

await check("2-a toWuxingKey 归一：'jin'/'JIN'/' 金 '/'金' → 'jin'，'水' → 'shui'", () => {
  assert.equal(toWuxingKey('jin'), 'jin');
  assert.equal(toWuxingKey('JIN'), 'jin');
  assert.equal(toWuxingKey(' 金 '), 'jin');
  assert.equal(toWuxingKey('金'), 'jin');
  assert.equal(toWuxingKey('水'), 'shui');
  assert.equal(toWuxingKey('Mu'), 'mu');
  assert.equal(toWuxingKey('TU'), 'tu');
  assert.equal(toWuxingKey(' 火 '), 'huo');
});

await check("2-b toWuxingKey 非法值 → null（'雷'/''/null/123/'gold'）", () => {
  for (const bad of ['雷', '', '   ', null, undefined, 123, 'gold', {}, [], true, NaN]) {
    assert.equal(toWuxingKey(bad), null, `toWuxingKey(${JSON.stringify(bad)}) 应为 null`);
  }
});

await check('2-c toWuxingLabel / isWuxing / wuxingRole 行为正确', () => {
  assert.equal(toWuxingLabel('jin'), '金');
  assert.equal(toWuxingLabel('金'), null);
  assert.equal(toWuxingLabel('bad'), null);
  assert.equal(isWuxing('jin'), true);
  assert.equal(isWuxing('JIN'), false, 'isWuxing 仅接受精确 ASCII key');
  assert.equal(isWuxing('金'), false);
  assert.equal(wuxingRole('jin'), '攻击');
  assert.equal(wuxingRole('tu'), '防御');
  assert.equal(wuxingRole('金'), null);
});

/* ------------------------------------------------------------------ *
 * 3. 中文 key 不混用
 * ------------------------------------------------------------------ */

await check("3-a isWuxing('金') === false 且 isElementId('金') === false", () => {
  assert.equal(isWuxing('金'), false);
  assert.equal(isElementId('金'), false);
});

await check('3-b ELEMENT_IDS 全部为 ASCII 小写字母', () => {
  assert.ok(ELEMENT_IDS.length > 0);
  for (const id of ELEMENT_IDS) {
    assert.match(id, /^[a-z]+$/, `ELEMENT_IDS 含非 ASCII 小写项：'${id}'`);
  }
});

/* ------------------------------------------------------------------ *
 * 4. 元素体系
 * ------------------------------------------------------------------ */

await check('4-a ELEMENT_IDS 长度 11、无重复', () => {
  assert.equal(ELEMENT_IDS.length, 11);
  assert.equal(Object.keys(ELEMENT_LABELS).length, 11);
  assert.equal(new Set(ELEMENT_IDS).size, 11, 'ELEMENT_IDS 存在重复');
});

await check('4-b ELEMENT_IDS 覆盖五系 + 五扩展系 + generic', () => {
  const expected = [
    'jin', 'mu', 'shui', 'huo', 'tu',
    'shengling', 'kongjian', 'xinling', 'zaowu', 'suoyu',
    'generic',
  ];
  assert.deepEqual([...ELEMENT_IDS], expected);
  assert.deepEqual(Object.keys(EXTENDED_ELEMENTS), [
    'shengling', 'kongjian', 'xinling', 'zaowu', 'suoyu',
  ]);
  assert.equal(GENERIC_ELEMENT_KEY, 'generic');
  assert.equal(ELEMENT_LABELS.generic, '通用');
});

await check("4-c toElementId('通用')==='generic'、('空间系')==='kongjian'", () => {
  assert.equal(toElementId('通用'), 'generic');
  assert.equal(toElementId('空间系'), 'kongjian');
  assert.equal(toElementId('generic'), 'generic');
  assert.equal(toElementId('KONGJIAN'), 'kongjian');
  assert.equal(toElementId('金'), 'jin');
  assert.equal(toElementId('火'), 'huo');
  assert.equal(toElementId('锁御系'), 'suoyu');
  assert.equal(toElementId('金系'), null);
  assert.equal(toElementId(''), null);
  assert.equal(toElementId(null), null);
});

await check('4-d elementLabel / isWuxingElement / 常量冻结', () => {
  assert.equal(elementLabel('kongjian'), '空间系');
  assert.equal(elementLabel('generic'), '通用');
  assert.equal(elementLabel('bad'), null);
  assert.equal(isWuxingElement('jin'), true);
  assert.equal(isWuxingElement('tu'), true);
  assert.equal(isWuxingElement('kongjian'), false);
  assert.equal(isWuxingElement('generic'), false);
  assert.ok(Object.isFrozen(ELEMENT_IDS));
  assert.ok(Object.isFrozen(ELEMENT_LABELS));
  assert.ok(Object.isFrozen(EXTENDED_ELEMENTS));
});

/* ------------------------------------------------------------------ *
 * 5. 术语消歧：灵质空间
 * ------------------------------------------------------------------ */

await check("5-a resolveSpiritSpaceKind：'lj'→base、'stw'/'xx'→node、'eco'→null", () => {
  assert.equal(resolveSpiritSpaceKind('lj'), 'base');
  assert.equal(resolveSpiritSpaceKind('stw'), 'node');
  assert.equal(resolveSpiritSpaceKind('xx'), 'node');
  assert.equal(resolveSpiritSpaceKind('eco'), null);
  assert.equal(resolveSpiritSpaceKind('bad'), null);
  assert.equal(resolveSpiritSpaceKind(null), null);
  assert.equal(resolveSpiritSpaceKind(123), null);
});

await check('5-b BASE_SPIRIT_SPACE !== SPIRIT_SPACE_NODE 且常量冻结', () => {
  assert.notEqual(BASE_SPIRIT_SPACE, SPIRIT_SPACE_NODE);
  assert.equal(BASE_SPIRIT_SPACE, 'base_spirit_space');
  assert.equal(SPIRIT_SPACE_NODE, 'spirit_space_node');
  assert.deepEqual(SPIRIT_SPACE_KIND, { BASE_SPIRIT_SPACE: 'base', SPIRIT_SPACE_NODE: 'node' });
  assert.ok(Object.isFrozen(SPIRIT_SPACE_KIND));
});

/* ------------------------------------------------------------------ *
 * 6. 资源域
 * ------------------------------------------------------------------ */

await check('6-a RESOURCE_DOMAINS 三域键正确且冻结', () => {
  assert.deepEqual([...RESOURCE_DOMAIN_IDS], ['eco', 'management', 'card']);
  assert.deepEqual(Object.keys(RESOURCE_DOMAINS.eco), ['water', 'food', 'mineral']);
  assert.deepEqual(Object.keys(RESOURCE_DOMAINS.management), [
    'spirit', 'food', 'faqi', 'wood', 'herb', 'stone', 'ore',
  ]);
  assert.deepEqual(Object.keys(RESOURCE_DOMAINS.card), [
    'spiritStone', 'lifespan', 'pills', 'treasures', 'companions',
  ]);
  assert.ok(Object.isFrozen(RESOURCE_DOMAINS));
  for (const domain of RESOURCE_DOMAIN_IDS) {
    assert.ok(Object.isFrozen(RESOURCE_DOMAINS[domain]), `${domain} 域未冻结`);
  }
});

await check("6-b 域隔离：isResourceId('eco','spirit')===false、('management','spirit')===true", () => {
  assert.equal(isResourceId('eco', 'spirit'), false);
  assert.equal(isResourceId('management', 'spirit'), true);
  assert.equal(isResourceId('card', 'spiritStone'), true);
  assert.equal(isResourceId('eco', 'spiritStone'), false);
  assert.equal(isResourceId('bad', 'spirit'), false);
});

await check("6-c findResourceDomains('food') → ['eco','management']", () => {
  assert.deepEqual([...findResourceDomains('food')], ['eco', 'management']);
  assert.deepEqual([...findResourceDomains('spirit')], ['management']);
  assert.deepEqual([...findResourceDomains('nonexistent')], []);
});

await check('6-d resourcesOf / resourceLabel 合法与非法入参', () => {
  assert.deepEqual([...resourcesOf('eco')], ['water', 'food', 'mineral']);
  assert.equal(resourcesOf('eco').length, 3);
  assert.equal(resourcesOf('card').length, 5);
  assert.deepEqual([...resourcesOf('bad')], []);
  assert.equal(resourceLabel('management', 'spirit'), '灵质');
  assert.equal(resourceLabel('eco', 'water'), '水');
  assert.equal(resourceLabel('eco', 'spirit'), null);
  assert.equal(resourceLabel('bad', 'water'), null);
  assert.equal(resourceLabel('eco', null), null);
});

/* ------------------------------------------------------------------ *
 * 7. 命名空间 id
 * ------------------------------------------------------------------ */

await check('7-a 四系统 makeId / parseId 往返一致', () => {
  assert.deepEqual([...SYSTEMS], ['eco', 'lj', 'stw', 'xx']);
  for (const system of SYSTEMS) {
    const id = makeId(system, 12);
    assert.equal(id, `${system}:12`);
    const parsed = parseId(id);
    assert.notEqual(parsed, null, `parseId('${id}') 应可解析`);
    assert.equal(parsed.system, system);
    assert.equal(parsed.localId, '12');
  }
  assert.equal(makeId('eco', '12'), 'eco:12');
  assert.equal(makeId('xx', 'abc-01'), 'xx:abc-01');
});

await check("7-b makeId('bad',1)===null、parseId('eco:')===null", () => {
  assert.equal(makeId('bad', 1), null);
  assert.equal(makeId('eco', ''), null);
  assert.equal(makeId('eco', null), null);
  assert.equal(makeId('eco', undefined), null);
  assert.equal(makeId(null, 1), null);
  assert.equal(parseId('eco:'), null);
  assert.equal(parseId('eco:   '), null);
  assert.equal(parseId('bad:1'), null);
  assert.equal(parseId('12'), null);
  assert.equal(parseId(null), null);
  assert.equal(parseId(12), null);
});

await check("7-c isIdOf('stw','stw:12')===true 与 isNamespacedId", () => {
  assert.equal(isIdOf('stw', 'stw:12'), true);
  assert.equal(isIdOf('stw', 'eco:12'), false);
  assert.equal(isIdOf('bad', 'stw:12'), false);
  assert.equal(isNamespacedId('stw:12'), true);
  assert.equal(isNamespacedId('12'), false);
  assert.equal(isNamespacedId(null), false);
  assert.deepEqual(NAME_MAP_CHECK(), true);
});

/**
 * 校验 SYSTEM_NAMES / ID_PREFIX 覆盖四系统且前缀自洽。
 * @returns {boolean} 全部通过返回 true
 */
function NAME_MAP_CHECK() {
  assert.deepEqual([...Object.keys(SYSTEM_NAMES)].sort(), ['eco', 'lj', 'stw', 'xx']);
  assert.deepEqual([...Object.keys(ID_PREFIX)].sort(), ['eco', 'lj', 'stw', 'xx']);
  assert.equal(ID_PREFIX.eco, 'eco:');
  assert.equal(SYSTEM_NAMES.eco, 'ecoplanet3d-js');
  assert.equal(SYSTEM_NAMES.lj, 'lingjing-huiguan');
  assert.equal(SYSTEM_NAMES.stw, 'Slay-the-Web');
  assert.equal(SYSTEM_NAMES.xx, 'xiuxian-card');
  assert.ok(Object.isFrozen(SYSTEMS) && Object.isFrozen(SYSTEM_NAMES) && Object.isFrozen(ID_PREFIX));
  return true;
}

/* ------------------------------------------------------------------ *
 * 8. 境界：常量硬编码 + DB 只读比对
 * ------------------------------------------------------------------ */

await check('8-a REALMS 6 条与规格硬编码断言一致', () => {
  const expected = [
    { realm_key: 'qi', realm_name: '练气', order_index: 1 },
    { realm_key: 'foundation', realm_name: '筑基', order_index: 2 },
    { realm_key: 'golden', realm_name: '金丹', order_index: 3 },
    { realm_key: 'nascent', realm_name: '元婴', order_index: 4 },
    { realm_key: 'deity', realm_name: '化神', order_index: 5 },
    { realm_key: 'tribulation', realm_name: '渡劫', order_index: 6 },
  ];
  assert.equal(REALMS.length, 6);
  assert.deepEqual(REALMS.map((r) => ({ ...r })), expected);
  assert.deepEqual([...REALM_KEYS], expected.map((r) => r.realm_key));
  assert.ok(Object.isFrozen(REALMS));
  for (const entry of REALMS) assert.ok(Object.isFrozen(entry));

  assert.equal(realmByKey('qi').realm_name, '练气');
  assert.equal(realmByKey('bad'), null);
  assert.equal(realmByName('练气').realm_key, 'qi');
  assert.equal(realmByName(' 渡劫 ').order_index, 6);
  assert.equal(realmByName('大乘'), null);
  assert.equal(realmOrder('golden'), 3);
  assert.equal(realmOrder('bad'), null);
  assert.equal(nextRealm('qi').realm_key, 'foundation');
  assert.equal(nextRealm('tribulation'), null);
  assert.equal(compareRealm('qi', 'golden'), -2);
  assert.equal(compareRealm('deity', 'deity'), 0);
  assert.equal(compareRealm('bad', 'qi'), null);
});

await check('8-b DB 只读比对 cultivation_realm（file:...?mode=ro）', async () => {
  if (!existsSync(DB_PATH)) skip(`DB 文件不存在：${DB_PATH}`);
  let DatabaseSync;
  try {
    ({ DatabaseSync } = await import('node:sqlite'));
  } catch (error) {
    skip(`node:sqlite 不可用（${error instanceof Error ? error.message : String(error)}）`);
  }
  const uri = `file:${DB_PATH.replace(/\\/g, '/')}?mode=ro`;
  let db;
  try {
    db = new DatabaseSync(uri);
  } catch (error) {
    skip(`只读打开 DB 失败（${error instanceof Error ? error.message : String(error)}）`);
  }
  try {
    const rows = db
      .prepare('SELECT realm_key, realm_name, order_index FROM cultivation_realm ORDER BY order_index')
      .all()
      .map((row) => ({
        realm_key: String(row.realm_key),
        realm_name: String(row.realm_name),
        order_index: Number(row.order_index),
      }));
    assert.equal(rows.length, 6, `DB cultivation_realm 应为 6 行，实际 ${rows.length} 行`);
    assert.deepEqual(rows, REALMS.map((r) => ({ ...r })), 'DB 行与 realm.js 常量不一致');
    console.log(`      [DB] 只读打开 ${uri}`);
    console.log(`      [DB] cultivation_realm 6 行与 realm.js REALMS 完全一致`);
  } finally {
    db.close();
  }
});

/* ------------------------------------------------------------------ *
 * 9. tick 契约
 * ------------------------------------------------------------------ */

await check('9-a fixedDt=0.25：dt=1.0 → 4 次调用、余量 0；dt=0.3 → 1 次、余量 0.05', () => {
  let calls = 0;
  const fn = (state, dt) => {
    calls += 1;
    return { t: state.t + dt };
  };

  calls = 0;
  const tickerFull = createTicker(fn, { fixedDt: 0.25 });
  let state = tickerFull.tick({ t: 0 }, 1.0);
  assert.equal(calls, 4, `dt=1.0 应调用 4 次，实际 ${calls} 次`);
  assert.ok(Math.abs(tickerFull.pendingDt()) < EPS, `dt=1.0 余量应为 0，实际 ${tickerFull.pendingDt()}`);
  assert.ok(Math.abs(state.t - 1.0) < EPS, `dt=1.0 推进后状态应为 1.0，实际 ${state.t}`);

  calls = 0;
  const tickerPart = createTicker(fn, { fixedDt: 0.25 });
  tickerPart.tick({ t: 0 }, 0.3);
  assert.equal(calls, 1, `dt=0.3 应调用 1 次，实际 ${calls} 次`);
  assert.ok(
    Math.abs(tickerPart.pendingDt() - 0.05) < EPS,
    `dt=0.3 余量应为 0.05，实际 ${tickerPart.pendingDt()}`,
  );
});

await check('9-b dt=10 时不超过 maxSubSteps 次（余量丢弃防死循环）', () => {
  let calls = 0;
  const fn = (state, dt) => {
    calls += 1;
    return { t: state.t + dt };
  };

  calls = 0;
  const ticker = createTicker(fn, { fixedDt: 0.25 });
  ticker.tick({ t: 0 }, 10);
  assert.equal(calls, 5, `默认 maxSubSteps=5，应调用 5 次，实际 ${calls} 次`);
  assert.equal(ticker.pendingDt(), 0, '超限后余量应被丢弃为 0');

  calls = 0;
  const ticker3 = createTicker(fn, { fixedDt: 0.25, maxSubSteps: 3 });
  ticker3.tick({ t: 0 }, 10);
  assert.equal(calls, 3, `maxSubSteps=3 应调用 3 次，实际 ${calls} 次`);
  assert.equal(ticker3.pendingDt(), 0);
});

await check('9-c fixedDt=null 时原样转发 tickFn(state, dt)', () => {
  const seen = [];
  const fn = (state, dt) => {
    seen.push([state, dt]);
    return { t: state.t + dt };
  };
  const ticker = createTicker(fn, { fixedDt: null });
  const input = { t: 5 };
  const out = ticker.tick(input, 0.37);
  assert.equal(seen.length, 1);
  assert.equal(seen[0][0], input, 'state 应原样传递');
  assert.ok(Math.abs(seen[0][1] - 0.37) < EPS, 'dt 应原样传递');
  assert.ok(Math.abs(out.t - 5.37) < EPS);
  assert.equal(ticker.pendingDt(), 0, 'fixedDt=null 不应累积余量');

  const tickerDefault = createTicker(fn);
  tickerDefault.tick({ t: 0 }, 0.9);
  assert.equal(tickerDefault.pendingDt(), 0, '默认 fixedDt=null 不应累积余量');
});

await check('9-d reset / pendingDt / tick 默认实现 / assertTickResult / TICK_UNITS', () => {
  let calls = 0;
  const fn = (state) => {
    calls += 1;
    return { ...state };
  };
  const ticker = createTicker(fn, { fixedDt: 0.25 });
  ticker.tick({ t: 0 }, 0.3);
  assert.ok(Math.abs(ticker.pendingDt() - 0.05) < EPS);
  ticker.reset();
  assert.equal(ticker.pendingDt(), 0, 'reset 后余量应为 0');
  const before = calls;
  ticker.tick({ t: 0 }, 0.2);
  assert.equal(calls, before, '余量 0.2 < 0.25 时不应调用 tickFn');

  const state = { t: 0 };
  assert.equal(tick(state, 1 / 60), state, '默认 tick 应为 no-op 并返回同一 state 引用');

  assert.deepEqual(assertTickResult({ t: 1 }), { t: 1 });
  assert.throws(() => assertTickResult(null), TypeError);
  assert.throws(() => assertTickResult(undefined), TypeError);
  assert.throws(() => assertTickResult(1), TypeError);
  assert.throws(() => assertTickResult('x'), TypeError);

  assert.throws(() => createTicker(null), TypeError);
  assert.throws(() => createTicker(() => {}, { fixedDt: 0 }), TypeError);
  assert.throws(() => createTicker(() => {}, { maxSubSteps: 0 }), TypeError);

  assert.deepEqual(TICK_UNITS, { SECOND: 1, MANAGEMENT_STEP: 0.25, CARD_TURN: 1 });
  assert.ok(Object.isFrozen(TICK_UNITS));
});

/* ------------------------------------------------------------------ *
 * 汇总
 * ------------------------------------------------------------------ */

const total = results.length;
const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL');
const skipped = results.filter((r) => r.status === 'SKIP');

console.log('\n================ 汇总 ================');
console.log(`合计 ${total} 项  |  PASS ${passed}  |  FAIL ${failed.length}  |  SKIP ${skipped.length}`);
if (skipped.length > 0) {
  for (const item of skipped) console.log(`  SKIP  ${item.name} — ${item.detail}`);
}
if (failed.length > 0) {
  for (const item of failed) console.log(`  FAIL  ${item.name} — ${item.detail}`);
  process.exitCode = 1;
  console.log('结果：存在失败项，exitCode=1');
} else {
  console.log('结果：全部断言通过（SKIP 项不计失败），exitCode=0');
}
