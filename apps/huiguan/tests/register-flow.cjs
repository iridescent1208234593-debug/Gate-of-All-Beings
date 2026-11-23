/* Registration UI contract against intercepted responses, no live site, mail, or credentials.
 * Run from repo root: node apps/huiguan/tests/register-flow.cjs
 * Real temporary-account/rate-limit coverage: python -B apps/huiguan/tests/test_register_rate_limit.py
 */
'use strict';
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const dir = path.resolve(__dirname, '..');
const source = readFileSync(path.join(dir, 'index.html'), 'utf8');
const legal = readFileSync(path.join(dir, 'legal-consent.js'), 'utf8');
const version = 'test-registration-version';
const password = 'fixture-password-123';
const key = '#authRegUsername', email = '#authEmail', pass = '#authRegPassword', confirm = '#authRegPassword2';
const origin = 'http://127.0.0.1:4179';
function between(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert(from >= 0 && to > from, 'Registration fixture markers changed');
  return source.slice(from, to);
}
const fixture = '<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width, initial-scale=1">' +
  between('<style>', '</style>') + '</style></head><body>' +
  between('<!-- 登录/注册弹窗：', '<!-- 全局弹出提示 -->') + '<div id="ocLegal"></div><script src="/legal-consent.js"></script><script>' +
  "window.HuiguanTurnstile={mount:async()=>{}, ensure:async()=>'disabled', token:()=>'', reset:()=>{}};" +
  'function hideGuestReminder(){} function showGuestReminder(){} async function checkLogin(){} function flushPending(){}' +
  between('const AUTH_USERNAME_RE', 'async function submitAuth()') +
  "openAuthModal('', 'register');</script></body></html>";

async function run(browser, width) {
  const context = await browser.newContext({viewport: {width, height: 900}, reducedMotion: 'reduce'});
  try {
    const page = await context.newPage();
    let submitted = 0;
    let response = 400;
    await page.route('**/*', route => {
      const request = route.request(), url = request.url();
      if (url === origin + '/') return route.fulfill({status:200, contentType:'text/html', body:fixture});
      if (url === origin + '/legal-consent.js') return route.fulfill({status:200, contentType:'application/javascript', body:legal});
      if (url === origin + '/api/legal') return route.fulfill({json:{legal_version: version}});
      if (url !== origin + '/api/register') return route.abort();
      submitted++;
      assert.equal(request.method(), 'POST');
      assert.deepEqual(request.postDataJSON(), {username:'test_member', email:'fixture@example.test', password, legal_version:version, turnstile:''});
      if (response === 0) return route.abort('failed');
      const body = {400:{error:'请输入有效邮箱地址'}, 409:{error:'该用户名已被注册'},
        429:{error:'注册过于频繁，请稍后再试',code:'register_rate_limited'},
        200:{ok:true,email_sent:false}}[response];
      return route.fulfill({status:response,json:body});
    });
    await page.goto(origin + '/');
    await page.locator(key).fill('x');
    async function submit(pattern) {
      await page.locator(confirm).press('Enter');
      await page.waitForFunction(rx => new RegExp(rx).test(document.getElementById('authMsg').textContent), pattern.source);
    }
    await submit(/用户名格式不对/);
    assert.equal(await page.locator(key).getAttribute('aria-invalid'), 'true');
    assert.equal(await page.locator(key).evaluate(el => el === document.activeElement), true);
    await page.locator(key).fill('test_member');
    await page.locator(email).fill('bad');
    await submit(/邮箱格式不对/);
    await page.locator(email).fill('fixture@example.test');
    await page.locator(pass).fill('short');
    await submit(/密码至少 12 位/);
    await page.locator(pass).fill(password);
    await page.locator(confirm).fill('wrong-password-123');
    await submit(/两次输入的密码不一致/);
    await page.locator(confirm).fill(password);
    await submit(/勾选同意.*用户须知.*隐私政策/);
    assert.equal(submitted, 0);
    assert.equal(await page.getByRole('button', {name:'《用户须知》'}).count(), 1);
    assert.equal(await page.getByRole('button', {name:'《隐私政策》'}).count(), 1);
    const consent = page.locator('#authLegal input[type=checkbox]');
    await consent.focus();
    await consent.press('Space');
    assert(await consent.isChecked());
    for (const [status, pattern] of [[400,/请输入有效邮箱地址/], [409,/该用户名已被注册/], [429,/注册过于频繁/], [0,/网络错误/]]) {
      response = status;
      await submit(pattern);
      for (const [selector, value] of [[key,'test_member'], [email,'fixture@example.test'], [pass,password], [confirm,password]]) {
        assert.equal(await page.locator(selector).inputValue(), value);
      }
      assert(await consent.isChecked());
    }
    assert.equal(await page.locator('#authUsername').inputValue(), 'test_member');
    response = 200;
    await submit(/注册成功/);
    assert.equal(submitted, 5);
    assert.equal(await page.locator(pass).inputValue(), '');
    assert.equal(await consent.isChecked(), false);
    await page.locator('#authMask').waitFor({state:'hidden'});
    console.log('PASS registration UI at width', width);
  } finally {
    await context.close();
  }
}
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    for (const width of [1440,390]) await run(browser, width);
  } finally {
    await browser.close();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
