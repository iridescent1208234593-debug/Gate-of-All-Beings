/**
 * #45 M15：响应签名防重放服务端化（需一次性 PostgreSQL）
 *
 * - 一次性 challenge 由服务端登记并原子消费：已用 / 过期 / 设备或接口不符一律拒绝
 * - 缺少或错误的签名配置 fail closed：不签发 challenge、不核销激活码
 * - 示例客户端缺公钥即报错，且拒绝重放的旧签名响应
 */
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { exportPKCS8, exportSPKI, generateKeyPair, jwtVerify, type KeyLike } from 'jose';
import { getTestDatabaseUrl, migrateTestDatabase, prepareTestEnv, TEST_CLIENT_API_KEY } from './helpers/test-env';

prepareTestEnv({ IRIDESCENTLY_CLIENT_IP_HEADER: 'cf-connecting-ip' });
const skip = getTestDatabaseUrl() ? false : '未设置 ACTIVATION_CORE_TEST_DATABASE_URL（一次性测试库）';

const ACTIVATION_CODE = 'M15TestCode000000001';
let publicKey: KeyLike;
let publicKeyPem: string;
let privateKeyPem: string;
let ipCounter = 0;

type Handler = (request: import('next/server').NextRequest) => Promise<Response>;

async function handlerFor(pathname: string): Promise<Handler> {
  switch (pathname) {
    case '/api/client/challenge':
      return (await import('@/app/api/client/challenge/route')).POST;
    case '/api/client/verify':
      return (await import('@/app/api/client/verify/route')).POST;
    case '/api/client/activate':
      return (await import('@/app/api/client/activate/route')).POST;
    default:
      throw new Error(`unexpected path ${pathname}`);
  }
}

/** 每个测试用不同的可信 IP，避免共享限额互相影响 */
function nextClientIp() {
  ipCounter += 1;
  return `203.0.113.${ipCounter % 250}`;
}

