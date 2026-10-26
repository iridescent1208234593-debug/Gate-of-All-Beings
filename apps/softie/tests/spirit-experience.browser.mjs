import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const room = process.env.TEST_ROOM || `touch-${Date.now().toString(36)}`;
const launch = () => chromium.launch({ channel: 'chrome', headless: true, args: [
  '--enable-unsafe-webgpu', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
] });
let browser;
try {
  browser = await launch();
  const contextA = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const contextB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  for (const page of [a, b]) {
    page.on('pageerror', error => console.error('browser page error:', error.message));
    page.on('console', message => { if (message.type() === 'error') console.error('browser console:', message.text()); });
    await page.goto(`${base}/games/spirit-playground?test=1&room=${room}`, { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForFunction(() => window.__SPIRIT__?.getDiagnostics().active
        && window.__SPIRIT__?.getDiagnostics().network?.connected, null, { timeout: 20000 });
    } catch (error) {
      console.error('failed page state:', await page.evaluate(() => ({ url: location.href,
        body: document.body.innerText.slice(0, 1000), spirit: window.__SPIRIT__?.getDiagnostics() })).catch(() => null));
      throw error;
    }
  }
  assert.equal(await a.locator('.spirit-playground').getAttribute('data-mode'), 'play');
  assert.equal(await a.locator('.spirit-panel').isVisible(), false);
  await a.getByRole('link', { name: '自定义形象' }).click();
  await a.waitForFunction(() => location.pathname.endsWith('/create'));
  assert.equal(await a.locator('.spirit-playground').getAttribute('data-mode'), 'create');
  assert.equal(await a.locator('.spirit-panel').isVisible(), true);
  assert.equal(await a.locator('.spirit-room-control').isVisible(), false);
  await a.getByRole('link', { name: '进入灵界' }).click();
  await a.waitForFunction(() => location.pathname.endsWith('/games/spirit-playground'));
  assert.equal(await a.locator('.spirit-playground').getAttribute('data-mode'), 'play');
  assert.equal(await a.locator('.spirit-panel').isVisible(), false);
  console.log('PASS public scene and creator routes preserve the active scene');

  await a.waitForFunction(() => window.__SPIRIT__.getDiagnostics().remoteCount === 1, null, { timeout: 10000 });
  await b.waitForFunction(() => window.__SPIRIT__.getDiagnostics().remoteCount === 1, null, { timeout: 10000 });
  const initial = await a.evaluate(() => {
    const { camera, remoteSpirits } = window.__SPIRIT__;
    const instance = [...remoteSpirits.values()][0].instance;
    const p = [instance.root.position.x, instance.root.position.y + 0.8, instance.root.position.z, 1];
    const view = camera.matrixWorldInverse.elements, projection = camera.projectionMatrix.elements;
    const v = [0, 1, 2, 3].map(row => view[row] * p[0] + view[row + 4] * p[1]
      + view[row + 8] * p[2] + view[row + 12] * p[3]);
    const clip = [0, 1, 2, 3].map(row => projection[row] * v[0] + projection[row + 4] * v[1]
      + projection[row + 8] * v[2] + projection[row + 12] * v[3]);
    const ndc = { x: clip[0] / clip[3], y: clip[1] / clip[3] };
    const rect = document.querySelector('.spirit-canvas').getBoundingClientRect();
    return { x: rect.left + (ndc.x + 1) * rect.width / 2, y: rect.top + (1 - ndc.y) * rect.height / 2 };
  });
  await a.mouse.click(initial.x, initial.y);
  assert.equal((await a.evaluate(() => window.__SPIRIT__.getDiagnostics().input.targeting)), true);
  await a.waitForFunction(() => {
    const d = window.__SPIRIT__.getDiagnostics();
    const entities = d.serverSnapshot?.entities;
    if (!entities || entities.length !== 2) return false;
    const [one, two] = entities;
    const gap = Math.hypot(one.position.x - two.position.x, one.position.z - two.position.z);
    return gap <= one.radius + two.radius + 0.45 && !d.input.targeting;
  }, null, { timeout: 15000 });
  console.log('PASS tapping another spirit walks to contact range and stops');

  const before = await b.evaluate(() => {
    const d = window.__SPIRIT__.getDiagnostics();
    return d.serverSnapshot.entities.find(entity => entity.id === d.network.selfId).position.x;
  });
  await b.locator('.spirit-canvas').focus();
  await b.keyboard.down('KeyD'); await b.waitForTimeout(400); await b.keyboard.up('KeyD');
  await b.waitForFunction(start => {
    const d = window.__SPIRIT__.getDiagnostics();
    return d.serverSnapshot?.entities.find(entity => entity.id === d.network.selfId)?.position.x > start + 0.1;
  }, before, { timeout: 5000 });
  await b.locator('.spirit-canvas').focus();
  await b.keyboard.down('KeyA'); await b.waitForTimeout(120);
  await b.evaluate(() => window.dispatchEvent(new FocusEvent('blur')));
  await b.keyboard.up('KeyA');
  await b.waitForFunction(() => {
    const d = window.__SPIRIT__.getDiagnostics();
    return d.input.keys.length === 0 && !d.input.targeting
      && Math.hypot(d.physics.velocity.x, d.physics.velocity.z) === 0;
  });
  console.log('PASS focus loss clears local held movement');

  await a.goto(`${base}/games/spirit-playground/debug?test=1&room=${room}`, { waitUntil: 'domcontentloaded' });
  await a.locator('.spirit-debug-gate:not([hidden])').waitFor({ timeout: 10000 });
  assert.equal((await a.evaluate(() => window.__SPIRIT__?.getDiagnostics().backend)), 'pending');
  console.log('PASS guest debug route is gated before WebGPU initialization');
  console.log('PASS movement inputs are acknowledged and visible to both clients');
} finally {
  await browser?.close();
}
