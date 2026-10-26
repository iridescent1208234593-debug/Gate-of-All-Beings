/* Run with an installed Playwright package; no browser/session or account writes. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    const request = requestAnimationFrame.bind(window);
    const cancel = cancelAnimationFrame.bind(window);
    const active = new Set();
    window.requestAnimationFrame = callback => {
      const id = request(time => { active.delete(id); callback(time); });
      active.add(id);
      return id;
    };
    window.cancelAnimationFrame = id => { active.delete(id); cancel(id); };
    window.__qaRAFCount = () => active.size;
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const base = process.env.HUIGUAN_URL || 'https://huiguan.iridescently.xyz/';
  const output = process.env.HUIGUAN_QA_DIR || path.join(require('node:os').tmpdir(), 'huiguan-homepage-qa');
  fs.mkdirSync(output, { recursive: true });
  const report = {};
  const inspect = () => page.evaluate(() => window.huiguanHomepage.inspect());
  const archive = async () => {
    await page.evaluate(() => {
      const a = document.querySelector('#archiveRoom');
      scrollTo({ top: a.getBoundingClientRect().top + scrollY - 76, behavior: 'instant' });
    });
    await page.waitForFunction(() => huiguanHomepage.inspect().phase === 'archive' && huiguanHomepage.inspect().progress > .995);
  };
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.huiguanHomepage);
    report.initial = await inspect();
    assert.equal(report.initial.phase, 'intro');
    await page.waitForFunction(() => huiguanHomepage.inspect().phase === 'hero', { timeout: 25000 });
    report.completeIntro = await inspect();
    assert(report.completeIntro.time >= report.completeIntro.introStop && report.completeIntro.time < 4);
    assert.equal(report.completeIntro.playing, false);
    assert.equal(report.completeIntro.intro, 0);
    await page.waitForFunction(() => __qaRAFCount() === 0);
    assert(await page.locator('#authBar .btn-login').isVisible());
    assert(await page.locator('.gate-canvas-host canvas').isVisible());
    assert.equal(await page.locator('#gateFallbackVideo').isVisible(), false);
    await page.getByRole('button', { name: '播放开屏动画', exact: true }).click();
    await page.waitForFunction(() => huiguanHomepage.inspect().time > .25);
    await page.getByRole('button', { name: '暂停开屏动画', exact: true }).click();
    const stoppedTime = (await inspect()).time;
    await page.waitForTimeout(250);
    assert.equal((await inspect()).time, stoppedTime);
    await page.locator('#gateProgress').focus();
    await page.keyboard.press('End');
    assert.equal((await inspect()).time, 6);
    const slider = await page.locator('#gateProgress').boundingBox();
    await page.mouse.move(slider.x + slider.width * .35, slider.y + slider.height / 2);
    await page.mouse.down();
    await page.mouse.move(slider.x + slider.width * .65, slider.y + slider.height / 2, { steps: 4 });
    await page.mouse.up();
    assert(Math.abs((await inspect()).time - 3.9) < .15);
    await page.locator('#gateProgress').focus();
    await page.keyboard.press('End');
    await page.getByRole('button', { name: '翠绿', exact: true }).click();
    assert.equal(await page.locator('html').getAttribute('data-home-theme'), 'emerald');
    await page.getByRole('button', { name: '会馆原色', exact: true }).click();
    report.player = 'WebGL model, replay, pause, keyboard/mouse seek, immediate time sync, six-second stop and theme controls passed';
    await page.screenshot({ path: path.join(output, 'desktop-hero.png') });
    await page.waitForFunction(() => document.querySelectorAll('#homeOfficialGrid .home-character img').length > 0);
    report.anchorSamples = [];
    for (const progress of [0, .2, .4, .66, 1]) {
      await page.evaluate(p => {
        const f = document.querySelector('#homeFlow');
        scrollTo({ top: f.getBoundingClientRect().top + scrollY + parseFloat(f.style.getPropertyValue('--home-travel')) * p, behavior: 'instant' });
      }, progress);
      await page.waitForTimeout(550);
      const sample = await page.evaluate(() => {
        const r = document.querySelector('#gateHero').getBoundingClientRect();
        const c = document.querySelector('.gate-canvas-host canvas').getBoundingClientRect();
        return { ...huiguanHomepage.inspect(), frameSize: [r.width,r.height], frameCenter: [r.x + r.width / 2, r.y + r.height / 2], canvasCenter: [c.x + c.width / 2, c.y + c.height / 2], viewport: [innerWidth, innerHeight] };
      });
      assert(Math.abs(sample.layout.projectedCenter[0] - .5) < .000001);
      assert(Math.abs(sample.layout.projectedCenter[1] - .5) < .000001);
      assert(Math.abs(sample.frameCenter[0] - sample.canvasCenter[0]) < .1);
      assert(Math.abs(sample.frameCenter[1] - sample.canvasCenter[1]) < .1);
      report.anchorSamples.push(sample);
    }
    for (const sample of report.anchorSamples) assert.equal(sample.frameSize[0], report.anchorSamples[0].frameSize[0]);
    await archive();
    await page.screenshot({ path: path.join(output, 'desktop-archives.png') });
    const url = page.url();
    await page.getByRole('button', { name: '人设登记', exact: true }).hover();
    await page.mouse.wheel(0, 160);
    await page.waitForFunction(() => !document.querySelector('#characterRegistration').hidden);
    await page.locator('#registrationPalette').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => huiguanHomepage.inspect().selected === 'character');
    assert(await page.locator('#charForm').isVisible());
    await page.locator('#charForm input[name="name"]').fill('验收草稿');
    await page.getByRole('button', { name: '同人角色档案', exact: true }).click();
    assert.equal((await inspect()).selected, 'fan');
    assert(await page.locator('#homeFanGrid .home-character').count() > 0);
    await page.getByRole('button', { name: '人设登记', exact: true }).click();
    assert.equal(await page.locator('#charForm input[name="name"]').inputValue(), '验收草稿');
    await page.getByRole('button', { name: '官方角色档案', exact: true }).click();
    await page.waitForTimeout(700);
    assert(await page.locator('#homeOfficialSearch').isVisible());
    assert.equal(new URL(page.url()).pathname, new URL(url).pathname);
    await page.screenshot({ path: path.join(output, 'desktop-official.png') });
    await page.keyboard.press('Escape');
    assert.equal((await inspect()).selected, null);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForFunction(() => huiguanHomepage.inspect().progress === 0);
    assert.equal((await inspect()).phase, 'hero');
    report.samePage = 'form, draft retention, direct edge switching, Escape and reverse scroll passed';

    const beforeRotate = await page.locator('.gate-canvas-host canvas').screenshot();
    const canvas = await page.locator('.gate-canvas-host canvas').boundingBox();
    await page.mouse.move(canvas.x + canvas.width * .45, canvas.y + canvas.height * .55);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width * .55, canvas.y + canvas.height * .60, { steps: 6 });
    await page.mouse.up();
    const afterRotate = await page.locator('.gate-canvas-host canvas').screenshot();
    assert.equal(beforeRotate.equals(afterRotate), false);
    assert(Math.abs((await inspect()).layout.projectedCenter[0] - .5) < .000001);
    await page.mouse.wheel(0, 360);
    await page.waitForTimeout(400);
    assert(await page.evaluate(() => scrollY > 100));
    report.modelInteraction = 'mouse rotation changes model, measured pivot remains centered, wheel scrolls page';
    await archive();
    const heights = await page.locator('.archive-door').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().height));
    assert(Math.max(...heights) - Math.min(...heights) > 80);
    await page.getByRole('button', { name: '官方角色档案', exact: true }).hover();
    await page.waitForTimeout(700);
    const widths = await page.locator('.archive-door').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().width));
    assert(widths[0] > widths[1] * 1.5);
    report.columns = { naturalHeights: heights, focusedWidths: widths };

    await page.locator('.home-more > summary').click();
    await page.locator('.home-legal > summary').click();
    assert(await page.locator('.home-legal .qc-copy').isVisible());
    assert.equal(await page.locator('#qc-foot, .ip-footer').count(), 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.home-more').getAttribute('open'), null);
    report.chrome = 'right-corner navigation, retained login entrance, copyright in menu, no bottom duplicates, Escape passed';
    await page.locator('#authBar .btn-login').click();
    assert(await page.locator('#authMask').isVisible());
    await page.evaluate(() => closeAuthModal());

    const links = ['/gallery.html','/relation.html','/stickers.html','/fan.html'];
    report.links = {};
    for (const link of links) {
      const response = await context.request.get(new URL(link, base).href);
      assert.equal(response.status(), 200);
      report.links[link] = response.status();
    }

    // Exercise account rendering without registering users or writing to the live account store.
    let fixture = 'A';
    await page.route('**/api/get-characters', route => route.fulfill({ json: { characters: [{ code: fixture, data: { name: '账号' + fixture + '的人设', image: '/api/official/img?cid=1&n=0&t=1' } }] } }));
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('huiguan:auth-change', { detail: { logged_in: true, nickname: '账号A' } })));
    await page.waitForFunction(() => document.querySelector('#homeMyCharacter').textContent.includes('账号A的人设'));
    fixture = 'B';
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('huiguan:auth-change', { detail: { logged_in: true, nickname: '账号B' } })));
    await page.waitForFunction(() => document.querySelector('#homeMyCharacter').textContent.includes('账号B的人设'));
    assert.equal(await page.locator('#homeMyCharacter').textContent().then(t => t.includes('账号A')), false);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('huiguan:auth-change', { detail: null })));
    assert(await page.locator('[data-home-login]').isVisible());
    report.account = 'fixture A -> B -> anonymous clears personal preview; real anonymous/public APIs passed; live authenticated session not exercised';

    await page.setViewportSize({ width: 390, height: 844 });
    await archive();
    await page.screenshot({ path: path.join(output, 'mobile-archives.png') });
    await page.getByRole('button', { name: '同人角色档案', exact: true }).click();
    assert(await page.locator('[data-home-login]').isVisible());
    await page.waitForTimeout(700);
    const edges = await page.locator('.archive-door:not([data-door="fan"])').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().height));
    assert(edges.every(height => height < 110));
    await page.screenshot({ path: path.join(output, 'mobile-fan.png') });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false);
    await page.getByRole('button', { name: '人设登记', exact: true }).click();
    assert(await page.locator('#charForm').isVisible());
    report.mobile = '390x844, form, fan, anonymous prompt, no horizontal overflow passed';

    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await touchContext.addInitScript(() => sessionStorage.setItem('huiguan.model-intro.v2','1'));
    const touchPage = await touchContext.newPage();
    await touchPage.goto(base, { waitUntil: 'domcontentloaded' });
    await touchPage.waitForFunction(() => window.huiguanHomepage && huiguanHomepage.inspect().phase === 'hero');
    const touchCanvas = await touchPage.locator('.gate-canvas-host canvas').boundingBox();
    const cdp = await touchContext.newCDPSession(touchPage);
    await touchPage.screenshot({ path: path.join(output, 'mobile-hero.png') });
    const touchSlider = await touchPage.locator('#gateProgress').boundingBox();
    const sliderY = touchSlider.y + touchSlider.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchSlider.x + touchSlider.width * .25, y: sliderY }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchSlider.x + touchSlider.width * .55, y: sliderY }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert(Math.abs(await touchPage.evaluate(() => huiguanHomepage.inspect().time) - 3.3) < .25);
    const x = touchCanvas.x + touchCanvas.width / 2;
    let y = touchCanvas.y + touchCanvas.height * .55;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 0; i < 8; i++) { y -= 24; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await touchPage.waitForTimeout(25); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touchPage.waitForTimeout(400);
    assert(await touchPage.evaluate(() => scrollY > 80));
    report.mobileTouch = 'real Chrome touch input on model scrolls the document';
    await touchPage.locator('#gateSkip').click();
    await touchPage.waitForFunction(() => huiguanHomepage.inspect().phase === 'archive');
    assert.equal(await touchPage.locator('#homeBoot').isVisible(), false);
    report.skip = 'Skip seeks the initialized model to the final state and reveals the archive immediately';
    await touchContext.close();

    const reducedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const reducedPage = await reducedContext.newPage();
    await reducedPage.goto(base, { waitUntil: 'domcontentloaded' });
    await reducedPage.waitForFunction(() => window.huiguanHomepage);
    report.reduced = await reducedPage.evaluate(() => huiguanHomepage.inspect());
    assert.equal(report.reduced.playing, false);
    assert.equal(report.reduced.phase, 'hero');
    assert.equal(report.reduced.intro, 0);
    await reducedPage.goto(new URL('/#charForm',base).href, { waitUntil: 'domcontentloaded' });
    await reducedPage.waitForFunction(() => window.huiguanHomepage && huiguanHomepage.inspect().selected === 'character');
    assert(await reducedPage.locator('#charForm').isVisible());
    report.directForm = 'fresh #charForm entry opens existing form immediately';
    await reducedContext.close();
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => __qaRAFCount()), 0);
    const diagnostics = await context.newCDPSession(page);
    async function listeners(expression) {
      const result = await diagnostics.send('Runtime.evaluate', { expression });
      const resultListeners = await diagnostics.send('DOMDebugger.getEventListeners', { objectId: result.result.objectId });
      return resultListeners.listeners.map(listener => listener.type);
    }
    const before = { window: await listeners('window'), document: await listeners('document') };
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    assert.equal(await page.locator('.gate-canvas-host canvas').count(), 0);
    assert.equal(await page.evaluate(() => typeof window.huiguanHomepage), 'undefined');
    assert.equal(await page.evaluate(() => __qaRAFCount()), 0);
    const after = { window: await listeners('window'), document: await listeners('document') };
    assert(after.window.filter(type => type === 'scroll').length < before.window.filter(type => type === 'scroll').length);
    assert(after.document.filter(type => type === 'keydown').length < before.document.filter(type => type === 'keydown').length);
    report.lifecycle = { idleRAF: 0, modelCanvasRemoved: true, before, after };
    for (let i = 0; i < 2; i++) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.huiguanHomepage && !huiguanHomepage.inspect().compositionRAF);
      await page.waitForTimeout(1000);
      assert.equal(await page.evaluate(() => __qaRAFCount()), 0);
      assert.equal(await page.locator('.gate-canvas-host canvas').count(), 1);
    }
    report.lifecycle.repeatedEntry = 'two reloads, one canvas and zero idle RAF';
    for (const route of ['/gallery.html','/fan.html']) {
      await page.goto(new URL(route,base).href, { waitUntil: 'domcontentloaded' });
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.huiguanHomepage && document.querySelector('.gate-canvas-host canvas'));
      assert.equal(await page.locator('.gate-canvas-host canvas').count(), 1);
    }
    report.backNavigation = 'standalone official/fan pages -> Back both restore one initialized model';
    report.errors = errors;
    assert.deepEqual(errors, []);
    report.output = output;
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
