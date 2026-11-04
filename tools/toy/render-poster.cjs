// Render the Toy cover (1200×900) and icon (500×500) from apps/bilibili-toy/poster/poster.html.
//   node tools/toy/render-poster.cjs <out-dir>
// Needs Playwright with Chromium and a CJK font installed.
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const out = process.argv[2];
  if (!out) throw new Error('usage: node tools/toy/render-poster.cjs <out-dir>');
  fs.mkdirSync(out, { recursive: true });
  const source = pathToFileURL(path.resolve(__dirname, '../../apps/bilibili-toy/poster/poster.html')).href;
  const browser = await chromium.launch();
  for (const [kind, width, height] of [['cover', 1200, 900], ['icon', 500, 500]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(`${source}?kind=${kind}`);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('#stage').screenshot({ path: path.join(out, `${kind}.png`) });
    await page.close();
  }
  await browser.close();
  console.log(`[toy] cover.png and icon.png written to ${out}`);
})().catch((error) => { console.error(error); process.exit(1); });
