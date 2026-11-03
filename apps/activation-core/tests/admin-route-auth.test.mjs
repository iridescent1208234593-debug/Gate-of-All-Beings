// 回归测试：#44 M14 管理 API 路由内统一鉴权
// 直接调用 /api/admin/* 的路由处理器（不经过 proxy），确认每个处理器自己执行完整管理员鉴权。
// 业务层（@/server/*）由桩模块替代，不连接数据库。需要先 `pnpm install`（用到 jose 与 next）。
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';
import { SignJWT } from 'jose';

register('./support/route-loader.mjs', import.meta.url);

const JWT_SECRET = '5d2c8f1a9e6b3d07c4a1f8e25b9d6c30a7e4f1b82d5c9a06e3b7f4d18c2a5e9b';
const ADMIN_SECRET = 'c1e7a4d90b3f6e28a5d1c7b04f9e3a62d8b5c1f07e4a9d36b2c8f5e10a7d4b93';
Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET, ADMIN_SECRET });

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const adminApiRoot = join(appRoot, 'src/app/api/admin');
const PUBLIC_ROUTES = new Set(['login/route.ts', 'setup/route.ts']);
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function listRouteFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listRouteFiles(path);
    return name === 'route.ts' ? [path] : [];
  });
}

const protectedRoutes = listRouteFiles(adminApiRoot)
  .map((path) => ({ path, rel: relative(adminApiRoot, path).split(sep).join('/') }))
  .filter(({ rel }) => !PUBLIC_ROUTES.has(rel))
  .sort((a, b) => a.rel.localeCompare(b.rel));

const encoder = new TextEncoder();

function signToken(claims, { secret = JWT_SECRET, expiresIn = '1h' } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(encoder.encode(secret));
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

let NextRequest;
let handlers = [];
let validToken;

before(async () => {
  ({ NextRequest } = await import(pathToFileURL(join(appRoot, 'node_modules/next/server.js')).href).then(
    (module) => module.default ?? module
  ));
  validToken = await signToken({ id: 1, username: 'root', role: 'admin' });

  for (const route of protectedRoutes) {
    const module = await import(pathToFileURL(route.path).href);
    for (const method of HTTP_METHODS) {
      if (typeof module[method] === 'function') {
        handlers.push({ route: route.rel, method, handler: module[method] });
      }
    }
  }
});

function makeRequest(method, headers = {}) {
  const init = { method, headers: { 'content-type': 'application/json', ...headers } };
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = JSON.stringify({ currentPassword: 'current-password', newPassword: 'new-password-123', ids: [1], action: 'reset', count: 1 });
  }
  return new NextRequest('http://localhost/api/admin/test', init);
}

const context = { params: Promise.resolve({ id: '1', deviceId: 'device-test-001' }) };

async function call(entry, headers) {
  globalThis.__adminRouteStubCalls = [];
  // 桩模块返回 undefined 时业务代码会走自身的 500 分支并打印错误，这里静音
  const consoleError = console.error;
  console.error = () => {};
  try {
    const response = await entry.handler(makeRequest(entry.method, headers), context);
    return { response, serviceCalls: globalThis.__adminRouteStubCalls.length };
  } finally {
    console.error = consoleError;
  }
}

