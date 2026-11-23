// npm ci (apps/cards), with playwright on NODE_PATH and a local Chromium browser.
// CARDS_DOM=jsdom uses the same actions, without browser layout/art assertions.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { build } = require('esbuild');

const root = path.resolve(__dirname, '..');
const fixture = `
import { createRoot } from 'react-dom/client';
import { PlayerOnboarding } from './src/onboarding/PlayerOnboarding';
const app = createRoot(document.querySelector('#root'));
const initial = { display_name: '', avatar_frame_id: '' };
window.attempts = [];
window.openFixture = (key, identity = initial) => app.render(
  <PlayerOnboarding key={key} initialIdentity={identity}
    onCancel={() => app.render(null)}
    onComplete={async result => {
      window.attempts.push(result);
      if (window.attempts.length === 1) throw Error('Synthetic save failed');
      app.render(<output id="done">{result.display_name}</output>);
    }}
  />
);
window.openFixture('new-a');
`;

async function main() {
  const packed = await build({
    stdin: { contents: fixture, resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, jsx: 'automatic',
    nodePaths: (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
    plugins: [{ name: 'fixture-visual-assets', setup(builder) {
      builder.onResolve({ filter: /\?raw$/ }, args => ({
        path: path.resolve(args.resolveDir, args.path.slice(0, -4)), namespace: 'raw',
      }));
      builder.onLoad({ filter: /.*/, namespace: 'raw' }, async args => ({
        contents: await fs.readFile(args.path, 'utf8'), loader: 'text',
      }));
      // Keep local SVG frame structure and real screen markup but omit image
      // URLs and CSS: this fixture tests flow, not animation appearance.
      builder.onLoad({ filter: /onboarding[/\\][^/\\]+\.js$/ }, async args => ({
        contents: (await fs.readFile(args.path, 'utf8')).replace(/import\.meta\.glob\([^\n]+?\);/g, '({});'),
        loader: 'js', resolveDir: path.dirname(args.path),
      }));
    } }],
    loader: { '.css': 'empty' },
  });
  const bundle = packed.outputFiles[0].text;
  let run, close;
  const runtimeErrors = [];
  if (process.env.CARDS_DOM === 'jsdom') {
    const { JSDOM, VirtualConsole } = require('jsdom');
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', error => runtimeErrors.push(error));
    const { window } = new JSDOM('<div id="root"></div>', { runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
    window.matchMedia = () => ({ matches: false });
    window.ResizeObserver = class { observe() {} disconnect() {} };
    window.SVGElement.prototype.getTotalLength = () => 100;
    window.SVGElement.prototype.getPointAtLength = distance => ({ x: distance, y: distance });
    window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    window.HTMLDialogElement.prototype.close = function () { this.open = false; };
    window.eval(bundle);
    run = (fn, args) => window.eval('(' + fn + ')(' + JSON.stringify(args ?? null) + ')');
    close = () => window.close();
  } else {
    const server = http.createServer((req, res) => {
      const js = req.url === '/fixture.js';
      res.setHeader('content-type', js ? 'text/javascript' : 'text/html');
      res.end(js ? bundle : '<meta charset="utf-8"><div id="root"></div><script src="/fixture.js"></script>');
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    let browser;
    close = async () => { try { await browser?.close(); } finally { await new Promise(resolve => server.close(resolve)); } };
    try {
      browser = await require('playwright').chromium.launch({ executablePath: process.env.CARDS_CHROMIUM || undefined });
      const page = await browser.newPage();
      page.on('pageerror', error => runtimeErrors.push(error));
      await page.goto('http://127.0.0.1:' + server.address().port);
      run = (fn, args) => page.evaluate(fn, args);
    } catch (error) { await close(); throw error; }
  }

  try {
    async function until(predicate, arg) {
      for (let i = 0; i < 180; i++) {
        if (await run(predicate, arg)) return;
        await new Promise(resolve => setTimeout(resolve, 40));
      }
      throw Error('Timed out: ' + predicate + ' ' + (arg || ''));
    }
    const click = async selector => {
      await until(s => !!document.querySelector(s) && !document.querySelector(s).disabled, selector);
      await run(s => document.querySelector(s).click(), selector);
    };
    const setValue = (selector, value) => run(([s, v]) => {
      const field = document.querySelector(s);
      field.value = v;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }, [selector, value]);
    const active = id => until(s => document.querySelector(s)?.getAttribute('aria-hidden') === 'false', '#' + id);
    const goSpecies = async () => {
      await click('#login-submit');
      await active('race-tree');
      await setValue('#race-tree-progress-range', '4300');
      await click('#race-tree [data-race="r01"]');
      await active('race-list');
      await click('#race-list [data-race="r01"]');
      await until(() => document.querySelector('.species-dialog')?.open);
    };
    await active('login');
    await setValue('#username', '未提交初稿');
    await click('#login-back');
    await until(() => !document.querySelector('#login'));
    await run(() => window.openFixture('new-a-reopened'));
    await active('login');
    assert.equal(await run(() => document.querySelector('#username').value), '');
    await setValue('#username', '重试旅人');
    await goSpecies();
    assert.equal(await run(() => document.querySelector('.species-dialog').dataset.kind), 'human');
    await click('.species-submit');
    await active('appearance-choice');
    await click('#appearance-choice [data-back]');
    await active('race-list');
    await click('#race-list [data-race="r01"]');
    await until(() => document.querySelector('.species-dialog')?.open);
    await click('.species-dialog [data-kind=""]');
    await click('.species-submit');
    assert.match(await run(() => document.querySelector('.species-error').textContent), /族类名称/);
    await setValue('.species-dialog [name=kind]', '灵');
    await setValue('.species-dialog [name=family]', '鸦科');
    await click('.species-submit');
    await active('appearance-choice');
    await click('[data-choice="frame"]');
    await click('#avatar-continue');
    await until(() => document.querySelector('#appearance-choice').textContent.includes('Synthetic save failed'));
    await click('#avatar-continue');
    await until(() => document.querySelector('#done')?.textContent === '重试旅人');
    const attempts = await run(() => window.attempts);
    assert.equal(attempts.length, 2);
    assert.deepEqual(attempts[0], attempts[1]);
    assert.equal(attempts[0].species_kind, '灵');
    assert.equal(attempts[0].species_family, '鸦科');
    await run(() => window.openFixture('new-b', { display_name: '账户乙', avatar_frame_id: '' }));
    await active('login');
    assert.equal(await run(() => document.querySelector('#username').value), '账户乙');
    assert.deepEqual(runtimeErrors, []);
    console.log('Onboarding component: leave/reopen, human/custom/back, failed save/retry and keyed remount PASS');
  } finally { await close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
