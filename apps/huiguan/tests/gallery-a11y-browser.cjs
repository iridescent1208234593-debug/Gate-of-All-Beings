/* #88：官方画廊与同人画廊在手机 / 平板 / 桌面宽度下的可访问性与懒加载 smoke。
 * 只读取当前页面源码，接口、图片全部是虚构 fixture；不连接真实站点或存储。
 * npm ci 后：node apps/huiguan/tests/gallery-a11y-browser.cjs
 * 可用 CHROMIUM_EXECUTABLE 指向本机 Chromium/Chrome；HUIGUAN_QA_DIR 指定截图目录（不设则不截图）。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const site = path.resolve(__dirname, '..');
async function until(check, message) {
  const deadline = Date.now() + 5000;
  while (!check()) {
    assert.ok(Date.now() < deadline, message);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}
const origin = 'http://127.0.0.1:38716';
const shots = process.env.HUIGUAN_QA_DIR;
if (shots) fs.mkdirSync(shots, { recursive: true });
// 1×1 PNG：只为让 <img> 真正加载，不读取任何原创素材。
const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
  '1f15c4890000000d49444154789c6360f8cfc0f01f0005000201e221bc330000000049454e44ae426082', 'hex');
const official = Array.from({ length: 45 }, (_, i) => ({
  id: i + 1, name: `${i % 2 ? 'Beta' : 'Alpha'} ${String(i).padStart(3, '0')}`,
  completeness: i % 9, type: '虚构', species: '', thumb_path: 'fixture.png',
}));
const fan = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1, code: `FIX-${i + 1}`, name: i === 0 ? '海报样例' : `同人样例 ${i + 1}`,
  type: i === 0 ? '配色海报' : '虚构', user_name: '测试作者', art_source: 'human',
  image_data: '/api/image-preview?src=fixture-' + (i + 1), like_count: 0,
}));

function fulfillPage(route, file) {
  return route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(site, file), 'utf8') });
}

async function open(browser, file, width, reducedMotion) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion, serviceWorkers: 'block',
    isMobile: width < 500, hasTouch: width < 500 });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const json = body => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/official/characters') {
      const q = url.searchParams.get('q') || '', p = +url.searchParams.get('page') || 1, limit = +url.searchParams.get('limit') || 30;
      const rows = official.filter(c => c.name.includes(q));
      requests.push({ path: url.pathname, q });
      return json({ total: rows.length, characters: rows.slice((p - 1) * limit, p * limit) });
    }
    if (url.pathname === '/api/fan/list') {
      const q = url.searchParams.get('q') || '';
      const rows = fan.filter(c => c.name.includes(q));
      requests.push({ path: url.pathname, q });
      return json({ total: rows.length, characters: rows, counts: { art: fan.length, text: 0, ai: 0 } });
    }
    if (url.pathname === '/api/official/img' || url.pathname === '/api/image-preview') {
      return route.fulfill({ contentType: 'image/png', body: png });
    }
    if (url.pathname === '/api/user') return json({ logged_in: false });
    if (url.pathname.startsWith('/api/')) return json({ characters: [], images: [], archives: [], counts: { art: 0, text: 0, ai: 0 } });
    if (url.pathname === '/' + file) return fulfillPage(route, file);
    if (url.pathname === '/char.html' || url.pathname.startsWith('/show')) {
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>detail</title><main id="detail">detail</main>' });
    }
    if (url.pathname === '/reactions-fx.js') {
      return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(site, 'reactions-fx.js'), 'utf8') });
    }
    if (url.pathname === '/shared/site-domains/index.js') {
      return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(site, '../../packages/site-domains/index.js'), 'utf8') });
    }
    // 其他非受检脚本和样式不执行；页面内联的布局与脚本保持真实。
    return route.fulfill({ contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript', body: '' });
  });
  await page.goto(origin + '/' + file);
  return { context, page, errors, requests };
}

// 滚过整页列表后累计布局偏移（不计用户输入后 500ms 内的偏移），0.1 是 Web Vitals 的“良好”上限。
async function scrollLayoutShift(page, label) {
  const shift = await page.evaluate(async () => {
    let total = 0;
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) total += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
    for (let y = 0; y <= document.documentElement.scrollHeight; y += innerHeight / 2) {
      scrollTo(0, y);
      await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 50)));
    }
    scrollTo(0, 0);
    await new Promise(resolve => setTimeout(resolve, 100));
    return total;
  });
  assert.ok(shift < 0.1, `${label}: layout shift while scrolling is ${shift.toFixed(3)}`);
  return shift;
}

async function noHorizontalOverflow(page, label) {
  const { scroll, inner } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth }));
  assert.ok(scroll <= inner + 1, `${label}: page scrolls sideways (${scroll} > ${inner})`);
}

async function listImages(page, selector, label) {
  const images = await page.locator(selector).evaluateAll(list => list.map(img => ({
    loading: img.getAttribute('loading'), alt: img.getAttribute('alt'), complete: img.complete, width: img.naturalWidth,
  })));
  assert.ok(images.length > 0, `${label}: no list images rendered`);
  for (const img of images) {
    assert.equal(img.loading, 'lazy', `${label}: list image is not lazy`);
    assert.ok(img.alt && img.alt.trim(), `${label}: list image has no alt text`);
  }
  // 列表可能在首屏之下：滚到第一张图后，它应当真正加载出来，而不是一直空白。
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await page.waitForFunction(sel => { const img = document.querySelector(sel); return img.complete && img.naturalWidth > 0; }, selector);
  await page.evaluate(() => scrollTo(0, 0));
}

async function controlsHaveNames(page, label) {
  const unnamed = await page.evaluate(() => {
    const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
    const named = el => (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') ||
      (el.labels && [...el.labels].some(l => l.textContent.trim())) || (el.tagName === 'BUTTON' && el.textContent.trim()));
    return [...document.querySelectorAll('button, input:not([type=hidden]), select, textarea')]
      .filter(el => visible(el) && !named(el)).map(el => el.outerHTML.slice(0, 120));
  });
  assert.deepEqual(unnamed, [], `${label}: controls without an accessible name (placeholder alone does not count)`);
}

async function tabTo(page, selector, limit = 80) {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(sel => document.activeElement?.matches(sel), selector)) return;
  }
  assert.fail('keyboard Tab never reached ' + selector);
}

async function officialGallery(browser, width, reducedMotion) {
  const label = `gallery.html @${width}${reducedMotion === 'reduce' ? ' reduced-motion' : ''}`;
  const { context, page, errors, requests } = await open(browser, 'gallery.html', width, reducedMotion);
  try {
    await page.locator('#grid .card').first().waitFor();
    await noHorizontalOverflow(page, label);
    await listImages(page, '#grid .card img', label);
    await scrollLayoutShift(page, label);
    await controlsHaveNames(page, label);
    if (shots) await page.screenshot({ path: path.join(shots, `gallery-${width}.png`) });
    // 键盘：搜索 → Tab 到结果 → Enter 打开 → 返回列表。
    await page.locator('#search').focus();
    await page.keyboard.type('Beta');
    await until(() => requests.some(r => r.q === 'Beta'), `${label}: search did not query the API`);
    await page.waitForFunction(() => [...document.querySelectorAll('#grid .card .card-name')].every(n => n.textContent.includes('Beta')));
    await tabTo(page, '#grid .card');
    const target = await page.evaluate(() => document.activeElement.getAttribute('href'));
    await Promise.all([page.waitForURL(url => url.pathname === '/char.html'), page.keyboard.press('Enter')]);
    assert.ok(page.url().endsWith(target), `${label}: Enter opened ${page.url()}, not ${target}`);
    await page.goBack();
    await page.locator('#grid .card').first().waitFor();
    await noHorizontalOverflow(page, label + ' after Back');
    assert.deepEqual(errors, [], `${label}: page errors`);
    console.log('PASS ' + label + ': no sideways scroll, lazy images with alt, scroll CLS < 0.1, named controls, keyboard search/open/back');
  } finally { await context.close(); }
}

async function fanGallery(browser, width, reducedMotion) {
  const label = `fan.html @${width}${reducedMotion === 'reduce' ? ' reduced-motion' : ''}`;
  const { context, page, errors, requests } = await open(browser, 'fan.html', width, reducedMotion);
  try {
    await page.locator('[data-open]').first().waitFor();
    await noHorizontalOverflow(page, label);
    await listImages(page, '[data-open] img', label);
    await scrollLayoutShift(page, label);
    await controlsHaveNames(page, label);
    const cards = await page.locator('[data-open]').evaluateAll(list => list.map(c => ({ tab: c.tabIndex, name: c.getAttribute('aria-label') })));
    assert.ok(cards.every(c => c.tab === 0 && c.name), `${label}: cards are not focusable with a name`);
    if (shots) await page.screenshot({ path: path.join(shots, `fan-${width}.png`) });
    // 键盘打开配色海报灯箱：焦点进入灯箱，Esc 关闭后回到原卡片。
    await tabTo(page, '[data-open="1"]');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#posterLightbox').classList.contains('is-open'));
    assert.ok(await page.evaluate(() => document.querySelector('#posterLightbox').contains(document.activeElement)), `${label}: focus did not move into the poster dialog`);
    assert.equal(await page.locator('#lbImg').getAttribute('alt'), '配色海报：海报样例');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#posterLightbox').classList.contains('is-open'));
    assert.equal(await page.evaluate(() => document.activeElement.dataset.open), '1', `${label}: focus did not return to the poster card`);
    // 键盘搜索，再用 Enter 打开普通设表。
    await page.locator('#search').focus();
    await page.keyboard.type('样例 7');
    await until(() => requests.some(r => r.path === '/api/fan/list' && r.q === '样例 7'), `${label}: search did not query the API`);
    await page.waitForFunction(() => document.querySelectorAll('[data-open]').length === 1);
    await tabTo(page, '[data-open="7"]');
    await Promise.all([page.waitForURL(url => url.href.includes('FIX-7')), page.keyboard.press('Enter')]);
    await page.goBack();
    await page.locator('[data-open]').first().waitFor();
    assert.deepEqual(errors, [], `${label}: page errors`);
    console.log('PASS ' + label + ': no sideways scroll, lazy images with alt, scroll CLS < 0.1, named controls and cards, poster dialog focus, keyboard search/open/back');
  } finally { await context.close(); }
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {});
  try {
    for (const [width, motion] of [[390, 'reduce'], [768, 'no-preference'], [1280, 'no-preference']]) {
      await officialGallery(browser, width, motion);
      await fanGallery(browser, width, motion);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
