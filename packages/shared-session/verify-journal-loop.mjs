// 牌录主循环验证：出发 → 结算 → 照料 → 续读。
// 只用本地构建产物与本机回环，不请求任何生产服务。
//
// 用法：
//   node packages/shared-session/verify-journal-loop.mjs
//   IRIDESCENTLY_CARDS_DIR=<构建出的 cards 目录> node packages/shared-session/verify-journal-loop.mjs
//
// 默认读取 .releases/candidate/cards（旧布局）或 <IRIDESCENTLY_STORAGE_ROOT>/<env>/releases/candidate/modules/cards。
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {access, mkdtemp, readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../../apps/management/node_modules/playwright/index.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = await mkdtemp(path.join(tmpdir(), 'verify-journal-loop-'));

const commit = (() => {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim(); }
  catch { return 'unknown'; }
})();

async function resolveCardsDir() {
  const candidates = [];
  if (process.env.IRIDESCENTLY_CARDS_DIR) candidates.push(process.env.IRIDESCENTLY_CARDS_DIR);
  candidates.push(path.join(root, '.releases', 'candidate', 'cards'));
  const storage = process.env.IRIDESCENTLY_STORAGE_ROOT;
  const environment = process.env.IRIDESCENTLY_ENVIRONMENT || 'development';
  if (storage) candidates.push(path.join(storage, environment, 'releases', 'candidate', 'modules', 'cards'));
  for (const dir of candidates) {
    try { await access(path.join(dir, 'index.html')); return dir; } catch {}
  }
  throw new Error(`NoCardsBuild: 未找到构建产物，请先 npm run build:cards 或设置 IRIDESCENTLY_CARDS_DIR。候选：${candidates.join(' | ')}`);
}

const cardsDir = await resolveCardsDir();
const types = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf'};

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // API 一律本地打桩：本检查不依赖账户、数值后台或外网。
    if (pathname.includes('/api/')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(pathname.includes('card-balance')
        ? {revision: 0, overrides: {}, editable: false}
        : {logged_in: false}));
      return;
    }
    const routes = [
      ['/app/modules/cards/', cardsDir],
      ['/shared/', path.join(root, 'packages')],
    ];
    const route = routes.find(([prefix]) => pathname.startsWith(prefix));
    if (!route) throw new Error('Unavailable route');
    const relative = pathname.slice(route[0].length) || 'index.html';
    const file = path.resolve(route[1], relative);
    if (path.relative(route[1], file).startsWith('..')) throw new Error('Invalid path');
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;

