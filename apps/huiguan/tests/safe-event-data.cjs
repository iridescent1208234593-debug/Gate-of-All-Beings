/* Browser regression on the repository's templates with inert test text. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const specialText = '保留 "双引号" 与 \'单引号\' (内文) &amp; 字面';

// A harmless statement, supplied as data without script tags or event markup.
const scriptSource = 'window.huiguanFixtureScriptRuns += 1;';

function section(html, start, end) {
  const first = html.indexOf(start);
  const last = html.indexOf(end, first + start.length);
  assert(first >= 0 && last > first, 'missing fixture section: ' + start);
  return html.slice(first, last);
}

async function open(context, name) {
  const html = fs.readFileSync(path.resolve(__dirname, '..', name + '.html'), 'utf8');
  assert(!/\bon[a-z]+\s*=\s*(?:"[^"]*\$\{|'[^']*\$\{)/i.test(html),
    name + ' interpolates a template expression into an event attribute');
  const page = await fixturePage(context, html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ''));
  return {html, page};
}

async function fixturePage(context, markup) {
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.setContent(markup);
  await page.evaluate(() => { window.huiguanFixtureScriptRuns = 0; });
  return page;
}

async function assertFixtureStayedData(page) {
  const observed = await page.evaluate(source => ({
    runs: window.huiguanFixtureScriptRuns,
    inScriptElement: Array.from(document.scripts).some(script => script.textContent.includes(source)),
    inEventAttribute: Array.from(document.querySelectorAll('*')).some(element =>
      element.getAttributeNames().some(name => name.startsWith('on') && element.getAttribute(name).includes(source))
    ),
  }), scriptSource);
  assert.deepEqual(observed, {runs: 0, inScriptElement: false, inEventAttribute: false});
}

async function verifyExecutionProbe(context) {
  const page = await fixturePage(context, '<title>Script execution control</title>');
  await page.addScriptTag({content: scriptSource});
  assert.equal(await page.evaluate(() => window.huiguanFixtureScriptRuns), 1);
  await page.close();
}

async function testMember(context, sample) {
  const {html, page} = await open(context, 'member');
  await page.addScriptTag({content: section(html, 'function esc(s)', 'init();')});
  await page.evaluate(value => {
    window.observed = [];
    upd = (...args) => observed.push(args);
    resetPwd = (...args) => observed.push(args);
    delSheet = (...args) => observed.push(['sheet', ...args]);
    delPoster = (...args) => observed.push(['poster', ...args]);
    myScope = 'all';
    charMap['local:' + value] = [{name: value, code: value, version: 42}];
    users = [{kind: 'usso', uid: value, nickname: value, role: 'executor', posters: [{id: 5, title: value}]}];
    render();
  }, sample);
  const role = page.locator('select[data-member-field=role]');
  assert.equal(await role.getAttribute('data-uid'), sample);
  assert.equal(await role.getAttribute('onchange'), null);
  await role.selectOption('elder');
  await page.evaluate(() => { users[0].kind = 'local'; render(); });
  const reset = page.locator('[data-member-action=reset]');
  assert.equal(await reset.getAttribute('onclick'), null);
  await reset.click();
  const expand = page.locator('[data-member-action=sheets]');
  assert.equal(await expand.getAttribute('data-key'), 'local:' + sample);
  await expand.click();
  assert.equal(await page.locator('.sheet-row').count(), 1);
  await page.locator('[data-member-action=delete-sheet]').click();
  await page.locator('[data-member-action=delete-poster]').click();
  assert.deepEqual(await page.evaluate(() => window.observed), [
    ['usso', sample, 'role', 'elder'], ['local', sample, sample],
    ['sheet', 'local:' + sample, sample, sample, '42'], ['poster', '5', sample],
  ]);
  await assertFixtureStayedData(page);
}

async function testCharacter(context, sample) {
  const {html, page} = await open(context, 'char');
  const manager = section(html, '<div id="mergeMgr"', '        </div>\n      </div>\n      <div id="delModal"');
  await page.evaluate(({markup, value}) => {
    document.body.insertAdjacentHTML('beforeend', markup);
    document.getElementById('mergeMgr').style.display = 'block';
    window.fetch = async () => ({json: async () => ({characters: [{id: 8, name: value, type: 'fixture'}]})});
  }, {markup: manager, value: sample});
  await page.addScriptTag({content: [
    section(html, 'function esc(s)', '\n'),
    section(html, 'function escAttr(s)', '\n'),
    section(html, 'function positiveId(', 'function badge('),
    'let _editCharId=1,_mergeTarget=null,_charImages=[{},{}];',
    'function typeOptions(){return \'<option value="wiki">设定图</option><option value="portrait">立绘</option>\';}',
    'function askDelImg(...args){window.observed.push(["image-delete",...args]);}',
    'function setImgType(...args){window.observed.push(["image-type",...args]);}',
    'function moveImg(...args){window.observed.push(["image-move",...args]);}',
    'function setAvatar(...args){window.observed.push(["image-avatar",...args]);}',
    'function dragStart(event,idx){window.observed.push(["drag",idx]);}',
    'function dropImg(event,idx,cid){window.observed.push(["drop",idx,cid]);}',
    'function faDate(value){return value||"";}',
    'function faToggleCmts(id){window.observed.push(["fan-comments",id]);}',
    'function faDelete(id){window.observed.push(["fan-delete",id]);}',
    'function faDelCmt(cid,id){window.observed.push(["fan-delete-comment",cid,id]);}',
    'function faPostCmt(event,id){window.observed.push(["fan-post",id,event.defaultPrevented]);}',
    section(html, 'function initMerge(', 'async function doMerge('),
    section(html, 'function _imgCard(', 'function renderImgMgr('),
    section(html, 'function faCardHTML(', 'async function initFanart('),
    section(html, 'async function faRenderCmts(', 'async function faPostCmt('),
  ].join('\n')});
  await page.evaluate(async () => { initMerge('原角色'); await mergeSearch('fixture'); });
  const pick = page.locator('button[data-merge-id]');
  assert.equal(await pick.getAttribute('data-merge-name'), sample);
  assert.equal(await pick.getAttribute('onclick'), null);
  await pick.click();
  assert.equal(await page.locator('#mergeTarget b').textContent(), sample);
  const imageCards = await page.evaluate(value => [
    _imgCard({id: 4}, 0, '010'), _imgCard({id: value}, 0, 10), _imgCard({id: 4}, 0, value),
  ], sample);
  assert.match(imageCards[0], /data-image-id="4"/);
  assert.deepEqual(imageCards.slice(1), ['', '']);

  await page.evaluate(async ({image, value}) => {
    window.observed = [];
    window.RFX = {seed() {}, bar() { return ''; }};
    const images = document.createElement('section');
    images.innerHTML = image + _imgCard({id: 5}, 1, 10);
    document.body.append(images);
    bindImageActions(images, 10);
    const fanart = document.createElement('section');
    fanart.innerHTML = faCardHTML({
      id: 8, caption: value, user_name: value, can_delete: true, comments: 1,
      image_url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    });
    document.body.append(fanart);
    bindFanartActions(fanart);
    document.getElementById('faC8').classList.add('show');
    window.fetch = async () => ({json: async () => ({comments: [{id: 12, user_name: value, content: value, can_delete: true}]})});
    await faRenderCmts(8);
  }, {image: imageCards[0], value: sample});
  await page.locator('[data-image-action=delete]').first().click();
  await page.locator('[data-image-action=avatar]').first().click();
  await page.locator('[data-image-action=next]').first().click();
  await page.locator('[data-image-action=type]').first().selectOption('portrait');
  await page.locator('[data-image-index="0"]').dispatchEvent('dragstart');
  await page.locator('[data-image-index="1"]').dispatchEvent('drop');
  assert.equal(await page.locator('.fa-cap').textContent(), sample);
  await page.locator('[data-fanart-action=comments]').click();
  await page.locator('[data-fanart-action=delete-art]').click();
  await page.locator('[data-fanart-action=delete-comment]').click();
  await page.locator('form[data-fanart-action] button[type=submit]').click();
  assert.deepEqual(await page.evaluate(() => window.observed), [
    ['image-delete', 4, 10], ['image-avatar', 4, 10], ['image-move', 0, 1, 10],
    ['image-type', 4, 'portrait', 0, 10], ['drag', 0], ['drop', 1, 10],
    ['fan-comments', 8], ['fan-delete', 8], ['fan-delete-comment', 12, 8], ['fan-post', 8, true],
  ]);
  await assertFixtureStayedData(page);
}

async function testWorks(context, sample) {
  const {html, page} = await open(context, 'works');
  await page.addScriptTag({content: [
    section(html, 'function setState(', '// ----------'),
    section(html, 'const $ =', 'const ROLE_PAGE'),
    section(html, 'function artHTML(', 'async function loadArt('),
    section(html, 'async function renderCmts(', 'function setCmtCount('),
    section(html, 'function bindArtActions(', "bindArtActions($('artGrid'));"),
    'function toggleCmts(id){window.observed.push(["comment",id]);}',
    'function delArt(id){window.observed.push(["art-delete",id]);}',
    'function delCmt(id,cid){window.observed.push(["comment-delete",id,cid]);}',
    'function addCmt(event,id){window.observed.push(["post",id,event.defaultPrevented]);}',
  ].join('\n')});
  await page.evaluate(async value => {
    window.observed = [];
    window.RFX = {seed() {}, bar() { return ''; }};
    setState(document.querySelector('#listState'), value, 'alert', () => window.observed.push(['retry']));
    const grid = document.getElementById('artGrid');
    document.getElementById('charView').hidden = false;
    grid.innerHTML = artHTML({id: 9, caption: value, user_name: value, can_delete: true, sub_comments: 1});
    bindArtActions(grid);
    document.getElementById('cmts9').hidden = false;
    window.fetch = async () => ({json: async () => ({comments: [{id: 13, user_name: value, content: value, can_delete: true}]})});
    await renderCmts(9);
  }, sample);
  const state = page.locator('#listState');
  assert((await state.textContent()).includes(sample));
  const retry = state.locator('button');
  assert.equal(await retry.getAttribute('onclick'), null);
  await retry.click();
  assert.equal(await page.locator('.art-cap').textContent(), sample);
  await page.locator('[data-art-action=comments]').click();
  await page.locator('[data-art-action=delete-art]').click();
  await page.locator('[data-art-action=delete-comment]').click();
  await page.locator('form[data-art-action] button[type=submit]').click();
  assert.deepEqual(await page.evaluate(() => window.observed), [
    ['retry'], ['comment', 9], ['art-delete', 9], ['comment-delete', 9, 13], ['post', 9, true],
  ]);
  await assertFixtureStayedData(page);
}

async function testAdmin(context, sample) {
  const {html, page} = await open(context, 'admin');
  assert(!html.includes('onchange="setRole('));
  await page.addScriptTag({content: [
    section(html, 'function escapeHtml(', 'let selfInfo'),
    section(html, 'async function loadRequests(', 'async function delUser('),
    section(html, 'function bindQueueActions(', 'bindQueueActions(document);'),
  ].join('\n')});
  await page.evaluate(async value => {
    window.observed = [];
    window.confirm = () => true;
    window.adminPost = async (url, data) => { window.observed.push([url, data]); return false; };
    window.fetch = async url => {
      const common = {id: 17, uid: value, user_uid: value, user_name: value, name: value, message: value, requested_role: 'fan_reviewer'};
      const requests = url.includes('elder') ? [common, {...common, id: value}] : [common];
      return {ok: true, json: async () => ({requests, supplements: [{...common, field_name: 'notes'}]})};
    };
    bindQueueActions(document);
    await Promise.all([loadRequests(), loadHonorRequests(), loadSupplements(), loadScribeRequests(), loadExemptRequests()]);
  }, sample);
  const rejectedId = page.locator('#reqBox button[data-approve="true"]').last();
  assert.equal(await rejectedId.getAttribute('data-request-id'), sample);
  await rejectedId.click();
  assert.equal((await page.evaluate(() => window.observed)).length, 0);
  const queues = ['elder', 'honor', 'supplement', 'scribe', 'exempt'];
  for (const queue of queues) {
    await page.locator('button[data-queue="' + queue + '"][data-approve="true"]').first().click();
  }
  await page.locator('button[data-queue="scribe"][data-approve="false"]').click();
  assert.deepEqual(await page.evaluate(() => window.observed), [
    ...queues.map(queue => ['/api/admin/' + queue + '/decide', {id: 17, approve: true}]),
    ['/api/admin/scribe/decide', {id: 17, approve: false}],
  ]);
  await assertFixtureStayedData(page);
}

async function testFormSkills(context, sample) {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  const page = await fixturePage(context, '<input type="checkbox" name="extra_sys" value="生灵系" checked>' +
    '<section id="extraBranchesContainer"></section><section id="customComboList"></section>');
  await page.addScriptTag({content: [
    'let extraOrder=[], customCombos=[], customBranches={}; const ABILITY_BRANCHES={};',
    'function getActiveCombos(){return customCombos;}',
    'function removeCustomCombo(index){window.removed.push(["combo",index]);}',
    'function removeCustomBranch(system,index){window.removed.push([system,index]);}',
    section(html, 'function escapeHtml(s)', '// 配色颜色'),
    section(html, 'function renderExtraBranches()', '// ========== 额外系别分支数量限制'),
    section(html, 'function renderComboUI()', 'function addCustomCombo()'),
    section(html, 'function renderCustomBranchTags(', 'function onComboChange()'),
  ].join('\n')});
  await page.evaluate(value => {
    window.removed = [];
    customCombos = [{name: value, systems: ['生灵系', '空间系']}];
    customBranches = {'生灵系': [value]};
    renderExtraBranches();
    renderComboUI();
  }, sample);
  assert.equal(await page.locator('input[data-combo]').inputValue(), sample);
  assert.equal(await page.locator('input[data-combo] + span').textContent(), sample + '（合璧）');
  assert.equal(await page.locator('#cbTags_生灵系 .combo-tag').textContent(), sample + '×');
  const removals = page.locator('.combo-tag button');
  assert.equal(await removals.count(), 2);
  assert.deepEqual(await removals.evaluateAll(buttons => buttons.map(button => button.getAttribute('onclick'))), [null, null]);
  await removals.first().click();
  await removals.last().click();
  assert.deepEqual(await page.evaluate(() => window.removed), [['生灵系', 0], ['combo', 0]]);
  await assertFixtureStayedData(page);
}

(async () => {
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE});
  try {
    const checks = [
      ['member role, password reset, sheet and poster', testMember],
      ['character merge, image controls and main-volume comments', testCharacter],
      ['works retry and sub-volume comments', testWorks],
      ['administrator review queues', testAdmin],
      ['registration form custom skill names and actions', testFormSkills],
    ];
    const executionCase = ['executable source as data', scriptSource];
    const fixtures = process.argv.includes('--script-source')
      ? [executionCase]
      : [['special text', specialText], executionCase];
    for (const [fixture, sample] of fixtures) {
      const context = await browser.newContext({serviceWorkers: 'block'});
      try {
        await context.route('**/*', route => route.abort());
        if (sample === scriptSource) {
          await verifyExecutionProbe(context);
          console.log('PASS script probe positive control');
        }
        for (const [label, check] of checks) {
          await check(context, sample);
          console.log('PASS ' + fixture + ': ' + label);
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
