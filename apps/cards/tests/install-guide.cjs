// Static browser tests only: no real account, production service or runtime storage.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');
const root = path.resolve(__dirname, '../public');
const repo = path.resolve(__dirname, '../../..');
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/install.css"><script defer src="/install.js"></script><style>dialog{margin:0;padding:0}</style><main><h1>众生之门测试页</h1><button onclick="window.dispatchEvent(new Event(\'gate:open-install\'))">设置：添加到桌面</button></main><dialog id="login" aria-label="登录">登录中</dialog>');
  }
  let file = path.resolve(root, '.' + url.pathname);
  const aliases = {
    '/shared/site-domains/index.js': path.join(repo, 'packages/site-domains/index.js'),
    '/design-system/design-system.css': path.join(repo, 'apps/huiguan/design-system/design-system.css'),
  };
  if (aliases[url.pathname]) file = aliases[url.pathname];
  else if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }[path.extname(file)] || 'text/plain');
  fs.createReadStream(file).pipe(res);
});
async function ready(page, value = true) {
  await page.evaluate(value => {
    document.documentElement.dataset.gateInstallReady = String(value);
    window.dispatchEvent(new Event('gate:install-ready'));
  }, value);
}
async function screenshot(page, name) {
  if (!process.env.PWA_SCREENSHOT_DIR) return;
  await page.locator('.install-steps img').evaluateAll(images => Promise.all(images.map(image => { image.loading = 'eager'; return image.decode(); })));
  fs.mkdirSync(process.env.PWA_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(process.env.PWA_SCREENSHOT_DIR, name + '.png') });
}
async function centered(page) {
  const box = await page.locator('.gate-install-dialog[open]').boundingBox();
  const viewport = page.viewportSize();
  assert.ok(Math.abs(box.x + box.width / 2 - viewport.width / 2) < 2, 'dialog centered horizontally');
  assert.ok(Math.abs(box.y + box.height / 2 - viewport.height / 2) < 2, 'dialog centered vertically');
}
async function offer(page, outcome = 'dismissed') {
  await page.evaluate(outcome => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => { window.promptCalls = (window.promptCalls || 0) + 1; window.promptWasActivated = navigator.userActivation.isActive; };
    event.userChoice = Promise.resolve({ outcome });
    window.dispatchEvent(event);
  }, outcome);
}
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, ...(process.env.PWA_TEST_CHANNEL ? { channel: process.env.PWA_TEST_CHANNEL } : {}) });
    const errors = [];
    const context = await browser.newContext({ ...devices['Pixel 7'] });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForTimeout(650);
    assert.equal(await page.locator('.gate-install-dialog[open]').count(), 0, 'guests do not get automatic reminders');
    await page.locator('#login').evaluate(el => el.showModal());
    await ready(page);
    await page.waitForTimeout(650);
    assert.equal(await page.locator('.gate-install-dialog[open]').count(), 0, 'wait until login dialog closes');
    await page.locator('#login').evaluate(el => el.close());
    await page.locator('.gate-install-dialog[open]').waitFor();
    await centered(page);
    await screenshot(page, 'gate-install-reminder-android');
    const originalURL = page.url();
    await page.getByRole('button', { name: '点击下载桌面快捷打开方式', exact: true }).click();
    await page.locator('.gate-install-dialog #install-android').waitFor();
    assert.equal(page.url(), originalURL, 'manual tutorial expands in the same window');
    assert.equal(await page.locator('.install-platforms + [data-install-slot] > [data-install-primary]').count(), 1, 'installation button follows the three platform options');
    await centered(page);
    await screenshot(page, 'gate-install-guide-android');
    const browserSelect = page.locator('.gate-install-dialog [data-android-browser]');
    for (const name of ['system', 'huawei', 'honor', 'xiaomi', 'oppo', 'vivo', 'qq', 'uc', 'quark', 'baidu', '360', 'chrome', 'edge', 'samsung', 'firefox']) {
      await browserSelect.selectOption(name);
      assert.equal(await page.locator(`.gate-install-dialog [data-android-help="${name}"]`).isVisible(), true, name + ' guide is reachable');
      assert.equal(page.url(), originalURL, 'browser help stays in the same window');
    }
    await browserSelect.selectOption('huawei');
    await page.locator('[data-android-help="huawei"] img').evaluateAll(images => Promise.all(images.map(image => { image.loading = 'eager'; return image.decode(); })));
    await screenshot(page, 'gate-install-guide-huawei');
    await browserSelect.selectOption('chrome');

    await page.getByRole('button', { name: '关闭添加到桌面窗口' }).click();
    await page.reload(); await ready(page); await page.waitForTimeout(650);
    assert.equal(await page.locator('.gate-install-dialog[open]').count(), 0, 'reminder is shown once');
    await page.getByRole('button', { name: '设置：添加到桌面' }).click();
    await page.locator('.gate-install-dialog #install-android').waitFor();
    await page.getByRole('button', { name: '关闭添加到桌面窗口' }).click();
    await page.getByRole('button', { name: '设置：添加到桌面' }).click();
    await page.locator('.install-platforms + [data-install-slot] > [data-install-primary]').waitFor();
    await offer(page);
    await page.getByRole('button', { name: '点击下载桌面快捷打开方式', exact: true }).click();
    await page.locator('[data-install-status]').filter({ hasText: '已取消安装' }).waitFor();
    assert.equal(await page.evaluate(() => window.promptCalls), 1);
    assert.equal(await page.evaluate(() => window.promptWasActivated), true, 'native prompt stays in user activation');
    await offer(page, 'accepted');
    await page.getByRole('button', { name: '点击下载桌面快捷打开方式', exact: true }).click();
    await page.locator('[data-install-status]').filter({ hasText: '已确认安装请求' }).waitFor();
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await page.locator('[data-install-status]').filter({ hasText: '已添加' }).waitFor();
    await page.getByRole('button', { name: '关闭添加到桌面窗口' }).click();
    await context.close();
    for (const scenario of ['ios', 'embedded', 'standalone', 'desktop', 'blocked-storage']) {
      const ctx = await browser.newContext(scenario === 'desktop' ? {} : { ...devices[scenario === 'ios' ? 'iPhone 13' : 'Pixel 7'] });
      await ctx.addInitScript(kind => {
        if (kind === 'embedded') Object.defineProperty(navigator, 'userAgent', { value: navigator.userAgent + ' MicroMessenger/8.0' });
        if (kind === 'standalone') Object.defineProperty(navigator, 'standalone', { value: true });
        if (kind === 'blocked-storage') Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
      }, scenario);
      const tab = await ctx.newPage(); tab.on('pageerror', error => errors.push(error.message));
      await tab.goto(base); await ready(tab);
      if (['standalone', 'desktop', 'blocked-storage'].includes(scenario)) {
        await tab.waitForTimeout(650);
        assert.equal(await tab.locator('.gate-install-dialog[open]').count(), 0, scenario);
        await tab.getByRole('button', { name: '设置：添加到桌面' }).click();
      } else await tab.locator('.gate-install-dialog[open]').waitFor();
      if (scenario === 'desktop') {
        await tab.locator('#install-desktop').waitFor();
        await centered(tab);
        assert.equal(await tab.getByRole('button', { name: '点击下载桌面快捷打开方式', exact: true }).isVisible(), true);
        await offer(tab);
        await tab.getByRole('button', { name: '点击下载桌面快捷打开方式', exact: true }).click();
        await tab.locator('[data-install-status]').filter({ hasText: '已取消安装' }).waitFor();
        assert.equal(await tab.evaluate(() => window.promptCalls), 1, 'desktop invokes native installation event');
        await screenshot(tab, 'gate-install-guide-desktop');
      }
      if (scenario === 'ios') {
        await screenshot(tab, 'gate-install-reminder-ios');
        await tab.getByRole('button', { name: '点击下载桌面快捷打开方式', exact: true }).click();
        await tab.locator('.gate-install-dialog #install-ios').waitFor();
        await screenshot(tab, 'gate-install-guide-ios');
        assert.equal(tab.url(), base + '/');
        assert.equal(await tab.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      if (scenario === 'embedded') {
        await tab.getByRole('button', { name: '点击下载桌面快捷打开方式', exact: true }).click();
        await tab.locator('#install-embedded').waitFor();
      }
      await ctx.close();
    }
    const standaloneGuide = await browser.newPage({ ...devices['Pixel 7'] });
    standaloneGuide.on('pageerror', error => errors.push(error.message));
    await standaloneGuide.goto(base + '/install.html');
    await standaloneGuide.locator('#install-android').waitFor();
    assert.equal(await standaloneGuide.locator('.install-platforms + [data-install-slot] > #install-now').count(), 1);
    await offer(standaloneGuide);
    await standaloneGuide.getByRole('button', { name: '点击下载桌面快捷打开方式', exact: true }).click();
    await standaloneGuide.locator('#install-status').filter({ hasText: '已取消' }).waitFor();
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.start_url, '/#home'); assert.equal(manifest.display, 'standalone');
    for (const icon of manifest.icons) {
      const png = fs.readFileSync(path.join(root, icon.src));
      assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
    }
    assert.deepEqual(errors, []);
    console.log('Gate login/install reminder + inline guides + native prompt contract PASS');
  } finally { if (browser) await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
