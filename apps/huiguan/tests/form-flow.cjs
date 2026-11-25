/* Real form + real save handler, with all account/character writes in a temporary directory. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'huiguan-flow-'));
const root = path.resolve(__dirname, '../../..');
const python = `
import pathlib, sys, os, http.server, json
root=pathlib.Path(sys.argv[1]); temp=pathlib.Path(sys.argv[2])
for key in list(os.environ):
 if key.startswith(('IRIDESCENTLY_', 'LAB_', 'USSO_', 'HX_', 'TURNSTILE_')): del os.environ[key]
os.environ.update(IRIDESCENTLY_STORAGE_ROOT=str(temp), IRIDESCENTLY_ENVIRONMENT='test', IRIDESCENTLY_PROJECT_ROOT=str(root), HX_SSO_SECRET='form-flow-test-only')
sys.path[:0] = [str(root/'apps/huiguan'), str(root/'services/platform')]
from storage_paths import initialize_storage
initialize_storage()
import server_huiguan as module
class Handler(module.Handler):
 def log_message(self,*args): pass
with module.db() as db:
 uids = [db.execute("INSERT INTO local_users (username,nickname,pass_hash,role,status) VALUES(?,?,?,?,?)",
  ('flow_'+str(width), 'Fixture_'+str(width), 'fixture-not-password', 'user', 'active')).lastrowid for width in (1440, 390)]
 for uid in uids: module.legal_consent.record(db, 'local', uid)
sessions=[module.create_session('local', uid) for uid in uids]
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
print(json.dumps({'port':server.server_port,'sessions':sessions}),flush=True)
server.serve_forever()
`;
const server = spawn(process.env.PYTHON || 'python', ['-u', '-c', python, root, scratch], { cwd: root, windowsHide: true });
(async () => {
  let browser;
  try {
    const fixture = await new Promise((resolve, reject) => {
      let stdout = '';
      server.stdout.on('data', data => { stdout += data; const match = stdout.match(/^\{.*\}$/m); if (match) resolve(JSON.parse(match[0])); });
      server.stderr.on('data', data => process.stderr.write(data));
      server.once('exit', code => reject(Error('Test server exited: ' + code)));
    });
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const origin = 'http://127.0.0.1:' + fixture.port;
    for (const [i, width] of [1440, 390].entries()) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      await context.route('**/*', route => route.request().url().startsWith(origin + '/') && !route.request().url().startsWith(origin + '/api/official/') ? route.continue() : route.abort());
      await context.route(origin + '/shared/site-domains/index.js*', route => route.fulfill({
        path: path.join(root, 'packages/site-domains/index.js'), contentType: 'text/javascript',
      }));
      await context.addCookies([{name:'session',value:fixture.sessions[i],url:origin}]);
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(origin + '/#charForm', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.currentUser?.logged_in && window.renderFormFeedback);
      await page.locator('#btnSubmit').click();
      assert.match(await page.locator('#formFeedback').innerText(), /请输入代号/);
      await page.evaluate(() => {
        const f = document.getElementById('charForm');
        for (const [key, value] of Object.entries({ code: '流程验证', name: '验证名字', age: '20', appearance: '!!!', background: '来自西木会馆的验证角色' })) f.elements.namedItem(key).value = value;
        f.querySelector('[name=gender]').checked = true; f.elements.namedItem('species_type').value = '人类';
        f.requestSubmit();
      });
      assert.match(await page.locator('#row-appearance .err').innerText(), /至少填写两个/);
      assert.equal(await page.locator('#row-appearance textarea').getAttribute('aria-invalid'), 'true');
      await page.locator('#ocLegal input[type=checkbox]').check();
      await page.locator('[name=appearance]').fill('黑色头发的验证角色');
      // Exercise the actual failure UI without writing a rejected character.
      await page.route('**/api/save-character', route => route.fulfill({ status: 413, contentType: 'application/json', body: '{"error":"oversized"}' }));
      await page.locator('#btnSubmit').click();
      await page.waitForFunction(() => document.getElementById('formFeedback').textContent.includes('提交内容过大'));
      assert.equal(await page.locator('[name=name]').inputValue(), '验证名字');
      await page.unroute('**/api/save-character');
      let requestStarted, releaseRequest;
      const started = new Promise(resolve => { requestStarted = resolve; });
      const release = new Promise(resolve => { releaseRequest = resolve; });
      await page.route('**/api/save-character', async route => {
        requestStarted();
        await release;
        await route.continue();
      });
      const saved = page.waitForResponse(r => r.url().endsWith('/api/save-character') && r.status() === 200);
      await page.waitForFunction(() => !document.getElementById('btnSubmit').disabled);
      await page.locator('#btnSubmit').click();
      await Promise.race([started, page.waitForTimeout(6000).then(() => {throw Error('The valid form did not send a save request');})]);
      await page.locator('[name=background]').fill('A later draft while saving');
      releaseRequest();
      assert.equal((await (await saved).json()).ok, true);
      await page.waitForFunction(() => !document.getElementById('btnSubmit').disabled);
      assert.equal(await page.locator('[name=background]').inputValue(), 'A later draft while saving');
      await page.waitForFunction(() => document.getElementById('successMsg').textContent.includes('登记成功'));
      const records = await (await context.request.get(origin + '/api/get-characters')).json();
      assert.ok(JSON.stringify(records).includes('验证名字'));
      await page.unroute('**/api/save-character');
      await page.reload({ waitUntil: 'domcontentloaded' });
      const restore = page.locator('#characterTextDraftRestore');
      const dismiss = page.locator('#fanSuggestClose');
      await restore.or(dismiss).first().waitFor({state:'visible'});
      if (await dismiss.isVisible()) await dismiss.click();
      await restore.evaluate(button => button.click());
      assert.equal(await page.locator('[name=background]').inputValue(), 'A later draft while saving');
      assert.deepEqual(errors, []);
      console.log(width + ': incomplete → visible error → corrected → failed request preserves form → real saved record; later text stays visible and is restorable after reload PASS');
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
    await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
    assert.ok(path.resolve(scratch).startsWith(path.join(os.tmpdir(), 'huiguan-flow-')));
    fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
