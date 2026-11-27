// #94: real built modules mounted and unmounted by the real Shell, with resource counters.
// Run from the repo root after `npm run build:modules` (or point MODULES_DIR at a built candidate):
//   node apps/shell/tests/module-lifecycle-real.mjs
// Only local files are served; accounts, APIs and every other origin are synthetic or blocked.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const storage = process.env.IRIDESCENTLY_STORAGE_ROOT;
const modulesDir = process.env.MODULES_DIR ||
  (storage && path.join(storage, process.env.IRIDESCENTLY_ENVIRONMENT || 'test', 'releases/candidate/modules'));
const cycles = Number(process.env.LIFECYCLE_CYCLES || 20);
const only = (process.env.LIFECYCLE_MODULES || 'cards,management,softie').split(',');
assert(modulesDir && existsSync(modulesDir), 'Build the modules first (npm run build:modules) or set MODULES_DIR');

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.ktx2': 'image/ktx2' };
const home = '<main id="home">' + only.map(k => `<a id="go-${k}" href="/app/shell/m/${k}">${k}</a>`).join('') + '</main>';
const shared = {
  '/shared/site-domains/index.js': "window.IridescentlyDomains={service:()=>'zszm',url:(_,p='')=>location.origin+p}",
  '/shared/shared-session/session.js': "export async function refreshSession(){return {logged_in:false}}",
  '/shared/shared-session/save.js': "export const get=k=>localStorage.getItem('shell:'+k); export const set=(k,v)=>localStorage.setItem('shell:'+k,v)",
};

function inside(base, rel) {
  const file = path.join(base, rel);
  return file.startsWith(base + path.sep) && !rel.split('/').includes('..') && existsSync(file) && statSync(file).isFile() ? file : null;
}

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const send = (body, type, status = 200) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(req.method === 'HEAD' ? undefined : body); };
  if (p === '/') return send(home, types['.html']);
  if (shared[p]) return send(shared[p], 'text/javascript');
  if (p.startsWith('/shared/')) {
    const file = inside(path.join(root, 'packages'), p.slice('/shared/'.length));
    return file ? send(readFileSync(file), types[path.extname(file)] || 'application/octet-stream') : send('', 'text/plain', 404);
  }
  // Site-root files the module pages also load (served by nginx from these sources in production).
  if (p.startsWith('/assets/')) {
    const file = inside(path.join(root, 'apps/www/assets'), p.slice('/assets/'.length));
    return file ? send(readFileSync(file), types[path.extname(file)] || 'application/octet-stream') : send('', 'text/plain', 404);
  }
  if (p === '/avatar-cropper.js') return send(readFileSync(path.join(root, 'apps/huiguan/avatar-cropper.js')), 'text/javascript');
  if (p.startsWith('/app/shell/')) return send(readFileSync(path.join(root, 'apps/shell/index.html')), types['.html']);
  if (p === '/app/portal.json') return send(readFileSync(path.join(root, 'apps/shell/portal.json')), types['.json']);
  const m = p.match(/^\/app\/modules\/([a-z-]+)\/(.*)$/);
  if (m) {
    const file = inside(path.join(modulesDir, m[1]), m[2] || 'index.html') || (!path.extname(m[2]) && inside(path.join(modulesDir, m[1]), 'index.html'));
    return file ? send(readFileSync(file), types[path.extname(file)] || 'application/octet-stream') : send('', 'text/plain', 404);
  }
  if (p.startsWith('/api/')) return send('{"logged_in":false}', 'application/json', p === '/api/sso-user' || p === '/api/user' ? 200 : 404);
  return send('', 'text/plain', 404);
});

