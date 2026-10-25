/* Playwright Chromium and real handlers; all account/image writes are temporary. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { randomFillSync } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'huiguan-poster-'));
const evidence = process.env.IRIDESCENT_EVIDENCE_DIR;
if (evidence) fs.mkdirSync(evidence, { recursive: true });
const fixture = `
import pathlib,sys,types,http.server,re,sqlite3
root=pathlib.Path(sys.argv[1]);temp=pathlib.Path(sys.argv[2])
world=sqlite3.connect(temp/'world.db')
world.execute('CREATE TABLE characters(id INTEGER PRIMARY KEY,name TEXT,merged_to TEXT)')
world.execute('CREATE TABLE character_images(id INTEGER PRIMARY KEY,character_id INTEGER,image_path TEXT,image_type TEXT,description TEXT,created_at TEXT)')
world.execute("INSERT INTO characters(id,name) VALUES(1,'test-only')");world.commit();world.close()
source=(root/'portal/huiguan/server_huiguan.py').read_text(encoding='utf-8')
for name,value in [('USER_DB',str(temp/'users.db')),('DATA_FILE',str(temp/'characters.json')),('STORE_DIR',str(temp/'store')),('UPLOAD_DIR',str(temp/'uploads')),('WV_DB',str(temp/'world.db')),('WV_IMG_DIR',str(temp/'world-images'))]:
 source,count=re.subn(r'^'+name+r' = .+$',lambda _:name+' = '+repr(value),source,count=1,flags=re.M);assert count==1
(temp/'world-images').mkdir()
module=types.ModuleType('poster_flow');module.__file__=str(root/'portal/huiguan/server_huiguan.py');sys.modules[module.__name__]=module
exec(compile(source,module.__file__,'exec'),module.__dict__)
module.init_user_db()
class Handler(module.Handler):
 def _session_cookie(self,sid):return super()._session_cookie(sid).replace('; Domain=.iridescently.xyz','')
 def _sso_cookie(self,*args):return super()._sso_cookie(*args).replace('; Domain=.iridescently.xyz','')
 def translate_path(self,value):
  if value.startswith('/assets/uploads/'):return str(temp/'uploads'/pathlib.Path(value.split('?')[0]).name)
  return super().translate_path(value)
 def log_message(self,*args):pass
class Server(http.server.ThreadingHTTPServer):
 def handle_error(self,*args):super().handle_error(*args)
server=Server(('127.0.0.1',0),Handler)
print(server.server_address[1],flush=True);server.serve_forever()
`;
const server = spawn('python', ['-u', '-c', fixture, root, temp], { cwd: root, windowsHide: true, env: { ...process.env, HX_SSO_SECRET: 'temporary-poster-test-only-secret' } });
(async () => {
 let browser;
 const results = [];
 try {
  const port = await new Promise((resolve, reject) => { server.stdout.once('data', d => resolve(Number(String(d).trim()))); server.stderr.on('data', d => process.stderr.write(d)); server.once('exit', c => reject(Error('Fixture exited: ' + c))); });
  const base = 'http://127.0.0.1:' + port;
  console.log('Temporary fixture:', base);
  const image = await sharp(randomFillSync(Buffer.alloc(1080 * 1920 * 3)), { raw: { width: 1080, height: 1920, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
  assert.ok(image.length > 2 * 1024 * 1024 && image.length < 8 * 1024 * 1024);
  browser = await chromium.launch({ headless: true });
  for (const width of [390, 1440]) {
   const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: width === 390 ? 3 : 1, isMobile: width === 390, hasTouch: width === 390, reducedMotion: 'reduce' });
   await context.route('https://iridescently.xyz/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
   // Cloudflare supplies this analytics endpoint in production, outside the application.
   await context.route('**/cdn-cgi/rum*', route => route.fulfill({ status: 204, body: '' }));
   await context.route('**/api/official/**', route => route.request().method() === 'GET' ? route.fulfill({ contentType: 'application/json', body: '{"characters":[],"stickers":[],"nodes":[],"links":[]}' }) : route.continue());
   assert.equal((await context.request.post(base + '/api/auth', { data: { username: 'poster_' + width, password: 'test-only-password' }, timeout: 60000 })).status(), 200);
   const page = await context.newPage();
   const errors = []; page.on('pageerror', error => errors.push(error.message));
   const consoleErrors = [];
   page.on('dialog', async dialog => { console.log('Browser dialog:', dialog.message()); await dialog.dismiss(); });
   page.on('console', message => { if (message.type() === 'error') { consoleErrors.push(message.text()); console.log('Browser console:', message.text(), message.location()); } });
   page.on('response', response => { if (response.status() === 404) console.log('Fixture 404:', response.url()); });
   page.on('requestfailed', request => console.log('Fixture request failed:', request.url(), request.failure()?.errorText));
   await page.goto(base + '/#charForm', { waitUntil: 'domcontentloaded' });
   await page.waitForFunction(() => window.currentUser?.logged_in && window.HuiguanColors);
   const record = { code: 'poster_' + width, name: 'Color check', gender: '男', species_type: '人类', age: 20, appearance: 'Test-only character', background: 'Test-only archive', abilities: [], colorIndex: 0, colorPrimary: '#426666', colorAccent: '#e06e5e', images: [], customDetails: {} };
   const indexOnly = { ...record, code: 'legacy_' + width, colorPrimary: '', colorAccent: '', colorIndex: 0 };
   const legacy = await page.evaluate(data => {
    fillFormFromData(data);
    return { primary: selectedColor.primary, resolved: colorsFromData(data).primary, surface: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(), html: generateShowcaseHTML(data, colorsFromData(data)).replace(/--character-primary:[^;]+;/, '').replace(/--surface:[^;]+;/, '--surface:#ffffff;') };
   }, indexOnly);
   assert.equal(legacy.primary, '#1A1F2E'); assert.equal(legacy.resolved, '#1A1F2E'); assert.equal(legacy.surface.toLowerCase(), '#1a1f2e');
   assert.equal((await context.request.post(base + '/api/save-character', { data: { code: indexOnly.code, data: indexOnly, html: legacy.html } })).status(), 200);
   await page.goto(base + '/show.html?code=' + indexOnly.code, { waitUntil: 'domcontentloaded' });
   await page.frameLocator('iframe').locator('#character-color-truth').waitFor({ state: 'attached' });
   const legacyFrame = await (await page.locator('iframe').elementHandle()).contentFrame();
   assert.equal(await legacyFrame.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--surface').trim().toLowerCase()), '#1a1f2e');
   await page.goto(base + '/#charForm', { waitUntil: 'domcontentloaded' });
   await page.waitForFunction(() => window.currentUser?.logged_in && window.HuiguanColors);
   const formColors = await page.evaluate(record => {
    fillFormFromData(record);
    return { selected: selectedColor.primary.toLowerCase(), surface: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(), accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() };
   }, record);
   assert.deepEqual(formColors, { selected: '#426666', surface: '#426666', accent: '#e06e5e' });
   await page.locator('#uploadZone input[type=file]').setInputFiles({ name: 'test-only.png', mimeType: 'image/png', buffer: image });
   await page.waitForFunction(() => imageList.length === 1);
   const formSaved = await page.evaluate(async record => {
    const data = { ...record, image: imageList[0], images: imageList.slice() };
    return postSave(data, generateShowcaseHTML(data, colorsFromData(data)));
   }, record);
   assert.equal(formSaved, true, JSON.stringify({ errors, consoleErrors, toast: await page.locator('.toast').allTextContents().catch(() => []) }));
   let records = await (await context.request.get(base + '/api/get-characters')).json();
   assert.equal(records.characters[0].data.colorPrimary, '#426666');
   assert.match(records.characters[0].data.image, /^\/api\/uploads\/preview\?name=[a-f0-9]{64}\.(png|jpe?g|webp)$/);
   assert.ok(!JSON.stringify(records).includes('data:image'));
   assert.equal((await context.request.get(base + records.characters[0].data.image)).status(), 200, 'Authenticated session can load the derived image preview');
   assert.equal((await context.request.get(base + '/api/original-image?src=' + encodeURIComponent(records.characters[0].data.image))).status(), 403, 'Original source remains owner-only');
   // A historical HTML snapshot with a washed-out surface must obey today's saved HEX.
   const historicalHtml = await page.evaluate(data => generateShowcaseHTML(data, colorsFromData(data)).replace(/--character-primary:[^;]+;/, '').replace(/--surface:[^;]+;/, '--surface:#ffffff;'), records.characters[0].data);
   const unsafeIndex = '</script><script>window.untrusted_index_marker=1</script>';
   assert.equal((await context.request.post(base + '/api/save-character', { data: { code: record.code, data: { ...records.characters[0].data, colorIndex: unsafeIndex }, html: historicalHtml } })).status(), 200);
   assert.ok(!(await (await context.request.get(base + '/api/get-character?code=' + record.code)).text()).includes('untrusted_index_marker'));
   await page.goto(base + '/show.html?code=' + record.code, { waitUntil: 'domcontentloaded' });
   await page.frameLocator('iframe').locator('#character-color-truth').waitFor({state:'attached'});
   let display = await page.locator('iframe').elementHandle();
   let frame = await display.contentFrame();
   assert.deepEqual(await frame.evaluate(() => ({ surface: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(), accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() })), { surface: '#426666', accent: '#e06e5e' });
   await page.goto(base + '/haibao/', { waitUntil: 'domcontentloaded' });
   await page.waitForFunction(() => window.HB_USER && MY_CHARS.length > 0 && loaded === total);
   await page.locator('#bindChar').selectOption(record.code);
   await page.locator('#charFile').setInputFiles({ name: 'test-only.png', mimeType: 'image/png', buffer: image });
   await page.waitForFunction(() => layers.charImg.img?.naturalWidth === 1080);
   const expected = await page.evaluate(() => {
    applyPair('#b83e4e', '#0eb83a');
    charPos.cx = 590; charPos.cy = 1110; layers.charImg.scale = .82;
    document.getElementById('posterTitle').value = 'Temporary color poster';
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    drawDuotoneBg(out.getContext('2d'));
    return { size: [cv.width, cv.height], pixel: [...out.getContext('2d').getImageData(300, 300, 1, 1).data], position: { ...charPos }, scale: layers.charImg.scale };
   });
   assert.deepEqual(expected.size, [1080, 1920]);
   assert.deepEqual(expected.pixel, [184, 62, 78, 255]);
   const saveResponse = page.waitForResponse(r => r.url().endsWith('/api/posters/save'));
   await page.locator('#btnSavePoster').click();
   const response = await saveResponse;
   assert.equal(response.status(), 200);
   assert.equal((await response.json()).ok, true);
   await page.waitForFunction(() => document.getElementById('saveMsg').textContent.includes('已保存'));
   let posters = await (await context.request.get(base + '/api/posters/my')).json();
   const saved = posters.posters[0];
   const state = JSON.parse(saved.state_json);
   assert.match(state.charImg, /^\/api\/uploads\/preview\?name=[a-f0-9]{64}\.(png|jpe?g|webp)$/);
   assert.equal(state.colorA, saved.primary_color);
   assert.ok(!saved.state_json.includes('data:image'));
   const cloudImage = await context.request.get(base + saved.img_ref);
   assert.equal(cloudImage.status(), 200);
   const cloudBytes = await cloudImage.body();
   assert.equal((await sharp(cloudBytes).metadata()).format, 'webp', 'Cloud poster reference is a derived WebP preview');
   assert.deepEqual((await sharp(cloudBytes).metadata()).width, 900);
   const storedCandidates = await Promise.all(fs.readdirSync(path.join(temp, 'uploads')).map(async name => {
    const file = path.join(temp, 'uploads', name), meta = await sharp(file).metadata().catch(() => null);
    return meta?.format === 'png' && meta.width === 1080 && meta.height === 1920 ? file : null;
   }));
   assert.ok(storedCandidates.some(Boolean), 'A full-resolution 1080×1920 PNG is stored for the saved poster');
   const rgbPixels = await sharp(storedCandidates.find(Boolean)).removeAlpha().raw().toBuffer();
   let exactPrimaryPixels = 0;
   for (let i = 0; i < rgbPixels.length; i += 3) if (rgbPixels[i] === 184 && rgbPixels[i + 1] === 62 && rgbPixels[i + 2] === 78) exactPrimaryPixels++;
   assert.ok(exactPrimaryPixels > 1000, 'Exported PNG keeps the exact source color in its solid region');
   const downloadPromise = page.waitForEvent('download');
   await page.locator('#btnExport').click();
   const download = await downloadPromise;
   const downloadPath = path.join(temp, 'download-' + width + '.png');
   await download.saveAs(downloadPath);
   assert.deepEqual(await sharp(downloadPath).metadata().then(m => [m.width, m.height]), [1080, 1920]);
   if (evidence) fs.copyFileSync(downloadPath, path.join(evidence, 'poster-export-' + width + '.png'));
   if (evidence) await page.screenshot({ path: path.join(evidence, 'poster-' + width + '.png'), fullPage: true });
   await page.reload({ waitUntil: 'domcontentloaded' });
   await page.waitForFunction(() => window.HB_USER && MY_POSTERS.length > 0);
   await page.locator('[data-act=load]').first().click();
   await page.waitForFunction(() => layers.charImg.img?.naturalWidth === 900);
   const reopened = await page.evaluate(() => ({ primary: colorA(), accent: colorB(), position: { ...charPos }, scale: layers.charImg.scale }));
   assert.equal(reopened.primary, '#b83e4e'); assert.equal(reopened.accent, '#0eb83a');
   assert.deepEqual(reopened.position, expected.position); assert.equal(reopened.scale, expected.scale);
   records = await (await context.request.get(base + '/api/get-characters')).json();
   assert.equal(records.characters[0].data.colorPrimary, '#b83e4e');
   await page.goto(base + '/show.html?code=' + record.code, { waitUntil: 'domcontentloaded' });
   await page.frameLocator('iframe').locator('#character-color-truth').waitFor({state:'attached'});
   display = await page.locator('iframe').elementHandle(); frame = await display.contentFrame();
   const finalColors = await frame.evaluate(() => ({ surface: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(), accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() }));
   assert.deepEqual(finalColors, { surface: '#b83e4e', accent: '#0eb83a' });
   assert.equal(await frame.locator('.page').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(184, 62, 78)');
   assert.equal(await frame.evaluate(() => { try { parent.document.body; return false; } catch { return true; } }), true, 'Saved HTML cannot read the account page');
   await frame.waitForFunction(() => Number(getComputedStyle(document.querySelector('.hero')).opacity) > .99);
   await frame.evaluate(() => { window.alert = message => console.error('Showcase export alert: ' + message); });
   const showcaseDownloadPromise = page.waitForEvent('download', { timeout: 60000 });
   await frame.locator('#saveImgBtn').click();
   const showcaseDownload = await showcaseDownloadPromise;
   const showcasePath = path.join(temp, 'showcase-' + width + '.png');
   await showcaseDownload.saveAs(showcasePath);
   if (evidence) fs.copyFileSync(showcasePath, path.join(evidence, 'showcase-export-' + width + '.png'));
   const showcaseMetadata = await sharp(showcasePath).metadata();
   assert.equal(showcaseMetadata.format, 'png');
   assert.ok(showcaseMetadata.width > 0 && showcaseMetadata.height > 0);
   const showcasePixels = await sharp(showcasePath).removeAlpha().raw().toBuffer();
   let showcasePrimaryPixels = 0;
   for (let i = 0; i < showcasePixels.length; i += 3) if (showcasePixels[i] === 184 && showcasePixels[i + 1] === 62 && showcasePixels[i + 2] === 78) showcasePrimaryPixels++;
   assert.ok(showcasePrimaryPixels > 1000, 'The saved showcase PNG keeps the exact source HEX');
   await frame.locator('#saveImgBtn').waitFor({ state: 'visible' });
   assert.equal(await frame.locator('#saveImgBtn').isDisabled(), false);
   if (evidence) await page.screenshot({ path: path.join(evidence, 'display-' + width + '.png'), fullPage: true });
   await page.goto(base + '/#charForm', { waitUntil: 'domcontentloaded' });
   await page.waitForFunction(() => window.currentUser?.logged_in && loadAll().length > 0);
   assert.deepEqual(await page.evaluate(() => { fillFormFromData(loadAll()[0]); return [selectedColor.primary, selectedColor.accent]; }), ['#b83e4e', '#0eb83a']);
   const unauthorized = await browser.newContext();
   assert.equal((await unauthorized.request.post(base + '/api/images/upload', { multipart: { metadata: '{}', image: { name: 'test-only.png', mimeType: 'image/png', buffer: image } } })).status(), 401);
   await unauthorized.close();
   assert.equal((await context.request.post(base + '/api/images/upload', { multipart: { metadata: '{}', image: { name: 'spoof.png', mimeType: 'image/png', buffer: Buffer.from('<svg></svg>') } } })).status(), 400);
   assert.equal((await context.request.post(base + '/api/images/upload', { multipart: { metadata: '{}', image: { name: 'too-big.png', mimeType: 'image/png', buffer: Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(8 * 1024 * 1024)]) } } })).status(), 400);
   assert.equal((await context.request.post(base + '/api/official/sticker/upload', { multipart: { metadata: JSON.stringify({ filename: 'test-only.png' }), image: { name: 'test-only.png', mimeType: 'image/png', buffer: image } } })).status(), 200);
   assert.equal((await context.request.post(base + '/api/official/image/add', { multipart: { metadata: JSON.stringify({ character_id: 1, filename: 'test-only.png' }), image: { name: 'test-only.png', mimeType: 'image/png', buffer: image } } })).status(), 403);
   assert.equal((await context.request.post(base + '/api/posters/delete', { data: { id: -1, padding: 'x'.repeat(3 * 1024 * 1024) } })).status(), 404);
   assert.deepEqual(errors, []);
   assert.deepEqual(consoleErrors, []);
   results.push({ viewportWidth: width, sourceImageBytes: image.length, posterDimensions: [1080, 1920], posterExactPrimaryPixels: exactPrimaryPixels, sourcePrimary: '#b83e4e', displaySurfaceRGB: [184, 62, 78], showcaseDownloadDimensions: [showcaseMetadata.width, showcaseMetadata.height], showcaseExactPrimaryPixels: showcasePrimaryPixels, indexOnlyFallbackPrimary: '#1a1f2e', opaqueSandbox: true, pageErrors: errors, consoleErrors, result: 'PASS' });
   console.log(width + 'px: generation → Blob file upload → save → PNG download → reload/edit → live saved HEX in old showcase PASS; opaque showcase PNG export and MIME/8MB/account checks PASS');
   await context.close();
  }
  if (evidence) fs.writeFileSync(path.join(evidence, 'poster-color-flow-results.json'), JSON.stringify({ testedAt: new Date().toISOString(), result: 'PASS', results }, null, 2));
 } finally {
  if (browser) await browser.close(); server.kill(); await new Promise(resolve => server.exitCode !== null ? resolve() : server.once('exit', resolve));
  assert.ok(path.resolve(temp).startsWith(path.join(os.tmpdir(), 'huiguan-poster-')));
  fs.rmSync(temp, { recursive: true, force: true });
 }
})().catch(error => { console.error(error); process.exitCode = 1; });
