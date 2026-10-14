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
import pathlib,sys,types,http.server
root=pathlib.Path(sys.argv[1]); temp=pathlib.Path(sys.argv[2])
import sqlite3
# Reproduce the deployed schema without copying any private account records.
origin=sqlite3.connect((root/'portal/huiguan/users.db').as_uri()+'?mode=ro',uri=True)
target=sqlite3.connect(temp/'users.db')
for (sql,) in origin.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL"):
 target.execute(sql)
target.commit();target.close();origin.close()
source=(root/'portal/huiguan/server_huiguan.py').read_text(encoding='utf-8')
for name,value in [('USER_DB',str(temp/'users.db')),('DATA_FILE',str(temp/'characters.json')),('STORE_DIR',str(temp/'store')),('UPLOAD_DIR',str(temp/'uploads'))]:
 import re
 source,count=re.subn(r'^'+name+r' = .+$',lambda _: name+' = '+repr(value),source,count=1,flags=re.M)
 assert count==1
module=types.ModuleType('test_huiguan');module.__file__=str(root/'portal/huiguan/server_huiguan.py');sys.modules[module.__name__]=module
exec(compile(source,module.__file__,'exec'),module.__dict__)
class Handler(module.Handler):
 def _session_cookie(self,sid): return super()._session_cookie(sid).replace('; Domain=.iridescently.xyz','')
 def _sso_cookie(self,*args): return super()._sso_cookie(*args).replace('; Domain=.iridescently.xyz','')
 def log_message(self,*args): pass
print('READY',flush=True)
http.server.ThreadingHTTPServer(('127.0.0.1',5190),Handler).serve_forever()
`;
const server = spawn('python', ['-u', '-c', python, root, scratch], { cwd: root, windowsHide: true });
(async () => {
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.stdout.on('data', data => { if (String(data).includes('READY')) resolve(); });
      server.stderr.on('data', data => process.stderr.write(data));
      server.once('exit', code => reject(Error('Test server exited: ' + code)));
    });
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const auth = await context.request.post('http://127.0.0.1:5190/api/auth', { data: { username: 'flow_' + width, password: 'test-only-password' } });
      assert.equal(auth.status(), 200);
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:5190/#charForm', { waitUntil: 'domcontentloaded' });
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
      await page.locator('[name=appearance]').fill('黑色头发的验证角色');
      // Exercise the actual failure UI without writing a rejected character.
      await page.route('**/api/save-character', route => route.fulfill({ status: 413, contentType: 'application/json', body: '{"error":"oversized"}' }));
      await page.locator('#btnSubmit').click();
      await page.waitForFunction(() => document.getElementById('formFeedback').textContent.includes('总大小'));
      assert.equal(await page.locator('[name=name]').inputValue(), '验证名字');
      await page.unroute('**/api/save-character');
      const saved = page.waitForResponse(r => r.url().endsWith('/api/save-character') && r.status() === 200);
      await page.waitForFunction(() => !document.getElementById('btnSubmit').disabled);
      await page.locator('#btnSubmit').click();
      assert.equal((await (await saved).json()).ok, true);
      await page.waitForFunction(() => document.getElementById('successMsg').textContent.includes('登记成功'));
      const records = await (await context.request.get('http://127.0.0.1:5190/api/get-characters')).json();
      assert.ok(JSON.stringify(records).includes('验证名字'));
      assert.deepEqual(errors, []);
      console.log(width + ': incomplete → visible error → corrected → failed request preserves form → real saved record PASS');
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
    await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
    assert.ok(path.resolve(scratch).startsWith(path.join(os.tmpdir(), 'huiguan-flow-')));
    fs.rmSync(scratch, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
