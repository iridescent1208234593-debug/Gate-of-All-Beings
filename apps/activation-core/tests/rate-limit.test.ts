/**
 * #43 M13：限流状态多实例共享、标识轮换与转发头伪造的负向测试（需一次性 PostgreSQL）
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { getTestDatabaseUrl, migrateTestDatabase, prepareTestEnv, TEST_CLIENT_API_KEY } from './helpers/test-env';

prepareTestEnv({ IRIDESCENTLY_CLIENT_IP_HEADER: undefined });
const skip = getTestDatabaseUrl() ? false : '未设置 ACTIVATION_CORE_TEST_DATABASE_URL（一次性测试库）';

async function resetBuckets() {
  const { db } = await import('@/db/client');
  const { sql } = await import('drizzle-orm');
  await db.execute(sql`TRUNCATE rate_limit_buckets`);
}

function verifyRequest(deviceId: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/client/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': TEST_CLIENT_API_KEY, ...headers },
    body: JSON.stringify({ device_id: deviceId }),
  });
}

async function callVerify(deviceId: string, headers: Record<string, string> = {}) {
  const { POST } = await import('@/app/api/client/verify/route');
  const { NextRequest } = await import('next/server');
  return await POST(new NextRequest(verifyRequest(deviceId, headers)));
}

describe('数据库共享限流', { skip }, () => {
  before(async () => {
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    delete process.env.IRIDESCENTLY_CLIENT_IP_HEADER;
    await resetBuckets();
  });

  after(async () => {
    const { dbPool } = await import('@/db/client');
    await dbPool.end();
  });

  test('并发请求计数原子：40 个并发只放行上限内的 10 个', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    const config = { maxRequests: 10, windowMs: 60_000, keyPrefix: 'concurrency_test' };
    const results = await Promise.all(Array.from({ length: 40 }, () => checkRateLimit('k', config)));
    assert.equal(results.filter((r) => !r.limited).length, 10);
    assert.deepEqual(results.map((r) => r.count).sort((a, b) => a - b), Array.from({ length: 40 }, (_, i) => i + 1));
  });

  test('另一进程（另一实例）与本进程共用同一计数', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    const config = { maxRequests: 5, windowMs: 60_000, keyPrefix: 'instance_test' };
    for (let i = 0; i < 3; i++) await checkRateLimit('shared-key', config);

    const helper = path.resolve(__dirname, 'helpers/consume-rate-limit.ts');
    const output = execFileSync(process.execPath, ['--import', 'tsx', helper, 'shared-key', '3', '5'], {
      cwd: path.resolve(__dirname, '..'),
      env: process.env,
      encoding: 'utf8',
    });
    assert.deepEqual(JSON.parse(output), [
      { count: 4, limited: false },
      { count: 5, limited: false },
      { count: 6, limited: true },
    ]);

    const mine = await checkRateLimit('shared-key', config);
    assert.equal(mine.count, 7);
    assert.equal(mine.limited, true);
  });

  test('窗口过期后重新计数，过期行可被清理', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    const { deleteExpiredRateLimitBuckets } = await import('@/db/repositories/rate-limit-repository');
    const config = { maxRequests: 2, windowMs: 200, keyPrefix: 'expiry_test' };
    await checkRateLimit('k', config);
    await checkRateLimit('k', config);
    assert.equal((await checkRateLimit('k', config)).limited, true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(await deleteExpiredRateLimitBuckets() >= 1, true);
    const fresh = await checkRateLimit('k', config);
    assert.equal(fresh.count, 1);
    assert.equal(fresh.limited, false);
  });

  test('限流表只存身份摘要，不存原始 IP / 设备标识', async () => {
    process.env.IRIDESCENTLY_CLIENT_IP_HEADER = 'cf-connecting-ip';
    await callVerify('device-raw-identifier', { 'cf-connecting-ip': '203.0.113.77' });
    const { db } = await import('@/db/client');
    const { sql } = await import('drizzle-orm');
    const rows = (await db.execute(sql`SELECT bucket_key FROM rate_limit_buckets`)).rows as Array<{ bucket_key: string }>;
    assert.ok(rows.length >= 3);
    for (const { bucket_key } of rows) {
      assert.match(bucket_key, /^[a-z_]+:[0-9a-f]{64}$/);
    }
  });

  test('未声明可信入口头：每次伪造不同 X-Forwarded-For 与设备号，第 31 次仍被 IP 限额拦下', async () => {
    for (let i = 0; i < 30; i++) {
      const res = await callVerify(`device-xff-${i}`, { 'x-forwarded-for': `198.51.100.${i}`, 'cf-connecting-ip': `192.0.2.${i}` });
      assert.equal(res.status, 200, `第 ${i + 1} 次应放行`);
    }
    const blocked = await callVerify('device-xff-30', { 'x-forwarded-for': '198.51.100.30', 'cf-connecting-ip': '192.0.2.30' });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('x-ratelimit-limit'), '30');
  });

  test('可信入口头下轮换 device_id 不能绕过同一 IP 的限额，其他 IP 不受影响', async () => {
    process.env.IRIDESCENTLY_CLIENT_IP_HEADER = 'cf-connecting-ip';
    for (let i = 0; i < 30; i++) {
      const res = await callVerify(`rotated-device-${i}`, { 'cf-connecting-ip': '203.0.113.20', 'x-forwarded-for': `198.51.100.${i}` });
      assert.equal(res.status, 200, `第 ${i + 1} 次应放行`);
    }
    const blocked = await callVerify('rotated-device-30', { 'cf-connecting-ip': '203.0.113.20' });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('x-ratelimit-limit'), '30');

    const otherClient = await callVerify('rotated-device-31', { 'cf-connecting-ip': '203.0.113.21' });
    assert.equal(otherClient.status, 200);
  });

  test('同一 /64 内轮换 IPv6 地址共用一个 IP 限额', async () => {
    process.env.IRIDESCENTLY_CLIENT_IP_HEADER = 'cf-connecting-ip';
    for (let i = 0; i < 30; i++) {
      const res = await callVerify(`v6-device-${i}`, { 'cf-connecting-ip': `2001:db8:5:6::${(i + 1).toString(16)}` });
      assert.equal(res.status, 200);
    }
    const blocked = await callVerify('v6-device-30', { 'cf-connecting-ip': '2001:db8:5:6:ffff::1' });
    assert.equal(blocked.status, 429);
  });

  test('同一设备号的附加限额仍然生效', async () => {
    process.env.IRIDESCENTLY_CLIENT_IP_HEADER = 'cf-connecting-ip';
    for (let i = 0; i < 20; i++) {
      const res = await callVerify('same-device', { 'cf-connecting-ip': `203.0.113.${100 + i}` });
      assert.equal(res.status, 200);
    }
    const blocked = await callVerify('same-device', { 'cf-connecting-ip': '203.0.113.200' });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('x-ratelimit-device-remaining'), '0');
  });

  test('限流存储不可用时拒绝请求（500），不静默放行', async () => {
    const { db } = await import('@/db/client');
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`ALTER TABLE rate_limit_buckets RENAME TO rate_limit_buckets_offline`);
    try {
      const res = await callVerify('device-db-down');
      assert.equal(res.status, 500);
    } finally {
      await db.execute(sql`ALTER TABLE rate_limit_buckets_offline RENAME TO rate_limit_buckets`);
    }
  });
});
