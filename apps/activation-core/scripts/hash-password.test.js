// 运行: pnpm run test:scripts（需先在 apps/activation-core 下 pnpm install）
// 只覆盖非终端（标准输入）路径；终端隐藏输入路径见 PR 中的手工验收记录。

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const SCRIPT = path.join(__dirname, 'hash-password.js');
const PASSWORD = 'Correct-Horse-9';

function run(args, input = '') {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { input, encoding: 'utf8' });
  return { ...result, output: result.stdout + result.stderr };
}

function hashFrom(stdout) {
  const match = stdout.match(/哈希值: (\$2[aby]\$10\$\S{53})/);
  return match && match[1];
}

test('无参数且无输入时失败，不生成任何默认口令的哈希', () => {
  const result = run([]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /密码不能为空/);
  assert.equal(hashFrom(result.stdout), null);
  assert.doesNotMatch(result.output, /admin123/);
});

test('拒绝命令行参数传入的密码，且不回显该参数', () => {
  const result = run([PASSWORD]);
  assert.equal(result.status, 1);
  assert.equal(hashFrom(result.stdout), null);
  assert.ok(!result.output.includes(PASSWORD));
});

test('未知选项不回显其内容', () => {
  const result = run([`--password=${PASSWORD}`]);
  assert.equal(result.status, 1);
  assert.ok(!result.output.includes(PASSWORD));
});

test('从标准输入生成可校验的哈希，输出中不含明文密码', async () => {
  const result = run([], `${PASSWORD}\n`);
  assert.equal(result.status, 0, result.stderr);
  const hash = hashFrom(result.stdout);
  assert.ok(hash, result.stdout);
  assert.equal(await bcrypt.compare(PASSWORD, hash), true);
  assert.ok(!result.output.includes(PASSWORD));
  assert.doesNotMatch(result.stdout, /UPDATE/);
});

test('指定 --username 时输出对应的 UPDATE 语句（兼容 pnpm 透传的 --）', async () => {
  const result = run(['--', '--username', 'site_admin'], `${PASSWORD}\r\n`);
  assert.equal(result.status, 0, result.stderr);
  const hash = hashFrom(result.stdout);
  assert.equal(await bcrypt.compare(PASSWORD, hash), true);
  assert.ok(result.stdout.includes(
    `UPDATE admin_users SET password_hash = '${hash}', updated_at = NOW() WHERE username = 'site_admin';`
  ));
  assert.ok(!result.output.includes(PASSWORD));
});

test('拒绝不合规的用户名', () => {
  const result = run(['--username', "admin'; --"], `${PASSWORD}\n`);
  assert.equal(result.status, 1);
  assert.equal(hashFrom(result.stdout), null);
});

test('拒绝过短、超过 72 字节或多行的密码', () => {
  for (const input of ['abc\n', `${'密'.repeat(25)}\n`, `${PASSWORD}\nsecond\n`]) {
    const result = run([], input);
    assert.equal(result.status, 1, `input length ${input.length}`);
    assert.equal(hashFrom(result.stdout), null);
  }
});
