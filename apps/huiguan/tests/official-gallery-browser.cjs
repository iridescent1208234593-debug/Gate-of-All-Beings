/* #87：只读取当前页面源码，以虚构 API、慢响应和失败响应验证搜索及翻页。
 * npm ci 后：node --test apps/huiguan/tests/official-gallery-browser.cjs
 * 可用 CHROMIUM_EXECUTABLE 指向本机 Chromium/Edge；不连接真实站点或存储。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test: nodeTest, before, after } = require('node:test');
const { chromium } = require('playwright');
const test = (name, run) => nodeTest(name, { timeout: 15000 }, run);

const site = path.resolve(__dirname, '..');
const origin = 'http://127.0.0.1:38715';
const views = {
  gallery: { file: 'gallery.html', search: '#search', cards: '#grid .card', more: '#loadMore', limit: 30 },
  home: { file: 'index.html', search: '#homeOfficialSearch', cards: '#homeOfficialGrid .home-character', more: '#homeOfficialMore', limit: 24 },
};
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}) });
});
after(async () => { await browser?.close(); });

async function fixture(kind, size = 100, width = 1280) {
  const view = views[kind];
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(4000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const rows = Array.from({ length: size }, (_, i) => ({
    id: i + 1, name: `${i % 2 ? 'Beta' : 'Alpha'} ${String(i).padStart(5, '0')}`,
    completeness: i % 9, type: '', species: '', thumb_path: '',
  }));
  const requests = [];
  const holds = [];
  let nextFailure;
  let nextHold;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/official/characters') {
      const params = Object.fromEntries(url.searchParams);
      requests.push(params);
      const filtered = rows.filter(c => c.name.includes(params.q || '') && c.completeness >= +params.min && c.completeness <= +params.max);
      const body = { total: filtered.length, characters: filtered.slice((+params.page - 1) * +params.limit, +params.page * +params.limit) };
      if (nextHold) {
        const notify = nextHold; nextHold = null;
        await new Promise(resolve => { holds.push(resolve); notify(params); });
      }
      const failure = nextFailure; nextFailure = null;
      // 已取消的浏览器请求仍允许释放测试端的栅栏。
      try {
        if (failure === 'network') return await route.abort('failed');
        return await json(failure ? { error: 'Synthetic failure' } : body, failure ? 503 : 200);
      } catch (error) { if (!/closed|handled|aborted|Invalid InterceptionId/i.test(error.message)) throw error; }
      return;
    }
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/user') return json({ logged_in: false });
      return json({ characters: [], images: [], archives: [], fav: {}, up: {}, down: {}, my: {} });
    }
    if (url.pathname === '/' + view.file) {
      let html = fs.readFileSync(path.join(site, view.file), 'utf8');
      if (kind === 'home') {
        // 首页只运行受检脚本，使用真实 DOM/CSS；账户、门景和其他栏目不在测量范围内。
        html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
        html = html.replace('</body>', '<style>#officialContent{display:block!important}</style><script src="/homepage-content.js"></script></body>');
      }
      return route.fulfill({ contentType: 'text/html', body: html });
    }
    const script = url.pathname.slice(1);
    if (['homepage-content.js', 'reactions-fx.js'].includes(script)) {
      return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(site, script), 'utf8') });
    }
    // 非受检脚本和私有媒体不执行、不读取；内联 CSS 保留真实列表布局。
    return route.fulfill({ contentType: url.pathname.endsWith('.js') ? 'text/javascript' : 'text/css', body: '' });
  });
  const started = performance.now();
  await page.goto(origin + '/' + view.file);
  await page.locator(view.cards).nth(view.limit - 1).waitFor({ state: 'attached' });
  const firstMs = performance.now() - started;
  async function settled(count) {
    await page.waitForFunction(({ selector, count }) => document.querySelectorAll(selector).length === count, { selector: view.cards, count }, { timeout: 4000 });
    await page.waitForFunction(selector => !document.querySelector(selector).disabled, view.more);
  }
  return { page, view, requests, errors, rows, firstMs, settled,
    hold: () => new Promise(resolve => { nextHold = resolve; }),
    release: () => holds.shift()?.(),
    fail: value => { nextFailure = value; },
    ids: () => page.locator(view.cards).evaluateAll(nodes => nodes.map(a => +new URL(a.href).searchParams.get('id'))),
    close: async () => { for (const release of holds) release(); await context.close(); },
  };
}

for (const kind of Object.keys(views)) {
  test(`${kind}: latest search wins while an older search is pending`, async () => {
    const f = await fixture(kind);
    try {
      const held = f.hold();
      await f.page.locator(f.view.search).fill('Alpha');
      await held;
      await f.page.locator(f.view.search).fill('Beta');
      await f.page.waitForRequest(r => new URL(r.url()).searchParams.get('q') === 'Beta', { timeout: 3000 });
      await f.settled(f.view.limit);
      f.release();
      await f.page.waitForTimeout(100);
      assert.ok((await f.ids()).every(id => id % 2 === 0), 'late Alpha response must not replace Beta');
      assert.deepEqual(f.errors, []);
    } finally { await f.close(); }
  });

  for (const failure of ['http', 'network']) {
    test(`${kind}: retry page two after ${failure} failure without losing page one`, async () => {
      const f = await fixture(kind);
      try {
        const first = await f.ids();
        f.fail(failure);
        await f.page.locator(f.view.more).click();
        await f.page.waitForFunction(selector => !document.querySelector(selector).disabled, f.view.more);
        await f.page.waitForTimeout(50);
        assert.deepEqual(await f.ids(), first, 'a failed append must retain the existing cards');
        await f.page.locator(f.view.more).click();
        await f.settled(f.view.limit * 2);
        assert.deepEqual(f.requests.map(r => +r.page), [1, 2, 2], 'retry must request the failed page');
        assert.deepEqual(await f.ids(), f.rows.slice(0, f.view.limit * 2).map(c => c.id));
        assert.deepEqual(f.errors, []);
      } finally { await f.close(); }
    });
  }

  test(`${kind}: repeated load-more clicks do not skip or duplicate a page`, async () => {
    const f = await fixture(kind);
    try {
      const held = f.hold();
      await f.page.locator(f.view.more).evaluate(button => { button.click(); button.click(); });
      await held;
      f.release();
      await f.settled(f.view.limit * 2);
      await f.page.locator(f.view.more).click();
      await f.settled(f.view.limit * 3);
      assert.deepEqual(f.requests.map(r => +r.page), [1, 2, 3]);
      assert.deepEqual(await f.ids(), f.rows.slice(0, f.view.limit * 3).map(c => c.id));
    } finally { await f.close(); }
  });

  test(`${kind}: search invalidates an append during debounce and coalesces typing`, async () => {
    const f = await fixture(kind);
    try {
      const held = f.hold();
      await f.page.locator(f.view.more).click();
      await held;
      await f.page.locator(f.view.search).fill('B');
      await f.page.locator(f.view.search).fill('Be');
      await f.page.locator(f.view.search).fill('Beta');
      assert.equal(await f.page.locator(f.view.more).isVisible(), false, 'no pagination for the old query during debounce');
      f.release();
      await f.settled(f.view.limit);
      assert.ok((await f.ids()).every(id => id % 2 === 0));
      assert.deepEqual(f.requests.map(r => [+r.page, r.q || '']), [[1, ''], [2, ''], [1, 'Beta']]);
      assert.deepEqual(f.errors, []);
    } finally { await f.close(); }
  });

  test(`${kind}: empty search resets pagination and clearing it restores page one`, async () => {
    const f = await fixture(kind);
    try {
      await f.page.locator(f.view.search).fill('No-such-character');
      await f.settled(0);
      assert.equal(await f.page.locator(f.view.more).isVisible(), false);
      await f.page.locator(f.view.search).fill('');
      await f.settled(f.view.limit);
      assert.deepEqual(await f.ids(), f.rows.slice(0, f.view.limit).map(c => c.id));
      assert.deepEqual(f.requests.map(r => +r.page), [1, 1, 1]);
    } finally { await f.close(); }
  });
}

test('gallery: changing filter supersedes a pending page and preserves search', async () => {
  const f = await fixture('gallery', 1000);
  try {
    const held = f.hold();
    await f.page.locator('#search').fill('Alpha');
    await held;
    const filteredRequest = f.page.waitForRequest(r => new URL(r.url()).searchParams.get('min') === '6', { timeout: 3000 });
    await f.page.getByRole('button', { name: '设定多', exact: true }).click();
    await filteredRequest;
    const expected = f.rows.filter(c => c.name.includes('Alpha') && c.completeness >= 6);
    await f.settled(f.view.limit);
    f.release();
    await f.page.waitForTimeout(100);
    await f.page.locator(f.view.more).click();
    await f.settled(f.view.limit * 2);
    assert.deepEqual(await f.ids(), expected.slice(0, f.view.limit * 2).map(c => c.id));
    assert.deepEqual(f.errors, []);
  } finally { await f.close(); }
});

for (const kind of Object.keys(views)) {
  for (const size of [100, 1000, 5000]) {
    for (const width of [390, 1280]) {
      test(`${kind}: ${size} synthetic rows at ${width}px, bounded render and stable pagination`, async t => {
        const f = await fixture(kind, size, width);
        try {
          const started = performance.now();
          await f.page.locator(f.view.more).click();
          await f.settled(f.view.limit * 2);
          assert.deepEqual(await f.ids(), f.rows.slice(0, f.view.limit * 2).map(c => c.id));
          assert.equal(f.requests.length, 2, 'one request per page');
          t.diagnostic(JSON.stringify({ size, viewport: `${width}x900`, firstRenderMs: +f.firstMs.toFixed(1), appendMs: +(performance.now() - started).toFixed(1), domCards: await f.page.locator(f.view.cards).count() }));
          assert.deepEqual(f.errors, []);
        } finally { await f.close(); }
      });
    }
  }
}