async function call(pathname: string, body: unknown, clientIp = '198.51.100.1'): Promise<{ status: number; json: any }> {
  const { NextRequest } = await import('next/server');
  const handler = await handlerFor(pathname);
  const res = await handler(
    new NextRequest(`http://localhost${pathname}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': TEST_CLIENT_API_KEY, 'cf-connecting-ip': clientIp },
      body: JSON.stringify(body),
    })
  );
  return { status: res.status, json: await res.json() };
}

async function getChallenge(deviceId: string, route: string, clientIp: string): Promise<string> {
  const res = await call('/api/client/challenge', { device_id: deviceId, route }, clientIp);
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.match(res.json.data.challenge, /^[A-Za-z0-9_-]{43}$/);
  return res.json.data.challenge;
}

async function sql(query: TemplateStringsArray, ...values: unknown[]) {
  const { db } = await import('@/db/client');
  const { sql: sqlTag } = await import('drizzle-orm');
  return await db.execute(sqlTag(query, ...values));
}

async function codeRow() {
  const result = await sql`SELECT used_by_device_id, used_count FROM activation_codes WHERE code = ${ACTIVATION_CODE}`;
  return result.rows[0] as { used_by_device_id: string | null; used_count: number };
}

async function withSigningEnv(overrides: Record<string, string | undefined>, fn: () => Promise<void>) {
  const { resetSigningKeyCache } = await import('@/lib/signing');
  const saved = { ...process.env };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetSigningKeyCache();
  try {
    await fn();
  } finally {
    for (const key of Object.keys(overrides)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    resetSigningKeyCache();
  }
}

describe('一次性 challenge 与签名 fail closed', { skip }, () => {
  before(async () => {
    const pair = await generateKeyPair('ES256', { extractable: true });
    publicKey = pair.publicKey;
    publicKeyPem = await exportSPKI(pair.publicKey);
    privateKeyPem = await exportPKCS8(pair.privateKey);
    process.env.RESPONSE_SIGN_PRIVATE_KEY_PEM = privateKeyPem.replace(/\n/g, '\\n');
    process.env.RESPONSE_SIGN_KEY_ID = 'test-key';
    await migrateTestDatabase();
  });

  beforeEach(async () => {
    await sql`TRUNCATE rate_limit_buckets, client_challenges`;
    await sql`DELETE FROM activation_codes WHERE code = ${ACTIVATION_CODE}`;
    await sql`INSERT INTO activation_codes (code, status) VALUES (${ACTIVATION_CODE}, 'active')`;
  });

  after(async () => {
    const { dbPool } = await import('@/db/client');
    await dbPool.end();
  });

  test('激活：challenge 写进签名 token 的 nonce，且同一 challenge 不能再次使用', async () => {
    const ip = nextClientIp();
    const challenge = await getChallenge('device-m15-a', '/api/client/activate', ip);
    const first = await call('/api/client/activate', { code: ACTIVATION_CODE, device_id: 'device-m15-a', challenge }, ip);
    assert.equal(first.status, 200, JSON.stringify(first.json));
    assert.equal(first.json.data.nonce, challenge);
    const { payload, protectedHeader } = await jwtVerify(first.json.data.license_token, publicKey);
    assert.equal(protectedHeader.alg, 'ES256');
    assert.equal(payload.nonce, challenge);
    assert.equal(payload.device_id, 'device-m15-a');
    assert.equal(payload.route, '/api/client/activate');

    const replay = await call('/api/client/activate', { code: ACTIVATION_CODE, device_id: 'device-m15-a', challenge }, ip);
    assert.equal(replay.status, 401);
    assert.equal(replay.json.error_code, 'CHALLENGE_USED');
  });

  test('验证：已消费的 challenge 再次提交被拒（CHALLENGE_USED）', async () => {
    const ip = nextClientIp();
    await sql`UPDATE activation_codes SET used_by_device_id = 'device-m15-b', used_at = now(), used_count = 1 WHERE code = ${ACTIVATION_CODE}`;
    const challenge = await getChallenge('device-m15-b', '/api/client/verify', ip);
    const ok = await call('/api/client/verify', { device_id: 'device-m15-b', challenge }, ip);
    assert.equal(ok.status, 200, JSON.stringify(ok.json));
    assert.equal(ok.json.data.is_activated, true);
    const { payload } = await jwtVerify(ok.json.data.license_token, publicKey);
    assert.equal(payload.nonce, challenge);

    const again = await call('/api/client/verify', { device_id: 'device-m15-b', challenge }, ip);
    assert.equal(again.status, 401);
    assert.equal(again.json.error_code, 'CHALLENGE_USED');
  });

  test('并发提交同一 challenge 只有一个成功', async () => {
    const ip = nextClientIp();
    const challenge = await getChallenge('device-m15-c', '/api/client/verify', ip);
    const results = await Promise.all(
      Array.from({ length: 8 }, () => call('/api/client/verify', { device_id: 'device-m15-c', challenge }, ip))
    );
    assert.equal(results.filter((r) => r.status === 200).length, 1);
    assert.equal(results.filter((r) => r.json.error_code === 'CHALLENGE_USED').length, 7);
  });

  test('过期 challenge 被拒（CHALLENGE_EXPIRED）', async () => {
    const ip = nextClientIp();
    const challenge = await getChallenge('device-m15-d', '/api/client/verify', ip);
    await sql`UPDATE client_challenges SET created_at = now() - interval '2 minutes', expires_at = now() - interval '1 second'`;
    const res = await call('/api/client/verify', { device_id: 'device-m15-d', challenge }, ip);
    assert.equal(res.status, 401);
    assert.equal(res.json.error_code, 'CHALLENGE_EXPIRED');
  });

  test('challenge 不能换设备、换接口或伪造使用', async () => {
    const ip = nextClientIp();
    const challenge = await getChallenge('device-m15-e', '/api/client/verify', ip);
    const otherDevice = await call('/api/client/verify', { device_id: 'device-m15-other', challenge }, ip);
    assert.equal(otherDevice.json.error_code, 'CHALLENGE_INVALID');
    const otherRoute = await call('/api/client/activate', { code: ACTIVATION_CODE, device_id: 'device-m15-e', challenge }, ip);
    assert.equal(otherRoute.json.error_code, 'CHALLENGE_INVALID');
    const forged = await call('/api/client/verify', { device_id: 'device-m15-e', challenge: 'A'.repeat(43) }, ip);
    assert.equal(forged.json.error_code, 'CHALLENGE_INVALID');
    const malformed = await call('/api/client/verify', { device_id: 'device-m15-e', challenge: 'short' }, ip);
    assert.equal(malformed.status, 400);
    // 失败尝试不会消费掉合法 challenge
    const ok = await call('/api/client/verify', { device_id: 'device-m15-e', challenge }, ip);
    assert.equal(ok.status, 200);
  });

  test('缺少 challenge 时拒绝，且不核销激活码', async () => {
    const ip = nextClientIp();
    const res = await call('/api/client/activate', { code: ACTIVATION_CODE, device_id: 'device-m15-f' }, ip);
    assert.equal(res.status, 400);
    assert.equal(res.json.error_code, 'CHALLENGE_REQUIRED');
    assert.equal((await codeRow()).used_by_device_id, null);
  });

  test('缺少签名私钥时 fail closed：不发 challenge、不核销激活码', async () => {
    const ip = nextClientIp();
    const challenge = await getChallenge('device-m15-g', '/api/client/activate', ip);
    await withSigningEnv({ RESPONSE_SIGN_PRIVATE_KEY_PEM: undefined }, async () => {
      const issue = await call('/api/client/challenge', { device_id: 'device-m15-g', route: '/api/client/activate' }, ip);
      assert.equal(issue.status, 503);
      assert.equal(issue.json.error_code, 'SIGNING_NOT_CONFIGURED');
      const activate = await call('/api/client/activate', { code: ACTIVATION_CODE, device_id: 'device-m15-g', challenge }, ip);
      assert.equal(activate.status, 503);
      assert.equal(activate.json.error_code, 'SIGNING_NOT_CONFIGURED');
    });
    assert.equal((await codeRow()).used_by_device_id, null);
    // 配置恢复后原 challenge 仍可用：拒绝发生在消费之前
    const retry = await call('/api/client/activate', { code: ACTIVATION_CODE, device_id: 'device-m15-g', challenge }, ip);
    assert.equal(retry.status, 200, JSON.stringify(retry.json));
  });

  test('签名私钥无效或 TTL 配置非法时同样 fail closed', async () => {
    const ip = nextClientIp();
    await withSigningEnv({ RESPONSE_SIGN_PRIVATE_KEY_PEM: 'not-a-key' }, async () => {
      const res = await call('/api/client/challenge', { device_id: 'device-m15-h', route: '/api/client/verify' }, ip);
      assert.equal(res.status, 503);
    });
    await withSigningEnv({ RESPONSE_SIGN_TOKEN_TTL_SEC: 'abc' }, async () => {
      const res = await call('/api/client/challenge', { device_id: 'device-m15-h', route: '/api/client/verify' }, ip);
      assert.equal(res.status, 503);
    });
    await withSigningEnv({ RESPONSE_SIGN_TOKEN_TTL_SEC: '86400' }, async () => {
      const res = await call('/api/client/challenge', { device_id: 'device-m15-h', route: '/api/client/verify' }, ip);
      assert.equal(res.status, 503);
    });
  });

  describe('示例客户端 example/activation-client.js', () => {
    const require = createRequire(__filename);
    const ActivationClient = require(path.resolve(__dirname, '../example/activation-client.js'));
    const storage = new Map<string, string>();
    let replayVerifyResponse: unknown = null;
    let capturedVerifyResponse: unknown = null;
    let clientIp = '';

    before(() => {
      (globalThis as any).localStorage = {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => void storage.set(k, v),
        removeItem: (k: string) => void storage.delete(k),
      };
      (globalThis as any).fetch = async (url: string, options: RequestInit) => {
        const { NextRequest } = await import('next/server');
        const pathname = new URL(url).pathname;
        if (pathname === '/api/client/verify' && replayVerifyResponse) {
          // 模拟中间人：把之前截获的合法签名响应原样回放
          return new Response(JSON.stringify(replayVerifyResponse), { status: 200 });
        }
        const headers = new Headers(options.headers);
        headers.set('cf-connecting-ip', clientIp);
        const res = await (await handlerFor(pathname))(new NextRequest(url, { method: options.method, body: options.body, headers }));
        if (pathname === '/api/client/verify') {
          capturedVerifyResponse = await res.clone().json();
        }
        return res;
      };
    });

    after(() => {
      delete (globalThis as any).localStorage;
    });

    test('缺少公钥时构造即报错，不会静默关闭验签', () => {
      assert.throws(() => new ActivationClient('http://localhost', TEST_CLIENT_API_KEY, {}), /公钥/);
      assert.throws(
        () => new ActivationClient('http://localhost', TEST_CLIENT_API_KEY, { enableSignatureVerification: false }),
        /公钥/
      );
    });

    test('正常激活与验证通过；回放截获的旧验证响应被客户端拒绝', async () => {
      clientIp = nextClientIp();
      const client = new ActivationClient('http://localhost', TEST_CLIENT_API_KEY, { publicKeyPem });
      const activated = await client.activate('device-m15-client', ACTIVATION_CODE);
      assert.equal(activated.success, true, JSON.stringify(activated));
      assert.ok(storage.get('activation_device-m15-client'));

      const verified = await client.verify('device-m15-client');
      assert.equal(verified.success, true, JSON.stringify(verified));
      assert.equal(verified.data.is_activated, true);

      replayVerifyResponse = capturedVerifyResponse;
      try {
        const replayed = await client.verify('device-m15-client');
        assert.equal(replayed.success, false);
        assert.equal(replayed.data.signature_failed, true);
        assert.equal(storage.has('activation_device-m15-client'), false);
      } finally {
        replayVerifyResponse = null;
      }
    });

    test('伪造“已激活”但不带签名的响应被拒绝', async () => {
      clientIp = nextClientIp();
      const client = new ActivationClient('http://localhost', TEST_CLIENT_API_KEY, { publicKeyPem });
      replayVerifyResponse = {
        success: true,
        data: { device_id: 'device-m15-forged', is_activated: true, activation_info: { expires_at: null } },
      };
      try {
        const res = await client.verify('device-m15-forged');
        assert.equal(res.success, false);
        assert.equal(storage.has('activation_device-m15-forged'), false);
      } finally {
        replayVerifyResponse = null;
      }
    });
  });
});
