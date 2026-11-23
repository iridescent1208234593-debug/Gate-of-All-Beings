// Run from the repo root: node apps/shell/tests/lifecycle.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:38121';
const shell = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const portal = await readFile(new URL('../portal.json', import.meta.url), 'utf8');
const javascript = 'application/javascript';
const html = 'text/html';
const probe = `
  const box = window.__iridescentlyEmbed || document.body;
  let ticks = 0;
  const timer = setInterval(() => { ticks++; }, 50);
  const mark = document.createElement('output');
  mark.id = 'fixture-probe'; mark.textContent = key; box.append(mark);
  const onProbe = () => dispatchEvent(new CustomEvent('fixture-seen', {detail: key}));
  window.addEventListener('fixture-ping', onProbe);
  window.__iridescentlyDispose = () => {
    clearInterval(timer);
    window.removeEventListener('fixture-ping', onProbe);
    window.fixtureDisposals = (window.fixtureDisposals || 0) + 1;
  };
`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH
  ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // Only the production Shell code and portal config are loaded; modules, account and assets
  // are tiny synthetic boundary probes. A real build/GPU measurement is a separate gate.
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    const p = url.pathname;
    const send = (body, contentType = html) => route.fulfill({ body, contentType });
    if (p.startsWith('/app/shell/')) return send(shell);
    if (p === '/app/portal.json') return send(portal, 'application/json');
    if (p === '/shared/site-domains/index.js') return send('window.IridescentlyDomains={service:()=>"zszm"}', javascript);
    if (p.endsWith('/session.js')) return send('export const refreshSession=async()=>({logged_in:true,name:"Fixture"});', javascript);
    if (p.endsWith('/save.js')) return send('export const get=()=>null,set=()=>{};', javascript);
    if (p.endsWith('/server-recovery.js')) return send('window.IridescentlyRecovery={render:el=>{el.textContent="error"}};', javascript);
    if (p.endsWith('.css')) return send('', 'text/css');
    if (p.startsWith('/shared/') || p === '/favicon.ico') return send('', javascript);
    const match = /^\/app\/modules\/(cards|management|softie|world-map)\/(index\.html)?$/.exec(p);
    if (match) {
      if (request.method() === 'HEAD') return send('');
      const key = JSON.stringify(match[1]);
      return send(`<!doctype html><body><script>{const key=${key};${probe}}</script></body>`);
    }
    return route.fulfill({ status: 404, body: 'unexpected fixture path' });
  });
  const href = key => '/app/shell/m/' + key;
  await page.goto(origin + href('cards'));
  await page.locator('#fixture-probe').waitFor();
  await page.evaluate(() => {
    window.fixtureSeen = [];
    addEventListener('fixture-seen', e => fixtureSeen.push(e.detail));
  });
  const switchTo = async key => {
    // Cards does not have a tab; the real Shell delegated link listener handles this deep link.
    await page.evaluate(url => {
      const a = Object.assign(document.createElement('a'), { href: url });
      a.setAttribute('href', url);
      document.body.append(a); a.click(); a.remove();
    }, href(key));
    await page.waitForURL(origin + href(key));
  };
  for (let round = 0; round < 20; round++) {
    await switchTo('management');
    await page.locator('.module-embed[aria-busy="false"] #fixture-probe').waitFor();
    const seen = await page.evaluate(() => {
      window.fixtureSeen.length = 0;
      dispatchEvent(new Event('fixture-ping'));
      return window.fixtureSeen.slice();
    });
    assert.deepEqual(seen, ['management']);
    await switchTo('softie');
    const frame = page.frameLocator('iframe.view');
    await frame.locator('#fixture-probe').waitFor();
    assert.equal(await frame.locator('#fixture-probe').textContent(), 'softie');
    assert.equal(await page.locator('#fixture-probe').count(), 0);
    await switchTo('cards');
    await page.locator('.module-embed[aria-busy="false"] #fixture-probe').waitFor();
    assert.equal(await page.locator('iframe.view').count(), 0);
    assert.equal(await page.evaluate(() => window.fixtureDisposals), (round + 1) * 2);
  }
  assert.deepEqual(errors, []);
  console.log('PASS Shell boundary: 20 cycles, attached disposers, isolated Softie frame, no page errors (fixture modules).');
} finally {
  await browser.close();
}
