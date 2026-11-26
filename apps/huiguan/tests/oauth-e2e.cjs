const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const { chromium } = require('playwright');

const fixture = path.join(__dirname, 'oauth-mock-server.py');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'huiguan-oauth-e2e-'));
const existingOnly = process.argv.includes('--existing-only');
const fixtureArgs = ['-B', '-X', 'utf8', fixture];
if (existingOnly) fixtureArgs.push('--existing-only');
const child = spawn(process.env.PYTHON || 'python', fixtureArgs, {
  env: { ...process.env, OAUTH_TEST_PARENT: temp },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const childClosed = new Promise((resolve) => child.once('close', resolve));
let stderr = '';
child.stderr.setEncoding('utf8').on('data', (part) => { stderr += part; });

function nextLine(stream) {
  return new Promise((resolve, reject) => {
    const lines = readline.createInterface({ input: stream });
    lines.once('line', (line) => { lines.close(); resolve(line); });
    child.once('exit', (code) => reject(new Error(`OAuth mock fixture exited (${code}): ${stderr}`)));
  });
}

(async () => {
  let browser;
  try {
    const info = JSON.parse(await nextLine(child.stdout));
    assert(info.dataRoot.startsWith(temp), 'test database must be inside the disposable test directory');
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE });
    const context = await browser.newContext();
    await context.route('**/*', (route) => {
      const origin = new URL(route.request().url()).origin;
      return [info.app, info.provider].includes(origin) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const app = info.app;
    const user = async () => page.evaluate(async () => (await fetch('/api/user')).json());
    const counts = async () => (await context.request.get(info.provider + '/__test__/counts')).json();

    if (existingOnly) {
      const before = await counts();
      await page.goto(`${app}/api/login`);
      const [refused] = await Promise.all([
        page.waitForResponse(response => response.url().startsWith(`${app}/cb?`)),
        page.getByRole('button', {name: '无法确认账号归属'}).click(),
      ]);
      assert.equal(refused.status(), 403);
      assert.equal((await refused.json()).error, '暂时无法确认这个账号的归属，请联系会馆管理员核验。');
      assert.equal((await user()).logged_in, false);
      assert(!(await context.cookies(app)).some(cookie => ['session', 'hx_sso'].includes(cookie.name)));
      assert.deepEqual(await counts(), before);
      await page.goto(`${app}/api/login`);
      await page.getByRole('button', {name: '老用户登录'}).click();
      await page.waitForURL(`${app}/`);
      assert.equal((await user()).user_id, 'mock-existing-137');
      assert.deepEqual(await counts(), {users: before.users, sessions: before.sessions + 1});
      await context.close();
      console.log('Huiguan OAuth browser E2E PASS (existing-only policy, refusal without writes, existing account login)');
      return;
    }

    await page.goto(`${app}/api/login`);
    assert(page.url().startsWith(info.provider + '/authorize.php?'), 'login starts at local mock Provider');
    const authorization = new URL(page.url());
    const state = authorization.searchParams.get('state');
    assert.match(state || '', /^[0-9a-f]{32}$/, 'OAuth state has expected random format');
    assert.equal(authorization.searchParams.get('client_id'), 'mock-client-id');
    assert.equal(authorization.searchParams.get('redirect_uri'), `${app}/cb`);
    await page.getByRole('button', { name: '新用户开户' }).click();
    await page.waitForURL(`${app}/`);

    assert.equal((await user()).logged_in, true, 'callback establishes authenticated session');
    assert.equal((await user()).user_id, 'mock-user-123');
    assert.equal((await counts()).users, 2, 'one new account plus the seeded account');
    let cookies = await context.cookies(app);
    for (const name of ['session', 'hx_sso']) {
      const cookie = cookies.find((item) => item.name === name);
      assert(cookie, `${name} cookie is set`);
      assert.equal(cookie.httpOnly, true);
      assert.equal(cookie.sameSite, 'Lax');
      assert.equal(cookie.secure, false, 'development fixture uses HTTP-only loopback');
    }

    await page.reload();
    assert.equal((await user()).logged_in, true, 'session restores after page reload');
    const sid = cookies.find((item) => item.name === 'session').value;
    const restarted = await context.request.get(`${info.control.replace('/__test__/expire', '/__test__/restart-app')}`);
    assert.equal(restarted.status(), 200, 'application process is restarted in isolation');
    assert.equal((await user()).logged_in, true, 'database-backed session survives application restart');

    const expired = await context.request.get(`${info.control}?sid=${encodeURIComponent(sid)}`);
    assert.equal(expired.status(), 200, 'fixture expires only the current test session');
    assert.equal((await user()).logged_in, false, 'expired session is rejected');

    await page.goto(`${app}/api/login`);
    await page.getByRole('button', { name: '新用户开户' }).click();
    await page.waitForURL(`${app}/`);
    assert.equal((await user()).logged_in, true, 'a new mock login recovers from expiration');
    await page.goto(`${app}/api/logout`);
    await page.goto(`${app}/`);
    assert.equal((await user()).logged_in, false, 'logout clears the session');
    cookies = await context.cookies(app);
    assert(!cookies.some((item) => item.name === 'session'), 'logout removes the session cookie');
    assert.equal((await counts()).users, 2, 'repeated first-user login does not create another account');

    await page.goto(`${app}/api/login`);
    await page.getByRole('button', { name: '老用户登录' }).click();
    await page.waitForURL(`${app}/`);
    assert.equal((await user()).user_id, 'mock-existing-137', 'old login returns the existing UID');
    assert.equal((await counts()).users, 2);
    const members = async () => {
      const result = await context.request.get(`${app}/api/member/users`);
      assert.equal(result.status(), 200);
      return (await result.json()).users;
    };
    assert((await members()).some(member => member.kind === 'usso' && member.uid === 'mock-existing-137' && member.role === 'admin'));
    for (const update of [{edit_role: 'scribe'}, {role: 'elder'}]) {
      const status = await page.evaluate(async set => (await fetch('/api/member/user/update', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({kind: 'usso', uid: 'mock-user-123', set}),
      })).status, update);
      assert.equal(status, 200);
    }
    const member = (await members()).find(member => member.kind === 'usso' && member.uid === 'mock-user-123');
    assert.equal(member.edit_role, 'scribe');
    assert.equal(member.role, 'elder');
    await page.goto(`${app}/api/logout`);

    for (const name of ['登录身份信息缺失', '登录身份信息有误']) {
      const before = await counts();
      await page.goto(`${app}/api/login`);
      await page.getByRole('button', { name }).click();
      assert.match(await page.locator('body').innerText(), /这次登录的身份信息有误，请重新登录。若仍失败，请联系会馆管理员。/);
      assert.equal((await user()).logged_in, false);
      assert.deepEqual(await counts(), before, 'identity rejection creates no account or session');
      assert(!(await context.cookies(app)).some((item) => ['session', 'hx_sso'].includes(item.name)));
    }

    const badState = await context.request.get(`${app}/cb?code=mock-code&state=not-issued`);
    assert.equal(badState.status(), 400, 'callback rejects an unknown state');
    assert.equal((await user()).logged_in, false, 'bad callback does not create a session');

    await page.goto(`${app}/api/login`);
    const expiredState = new URL(page.url()).searchParams.get('state');
    const expireState = await context.request.get(`${info.control.replace('/__test__/expire', '/__test__/expire-state')}?state=${expiredState}`);
    assert.equal(expireState.status(), 200, 'fixture expires only the issued test OAuth state');
    const expiredCallback = await context.request.get(`${app}/cb?code=mock-code&state=${expiredState}`);
    assert.equal(expiredCallback.status(), 400, 'callback rejects expired OAuth state');

    await page.goto(`${app}/api/login`);
    const deniedState = new URL(page.url()).searchParams.get('state');
    await page.getByRole('button', { name: '取消授权' }).click();
    const deniedBody = await page.locator('body').innerText();
    assert(deniedBody.includes('授权未完成，请重新登录。'), `provider denial is surfaced: ${deniedBody}`);
    assert.equal((await user()).logged_in, false, 'denied authorization does not create a session');
    const replayedDenial = await context.request.get(`${app}/cb?error=access_denied&state=${deniedState}`);
    assert.equal(replayedDenial.status(), 400, 'denied callback consumes state and cannot be replayed');

    await page.goto(`${app}/api/login`);
    await page.getByRole('button', { name: '模拟登录服务异常' }).click();
    const tokenFailureBody = await page.locator('body').innerText();
    assert(tokenFailureBody.includes('暂时无法完成登录，请稍后重试。'), `token exchange errors are surfaced: ${tokenFailureBody}`);
    assert.equal((await user()).logged_in, false, 'token failure does not create a session');

    await context.close();
    console.log('Huiguan OAuth browser E2E PASS (new, repeat, existing, member management, rejected UID, state, session lifecycle, provider errors)');
  } finally {
    if (browser) await browser.close();
    child.kill();
    await childClosed;
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
