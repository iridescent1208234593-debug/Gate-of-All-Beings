// 回归测试：#32 H3 生产凭据占位值校验
// 运行：pnpm test（node --test，直接加载 TypeScript 源文件，不连接数据库）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertServerCredentials,
  findCredentialProblems,
  getAdminSecretValue,
  getClientApiKey,
  getEventAccessCodeValue,
  getJwtSecret,
  isPlaceholderCredential,
  CredentialConfigError,
} from '../src/lib/server-credentials.ts';

const here = new URL('.', import.meta.url);

/** 解析 .env.example（KEY=VALUE，去掉引号与注释） */
function loadExampleEnv() {
  const env = {};
  for (const line of readFileSync(new URL('../.env.example', here), 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    env[match[1]] = match[2].replace(/^"(.*)"$/, '$1');
  }
  return env;
}

// 合法测试配置：随机生成，满足长度与多样性
const GOOD = {
  NODE_ENV: 'production',
  JWT_SECRET: '9f1c4be07a3d58e2c6b4f10a7d93e85b2c0f6a41d7e98b3c5a2f0e6d1b4c7a98',
  CLIENT_API_KEY: '3e7a0c9d5b1f82e46a0d3c7b9e15f2a8c4d60b9e7f13a5c28d0e4b6f9a1c3e57',
  ADMIN_SECRET: 'b84f2e6c0a9d71f35c8e2b40d6a9f17e3c5b08d2a6f94e1c7b3d50a8f2e6c19d',
  EVENT_ACCESS_CODE: 'Gate-Event-7Kq9Zx',
  DATABASE_URL: 'postgresql://activation:Zq8v2LmT4xR9wP1s@db.internal:5432/activation',
};

test('仓库 .env.example 原样用于 production 时拒绝启动', () => {
  const env = { ...loadExampleEnv(), NODE_ENV: 'production' };
  assert.throws(() => assertServerCredentials(env), (error) => {
    assert.ok(error instanceof CredentialConfigError);
    const names = error.problems.map((p) => p.name);
    assert.ok(names.includes('JWT_SECRET'));
    assert.ok(names.includes('CLIENT_API_KEY'));
    assert.ok(names.includes('DATABASE_URL'));
    return true;
  });
});

test('README 快速开始中的示例值用于 production 时拒绝启动', () => {
  const readme = readFileSync(new URL('../README.md', here), 'utf8');
  const env = { NODE_ENV: 'production' };
  for (const name of ['JWT_SECRET', 'CLIENT_API_KEY', 'DATABASE_URL']) {
    const match = readme.match(new RegExp(`^${name}=(.+)$`, 'm'));
    assert.ok(match, `README 应包含 ${name} 示例`);
    env[name] = match[1].trim();
  }
  const problems = findCredentialProblems(env).map((p) => p.name);
  assert.ok(problems.includes('JWT_SECRET'));
  assert.ok(problems.includes('CLIENT_API_KEY'));
  assert.ok(problems.includes('DATABASE_URL'));
});

test('合法测试配置正常通过', () => {
  assert.deepEqual(findCredentialProblems(GOOD), []);
  assert.doesNotThrow(() => assertServerCredentials(GOOD));
  assert.equal(getJwtSecret(GOOD), GOOD.JWT_SECRET);
  assert.equal(getClientApiKey(GOOD), GOOD.CLIENT_API_KEY);
  assert.equal(getAdminSecretValue(GOOD), GOOD.ADMIN_SECRET);
  assert.equal(getEventAccessCodeValue(GOOD), GOOD.EVENT_ACCESS_CODE);
});

test('production 缺失必需凭据时拒绝启动', () => {
  for (const name of ['JWT_SECRET', 'CLIENT_API_KEY', 'DATABASE_URL']) {
    const env = { ...GOOD, [name]: '' };
    assert.throws(() => assertServerCredentials(env), CredentialConfigError, name);
  }
});

test('production 下 ADMIN_SECRET / EVENT_ACCESS_CODE 可不配置（通道关闭）', () => {
  const env = { ...GOOD };
  delete env.ADMIN_SECRET;
  delete env.EVENT_ACCESS_CODE;
  assert.doesNotThrow(() => assertServerCredentials(env));
  assert.equal(getAdminSecretValue(env), null);
  assert.equal(getEventAccessCodeValue(env), null);
});

test('production 下每个凭据的占位值与弱值都被拒绝', () => {
  const cases = [
    ['JWT_SECRET', 'your-secret-key'],
    ['JWT_SECRET', 'your-super-secret-jwt-key-at-least-32-characters-long'],
    ['JWT_SECRET', 'short-but-random-7Hq'],
    ['JWT_SECRET', 'a'.repeat(64)],
    ['CLIENT_API_KEY', 'your-client-api-key-at-least-32-characters-long'],
    ['CLIENT_API_KEY', 'replace-me-with-a-real-client-api-key-0123456789'],
    ['ADMIN_SECRET', 'changeme'],
    ['ADMIN_SECRET', '<admin-secret-goes-here-0123456789abcdef>'],
    ['ADMIN_SECRET', 'abababababababababababababababab'],
    ['EVENT_ACCESS_CODE', 'placeholder-event-code'],
    ['EVENT_ACCESS_CODE', '1234'],
    ['DATABASE_URL', 'postgresql://db_user:replace-with-database-password@localhost:5432/database_name'],
    ['DATABASE_URL', 'postgresql://username:password@hostname:5432/database_name'],
  ];
  for (const [name, value] of cases) {
    const env = { ...GOOD, [name]: value };
    const problems = findCredentialProblems(env);
    assert.equal(problems.length, 1, `${name}=${value} 应被拒绝`);
    assert.equal(problems[0].name, name);
    assert.throws(() => assertServerCredentials(env), CredentialConfigError);
  }
});

test('production 下单项读取函数与启动校验规则一致', () => {
  assert.throws(() => getJwtSecret({ ...GOOD, JWT_SECRET: 'your-secret-key' }), CredentialConfigError);
  assert.throws(() => getClientApiKey({ ...GOOD, CLIENT_API_KEY: 'x'.repeat(40) }), CredentialConfigError);
  assert.throws(() => getAdminSecretValue({ ...GOOD, ADMIN_SECRET: 'changeme' }), CredentialConfigError);
  assert.throws(() => getEventAccessCodeValue({ ...GOOD, EVENT_ACCESS_CODE: 'short' }), CredentialConfigError);
});

test('非 production：JWT_SECRET 缺失或占位值仍拒绝，其余只告警', () => {
  const dev = { ...loadExampleEnv(), NODE_ENV: 'development' };
  assert.throws(() => assertServerCredentials(dev), CredentialConfigError);
  assert.throws(() => getJwtSecret({ NODE_ENV: 'development' }), CredentialConfigError);

  const devWithRealJwt = { ...dev, JWT_SECRET: GOOD.JWT_SECRET };
  const warn = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(message);
  try {
    assert.doesNotThrow(() => assertServerCredentials(devWithRealJwt));
  } finally {
    console.warn = warn;
  }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /CLIENT_API_KEY/);
  assert.equal(getClientApiKey(devWithRealJwt), dev.CLIENT_API_KEY);
});

test('占位值检测不误伤随机值', () => {
  for (const value of [GOOD.JWT_SECRET, GOOD.CLIENT_API_KEY, GOOD.ADMIN_SECRET, GOOD.EVENT_ACCESS_CODE]) {
    assert.equal(isPlaceholderCredential(value), false, value);
  }
});

test('generate-keys 生成的凭据可直接通过 production 校验', () => {
  const script = fileURLToPath(new URL('../scripts/generate-keys.js', here));
  const output = execFileSync(process.execPath, [script], { encoding: 'utf8' });
  const env = { NODE_ENV: 'production', DATABASE_URL: GOOD.DATABASE_URL };
  for (const name of ['JWT_SECRET', 'CLIENT_API_KEY', 'ADMIN_SECRET']) {
    const match = output.match(new RegExp(`^${name}=(.+)$`, 'm'));
    assert.ok(match, `generate-keys 应输出 ${name}`);
    env[name] = match[1].trim();
  }
  assert.deepEqual(findCredentialProblems(env), []);
});