// Counts what a module can leave running after it is unmounted. Runs in the page and in iframes.
const probe = () => {
  const live = { raf: new Set(), intervals: new Set(), timeouts: new Set(), listeners: 0, audio: new Set(), workers: new Set(), gl: [] };
  window.__lifecycle = live;
  const raf = window.requestAnimationFrame.bind(window), caf = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => { const id = raf(t => { live.raf.delete(id); cb(t); }); live.raf.add(id); return id; };
  window.cancelAnimationFrame = id => { live.raf.delete(id); caf(id); };
  const si = window.setInterval.bind(window), ci = window.clearInterval.bind(window);
  window.setInterval = (...a) => { const id = si(...a); live.intervals.add(id); return id; };
  window.clearInterval = id => { live.intervals.delete(id); ci(id); };
  const st = window.setTimeout.bind(window), ct = window.clearTimeout.bind(window);
  window.setTimeout = (cb, ms, ...a) => { let id; id = st((...x) => { live.timeouts.delete(id); typeof cb === 'function' && cb(...x); }, ms, ...a); if (ms >= 1000) live.timeouts.add(id); return id; };
  window.clearTimeout = id => { live.timeouts.delete(id); ct(id); };
  for (const target of [window, document]) {
    const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
    const seen = new Map();
    const key = (type, fn, opt) => type + '|' + (typeof opt === 'object' ? !!opt?.capture : !!opt);
    target.addEventListener = (type, fn, opt) => {
      if (fn && !(seen.get(fn) || new Set()).has(key(type, fn, opt))) {
        const set = seen.get(fn) || new Set(); set.add(key(type, fn, opt)); seen.set(fn, set); live.listeners++;
        opt?.signal?.addEventListener?.('abort', () => { if (set.delete(key(type, fn, opt))) live.listeners--; }, { once: true });
      }
      return add(type, fn, opt);
    };
    target.removeEventListener = (type, fn, opt) => {
      const set = seen.get(fn);
      if (set?.delete(key(type, fn, opt))) live.listeners--;
      return remove(type, fn, opt);
    };
  }
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const Base = window[name];
    if (!Base) continue;
    window[name] = class extends Base {
      constructor(...a) { super(...a); live.audio.add(this); }
      close() { live.audio.delete(this); return super.close(); }
    };
  }
  if (window.Worker) {
    const W = window.Worker;
    window.Worker = class extends W {
      constructor(...a) { super(...a); live.workers.add(this); }
      terminate() { live.workers.delete(this); return super.terminate(); }
    };
  }
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const ctx = getContext.call(this, type, ...a);
    if (ctx && /webgl/.test(String(type)) && !live.gl.some(g => g.ctx === ctx)) live.gl.push({ ctx, canvas: this });
    return ctx;
  };
  window.__lifecycleCounts = () => ({
    raf: live.raf.size, intervals: live.intervals.size, longTimeouts: live.timeouts.size, listeners: live.listeners,
    audioOpen: [...live.audio].filter(a => a.state !== 'closed').length, workers: live.workers.size,
    webglLiveDetached: live.gl.filter(g => !g.canvas.isConnected && !g.ctx.isContextLost()).length,
    iframes: document.querySelectorAll('iframe').length,
    webglCreated: live.gl.length,
  });
};

await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE
  ? { executablePath: process.env.CHROMIUM_EXECUTABLE, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] }
  : { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const report = {};
try {
  const context = await browser.newContext({ serviceWorkers: 'block', locale: 'zh-CN', viewport: { width: 1280, height: 800 } });
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === base) return route.continue();
    return route.abort();
  });
  await context.addInitScript(probe);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const href = key => '/app/shell/m/' + key;
  // The Shell's own delegated link listener switches modules without reloading the document, so
  // anything a module leaves behind accumulates here (#94). Returning to the hall is a full page load.
  const switchTo = async key => {
    await page.evaluate(url => {
      const a = Object.assign(document.createElement('a'), { href: url });
      document.body.append(a); a.click(); a.remove();
    }, href(key));
    await page.waitForURL(base + href(key));
    if (key === 'softie') await page.frameLocator('iframe.view').locator('body[data-softie-page]').waitFor({ state: 'attached' });
    else await page.locator('.module-embed[aria-busy="false"]').waitFor({ state: 'attached' });
    await page.waitForTimeout(Number(process.env.LIFECYCLE_SETTLE_MS || 1200));   // let loops, audio and workers start
  };
  await page.goto(base + href('softie'));
  await page.frameLocator('iframe.view').locator('body[data-softie-page]').waitFor({ state: 'attached' });
  const samples = [];
  for (let i = 0; i < cycles; i++) {
    for (const key of only.filter(k => k !== 'softie')) await switchTo(key);
    await switchTo('softie');
    samples.push(await page.evaluate(() => window.__lifecycleCounts()));
  }
  report.samples = samples;
  report.errors = errors;
  if (process.env.LIFECYCLE_VERBOSE) console.log(JSON.stringify({ first: samples[0], last: samples.at(-1), errors }));
  assert.deepEqual(errors, [], 'page errors while mounting/unmounting real modules');
  samples.forEach((s, i) => {
    const round = `round ${i + 1}`;
    // Measured inside Softie (an iframe), so every embedded module has been unmounted by then.
    for (const name of ['raf', 'intervals', 'longTimeouts', 'audioOpen', 'workers', 'webglLiveDetached']) {
      assert.equal(s[name], 0, `${round}: ${name} left behind by an unmounted module`);
    }
    assert.equal(s.iframes, 1, `${round}: only the current Softie frame may exist`);
    assert.ok(s.listeners <= samples[0].listeners, `${round}: window/document listeners grew ${samples[0].listeners} -> ${s.listeners}`);
  });
  if (only.includes('cards')) assert.ok(samples.at(-1).webglCreated >= cycles, 'the Gate scene never created a WebGL renderer');
  console.log(`PASS real modules (${only.join(', ')}): ${cycles} in-Shell switch rounds, no RAF/timer/audio/worker/WebGL left after unmount, ` +
    `listeners stay at ${samples[0].listeners}, ${samples.at(-1).webglCreated} WebGL contexts created and released, no page errors`);
} finally {
  await browser.close();
  server.close();
}
