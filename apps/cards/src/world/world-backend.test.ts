/**
 * 后端集成测试：用 fake-indexeddb 在 Node 里注入模拟的 IndexedDB 实现，
 * 跑通「出发 → 结算（出行） → 照料（过夜） → 续读」整条存档链路。
 *
 * 前一轮只测了纯函数（commitResult / nightResult），续读（saveWorld → 重新 openWorld）
 * 依赖 shared-session 的 IndexedDB 后端，Node 原生没有 indexedDB 会直接 reject，
 * 所以这条路一直没法验证。这里用 fake-indexeddb 补上模拟环境，通过模拟 IndexedDB
 * 验证存档的保存和读回；这不等于真实浏览器里的原生落盘行为。
 */
import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';

import { openWorld, saveWorld } from './store';
import { commitResult, nightResult } from './rules';
import { startExpedition, expeditionResult, defaultLoadout } from './activities';

const names = (id: number) => 'companion-' + id;

/** 每个用例用全新的 IndexedDB，避免跨用例串档。 */
function freshDB() {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
}

test('出发 → 结算（胜利出行） → 照料（过夜） → 续读：通过模拟 IndexedDB 验证保存和读回', async () => {
  freshDB();

  // 出发：首次打开世界
  let store = await openWorld();
  assert.equal(store.snapshot.world.day, 1);
  assert.equal(store.snapshot.world.daypart, 'morning');
  assert.equal(store.snapshot.journal.entries.length, 0);
  const companionCount = Object.keys(store.snapshot.world.companions).length;
  assert.ok(companionCount > 0, '应至少有一名同行者');
  assert.equal(store.ledger.resources.spirit, 0, '初始灵质应为 0');

  // 结算：用默认编队开一局，强制判胜，走完整提交
  const loadout = defaultLoadout(store.snapshot.world);
  const session = startExpedition(store.snapshot.world, store.ledger, loadout, 123456);
  (session.state as unknown as { phase: string }).phase = 'victory';
  const exp = expeditionResult(session, store.snapshot.world, store.ledger);
  const out = commitResult(store.snapshot, store.ledger, exp);
  assert.equal(out.duplicate, false, '首次提交不应被判重复');
  store = await saveWorld(store, out.snapshot, { resources: out.resources });

  assert.equal(store.snapshot.world.day, 1, '白天出行不推进游戏日');
  assert.equal(store.snapshot.world.daypart, 'evening', '出行后应到傍晚');
  assert.equal(store.snapshot.journal.entries.length, 1, '见理应写入一条');
  assert.equal(store.ledger.resources.spirit, 20, '胜利应结算 +20 灵质');

  // 照料：过一夜，结算休养与收成
  const night = nightResult(store.snapshot.world, store.ledger, names);
  const out2 = commitResult(store.snapshot, store.ledger, night);
  store = await saveWorld(store, out2.snapshot, { resources: out2.resources });

  assert.equal(store.snapshot.world.day, 2, '过夜应推进到第 2 日');
  assert.equal(store.snapshot.world.daypart, 'morning', '过夜后应回到清晨');
  assert.equal(store.snapshot.journal.entries.length, 2, '过夜见理应追加一条');

  // 续读：模拟关闭页面后重新打开
  const reloaded = await openWorld();
  assert.deepEqual(reloaded.snapshot, store.snapshot, '续读应原样恢复存档快照');
  assert.equal(reloaded.snapshot.world.day, 2);
  assert.equal(reloaded.snapshot.journal.entries.length, 2);
  // 灵质累计：胜利 +20，过夜 +2（nightSpirit），共 22
  assert.equal(reloaded.ledger.resources.spirit, 22, '续读后共享资源（灵质）应保留累计值');
});

test('续读对账：存档缺失的同行者重新打开时应被补回默认照料状态', async () => {
  freshDB();
  const store = await openWorld();
  const snapshot = structuredClone(store.snapshot);
  const missingId = Object.keys(snapshot.world.companions)[0];
  delete (snapshot.world.companions as Record<string, unknown>)[missingId];

  // 故意存一份缺人的存档，看续读能否自愈
  await saveWorld(store, snapshot);
  const reloaded = await openWorld();

  assert.ok(reloaded.snapshot.world.companions[missingId], '缺失的同行者应在续读时补回');
  assert.equal(reloaded.snapshot.world.companions[missingId].condition, 'healthy', '补回的同行者应为健康');
  assert.equal(reloaded.snapshot.world.companions[missingId].assignment, 'garden', '补回的同行者应为默认分工（园圃）');
});

test('重复提交同一结果 ID 不会二次生效（幂等）', async () => {
  freshDB();
  const store = await openWorld();
  const loadout = defaultLoadout(store.snapshot.world);
  const session = startExpedition(store.snapshot.world, store.ledger, loadout, 777);
  (session.state as unknown as { phase: string }).phase = 'victory';
  const exp = expeditionResult(session, store.snapshot.world, store.ledger);

  const first = commitResult(store.snapshot, store.ledger, exp);
  const second = commitResult(first.snapshot, store.ledger, exp);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true, '同一结果 ID 再次提交应被判重复');
  assert.deepEqual(second.snapshot, first.snapshot, '重复提交不应改变世界');
});