const browser = await chromium.launch({channel: 'msedge', headless: true});
const checks = [];
let page;
try {
  const context = await browser.newContext({serviceWorkers: 'block', viewport: {width: 1280, height: 900}});
  const pageErrors = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === origin ? route.continue() : route.abort();
  });
  // 固定开场与身份，让检查直接落在牌录上，而不是开场动画。
  await context.addInitScript(() => {
    localStorage.setItem('zszm.introSeenAt', String(Date.now()));
    sessionStorage.setItem('zszm.gateIdentity.v1', JSON.stringify({
      schema_version: 1, id: 'verification', display_name: '旅人', species_name: '妖精',
      avatar_asset_id: '', avatar_frame_id: 'frame-default', avatar_mode: 'default', source_oc_id: ''
    }));
  });

  page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));

  const readDay = async () => {
    const text = await page.locator('.day-label').first().innerText();
    const match = text.match(/第\s*(\d+)\s*日/);
    assert(match, `无法从 "${text}" 解析游戏日`);
    return Number(match[1]);
  };
  const journalCount = async () => {
    const label = await page.getByText(/条$/, {exact: false}).first().innerText().catch(() => '0');
    const match = label.match(/(\d+)\s*条/);
    return match ? Number(match[1]) : 0;
  };

  // ── 1. 出发 ────────────────────────────────────────────────
  await page.goto(origin + '/app/modules/cards/#journal');
  await page.getByRole('heading', {name: '众生牌录', exact: true}).waitFor();
  const dayBefore = await readDay();
  const entriesBefore = await journalCount();
  checks.push(`牌录打开，第 ${dayBefore} 日，见闻 ${entriesBefore} 条`);

  await page.getByRole('button', {name: /^出行/}).click();
  await page.getByRole('heading', {name: '这一程，与谁同行'}).waitFor();
  await page.locator('.hero-option').first().click();
  await page.getByRole('button', {name: /^以.+启程$/}).click({timeout: 15000});
  await page.getByRole('heading', {name: /林间小径|重生之门/}).first().waitFor({timeout: 20000});
  checks.push('已出发并进入旅途');

  // ── 2. 结算（打完第一场遭遇，折返回会馆写进牌录）──────────
  await page.locator('.map-node:not([disabled])').first().click();

  // 自动出牌直到离开战斗：遭遇、奖励、休憩三种房间都按文案处理。
  const settled = page.getByRole('button', {name: '收好这些见闻'});
  const returnButton = page.getByRole('button', {name: /折返|离开/}).first();
  for (let step = 0; step < 60; step++) {
    if (await settled.isVisible().catch(() => false)) break;
    if (await returnButton.isVisible().catch(() => false)) break;

    const reward = page.getByRole('button', {name: /不取新牌，继续旅途/});
    if (await reward.isVisible().catch(() => false)) { await reward.click(); continue; }

    const rest = page.getByRole('button', {name: /在树荫下休息/});
    if (await rest.isVisible().catch(() => false)) { await rest.click(); continue; }

    const endTurn = page.getByRole('button', {name: '结束回合'});
    if (await endTurn.isVisible().catch(() => false)) {
      for (let card = 0; card < 3; card++) {
        const playable = page.locator('.hand button:not([disabled])').first();
        if (await playable.count() === 0) break;
        await playable.click({timeout: 5000}).catch(() => {});
      }
      await endTurn.click({timeout: 10000}).catch(() => {});
      continue;
    }
    await page.waitForTimeout(250);
  }

  if (await returnButton.isVisible().catch(() => false)) {
    await returnButton.click();
    await page.getByRole('heading', {name: /现在折返？|现在离开重生之门？/}).waitFor();
    await page.getByRole('button', {name: '回会馆'}).click();
  }

  const returnPanel = page.getByRole('status', {name: '新的见闻'});
  await returnPanel.waitFor({timeout: 20000});
  const entriesAfter = await journalCount();
  assert(entriesAfter > entriesBefore, `结算未写入新见闻：${entriesBefore} → ${entriesAfter}`);
  checks.push(`结算产生新见闻：${entriesBefore} → ${entriesAfter} 条`);
  await page.screenshot({path: path.join(output, 'journal-settled.png')});
  await page.getByRole('button', {name: '收好这些见闻'}).click();

  // ── 3. 照料（过一夜，结算当日安排）────────────────────────
  const advance = page.getByRole('button', {name: /歇下，等明天|在会馆过一天/}).first();
  await advance.click();
  await page.waitForFunction(
    previous => {
      const label = document.querySelector('.day-label')?.textContent || '';
      const match = label.match(/第\s*(\d+)\s*日/);
      return match && Number(match[1]) > previous;
    },
    dayBefore, {timeout: 20000}
  );
  const dayAfterCare = await readDay();
  assert(dayAfterCare === dayBefore + 1, `照料未推进一天：${dayBefore} → ${dayAfterCare}`);
  checks.push(`照料过夜推进到第 ${dayAfterCare} 日`);

  // ── 4. 续读（刷新后状态仍在）─────────────────────────────
  await page.reload();
  await page.getByRole('heading', {name: '众生牌录', exact: true}).waitFor();
  const dayAfterReload = await readDay();
  const entriesAfterReload = await journalCount();
  assert(dayAfterReload === dayAfterCare, `刷新后游戏日回退：${dayAfterCare} → ${dayAfterReload}`);
  assert(entriesAfterReload >= entriesAfter, `刷新后见闻丢失：${entriesAfter} → ${entriesAfterReload}`);
  checks.push(`刷新续读：第 ${dayAfterReload} 日、见闻 ${entriesAfterReload} 条仍在`);
  await page.screenshot({path: path.join(output, 'journal-resumed.png')});

  assert.deepEqual(pageErrors, [], '页面运行期报错：' + pageErrors.join(' | '));

  console.log(JSON.stringify({
    passed: checks.length, failed: 0, commit, cards: cardsDir, checks, screenshots: output
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    commit, cards: cardsDir, checks,
    pageErrors: page ? await page.evaluate(() => [...document.querySelectorAll('.toast')].map(n => n.textContent)).catch(() => []) : [],
    body: page ? await page.locator('body').innerText().catch(() => '') : ''
  }, null, 2));
  throw error;
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
