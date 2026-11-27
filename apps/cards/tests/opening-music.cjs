const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { build } = require('esbuild');

// Real React provider in Chromium (or CARDS_DOM=jsdom without a browser).
// Node dependencies: npm ci --prefix apps/cards; Playwright or jsdom on NODE_PATH.
async function domHarness(js) {
  const { JSDOM } = require('jsdom');
  const { window } = new JSDOM('<div id="root"></div>', {
    url: 'https://fixture.invalid/', pretendToBeVisual: true, runScripts: 'outside-only',
  });
  const evaluate = fn => window.eval('(' + fn.toString() + ')()');
  async function waitForFunction(fn) {
    const deadline = Date.now() + 700;
    while (!fn()) {
      if (Date.now() > deadline) throw new Error('Unmet condition: ' + fn);
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }
  const page = {
    addInitScript: evaluate,
    evaluate,
    goto: () => window.eval(js),
    waitForFunction: fn => waitForFunction(() => evaluate(fn)),
    async click(selector) {
      await new Promise(resolve => setTimeout(resolve, 15));
      const element = window.document.querySelector(selector);
      element.dispatchEvent(new window.MouseEvent('pointerdown', { bubbles: true }));
      element.click();
    },
    locator(selector) {
      return { waitFor: () => waitForFunction(() => !!window.document.querySelector(selector)),
        textContent: () => window.document.querySelector(selector).textContent };
    },
  };
  return { page, url: window.location.href, close: () => window.close() };
}

async function browserHarness(js) {
  const { chromium } = require('playwright');
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/bundle.js' ? 'application/javascript' : 'text/html; charset=utf-8');
    res.end(req.url === '/bundle.js' ? js : '<div id="root"></div><script src="/bundle.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const stopServer = () => new Promise(resolve => server.close(resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CARDS_CHROMIUM || undefined });
    return {
      page: await browser.newPage(), url: 'http://127.0.0.1:' + server.address().port + '/',
      async close() { try { await browser.close(); } finally { await stopServer(); } },
    };
  } catch (error) {
    try { await browser?.close(); } finally { await stopServer(); }
    throw error;
  }
}
(async () => {
  const result = await build({ stdin: { contents: `
    import React, { StrictMode } from 'react';
    import { createRoot } from 'react-dom/client';
    import { OpeningMusicProvider, useOpeningMusic } from './src/gate/OpeningMusic';
    function Controls() {
      const music = useOpeningMusic();
      return <><output id="choice">{music.choice}</output>
        <button id="unlock">unlock</button>
        <button id="ext" onClick={() => music.choose('ext')}>track 1</button>
        <button id="demo2" onClick={() => music.choose('demo2')}>track 2</button>
        <button id="mute" onClick={music.toggleMute}>mute</button>
        <button id="enter" onClick={() => music.setInside(true)}>enter</button>
        <button id="leave" onClick={() => music.setInside(false)}>leave</button></>;
    }
    window.mount = () => {
      const root = createRoot(document.querySelector('#root'));
      root.render(<StrictMode><OpeningMusicProvider><Controls /></OpeningMusicProvider></StrictMode>);
      window.dispose = () => root.unmount();
    };
    window.mount();
  `, resolveDir: path.resolve(__dirname, '..'), loader: 'tsx' },
  bundle: true, write: false, jsx: 'automatic', define: { 'import.meta.url': JSON.stringify('https://fixture.invalid/bundle.js') },
  nodePaths: (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean) });
  const harness = await (process.env.CARDS_DOM === 'jsdom' ? domHarness : browserHarness)(result.outputFiles[0].text);
  const { page } = harness;
  try {
    await page.addInitScript(() => {
      let allowed = false;
      window.addEventListener('pointerdown', () => { allowed = true; }, true);
      const contexts = [];
      const pending = new Map();
      const trackRequests = [];
      window.check = {
        contexts, trackRequests,
        show(hidden) {
          Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
          document.dispatchEvent(new Event('visibilitychange'));
        },
        holdDemo: true,
      };
      const timer = window.setTimeout.bind(window);
      const clear = window.clearTimeout.bind(window);
      window.audioTimers = new Set();
      window.setTimeout = (cb, ms, ...args) => {
        const id = timer((...params) => { window.audioTimers.delete(id); cb(...params); }, ms, ...args);
        if (ms > 1000) window.audioTimers.add(id);
        return id;
      };
      window.clearTimeout = id => { window.audioTimers.delete(id); clear(id); };
      const gain = () => ({
        gain: { value: 0, setValueCurveAtTime() {}, setValueAtTime() {}, cancelScheduledValues() {}, linearRampToValueAtTime() {} },
        connect() {}, disconnect() {},
      });
      window.AudioContext = class {
        constructor() { this.state = 'suspended'; this.started = 0; this.offsets = []; this.currentTime = 0; contexts.push(this); }
        async resume() { if (!allowed) throw new Error('Autoplay blocked'); this.state = 'running'; }
        async suspend() { this.state = 'suspended'; }
        async close() { this.state = 'closed'; }
        createGain() { return gain(); }
        createBufferSource() { return { start: (_when, offset) => { this.started += 1; this.offsets.push(offset); }, stop() {}, connect() {}, disconnect() {} }; }
        async decodeAudioData() { return { duration: 60 }; }
      };
      window.fetch = async (url, options) => {
        const track = String(url).includes('demo2') ? 'demo2' : 'ext';
        trackRequests.push(track);
        if (track === 'demo2' && window.check.holdDemo) {
          await new Promise((resolve, reject) => {
            pending.set(track, resolve);
            options?.signal?.addEventListener('abort', () => { pending.delete(track); reject(new Error('Aborted')); }, { once: true });
          });
          pending.delete(track);
        }
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
      };
      window.pendingAudio = pending;
    });
    await page.goto(harness.url);
    await page.locator('#unlock').waitFor();
    assert.equal(await page.evaluate(() => check.contexts.reduce((n, item) => n + item.started, 0)), 0);
    await page.click('#unlock');
    await page.waitForFunction(() => check.contexts.some(c => c.state === 'running' && c.started === 1));
    await page.evaluate(() => check.show(true));
    await page.waitForFunction(() => check.contexts.every(c => c.state !== 'running'));
    await page.evaluate(() => check.show(false));
    await page.waitForFunction(() => check.contexts.some(c => c.state === 'running' && c.started === 1));
    await page.click('#mute');
    await page.waitForFunction(() => document.querySelector('#choice').textContent === 'mute');
    await page.click('#mute');
    await page.waitForFunction(() => document.querySelector('#choice').textContent === 'auto');
    // #246: the default track plays the door loop (from 0 s); entering or Skip crossfades into the
    // inside section of the same track (19.3 s), entering again adds nothing, and replaying the
    // opening goes back to the door loop. One context and one new voice per switch.
    const playing = () => page.evaluate(() => { const c = check.contexts.filter(x => x.state === 'running'); return c.length === 1 ? { started: c[0].started, offsets: c[0].offsets.slice() } : null; });
    assert.deepEqual(await playing(), { started: 1, offsets: [0] });
    await page.click('#enter');
    await page.waitForFunction(() => check.contexts.find(c => c.state === 'running')?.started === 2);
    assert.deepEqual(await playing(), { started: 2, offsets: [0, 19.3] });
    await page.click('#enter');
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.deepEqual(await playing(), { started: 2, offsets: [0, 19.3] }, 'entering twice must not stack voices');
    await page.click('#leave');
    await page.waitForFunction(() => check.contexts.find(c => c.state === 'running')?.started === 3);
    assert.deepEqual(await playing(), { started: 3, offsets: [0, 19.3, 0] });
    await page.click('#demo2');
    await page.waitForFunction(() => pendingAudio.has('demo2'));
    await page.evaluate(() => dispose());
    await page.waitForFunction(() => check.contexts.every(c => c.state === 'closed') && !pendingAudio.size && !audioTimers.size);
    await page.evaluate(() => { check.holdDemo = false; mount(); });
    await page.waitForFunction(() => check.contexts.filter(c => c.state === 'running').length === 1 &&
      check.contexts.find(c => c.state === 'running').started === 1);
    assert.equal(await page.locator('#choice').textContent(), 'demo2');
    await page.click('#ext');
    await page.waitForFunction(() => check.contexts.find(c => c.state === 'running').started === 2);
    await page.evaluate(() => dispose());
    await page.waitForFunction(() => check.contexts.every(c => c.state === 'closed') && !audioTimers.size);
    console.log('Opening music: unlock, mute, visibility, door→inside→door sections, async abort, repeat mount and track switch PASS');
  } finally {
    await harness.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
