#!/usr/bin/env node
/* Actual Shell + manifest, synthetic module state, temp browser profiles; no external site. */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = process.env.SHELL_SMOKE_ROOT || path.resolve(__dirname, '../../..');
const shell = fs.readFileSync(path.join(root, 'apps/shell/index.html'));
const manifestBytes = fs.readFileSync(path.join(root, 'apps/shell/portal.json'));
const names = ['cards', 'management', 'ecology', 'juling', 'slay', 'softie', 'aeon', 'world-map'];
const manifest = JSON.parse(manifestBytes);
const modules = manifest.links.filter(m => names.includes(m.key));
assert.deepEqual(modules.map(m => m.key).sort(), [...names].sort());
const routes = new Map(modules.flatMap(m => [[m.url, m.key], [m.url + 'index.html', m.key]]));
const base = '/app/shell/';
const modulePath = key => base + 'm/' + key;
const shared = '/shared/';
const fixture = key => `<!doctype html><p data-module="${key}">${key}</p>
  <output data-save></output><button data-complete>完成测试回合</button>
  <script>
    (() => {
      const scope = 'issue95:' + ${JSON.stringify(key)};
      const get = () => Number(localStorage.getItem(scope) || 0);
      const panel = document.querySelector('[data-module="' + ${JSON.stringify(key)} + '"]');
      const output = panel.nextElementSibling;
      output.textContent = String(get());
      output.nextElementSibling.onclick = async () => {
        localStorage.setItem(scope, String(get() + 1));
        output.textContent = String(get());
        await fetch('/__fixture/report', {method: 'POST', body: scope});
      };
    })();
  </script>`;

async function main() {
  let browser;
  const reports = new Map();
  const rejects = [];
  const server = http.createServer((req,res) => {
    const p = new URL(req.url, 'http://127.0.0.1').pathname;
    const send = (type, body, status=200) => {
      res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store'});
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    const html = (body,status) => send('text/html; charset=utf-8',body,status);
    const js = body => send('text/javascript',body);
    if (p.startsWith(base)) return html(shell);
    if (p === '/app/portal.json') return send('application/json', manifestBytes);
    if (p === '/') return html('<main id="home">合成门庭</main>' + names.map(k =>
      `<a data-play="${k}" href="${modulePath(k)}">${k}</a>`).join(' '));
    if (p.startsWith(shared)) {
      if (p.endsWith('/site-domains/index.js')) return js("window.IridescentlyDomains={service:()=> 'zszm'}");
      if (p.endsWith('/shared-session/session.js')) return js("export async function refreshSession(){return {logged_in:true,name:'合成账户 A'}}");
      if (p.endsWith('/shared-session/save.js')) return js("export const get=k=>localStorage.getItem('shell:'+k); export const set=(k,v)=>localStorage.setItem('shell:'+k,v)");
      if (p.endsWith('/server-recovery.js')) return js("window.IridescentlyRecovery={render:(v,o)=>{v.textContent=o?.message||'error'}}");
      if (p.endsWith('.css')) return send('text/css','');
      return js('');
    }
    if (routes.has(p)) return html(fixture(routes.get(p)));
    if (p === '/__fixture/report' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { if (body.length < 128) body += chunk.toString(); });
      req.on('end', () => {
        if (!names.some(k => body === 'issue95:' + k)) return html('bad',400);
        reports.set(body, (reports.get(body) || 0) + 1);
        return html('ok');
      });
      return;
    }
    return html('not found',404);
  });
  await new Promise((resolve,reject) => server.listen(0,'127.0.0.1',resolve).once('error',reject));
  try {
    const host = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({executablePath: process.env.CHROMIUM_EXECUTABLE || undefined});
    for (const m of modules) {
      const context = await browser.newContext({serviceWorkers:'block'});
      try {
        await context.route('**/*', route => {
          if (new URL(route.request().url()).origin === host) return route.continue();
          rejects.push(route.request().url());
          return route.abort();
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const anchor = key => page.locator('#iridescently-shell-navlinks a[href="' + modulePath(key) + '"]');
        const expect = async (target, n) => {
          await page.waitForURL(host + modulePath(target.key));
          const current = target.embed ? page : page.frameLocator('iframe.view');
          if (target.embed) await current.locator('.module-embed[aria-busy=false]').waitFor();
          await current.locator(`[data-module="${target.key}"]`).waitFor();
          await current.locator('[data-save]').filter({hasText: new RegExp('^' + n + '$')}).waitFor();
          await page.locator('#iridescently-shell-user').filter({hasText:'合成账户 A'}).waitFor({state:'attached'});
          return current;
        };
        await page.goto(host + '/#home');
        await page.locator(`[data-play="${m.key}"]`).click();
        const mounted = await expect(m,0);
        await Promise.all([page.waitForResponse(r => r.url() === host + '/__fixture/report' && r.ok()),
                           mounted.locator('[data-complete]').click()]);
        const neighbor = modules.find(target => target.key !== m.key && target.key === 'management') ||
                         modules.find(target => target.key === 'ecology');
        await anchor(neighbor.key).click();
        await expect(neighbor,0);
        await page.goBack();
        await expect(m,1);
        await page.goForward();
        await expect(neighbor,0);
        await page.locator('#iridescently-shell-return').click();
        await page.waitForURL(host + '/#home');
        await page.locator(`[data-play="${m.key}"]`).click();
        await expect(m,1);
        assert.equal(reports.get('issue95:' + m.key),1);
        assert.deepEqual(errors,[]);
        console.log(`PASS shell route/history + synthetic save fixture: ${m.key} (${m.embed ? 'embed' : 'iframe'})`);
      } finally {
        await context.close();
      }
    }
    assert.equal(reports.size,8);
    assert.deepEqual(rejects,[]);
    console.log('PASS 8/8 Shell paths; fixtures only, no real module gameplay or save verified.');
  } finally {
    await browser?.close();
    server.close();
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