test('每个管理路由文件都用 withAdminAccess 导出全部处理器', () => {
  assert.ok(protectedRoutes.length >= 13, `只找到 ${protectedRoutes.length} 个管理路由`);
  for (const { path, rel } of protectedRoutes) {
    const source = readFileSync(path, 'utf8');
    for (const method of HTTP_METHODS) {
      assert.doesNotMatch(
        source,
        new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`),
        `${rel} 的 ${method} 未经 withAdminAccess 包装`
      );
    }
    assert.match(source, /export const (GET|POST|PUT|PATCH|DELETE) = withAdminAccess\(/, rel);
    assert.doesNotMatch(source, /x-admin-(username|id)/, `${rel} 不应信任 proxy 注入的身份头`);
    assert.doesNotMatch(source, /atob\(|split\('\.'\)\[1\]/, `${rel} 不应只解码 token payload`);
  }
});

test('处理器总数与源码一致（确保下面的用例覆盖了全部管理 API）', () => {
  const declared = protectedRoutes.reduce((count, { path }) => {
    const source = readFileSync(path, 'utf8');
    return count + (source.match(/export const (GET|POST|PUT|PATCH|DELETE) = /g) ?? []).length;
  }, 0);
  assert.equal(handlers.length, declared);
});

const rejectedCases = [
  ['没有任何凭据', async () => ({})],
  ['管理密钥错误', async () => ({ 'x-admin-key': 'wrong-' + ADMIN_SECRET.slice(6) })],
  ['Bearer 密钥错误', async () => ({ authorization: 'Bearer not-the-admin-secret' })],
  ['JWT 用错误密钥签名', async () => ({ cookie: `token=${await signToken({ id: 1, username: 'root', role: 'admin' }, { secret: 'f'.repeat(16) + JWT_SECRET.slice(16) })}` })],
  ['JWT 未签名（alg=none，只能被“解码”）', async () => ({ cookie: `token=${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ id: 1, username: 'root', role: 'admin' })}.` })],
  ['JWT 签名正确但不是 admin 角色', async () => ({ cookie: `token=${await signToken({ id: 1, username: 'root', role: 'player' })}` })],
  ['JWT 已过期', async () => ({ cookie: `token=${await signToken({ id: 1, username: 'root', role: 'admin' }, { expiresIn: Math.floor(Date.now() / 1000) - 60 })}` })],
  ['伪造 proxy 身份头但没有凭据', async () => ({ 'x-admin-username': 'root', 'x-admin-id': '1' })],
];

for (const [label, buildHeaders] of rejectedCases) {
  test(`绕过 proxy 直接调用：${label} → 401，且不触达业务层`, async () => {
    const headers = await buildHeaders();
    for (const entry of handlers) {
      const { response, serviceCalls } = await call(entry, headers);
      assert.equal(response.status, 401, `${entry.method} ${entry.route}`);
      assert.equal(serviceCalls, 0, `${entry.method} ${entry.route} 不应调用业务层`);
    }
  });
}

test('合法管理员会话（JWT）可以访问全部管理 API', async () => {
  for (const entry of handlers) {
    const { response } = await call(entry, { cookie: `token=${validToken}` });
    assert.ok(![401, 403].includes(response.status), `${entry.method} ${entry.route} 返回 ${response.status}`);
  }
});

test('合法管理密钥可以访问管理 API；修改密码要求账号会话（403）', async () => {
  for (const entry of handlers) {
    const { response, serviceCalls } = await call(entry, { 'x-admin-key': ADMIN_SECRET });
    if (entry.route === 'settings/password/route.ts') {
      assert.equal(response.status, 403);
      assert.equal(serviceCalls, 0);
    } else {
      assert.ok(![401, 403].includes(response.status), `${entry.method} ${entry.route} 返回 ${response.status}`);
    }
  }
});

test('修改密码使用已验证 token 中的管理员 ID', async () => {
  const entry = handlers.find((h) => h.route === 'settings/password/route.ts');
  const token = await signToken({ id: 7, username: 'root', role: 'admin' });
  const seen = [];
  globalThis.__adminRouteStubResult = (name, args) => {
    seen.push([name, args[0]]);
    return null; // getAdminById → 管理员不存在
  };
  try {
    const { response } = await call(entry, { cookie: `token=${token}` });
    assert.equal(response.status, 404);
    assert.deepEqual(seen, [['getAdminById', 7]]);
  } finally {
    globalThis.__adminRouteStubResult = undefined;
  }
});

test('审计中的操作者来自鉴权结果，伪造 x-admin-username 无效', async () => {
  const entry = handlers.find((h) => h.route === 'devices/[deviceId]/route.ts' && h.method === 'DELETE');
  globalThis.__adminRouteStubResult = () => 0;
  try {
    const { response } = await call(entry, { 'x-admin-key': ADMIN_SECRET, 'x-admin-username': 'forged-admin' });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.reset_by, 'admin-key');
  } finally {
    globalThis.__adminRouteStubResult = undefined;
  }
});

test('proxy 与路由使用同一套规则：未授权 API 返回 401，并剥离客户端伪造的身份头', async () => {
  const { proxy } = await import(pathToFileURL(join(appRoot, 'src/proxy.ts')).href);

  const anonymous = await proxy(new NextRequest('http://localhost/api/admin/stats'));
  assert.equal(anonymous.status, 401);

  const unsigned = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ id: 1, username: 'root', role: 'admin' })}.`;
  const forgedPage = await proxy(new NextRequest('http://localhost/admin/codes', { headers: { cookie: `token=${unsigned}` } }));
  assert.equal(forgedPage.status, 307);
  assert.match(forgedPage.headers.get('location'), /\/admin\/login$/);

  const passed = await proxy(new NextRequest('http://localhost/api/admin/stats', {
    headers: { 'x-admin-key': ADMIN_SECRET, 'x-admin-username': 'forged-admin' },
  }));
  assert.equal(passed.status, 200);
  assert.equal(passed.headers.get('x-middleware-next'), '1');
  const overridden = (passed.headers.get('x-middleware-override-headers') ?? '').split(',');
  assert.ok(!overridden.includes('x-admin-username'));
  assert.equal(passed.headers.get('x-middleware-request-x-admin-username'), null);
});
