import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { DEFAULT_SPIRIT_SETTINGS } from '../src/games/spirit-playground/settings.js';

const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const profile = { ...DEFAULT_SPIRIT_SETTINGS, name: '账户芽芽', skin: 'bud', color: '#92d6bd' };
const saves = [];
let cloudProfile = profile;
const cors = {
  'Access-Control-Allow-Origin': new URL(base).origin,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--enable-unsafe-webgpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });

try {
  const context = await browser.newContext({ viewport: { width: 960, height: 720 } });
  await context.route('**/api/sso-user', route => route.fulfill({ json: {
    logged_in: true, uid: 'smoke-account', name: '测试账户', kind: 'local',
  } }));
  await context.route('**/api/game/**', async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (request.url().includes('/load?scope=softie')) {
      return cloudProfile
        ? route.fulfill({ status: 200, headers: cors, json: { ok: true, state: cloudProfile } })
        : route.fulfill({ status: 404, headers: cors, json: { error: 'profile not found' } });
    }
    if (request.url().includes('/save?scope=softie')) {
      const body = request.postDataJSON();
      saves.push(body.state);
      return route.fulfill({ status: 200, headers: cors, json: { ok: true, savedAt: 'test' } });
    }
    return route.fulfill({ status: 404, headers: cors, json: { error: 'unknown API' } });
  });
  const page = await context.newPage();
  await page.goto(`${base}/games/spirit-playground?test=1&room=account-smoke`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SPIRIT__?.getDiagnostics().frames > 15
    && window.__SPIRIT__?.getDiagnostics().network?.connected, null, { timeout: 60000 });
  await page.locator('.spirit-nav-create').click();
  await page.waitForFunction(() => document.querySelector('.spirit-playground')?.dataset.mode === 'create');
  await page.getByText('已绑定账户：测试账户 · 使用云端灵体档案').waitFor();
  assert.equal((await page.locator('#spirit-name-input').inputValue()), profile.name);
  assert.equal((await page.evaluate(() => window.__SPIRIT__.getDiagnostics().skin)), 'bud-spirit');
  await page.locator('#spirit-color').fill('#123456');
  await page.locator('.spirit-save').click();
  await page.getByText('灵体档案已保存到登录账户。').waitFor();
  assert.equal(saves.length, 1);
  assert.equal(saves[0].color, '#123456');
  assert.equal(saves[0].skin, 'bud');
  cloudProfile = null;
  const firstLogin = await context.newPage();
  await firstLogin.goto(`${base}/games/spirit-playground?test=1&room=account-first-login`, { waitUntil: 'domcontentloaded' });
  await firstLogin.waitForFunction(() => window.__SPIRIT__?.getDiagnostics().settingsLoaded, null, { timeout: 60000 });
  await firstLogin.locator('.spirit-nav-create').click();
  await firstLogin.waitForFunction(() => document.querySelector('.spirit-playground')?.dataset.mode === 'create');
  assert.equal(await firstLogin.locator('#spirit-name-input').inputValue(), '测试账户');
  console.log(JSON.stringify({ result: 'pass', accountLabel: '测试账户', cloudProfileLoaded: true,
    firstProfileDefaultsToAccountName: true, savedProfileColor: saves[0].color, scope: 'softie' }));
  await context.close();
} finally {
  await browser.close();
}
