// Guide scenarios against the local portal (test storage). node guide-scenarios.cjs <evidenceDir>
const { chromium } = require('playwright');
const useLocalNet = require('./localnet.cjs');
const fs = require('fs'), path = require('path');
const sessions = JSON.parse(fs.readFileSync(process.env.GUIDE_SESSIONS || path.join(__dirname, 'sessions.json'), 'utf8'));
const OUT = process.argv[2] || path.join(__dirname, 'tmp', 'scen');
fs.mkdirSync(OUT, { recursive: true });
const HALL = 'https://huiguan.iridescently.cn/';
const KEY = 'iridescently.onboarding.v1';
const results = [];
function check(name, ok, detail) { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? ' — ' + JSON.stringify(detail) : '')); }

async function ctxFor(browser, { view = [1366, 768], session, storage, reduced } = {}) {
  const ctx = await browser.newContext({ viewport: { width: view[0], height: view[1] }, isMobile: view[0] < 600, hasTouch: view[0] < 1100, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await useLocalNet(ctx);
  if (session) await ctx.addCookies([{ name: 'session', value: session, domain: '.iridescently.cn', path: '/', secure: true, httpOnly: true }]);
  if (storage) await ctx.addInitScript(s => { for (const k in s) localStorage.setItem(k, s[k]); }, storage);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  return { ctx, page };
}
const noteTitle = p => p.evaluate(() => { const n = document.querySelector('.ling-guide__note'); return n && !n.hidden ? n.querySelector('.ling-guide__title').textContent : null; });
const local = p => p.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const api = p => p.evaluate(() => fetch('/api/onboarding').then(r => r.json()));
async function waitNote(p, ms = 14000) { try { await p.waitForSelector('.ling-guide__note.is-in', { timeout: ms }); return true; } catch { return false; } }

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });

  // A. new visitor: walk starts only after the opening; pause → corner light; reload → stays paused; resume continues.
  {
    const { ctx, page } = await ctxFor(browser);
    await page.goto(HALL);
    await page.waitForTimeout(1500);
    check('A1 no guide during the opening', (await noteTitle(page)) === null);
    check('A2 walk starts after the opening', await waitNote(page), await noteTitle(page));
    check('A3 no blocking login dialog on landing', !(await page.$('#guestSaveMask')) && await page.evaluate(() => !document.querySelector('.auth-mask:not([hidden])')));
    await page.click('[data-guide=next]'); await waitNote(page);
    await page.waitForTimeout(1200);
    await page.click('[data-guide=pause]');
    await page.waitForTimeout(500);
    const l = await local(page);
    check('A4 pause saves progress', l.chapters.world.status === 'paused' && l.chapters.world.seen.length === 1, l.chapters.world);
    check('A5 corner light shown while paused', await page.isVisible('.ling-guide__menu-btn'));
    await page.reload(); await page.waitForTimeout(11000);
    check('A6 paused walk does not restart by itself', (await noteTitle(page)) === null);
    await page.click('.ling-guide__menu-btn'); await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, 'A-menu.jpg'), type: 'jpeg', quality: 70 });
    await page.click('[data-resume=world]');
    await waitNote(page);
    check('A7 resume continues at the next unseen step', (await noteTitle(page)) === '推开门，是西木会馆', await noteTitle(page));
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    check('A8 Esc pauses', (await local(page)).chapters.world.status === 'paused');
    check('A9 no page errors', page.errors.length === 0, page.errors);
    await ctx.close();
  }

  // B. skip → never again; review from 「更多 · 新手引导」.
  {
    const { ctx, page } = await ctxFor(browser);
    await page.goto(HALL); await waitNote(page);
    await page.click('[data-guide=skip]'); await page.waitForTimeout(400);
    check('B1 skip recorded', (await local(page)).chapters.world.status === 'skipped');
    await page.reload(); await page.waitForTimeout(11000);
    check('B2 skipped walk stays away', (await noteTitle(page)) === null);
    await page.click('#qc-nav .qc-more > summary'); await page.waitForTimeout(200);
    check('B3 「更多」 has 新手引导', await page.isVisible('#qc-nav .qc-guide'));
    await page.click('#qc-nav .qc-guide'); await page.waitForTimeout(300);
    await page.click('[data-review=world]');
    check('B4 review restarts from the first step', await waitNote(page) && (await noteTitle(page)) === '这扇门，叫众生之门', await noteTitle(page));
    await ctx.close();
  }

  // C. returning browser (characters saved here before) is not walked through.
  {
    const { ctx, page } = await ctxFor(browser, { storage: { luoxiaohei_characters: JSON.stringify([{ code: 'x', name: 'y' }]) } });
    await page.goto(HALL); await page.waitForTimeout(12000);
    check('C1 returning browser: no walk', (await noteTitle(page)) === null, (await local(page)));
    await ctx.close();
  }

  // D. reduced motion: same content, no travel.
  {
    const { ctx, page } = await ctxFor(browser, { reduced: true });
    await page.goto(HALL);
    check('D1 reduced motion still guides', await waitNote(page), await noteTitle(page));
    await ctx.close();
  }

  // E. 建立身份: a visitor opening the registration gets the form note, then the account note.
  {
    const { ctx, page } = await ctxFor(browser, { storage: { [KEY]: JSON.stringify({ v: 1, chapters: { world: { status: 'completed', seen: [] } } }) } });
    await page.goto(HALL); await page.waitForTimeout(9000);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('huiguan:select-archive', { detail: { key: 'character' } })));
    check('E1 form note appears when registration opens', await waitNote(page, 6000) && (await noteTitle(page)) === '从一句话开始就好', await noteTitle(page));
    await page.screenshot({ path: path.join(OUT, 'E-form.jpg'), type: 'jpeg', quality: 70 });
    await page.fill('#registrationBasics input[name="code"]', '小松');
    await page.waitForTimeout(400);
    const body = await page.textContent('.ling-guide__note');
    check('E2 typing gives feedback', /就这样/.test(body));
    await page.screenshot({ path: path.join(OUT, 'E-feedback.jpg'), type: 'jpeg', quality: 70 });
    await page.waitForTimeout(2200);
    check('E3 account note follows for a visitor', await waitNote(page, 4000) && (await noteTitle(page)) === '先有一个会馆账号', await noteTitle(page));
    await page.screenshot({ path: path.join(OUT, 'E-account.jpg'), type: 'jpeg', quality: 70 });
    await page.click('[data-guide=next]'); await page.waitForTimeout(400);
    check('E4 its action opens the real login dialog', await page.isVisible('#authMask'));
    const l = await local(page);
    check('E5 identity progress kept', l.chapters.identity && l.chapters.identity.seen.join() === 'oc-form,account', l.chapters.identity);
    await ctx.close();
  }

  // F. new account: progress lives on the account; a second device sees it.
  {
    const { ctx, page } = await ctxFor(browser, { session: sessions.fresh });
    await page.goto(HALL);
    check('F1 new account gets the walk', await waitNote(page));
    await page.click('[data-guide=skip]'); await page.waitForTimeout(800);
    const server = await api(page);
    check('F2 skip stored on the account', server.chapters.world.status === 'skipped', server.chapters.world);
    await ctx.close();
    const other = await ctxFor(browser, { session: sessions.fresh });   // empty browser = another device
    await other.page.goto(HALL); await other.page.waitForTimeout(12000);
    check('F3 another device does not repeat it', (await noteTitle(other.page)) === null);
    await other.ctx.close();
  }

  // G. pre-guide account is a veteran: never walked through.
  {
    const { ctx, page } = await ctxFor(browser, { session: sessions.old });
    await page.goto(HALL); await page.waitForTimeout(12000);
    const server = await api(page);
    check('G1 veteran account: no walk', (await noteTitle(page)) === null && server.chapters.world.status === 'veteran', server.chapters);
    await ctx.close();
  }

  // H. guest progress merges into the account on sign-in (only forward).
  {
    const { ctx, page } = await ctxFor(browser, { session: sessions.merge, storage: { [KEY]: JSON.stringify({ v: 1, chapters: { world: { status: 'completed', seen: ['gate', 'hall'] }, identity: { status: 'active', seen: ['oc-form'] } } }) } });
    await page.goto(HALL); await page.waitForTimeout(3000);
    const server = await api(page);
    check('H1 guest progress merged', server.chapters.world.status === 'completed' && server.chapters.identity.seen.includes('oc-form'), server.chapters);
    await ctx.close();
  }

  // I. fan gallery note, first visit only.
  {
    const { ctx, page } = await ctxFor(browser, { view: [390, 844] });
    await page.goto('https://huiguan.iridescently.cn/fan.html');
    check('I1 gallery note on first visit', await waitNote(page, 6000) && (await noteTitle(page)) === '大家的角色都在这里', await noteTitle(page));
    await page.screenshot({ path: path.join(OUT, 'I-fan-mobile.jpg'), type: 'jpeg', quality: 70 });
    await page.tap('[data-guide=next]'); await page.waitForTimeout(300);
    await page.reload(); await page.waitForTimeout(3000);
    check('I2 not again on the second visit', (await noteTitle(page)) === null);
    check('I3 no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await ctx.close();
  }

  // J. a veteran account opening the form gets no hints, and stays veteran.
  {
    const { ctx, page } = await ctxFor(browser, { session: sessions.old });
    await page.goto(HALL); await page.waitForTimeout(9000);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('huiguan:select-archive', { detail: { key: 'character' } })));
    await page.waitForTimeout(3500);
    await page.focus('#registrationBasics input[name="code"]').catch(() => {});
    await page.waitForTimeout(2500);
    const server = await api(page);
    check('J1 veteran: no hints on the form', (await noteTitle(page)) === null, await noteTitle(page));
    check('J2 veteran stays veteran', server.chapters.identity.status === 'veteran', server.chapters.identity);
    await ctx.close();
  }

  // K. Esc on a hint closes that hint only; typing keeps focus.
  {
    const { ctx, page } = await ctxFor(browser, { storage: { [KEY]: JSON.stringify({ v: 1, chapters: { world: { status: 'completed', seen: [] } } }) } });
    await page.goto(HALL); await page.waitForTimeout(9000);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('huiguan:browse-registration')));
    await page.click('#registrationBasics input[name="code"]');
    await page.waitForTimeout(2600);
    const focusKept = await page.evaluate(() => document.activeElement && document.activeElement.name === 'code');
    check('K1 a hint never steals focus from the field being typed in', focusKept && (await noteTitle(page)) !== null, await noteTitle(page));
    await page.focus('.ling-guide__note [data-guide=next]'); await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    const l = await local(page);
    check('K2 Esc on a hint does not pause the chapter', l.chapters.identity.status !== 'paused', l.chapters.identity);
    await ctx.close();
  }

  // L. one browser, two accounts: A's progress never reaches B.
  {
    const { ctx, page } = await ctxFor(browser, { session: sessions.fresh });
    await page.goto(HALL); await page.waitForTimeout(2500);
    await ctx.clearCookies();
    await ctx.addCookies([{ name: 'session', value: sessions.other, domain: '.iridescently.cn', path: '/', secure: true, httpOnly: true }]);
    await page.goto(HALL);
    check('L1 the next account still gets its own walk', await waitNote(page));
    const server = await api(page);
    check('L2 nothing merged from the previous account', server.chapters.world.status === 'active' && server.chapters.identity.status === 'new', server.chapters);
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 1));
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
