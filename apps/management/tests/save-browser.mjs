
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {join, extname, resolve} from 'node:path';
import {chromium} from 'playwright';

const dist = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  try {
    const file = resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
    assert(file.startsWith(resolve(dist) + (/^[A-Z]:/.test(dist) ? '\\' : '/')));
    const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css'};
    res.setHeader('content-type', types[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch {
    res.writeHead(404); res.end();
  }
});

await new Promise(r => server.listen(0,'127.0.0.1',r));
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let active = false, remote, saveRequests = 0, logoutRequests = 0;
  const user = {kind:'local', uid:'9733', name:'SaveFixture'};
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
    if (url.origin !== 'http://localhost:8089' && url.origin !== origin) return route.abort();
    const json = (data, status = 200) => route.fulfill({status, json:data});
    switch (url.pathname) {
      case '/api/user': return json({logged_in:active, user_id:user.uid, kind:user.kind, nickname:user.name});
      case '/api/auth': active = true; return json({user});
      case '/api/logout': logoutRequests++; active = false; return json({ok:true});
      case '/api/game/load': return remote ? json({ok:true, state:remote}) : json({error:'没有存档'}, 404);
      case '/api/game/save':
        saveRequests++;
        remote = route.request().postDataJSON().state;
        return json({ok:true});
      default: return json({ok:true, enabled:false});
    }
  });
  await page.goto(origin);
  await page.evaluate(async () => window.__lingjing.ready);
  remote = await page.evaluate(() => {
    const state = {...window.__lingjing.state(), paused:true};
    return JSON.parse(JSON.stringify(state));
  });
  const enter = async () => {
    await page.locator('#btn-settings').click();
    await page.locator('#btn-login').click();
    await page.locator('#login-username').fill('fixture97');
    await page.locator('#login-password').fill('synthetic-password');
    await page.locator('#login-ok').click();
    await page.waitForFunction(() => document.querySelector('#account-status').textContent === 'SaveFixture');
  };
  const leave = async () => {
    await page.locator('#btn-settings').click();
    await page.locator('#btn-logout').click();
    await page.locator('#btn-login').waitFor();
    await page.locator('#settings-close').click();
  };
  await enter();
  const base = remote.resources.spirit;
  await page.evaluate(() => { window.__lingjing.state().resources.spirit += 7; });
  await leave();
  await enter();
  assert.equal(await page.evaluate(() => window.__lingjing.state().resources.spirit), base + 7);
  assert.equal(await page.locator('#btn-save').isEnabled(), true);
  await leave();
  remote.resources.spirit = base + 3; // Simulate an independent change on another device.
  await enter();
  assert.equal(await page.evaluate(() => window.__lingjing.state().resources.spirit), base + 7);
  assert.equal(await page.locator('#btn-save').isDisabled(), true);
  assert.match(await page.locator('#save-protection').textContent(), /保留两份/);
  await page.locator('#btn-load').click();
  assert.equal(await page.locator('#save-protection').isVisible(), true);
  await page.evaluate(() => { window.__lingjing.state().paused = false; });
  await page.waitForTimeout(15500);
  assert.equal(saveRequests, 0);
  assert.equal(remote.resources.spirit, base + 3);
  await leave();
  assert.equal(logoutRequests, 3);
  assert.deepEqual(errors, []);
  console.log('PASS Chrome: login/logout/reentry, explicit conflict, distinct local and cloud, protected manual/autosave/load/logout');
} finally {
  if(browser) await browser.close();
  server.close();
}
