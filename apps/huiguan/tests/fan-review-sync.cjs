// Two isolated reviewer browsers share a fake queue; no real accounts or storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function waitUntil(check) {
  const deadline = Date.now() + 10000;
  while (!check()) {
    assert.ok(Date.now() < deadline, 'mock request did not arrive');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

async function run(browser) {
  const html = fs.readFileSync(path.join(__dirname, '../fan.html'), 'utf8');
  const origin = 'http://127.0.0.1:5199';
  const item = id => ({ id, name: `设表 ${id}`, code: `TEST-${id}`, review_version: `v${id}`, image_data: '/test.png', art_source: 'human' });
  let queue = [item(1), item(2)], posts = 0, queueGets = 0, failQueue = false;
  let releaseDecision, releaseQueue, holdQueue = false;
  const contexts = [], pages = [], errors = [];
  try {
    for (let i = 0; i < 2; i++) {
      const context = await browser.newContext({ viewport: i ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
      contexts.push(context);
      await context.addInitScript(() => {
        window.RFX = { load: async () => {}, toast: msg => { window.lastToast = msg; } };
      });
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (url.pathname === '/api/user') return json({ logged_in: true, can_review_fan: true });
        if (url.pathname === '/api/fan/review/queue') {
          queueGets++;
          const snapshot = JSON.parse(JSON.stringify(queue));
          if (holdQueue) { holdQueue = false; await new Promise(resolve => { releaseQueue = resolve; }); }
          if (failQueue) return json({ error: '模拟断网' }, 503);
          return json({ characters: snapshot, total: snapshot.length });
        }
        if (url.pathname === '/api/fan/review/decide') {
          posts++;
          const body = req.postDataJSON();
          await new Promise(resolve => { releaseDecision = resolve; });
          const row = queue.find(c => c.id === body.id);
          if (!row || row.review_version !== body.review_version) return json({ error: '设表内容或审核状态已变化，请刷新后重新审核' }, 409);
          queue = queue.filter(c => c.id !== body.id);
          return json({ ok: true });
        }
        if (url.pathname.startsWith('/api/')) return json({ characters: [], counts: { art: 0, text: 0, ai: 0 }, total: 0 });
        if (url.pathname === '/fan.html') return route.fulfill({ contentType: 'text/html', body: html });
        return route.fulfill({ contentType: 'text/javascript', body: '' });
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      pages.push(page);
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(origin + '/fan.html');
      await page.waitForFunction(() => document.querySelectorAll('[data-review]').length === 2 && !document.querySelector('#reviewRefresh').disabled);
    }
    const [a, b] = pages;
    await b.locator('[data-review="2"] select').selectOption('ai');
    await b.evaluate(() => { window.savedRow = document.querySelector('[data-review="2"]'); });
    await a.locator('[data-approve="1"]').click();
    await a.waitForFunction(() => document.querySelector('[data-approve="1"]').disabled);
    await a.locator('[data-approve="1"]').evaluate(button => { button.click(); button.click(); });
    assert.equal(posts, 1, 'repeated clicks send only one decision');
    assert.ok(releaseDecision);
    releaseDecision();
    await a.waitForFunction(() => !document.querySelector('[data-review="1"]'));
    await b.waitForFunction(() => !document.querySelector('[data-review="1"]'), null, { timeout: 12000 });
    assert.equal(await b.locator('#reviewCount').textContent(), '1', 'other reviewer syncs without an action');
    assert.equal(await b.locator('[data-review="2"] select').inputValue(), 'ai');
    assert.ok(await b.evaluate(() => savedRow === document.querySelector('[data-review="2"]')), 'unchanged rows keep their DOM and selection');

    failQueue = true;
    await b.locator('#reviewRefresh').click();
    await b.waitForFunction(() => document.querySelector('#reviewSync').textContent.includes('同步失败'));
    assert.equal(await b.locator('[data-review="2"]').count(), 1, 'temporary errors retain the last queue');
    failQueue = false;
    queue.push(item(3));
    await b.evaluate(() => window.dispatchEvent(new Event('focus')));
    await b.waitForFunction(() => !!document.querySelector('[data-review="3"]'));

    // The author edits while the reviewer writes a rejection note. The old version must be submitted.
    await b.locator('[data-reject="2"]').click();
    await b.locator('#modalInput').fill('请补充设定');
    queue[0] = { ...queue[0], name: '作者新稿', review_version: 'v2-new' };
    await b.evaluate(() => window.dispatchEvent(new Event('focus')));
    await b.waitForFunction(() => document.querySelector('[data-review="2"]').dataset.reviewVersion === 'v2-new');
    await b.locator('#modalOk').click();
    await waitUntil(() => posts >= 2);
    releaseDecision();
    await b.waitForFunction(() => window.lastToast?.includes('状态已变化'));
    await b.waitForFunction(() => !document.querySelector('#modal').classList.contains('is-open'));
    assert.equal(queue.length, 2, 'stale rejection does not remove the revised entry');

    // An already-running queue fetch returns its old snapshot after a decision; it must be followed by a fresh fetch.
    holdQueue = true;
    await b.evaluate(() => window.dispatchEvent(new Event('focus')));
    await waitUntil(() => releaseQueue);
    await b.locator('[data-approve="3"]').click();
    await waitUntil(() => posts >= 3);
    releaseDecision();
    await b.waitForFunction(() => !document.querySelector('[data-review="3"]'));
    releaseQueue();
    await b.waitForFunction(() => !document.querySelector('#reviewRefresh').disabled && !document.querySelector('[data-review="3"]'));
    assert.equal(await b.locator('#reviewCount').textContent(), '1');

    // Closed desks do not poll, and reopening immediately syncs.
    await Promise.all(pages.map(p => p.locator('#reviewDesk > summary').click()));
    await Promise.all(pages.map(p => p.waitForFunction(() => !document.querySelector('#reviewDesk').open && !document.querySelector('#reviewRefresh').disabled)));
    const before = queueGets;
    await new Promise(resolve => setTimeout(resolve, 5500));
    assert.equal(queueGets, before, 'closed desks stop polling');
    queue = [];
    await b.locator('#reviewDesk > summary').click();
    await b.waitForFunction(() => document.querySelector('#reviewCount').textContent === '0');
    assert.deepEqual(errors, []);
    console.log('PASS fan review: cross-browser sync, stable rows, retry/focus, stale modal, click guard, fetch race, collapsed desk');
  } finally {
    releaseDecision?.(); releaseQueue?.();
    await Promise.all(contexts.map(context => context.close()));
  }
}

module.exports = run;
if (require.main === module) {
  (async () => {
    const browser = await chromium.launch({ headless: true });
    try { await run(browser); } finally { await browser.close(); }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
