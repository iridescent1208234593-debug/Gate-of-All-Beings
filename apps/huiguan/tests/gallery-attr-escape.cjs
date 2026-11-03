/* gallery.html: character names and image reasons from the API stay plain attribute/text values (issue #37 M6).
 * The page runs in a real browser; every request is answered from the checkout or from mock JSON, nothing touches storage. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../..');
const huiguan = path.join(root, 'apps/huiguan');
const ORIGIN = 'http://127.0.0.1:5199';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const characters = [
  { id: 101, name: '" onmouseover="window.__xss=1" data-x="', thumb_path: 'a.png' },
  { id: 102, name: '"><img src=x onerror="window.__xss=2">', thumb_path: 'b.png' },
  { id: 103, name: "' autofocus onfocus='window.__xss=3", thumb_path: 'c.png' },
  { id: 104, name: '<script>window.__xss=4</script>', thumb_path: '' },
  { id: 105, name: 'A&amp;B', thumb_path: 'e.png' },
  { id: 106, name: '罗小黑', thumb_path: 'f.png', type: '主角', species: '妖精' },
  { id: 107, name: '无限', thumb_path: '' },
].map(c => ({ type: '', species: '', completeness: 5, ...c }));
const unclassified = [
  { id: 7, reason: '" onmouseover="window.__xss=5" x="' },
  { id: 8, reason: '' },
];

const STATIC = [['/shared/site-domains/', 'packages/site-domains/'], ['/shared/shared-ui/', 'packages/shared-ui/'], ['/', 'apps/huiguan/']];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css' };

async function serve(route) {
  const url = new URL(route.request().url());
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (url.pathname === '/api/official/characters') return json({ characters, total: characters.length });
  if (url.pathname === '/api/official/unclassified') return json({ images: unclassified });
  if (url.pathname === '/api/user') return json({ logged_in: false });
  if (url.pathname === '/api/archives') return json({ archives: [] });
  if (url.pathname === '/api/official/img' || url.pathname === '/api/official/unclassified-img') {
    return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
  }
  if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
  const [prefix, dir] = STATIC.find(([p]) => url.pathname.startsWith(p));
  const file = path.resolve(root, dir, url.pathname.slice(prefix.length));
  if (file.startsWith(path.join(root, dir)) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  }
  return route.fulfill({ status: 404, body: '' });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.route('**/*', serve);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(ORIGIN + '/gallery.html');
    await page.waitForFunction(n => document.querySelectorAll('#grid .card').length === n, characters.length);
    await page.waitForFunction(n => document.querySelectorAll('#unclassBox > div').length === n, unclassified.length);

    const cards = await page.$$eval('#grid .card', nodes => nodes.map(a => {
      const img = a.querySelector('img.card-img'), box = a.querySelector('div.card-img');
      return {
        href: a.getAttribute('href'), cid: a.getAttribute('data-cid'), imgCount: a.querySelectorAll('img').length,
        alt: img && img.getAttribute('alt'), src: img && img.getAttribute('src'),
        imgAttrs: img && img.getAttributeNames().sort(), placeholder: box && box.textContent,
        name: a.querySelector('.card-name').textContent, bar: !!a.querySelector('.rfx-bar'),
      };
    }));
    characters.forEach((c, i) => {
      const card = cards[i];
      assert.equal(card.href, `char.html?id=${c.id}`, 'card link');
      assert.equal(card.cid, String(c.id), 'card data-cid');
      assert.equal(card.name, c.name, 'card name is shown as plain text');
      assert.ok(card.bar, 'reaction bar still renders');
      if (c.thumb_path) {
        assert.equal(card.imgCount, 1, `name must not inject extra <img>: ${c.name}`);
        assert.equal(card.alt, c.name, `alt is exactly the name: ${c.name}`);
        assert.equal(card.src, `/api/official/img?cid=${c.id}&n=0&t=1`, 'thumbnail URL unchanged');
        assert.deepEqual(card.imgAttrs, ['alt', 'class', 'data-original-image', 'decoding', 'loading', 'onerror', 'src'],
          `name must not create extra attributes: ${c.name}`);
      } else {
        assert.equal(card.imgCount, 0, 'no thumbnail means no <img>');
        assert.equal(card.placeholder, c.name[0], 'placeholder shows the first character as text');
      }
    });

    const titles = await page.$$eval('#unclassBox > div', nodes => nodes.map(d => ({
      title: d.getAttribute('title'), attrs: d.getAttributeNames().sort(), src: d.querySelector('img').getAttribute('src'),
    })));
    unclassified.forEach((im, i) => {
      assert.equal(titles[i].title, im.reason || '待归类', 'reason is exactly the title');
      assert.deepEqual(titles[i].attrs, ['style', 'title'], 'reason must not create extra attributes');
      assert.equal(titles[i].src, `/api/official/unclassified-img?id=${im.id}`, 'unclassified image URL unchanged');
    });

    assert.equal(await page.locator('#grid script, #unclassBox script').count(), 0, 'no injected <script>');
    assert.equal(await page.locator('[onmouseover], [onfocus], [autofocus], [data-x], [x]').count(), 0, 'no injected event attributes');
    for (const el of await page.$$('#grid .card-img, #unclassBox > div')) await el.hover();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__xss), undefined, 'no injected script ran');
    assert.deepEqual(errors, [], 'no page errors');
    console.log('Huiguan gallery attribute escaping PASS');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
