/* Capture review states only. This is not an interaction acceptance test. */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const base = process.env.HUIGUAN_URL || 'https://huiguan.iridescently.xyz/';
  const output = process.env.HUIGUAN_QA_DIR || path.join(__dirname, 'artifacts');
  fs.mkdirSync(output, { recursive: true });
  const captures = [];
  async function capture(page, name) {
    await page.screenshot({ path: path.join(output, name) });
    captures.push({ name, viewport: page.viewportSize(), url: page.url() });
  }
  async function archive(page) {
    await page.evaluate(() => scrollTo({ top: document.querySelector('#archiveRoom').getBoundingClientRect().top + scrollY - 76, behavior: 'instant' }));
    await page.waitForTimeout(1100);
  }
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await desktop.newPage();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.huiguanHomepage && huiguanHomepage.inspect().time > 2.2);
    await capture(page, 'desktop-opening.png');
    await page.waitForFunction(() => huiguanHomepage.inspect().phase === 'hero');
    await page.waitForTimeout(350);
    await capture(page, 'desktop-hero.png');
    await archive(page);
    await capture(page, 'desktop-archives.png');
    await page.getByRole('button', { name: '人设登记', exact: true }).hover();
    await page.mouse.wheel(0, 160);
    await page.waitForTimeout(1100);
    await capture(page, 'desktop-registration-start.png');
    await page.locator('#registrationPalette').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1400);
    await capture(page, 'desktop-registration-focused.png');
    await page.getByRole('button', { name: '官方角色档案', exact: true }).click();
    await page.waitForTimeout(1300);
    await capture(page, 'desktop-official.png');
    await desktop.close();

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const phone = await mobile.newPage();
    await phone.goto(base, { waitUntil: 'domcontentloaded' });
    await phone.waitForFunction(() => window.huiguanHomepage && huiguanHomepage.inspect().phase === 'hero');
    await phone.waitForTimeout(350);
    await capture(phone, 'mobile-hero.png');
    await archive(phone);
    await capture(phone, 'mobile-archives.png');
    await phone.getByRole('button', { name: '同人角色档案', exact: true }).click();
    await phone.waitForTimeout(1300);
    await capture(phone, 'mobile-fan.png');
    await mobile.close();
    const report = { capturedAt: new Date().toISOString(), interactionAcceptance: 'User review; no detailed desktop/mobile acceptance performed for this revision.', captures };
    fs.writeFileSync(path.join(output, 'capture-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
