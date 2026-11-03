#!/usr/bin/env node

/**
 * 管理员密码哈希生成工具
 *
 * 生成管理员密码的 bcrypt 哈希，用于在数据库中直接重置某个管理员的密码。
 * 首个管理员账号请通过 /admin/setup 创建；本工具没有任何默认密码。
 *
 * 用法:
 *   node scripts/hash-password.js [--username <管理员用户名>]
 *
 * 密码来源:
 *   - 在终端中运行时，隐藏输入并要求输入两次；
 *   - 标准输入不是终端时（管道或重定向），从标准输入读取一行作为密码。
 *
 * 不接受通过命令行参数传入密码（会留在 shell 历史和进程列表中），
 * 也不会把密码明文写到任何输出中。
 */

'use strict';

const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;
// 与 /api/admin/setup 和 /api/admin/settings/password 的最小长度一致。
const MIN_PASSWORD_LENGTH = 6;
// bcrypt 只使用前 72 字节，超出部分会被静默截断。
const MAX_PASSWORD_BYTES = 72;
// 与 /api/admin/setup 的用户名规则一致；同时保证可以安全地放进 SQL 字符串。
const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,32}$/;

const USAGE = `用法: node scripts/hash-password.js [--username <管理员用户名>]

在终端中运行时会提示隐藏输入密码（输入两次）；
也可以通过标准输入传入一行密码，例如:
  node scripts/hash-password.js --username <管理员用户名> < password.txt

不接受通过命令行参数传入密码。`;

class UsageError extends Error {}

function parseArgs(argv) {
  const options = { username: null, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '-u' || arg === '--username') {
      if (i + 1 >= argv.length) throw new UsageError('--username 需要一个值');
      options.username = argv[i + 1];
      i += 1;
    } else if (arg.startsWith('--username=')) {
      options.username = arg.slice('--username='.length);
    } else if (arg.startsWith('-')) {
      // 不回显参数内容：它可能包含密码。
      throw new UsageError('无法识别的选项');
    } else {
      throw new UsageError('不再支持通过命令行参数传入密码（会留在 shell 历史和进程列表中），请按提示输入或通过标准输入传入');
    }
  }
  if (options.username !== null && !USERNAME_PATTERN.test(options.username)) {
    throw new UsageError('用户名只能包含字母、数字、下划线和短横线，长度 3-32 个字符');
  }
  return options;
}

function validatePassword(password) {
  if (password.length === 0) throw new UsageError('密码不能为空');
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new UsageError(`密码长度不能少于 ${MIN_PASSWORD_LENGTH} 个字符`);
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new UsageError(`密码不能超过 ${MAX_PASSWORD_BYTES} 字节（bcrypt 会截断超出部分）`);
  }
}

/** 在终端中读取一行输入，不回显任何字符。 */
function readHiddenLine(prompt) {
  return new Promise((resolve, reject) => {
    const { stdin, stderr } = process;
    let value = '';

    function finish(error) {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write('\n');
      if (error) reject(error);
      else resolve(value);
    }

    function onData(chunk) {
      if (chunk.startsWith('\u001b')) return; // 方向键等转义序列
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') return finish();
        if (ch === '\u0003') return finish(new UsageError('已取消'));
        if (ch === '\u007f' || ch === '\b') {
          value = Array.from(value).slice(0, -1).join('');
        } else if (ch >= ' ') {
          value += ch;
        }
      }
    }

    stderr.write(prompt);
    stdin.setEncoding('utf8');
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

/** 从管道或重定向的标准输入读取一行密码。 */
async function readPasswordFromStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
  if (/[\r\n]/.test(password)) throw new UsageError('标准输入只能包含一行密码');
  return password;
}

async function readPassword() {
  if (!process.stdin.isTTY) {
    const password = await readPasswordFromStdin();
    validatePassword(password);
    return password;
  }
  const password = await readHiddenLine('请输入新的管理员密码: ');
  validatePassword(password);
  const confirmation = await readHiddenLine('请再次输入以确认: ');
  if (confirmation !== password) throw new UsageError('两次输入的密码不一致');
  return password;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const hash = await bcrypt.hash(await readPassword(), SALT_ROUNDS);

  console.log(`哈希值: ${hash}`);
  if (options.username) {
    console.log('\n重置该管理员密码的 SQL:');
    console.log(
      `UPDATE admin_users SET password_hash = '${hash}', updated_at = NOW() WHERE username = '${options.username}';`
    );
  } else {
    console.error('\n提示: 加上 --username <管理员用户名> 可同时输出对应的 UPDATE 语句。');
  }
}

main().catch((error) => {
  if (error instanceof UsageError) {
    console.error(`错误: ${error.message}`);
  } else {
    console.error('密码哈希生成失败:', error instanceof Error ? error.message : error);
  }
  process.exitCode = 1;
});
