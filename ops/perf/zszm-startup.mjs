#!/usr/bin/env node
// 众生之门启动性能 harness（docs/zszm-startup-performance-spec.md 第 4 节第 6 项）。
//
// 用 Playwright + Chrome DevTools Protocol 在冷 / 热缓存下打开门景，按规格第 2 节的条件节流
// （Fast 4G 约 9 Mbps / 150 ms RTT、CPU 4× 降速），输出
//   {firstGateFrame, jsBeforeFrame, crossOriginBlocking, onboardingBytes}
// 并与第 2 节预算比较；任一超标即以退出码 1 结束。报告写入 work/qa/perf/<date>/。
//
// 首帧口径只有一个：页面里的 performance.mark('gate:first-frame')（src/gate/EntryGate.tsx）。
// 没有这个打点的构建无法测量，harness 会直接报错。
//
// 目标（三选一，默认 --dist .releases/candidate/cards）：
//   --dist <dir>   在本进程内用静态服务器托管一个已构建的 Cards 目录（index.html 在 /，
//                  资源在 /app/modules/cards/），文本资源 gzip 压缩，哈希资源长缓存。
//   --build        先把当前工作树构建到系统临时目录（与 ops/build-cards.mjs 相同的 Vite 配置
//                  和 base），再按 --dist 测量；不触碰 .releases。
//   --url <url>    测量一个已在运行的地址（例如本地 Vite dev：http://127.0.0.1:5173/）。
//                  dev 模式下 JS 未打包、未压缩，数字只用于相对比较。
//
// 所有 /api/* 请求都由 harness 拦截并返回固定的匿名游客应答，不访问任何后端或数据根。
// 跨子域资源（会馆 design-system.css 等）走真实网络，这正是要测的阻塞项；
// --block-cross-origin 可让它们立即失败，用于验证"外部请求失败不阻止进入"。
//
// 报告除四个预算指标外还包含：
//   milestones  门景首帧、跳过可点、进入可点、初始化可交互、门庭可交互等时间点（自导航开始，ms）
//   groups      按 document / js / css / font / image / audio / video / api / other 分组的请求数、字节、最早开始、最晚结束
//   resources   每个请求的开始、结束、字节；键去掉同源 origin 与 Vite 文件哈希，跨构建可对齐
// 汇总取各次运行的中位数，格式由 schema 字段（zszm-startup/v1）固定，可直接做前后 diff：
//   --compare <before.json>        测完后与旧报告比较，另写 *.diff.{json,md}
//   --diff <before.json> <after.json>  不测量，只比较两份报告
//
// 其他参数：--runs <n>（默认 3，取中位数） --headed --channel <chrome|msedge>
//           --out <dir> --no-throttle --timeout <ms>
import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoPath = file => path.relative(projectRoot, file).split(path.sep).join('/') || '.';
const cardsRoot = path.join(projectRoot, 'server', 'app', 'src', 'cards');
const BASE = '/app/modules/cards/';
const MARK = 'gate:first-frame';
const SCHEMA = 'zszm-startup/v1';

// 规格第 2 节。单位：ms / bytes / 个。
const BUDGET = {
  firstGateFrame: 2500,
  jsBeforeFrame: 250 * 1024,
  crossOriginBlocking: 0,
  onboardingBytes: 1.5 * 1024 * 1024,
  warmHallEnter: 1000,
};
const FAST_4G = { offline: false, latency: 150, downloadThroughput: (9 * 1e6) / 8, uploadThroughput: (1.5 * 1e6) / 8 };
const CPU_SLOWDOWN = 4;

function parseArgs(argv) {
  const args = { runs: 3, channel: 'chrome', headed: false, throttle: true, blockCrossOrigin: false, timeout: 90000 };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`${flag} 需要一个值`);
      return next;
    };
    if (flag === '--dist') args.dist = path.resolve(value());
    else if (flag === '--build') args.build = true;
    else if (flag === '--url') args.url = value();
    else if (flag === '--runs') args.runs = Math.max(1, Number.parseInt(value(), 10) || 1);
    else if (flag === '--channel') args.channel = value();
    else if (flag === '--headed') args.headed = true;
    else if (flag === '--out') args.out = path.resolve(value());
    else if (flag === '--no-throttle') args.throttle = false;
    else if (flag === '--block-cross-origin') args.blockCrossOrigin = true;
    else if (flag === '--compare') args.compare = path.resolve(value());
    else if (flag === '--diff') args.diff = [path.resolve(value()), path.resolve(value())];
    else if (flag === '--timeout') args.timeout = Number.parseInt(value(), 10);
    else if (flag === '--help' || flag === '-h') args.help = true;
    else throw new Error(`未知参数：${flag}`);
  }
  if ([args.dist, args.build, args.url].filter(Boolean).length > 1) throw new Error('--dist、--build、--url 只能选一个');
  return args;
}

function loadPlaywright() {
  // 仓库根没有 Playwright 依赖；复用已安装在子项目里的副本，避免新增根依赖。
  const candidates = [
    pathToFileURL(path.join(projectRoot, 'package.json')).href,
    pathToFileURL(path.join(projectRoot, 'server/app/src/management/package.json')).href,
    pathToFileURL(path.join(projectRoot, 'server/app/src/softie-webgpu/package.json')).href,
  ];
  for (const base of candidates) {
    try { return createRequire(base)('playwright'); } catch { /* try next */ }
    try { return createRequire(base)('playwright-core'); } catch { /* try next */ }
  }
  throw new Error('找不到 playwright。请在 server/app/src/management 执行 npm install，或在仓库根安装 playwright。');
}

/* ---------- 目标：构建与静态托管 ---------- */

async function buildToTemp() {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'zszm-perf-build-'));
  const { build } = await import(pathToFileURL(path.join(cardsRoot, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  await build({
    root: cardsRoot,
    configFile: path.join(cardsRoot, 'vite.config.ts'),
    base: BASE,
    logLevel: 'warn',
    build: { outDir, emptyOutDir: true },
  });
  return outDir;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wasm': 'application/wasm',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg']);

function serveDist(dist) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://local');
    let file = null;
    let immutable = false;
    if (url.pathname === '/' || url.pathname === '/index.html') file = path.join(dist, 'index.html');
    else if (url.pathname.startsWith(BASE)) {
      const rel = decodeURIComponent(url.pathname.slice(BASE.length));
      const resolved = path.resolve(dist, rel);
      if (resolved.startsWith(dist + path.sep)) { file = resolved; immutable = rel.startsWith('assets/'); }
    }
    if (!file || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    };
    if (COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      headers['Content-Encoding'] = 'gzip';
      headers.Vary = 'Accept-Encoding';
      res.writeHead(200, headers);
      createReadStream(file).pipe(zlib.createGzip({ level: 6 })).pipe(res);
    } else {
      headers['Content-Length'] = statSync(file).size;
      res.writeHead(200, headers);
      createReadStream(file).pipe(res);
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/* ---------- 单次测量 ---------- */

const GUEST_COMPLETE = {
  schema_version: 1, display_name: '测量旅人', species_name: '妖精', avatar_asset_id: '',
  avatar_frame_id: 'perf-frame', avatar_mode: 'default', source_oc_id: '',
};

const API_MOCK = {
  '/api/sso-user': { logged_in: false },
  '/api/gate/identity': { logged_in: false },
};

/**
 * 用 CDP Fetch 拦截 /api/*（不用 Playwright route：它会关闭整个上下文的 HTTP 缓存，热缓存就测不了）。
 * --block-cross-origin 时拦截全部请求并让跨源请求失败；此模式下热缓存数字不可代表真实缓存。
 */
async function interceptRequests(cdp, origin, blockCrossOrigin) {
  const patterns = blockCrossOrigin ? [{ urlPattern: '*', requestStage: 'Request' }] : [{ urlPattern: `${origin}/api/*`, requestStage: 'Request' }];
  cdp.on('Fetch.requestPaused', async ({ requestId, request }) => {
    const url = new URL(request.url);
    try {
      if (url.origin === origin && url.pathname.startsWith('/api/')) {
        const known = Object.hasOwn(API_MOCK, url.pathname);
        await cdp.send('Fetch.fulfillRequest', {
          requestId, responseCode: known ? 200 : 404,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Cache-Control', value: 'no-store' }],
          body: Buffer.from(JSON.stringify(known ? API_MOCK[url.pathname] : {})).toString('base64'),
        });
      } else if (url.origin !== origin && /^https?:$/.test(url.protocol)) {
        await cdp.send('Fetch.failRequest', { requestId, errorReason: 'ConnectionRefused' });
      } else {
        await cdp.send('Fetch.continueRequest', { requestId });
      }
    } catch { /* page closed */ }
  });
  await cdp.send('Fetch.enable', { patterns });
}

/** 记录一次导航内的所有网络请求（CDP 时间戳，秒）。 */
function recordNetwork(cdp) {
  const requests = new Map();
  requests.lastActivity = Date.now();
  for (const event of ['Network.requestWillBeSent', 'Network.loadingFinished', 'Network.loadingFailed', 'Network.dataReceived']) {
    cdp.on(event, () => { requests.lastActivity = Date.now(); });
  }
  cdp.on('Network.requestWillBeSent', e => {
    const prev = requests.get(e.requestId);
    requests.set(e.requestId, {
      ...(prev || {}),
      id: e.requestId, url: e.request.url, type: e.type, start: prev?.start ?? e.timestamp, wallTime: prev?.wallTime ?? e.wallTime,
      initiator: e.initiator?.type, bytes: prev?.bytes ?? 0,
    });
  });
  cdp.on('Network.responseReceived', e => {
    const r = requests.get(e.requestId);
    if (r) Object.assign(r, { status: e.response.status, fromCache: Boolean(e.response.fromDiskCache || e.response.fromMemoryCache || e.response.fromServiceWorker), mime: e.response.mimeType });
  });
  cdp.on('Network.requestServedFromCache', e => { const r = requests.get(e.requestId); if (r) r.fromCache = true; });
  cdp.on('Network.loadingFinished', e => { const r = requests.get(e.requestId); if (r) Object.assign(r, { end: e.timestamp, bytes: e.encodedDataLength }); });
  cdp.on('Network.loadingFailed', e => { const r = requests.get(e.requestId); if (r) Object.assign(r, { end: e.timestamp, failed: e.errorText || 'failed' }); });
  return requests;
}

/** 初始 HTML 中会阻塞首屏的外部资源：<head>/<body> 的同步 stylesheet 与经典同步脚本。 */
function blockingUrlsFromHtml(html, pageUrl) {
  const urls = new Set();
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    if (!/\brel=["']?stylesheet\b/i.test(tag) || /\bmedia=["']?print\b/i.test(tag) || /\bdisabled\b/i.test(tag)) continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href) urls.add(new URL(href, pageUrl).href);
  }
  for (const tag of html.match(/<script\b[^>]*>/gi) || []) {
    if (/\b(async|defer)\b/i.test(tag) || /\btype=["']?module\b/i.test(tag)) continue;
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (src) urls.add(new URL(src, pageUrl).href);
  }
  return urls;
}

async function measureNavigation({ page, cdp, url, args, phase }) {
  const requests = recordNetwork(cdp);
  let html = '';
  const onResponse = async response => {
    if (response.request().resourceType() === 'document' && response.url().startsWith(url.split('#')[0]) && !html) {
      html = await response.text().catch(() => '');
    }
  };
  page.on('response', onResponse);
  await page.goto(url, { waitUntil: 'commit', timeout: args.timeout });
  await page.waitForFunction(name => performance.getEntriesByName(name, 'mark').length > 0, MARK, { timeout: args.timeout, polling: 50 })
    .catch(() => { throw new Error(`${phase}: ${args.timeout} ms 内没有出现 performance.mark('${MARK}')。目标构建是否包含 EntryGate 打点？`); });
  const timing = await page.evaluate(name => ({
    frame: performance.getEntriesByName(name, 'mark')[0].startTime,
    timeOrigin: performance.timeOrigin,
    renderBlocking: performance.getEntriesByType('resource')
      .filter(entry => entry.renderBlockingStatus === 'blocking').map(entry => entry.name),
  }), MARK);

  // CDP 时间戳（单调秒）与页面时间（timeOrigin 起的毫秒）对齐：用文档请求的 wallTime 换算。
  const doc = [...requests.values()].find(r => r.type === 'Document');
  if (!doc) throw new Error(`${phase}: 没有捕获到文档请求`);
  const monoAtTimeOrigin = doc.start - (doc.wallTime * 1000 - timing.timeOrigin) / 1000;
  const toPageMs = mono => (mono - monoAtTimeOrigin) * 1000;
  const frameMs = timing.frame;
  const pageOrigin = new URL(url).origin;
  const beforeFrame = [...requests.values()].filter(r => toPageMs(r.start) <= frameMs);

  const jsBefore = beforeFrame.filter(r => r.type === 'Script');
  const htmlBlocking = blockingUrlsFromHtml(html, url);
  const renderBlocking = new Set(timing.renderBlocking);
  const crossOriginBefore = beforeFrame.filter(r => { try { return new URL(r.url).origin !== pageOrigin && !r.url.startsWith('data:'); } catch { return false; } });
  const crossOriginBlocking = crossOriginBefore.filter(r => htmlBlocking.has(r.url) || renderBlocking.has(r.url));

  const summary = list => list.map(r => ({
    url: r.url, type: r.type, bytes: r.bytes, status: r.status ?? null, fromCache: Boolean(r.fromCache), failed: r.failed || null,
    startMs: Math.round(toPageMs(r.start)), endMs: r.end ? Math.round(toPageMs(r.end)) : null,
  }));
  page.off('response', onResponse);
  return {
    requests, toPageMs, frameMs,
    result: {
      firstGateFrame: Math.round(frameMs),
      jsBeforeFrame: jsBefore.reduce((sum, r) => sum + (r.bytes || 0), 0),
      crossOriginBlocking: crossOriginBlocking.length,
      detail: {
        jsBeforeFrame: summary(jsBefore),
        crossOriginBlocking: summary(crossOriginBlocking),
        crossOriginBeforeFrame: summary(crossOriginBefore),
      },
    },
  };
}

const LONG_LIVED = new Set(['WebSocket', 'EventSource']);

async function waitNetworkQuiet(requests, quietMs, capMs) {
  const started = Date.now();
  for (;;) {
    const pending = [...requests.values()].filter(r => r.end === undefined && !LONG_LIVED.has(r.type) && !r.url.startsWith('data:'));
    if (!pending.length && Date.now() - requests.lastActivity >= quietMs) return true;
    if (Date.now() - started > capMs) return false;
    await new Promise(r => setTimeout(r, 100));
  }
}

async function newThrottledPage(context, origin, args) {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await interceptRequests(cdp, origin, args.blockCrossOrigin);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  if (args.throttle) {
    await cdp.send('Network.emulateNetworkConditions', FAST_4G);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  }
  return { page, cdp };
}

/* ---------- 交互时间点与资源时序 ---------- */

/**
 * 注入页面（每次导航前）：每帧检查一次界面状态，第一次满足时记下 performance.now()，
 * 同时打 performance.mark('zszm:<name>')。时间点都以导航开始为零点，与 gate:first-frame 同一时钟。
 */
function milestoneProbe() {
  const state = (window.__zszmPerf = window.__zszmPerf || {});
  const visible = el => {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const probes = {
    skipClickable: () => { const b = document.querySelector('.gate-skip'); return visible(b) && !b.disabled; },
    enterClickable: () => { const b = document.querySelector('.gate-enter'); return visible(b) && !b.disabled; },
    onboardingInteractive: () => { const i = document.querySelector('.gate-onboarding #username'); return visible(i) && !i.disabled; },
    hallInteractive: () => visible(document.querySelector('.zszm-game .game-main')),
  };
  const record = name => {
    if (state[name] !== undefined) return;
    state[name] = performance.now();
    try { performance.mark(`zszm:${name}`); } catch { /* ignore */ }
  };
  addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('.gate-enter')) record('enterClicked');
  }, true);
  const tick = () => {
    for (const [name, test] of Object.entries(probes)) if (state[name] === undefined && test()) record(name);
    if (performance.now() < 180000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const GROUPS = ['document', 'js', 'css', 'font', 'image', 'audio', 'video', 'api', 'other'];
const EXT = {
  font: /\.(woff2?|ttf|otf|eot)$/i,
  image: /\.(png|jpe?g|webp|avif|gif|svg|ico)$/i,
  audio: /\.(mp3|ogg|oga|wav|m4a|aac|opus|flac)$/i,
  video: /\.(mp4|webm|mov|m4v|ogv)$/i,
  js: /\.(m?js)$/i,
  css: /\.css$/i,
};

function classify(r) {
  let pathname = '';
  try { pathname = new URL(r.url).pathname; } catch { /* ignore */ }
  const mime = r.mime || '';
  if (r.type === 'Document') return 'document';
  if (r.type === 'Script' || EXT.js.test(pathname)) return 'js';
  if (r.type === 'Stylesheet' || EXT.css.test(pathname)) return 'css';
  if (r.type === 'Font' || EXT.font.test(pathname) || mime.startsWith('font/')) return 'font';
  if (EXT.audio.test(pathname) || mime.startsWith('audio/')) return 'audio';
  if (EXT.video.test(pathname) || mime.startsWith('video/') || r.type === 'Media') return 'video';
  if (r.type === 'Image' || EXT.image.test(pathname) || mime.startsWith('image/')) return 'image';
  if (r.type === 'Fetch' || r.type === 'XHR') return 'api';
  return 'other';
}

/** 跨构建稳定的资源键：同源去掉 origin 并去掉 Vite 的 8 位文件哈希；一律去掉查询串。 */
function resourceKey(url, origin) {
  try {
    const u = new URL(url);
    if (u.origin !== origin) return `${u.origin}${u.pathname}`;
    // 哈希必含大写、数字、_ 或 -，以免把 site-language.js 之类的普通词当成哈希。
    return u.pathname.replace(/-([A-Za-z0-9_-]{8})(\.[a-z0-9]+)$/i, (match, hash, ext) => (/[A-Z0-9_-]/.test(hash) ? ext : match));
  } catch { return url; }
}

function collectResources(requests, toPageMs, origin) {
  const seen = new Map();
  return [...requests.values()]
    .filter(r => /^https?:/.test(r.url))
    .sort((a, b) => a.start - b.start)
    .map(r => {
      let key = resourceKey(r.url, origin);
      const n = (seen.get(key) || 0) + 1;
      seen.set(key, n);
      if (n > 1) key += `#${n}`;
      const startMs = Math.round(toPageMs(r.start));
      const endMs = r.end ? Math.round(toPageMs(r.end)) : null;
      return {
        key, group: classify(r), type: r.type, url: r.url.startsWith(origin) ? r.url.slice(origin.length) : r.url,
        status: r.status ?? null, fromCache: Boolean(r.fromCache), failed: r.failed || null,
        bytes: r.bytes || 0, startMs, endMs, durationMs: endMs === null ? null : endMs - startMs,
      };
    });
}

function groupSummary(resources) {
  const groups = {};
  for (const name of GROUPS) {
    const list = resources.filter(r => r.group === name);
    const ended = list.filter(r => r.endMs !== null);
    groups[name] = {
      count: list.length,
      bytes: list.reduce((sum, r) => sum + r.bytes, 0),
      fromCache: list.filter(r => r.fromCache).length,
      failed: list.filter(r => r.failed).length,
      firstStartMs: list.length ? Math.min(...list.map(r => r.startMs)) : null,
      lastEndMs: ended.length ? Math.max(...ended.map(r => r.endMs)) : null,
    };
  }
  return groups;
}

async function readMilestones(page, frameMs) {
  const state = await page.evaluate(() => ({ ...(window.__zszmPerf || {}) }));
  const out = { firstGateFrame: Math.round(frameMs) };
  for (const name of ['skipClickable', 'enterClickable', 'enterClicked', 'onboardingInteractive', 'hallInteractive']) {
    if (state[name] !== undefined) out[name] = Math.round(state[name]);
  }
  return out;
}

async function waitMilestone(page, name, timeout) {
  await page.waitForFunction(key => window.__zszmPerf && window.__zszmPerf[key] !== undefined, name, { timeout, polling: 50 });
}

/* ---------- 单次运行 ---------- */

async function runOnce(browser, url, args, index) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  await context.addInitScript(milestoneProbe);
  const origin = new URL(url).origin;
  const errors = [];
  try {
    /* 冷缓存：新玩家。门景首帧 → 进入可点 → 点击进入 → 初始化可交互 → 字体就绪、网络静止。 */
    const cold = await newThrottledPage(context, origin, args);
    cold.page.on('pageerror', e => errors.push(`cold: ${e.message}`));
    await cold.cdp.send('Network.clearBrowserCache');
    const coldNav = await measureNavigation({ page: cold.page, cdp: cold.cdp, url, args, phase: `run ${index} cold` });
    await waitMilestone(cold.page, 'enterClickable', args.timeout);
    await cold.page.locator('.gate-enter').click({ timeout: args.timeout });
    await waitMilestone(cold.page, 'onboardingInteractive', args.timeout);
    await cold.page.evaluate(() => document.fonts.ready.then(() => undefined));
    const coldQuiet = await waitNetworkQuiet(coldNav.requests, 1500, args.timeout);
    const coldMilestones = await readMilestones(cold.page, coldNav.frameMs);
    const coldResources = collectResources(coldNav.requests, coldNav.toPageMs, origin);
    await cold.page.close();

    /* 热缓存：同一上下文（HTTP 缓存保留），已完成资料的老玩家。门景首帧 → 进入可点 → 点击进入 → 门庭可交互。 */
    await context.addInitScript(identity => {
      try { sessionStorage.setItem('zszm.gateIdentity.v1', JSON.stringify(identity)); } catch { /* ignore */ }
    }, GUEST_COMPLETE);
    const warm = await newThrottledPage(context, origin, args);
    warm.page.on('pageerror', e => errors.push(`warm: ${e.message}`));
    const warmNav = await measureNavigation({ page: warm.page, cdp: warm.cdp, url, args, phase: `run ${index} warm` });
    await waitMilestone(warm.page, 'enterClickable', args.timeout);
    await warm.page.locator('.gate-enter').click({ timeout: args.timeout });
    await waitMilestone(warm.page, 'hallInteractive', args.timeout);
    const warmQuiet = await waitNetworkQuiet(warmNav.requests, 1500, args.timeout);
    const warmMilestones = await readMilestones(warm.page, warmNav.frameMs);
    const warmResources = collectResources(warmNav.requests, warmNav.toPageMs, origin);
    await warm.page.close();

    return {
      cold: {
        ...coldNav.result,
        onboardingBytes: coldResources.reduce((sum, r) => sum + r.bytes, 0),
        networkQuiet: coldQuiet,
        milestones: coldMilestones,
        groups: groupSummary(coldResources),
        resources: coldResources,
      },
      warm: {
        ...warmNav.result,
        warmHallEnter: warmMilestones.hallInteractive - warmMilestones.enterClicked,
        networkQuiet: warmQuiet,
        milestones: warmMilestones,
        groups: groupSummary(warmResources),
        resources: warmResources,
      },
      errors,
    };
  } finally {
    await context.close();
  }
}

/* ---------- 汇总 ---------- */

const median = values => {
  const list = values.filter(v => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : Math.round((list[mid - 1] + list[mid]) / 2);
};
const medianObject = objects => {
  const keys = [...new Set(objects.flatMap(o => Object.keys(o)))];
  return Object.fromEntries(keys.map(key => [key, median(objects.map(o => o[key]))]));
};
const kb = bytes => (bytes === null || bytes === undefined ? '—' : `${(bytes / 1024).toFixed(1)} KB`);
const mb = bytes => (bytes === null || bytes === undefined ? '—' : `${(bytes / 1024 / 1024).toFixed(2)} MB`);
const ms = v => (v === null || v === undefined ? '—' : `${v} ms`);
const FORMAT = {
  firstGateFrame: ms, jsBeforeFrame: kb, crossOriginBlocking: v => String(v), onboardingBytes: mb, warmHallEnter: ms,
};
const MILESTONE_LABEL = {
  firstGateFrame: '门景首帧', skipClickable: '跳过可点', enterClickable: '进入可点', enterClicked: '点击进入',
  onboardingInteractive: '初始化可交互', hallInteractive: '门庭可交互',
};
const PHASE_LABEL = { cold: '冷缓存', warm: '热缓存' };

function summarizeResources(runs, phase) {
  const keys = [...new Set(runs.flatMap(r => r[phase].resources.map(x => x.key)))];
  const out = {};
  for (const key of keys) {
    const hits = runs.map(r => r[phase].resources.find(x => x.key === key)).filter(Boolean);
    out[key] = {
      group: hits[0].group, url: hits[0].url, runs: hits.length,
      bytes: median(hits.map(h => h.bytes)), startMs: median(hits.map(h => h.startMs)), endMs: median(hits.map(h => h.endMs)),
      fromCache: hits.every(h => h.fromCache), failed: hits.find(h => h.failed)?.failed ?? null,
    };
  }
  return out;
}

function summarize(runs) {
  const metrics = {
    firstGateFrame: median(runs.map(r => r.cold.firstGateFrame)),
    jsBeforeFrame: median(runs.map(r => r.cold.jsBeforeFrame)),
    crossOriginBlocking: Math.max(...runs.map(r => r.cold.crossOriginBlocking)),
    onboardingBytes: median(runs.map(r => r.cold.onboardingBytes)),
    warmHallEnter: median(runs.map(r => r.warm.warmHallEnter)),
  };
  const phaseGroups = phase => Object.fromEntries(GROUPS.map(g => [g, medianObject(runs.map(r => r[phase].groups[g]))]));
  const checks = Object.keys(BUDGET).map(name => ({
    name, condition: name === 'warmHallEnter' ? 'warm' : 'cold', value: metrics[name], budget: BUDGET[name],
    pass: metrics[name] !== null && metrics[name] <= BUDGET[name],
  }));
  return {
    metrics,
    milestones: { cold: medianObject(runs.map(r => r.cold.milestones)), warm: medianObject(runs.map(r => r.warm.milestones)) },
    groups: { cold: phaseGroups('cold'), warm: phaseGroups('warm') },
    resources: { cold: summarizeResources(runs, 'cold'), warm: summarizeResources(runs, 'warm') },
    checks,
  };
}

/* ---------- 报告 ---------- */

function milestoneTable(summary) {
  return [
    '| 时间点 | 冷缓存（新玩家） | 热缓存（老玩家） |',
    '| --- | ---: | ---: |',
    ...Object.keys(MILESTONE_LABEL).map(n => `| ${MILESTONE_LABEL[n]} \`${n}\` | ${ms(summary.milestones.cold[n])} | ${ms(summary.milestones.warm[n])} |`),
  ];
}

function groupTable(groups) {
  return [
    '| 类型 | 请求 | 传输 | 缓存命中 | 失败 | 最早开始 | 最晚结束 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...GROUPS.filter(g => groups[g].count).map(g => {
      const x = groups[g];
      return `| ${g} | ${x.count} | ${kb(x.bytes)} | ${x.fromCache} | ${x.failed} | ${ms(x.firstStartMs)} | ${ms(x.lastEndMs)} |`;
    }),
  ];
}

function resourceTable(resources) {
  const list = Object.entries(resources).sort((a, b) => GROUPS.indexOf(a[1].group) - GROUPS.indexOf(b[1].group) || a[1].startMs - b[1].startMs);
  return [
    '| 类型 | 资源 | 开始 | 结束 | 传输 | 备注 |',
    '| --- | --- | ---: | ---: | ---: | --- |',
    ...list.map(([key, r]) => `| ${r.group} | \`${key}\` | ${ms(r.startMs)} | ${ms(r.endMs)} | ${kb(r.bytes)} | ${[r.fromCache ? '缓存' : '', r.failed ? `失败 ${r.failed}` : ''].filter(Boolean).join('，')} |`),
  ];
}

function markdownReport(report) {
  const { summary } = report;
  const lines = [
    '# 众生之门启动性能报告',
    '',
    `- schema：\`${report.schema}\``,
    `- 时间：${report.generatedAt}`,
    `- 目标：${report.target.kind} \`${report.target.location}\``,
    `- 条件：${report.conditions.throttle ? `Fast 4G（${FAST_4G.downloadThroughput * 8 / 1e6} Mbps 下行 / ${FAST_4G.latency} ms RTT），CPU ${CPU_SLOWDOWN}× 降速` : '不节流'}；${report.conditions.browser}；视口 1440×900；${report.runs.length} 次取中位数${report.conditions.blockCrossOrigin ? '；跨子域请求被阻断（热缓存数字不可用）' : ''}`,
    `- 口径：时间均自导航开始；首帧为 \`performance.mark('${MARK}')\`；/api/* 由 harness 返回匿名游客应答`,
    '',
    '## 预算',
    '',
    '| 指标 | 条件 | 实测 | 预算 | 结果 |',
    '| --- | --- | ---: | ---: | --- |',
    ...summary.checks.map(c => `| ${c.name} | ${c.condition} | ${FORMAT[c.name](c.value)} | ${FORMAT[c.name](c.budget)} | ${c.pass ? '通过' : '**超标**'} |`),
    '',
    '## 时间点',
    '',
    ...milestoneTable(summary),
    '',
    '## 按类型分组（冷缓存，到初始化可交互且网络静止）',
    '',
    ...groupTable(summary.groups.cold),
    '',
    '## 按类型分组（热缓存，到门庭可交互且网络静止）',
    '',
    ...groupTable(summary.groups.warm),
    '',
    '## 每次运行',
    '',
    '| # | 冷首帧 | 进入可点 | 初始化可交互 | 首帧前 JS | 跨子域阻塞 | 冷总传输 | 热首帧 | 热进入门庭 |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.runs.map((r, i) => `| ${i + 1} | ${ms(r.cold.milestones.firstGateFrame)} | ${ms(r.cold.milestones.enterClickable)} | ${ms(r.cold.milestones.onboardingInteractive)} | ${kb(r.cold.jsBeforeFrame)} | ${r.cold.crossOriginBlocking} | ${mb(r.cold.onboardingBytes)}${r.cold.networkQuiet ? '' : '（未静止）'} | ${ms(r.warm.milestones.firstGateFrame)} | ${ms(r.warm.warmHallEnter)} |`),
    '',
    '## 首帧前的跨子域阻塞请求（第 1 次运行）',
    '',
    ...(report.runs[0].cold.detail.crossOriginBlocking.length
      ? report.runs[0].cold.detail.crossOriginBlocking.map(r => `- ${r.url}（${r.type}，${r.startMs}–${r.endMs ?? '?'} ms，${r.failed ? `失败：${r.failed}` : `HTTP ${r.status}，${kb(r.bytes)}`}）`)
      : ['- 无']),
    '',
    '## 资源时序（冷缓存，中位数）',
    '',
    ...resourceTable(summary.resources.cold),
    '',
    '## 资源时序（热缓存，中位数）',
    '',
    ...resourceTable(summary.resources.warm),
    '',
  ];
  const errors = report.runs.flatMap(r => r.errors);
  if (errors.length) lines.push('## 页面错误', '', ...errors.map(e => `- ${e}`), '');
  return lines.join('\n');
}

/* ---------- 前后比较 ---------- */

const delta = (before, after) => {
  if (typeof before !== 'number' || typeof after !== 'number') return { before: before ?? null, after: after ?? null, delta: null, pct: null };
  return { before, after, delta: after - before, pct: before ? Math.round(((after - before) / before) * 1000) / 10 : null };
};
const BYTES_THRESHOLD = 1024;
const TIME_THRESHOLD = 250;

function loadReport(file) {
  const report = JSON.parse(readFileSync(file, 'utf8'));
  if (report.schema !== SCHEMA) throw new Error(`${file} 不是 ${SCHEMA} 报告（schema=${report.schema ?? '无'}），无法比较`);
  return report;
}

function diffReports(before, after, files) {
  const comparable = c => JSON.stringify({ ...c, browser: undefined, runs: undefined });
  const resources = {};
  const groups = {};
  for (const phase of ['cold', 'warm']) {
    const a = before.summary.resources[phase];
    const b = after.summary.resources[phase];
    resources[phase] = {
      added: Object.keys(b).filter(k => !(k in a)).map(k => ({ key: k, group: b[k].group, bytes: b[k].bytes, endMs: b[k].endMs })),
      removed: Object.keys(a).filter(k => !(k in b)).map(k => ({ key: k, group: a[k].group, bytes: a[k].bytes, endMs: a[k].endMs })),
      changed: Object.keys(b).filter(k => k in a)
        .map(k => ({ key: k, group: b[k].group, bytes: delta(a[k].bytes, b[k].bytes), endMs: delta(a[k].endMs, b[k].endMs) }))
        .filter(x => Math.abs(x.bytes.delta ?? 0) >= BYTES_THRESHOLD || Math.abs(x.endMs.delta ?? 0) >= TIME_THRESHOLD),
    };
    groups[phase] = Object.fromEntries(GROUPS.map(g => [g, Object.fromEntries(['count', 'bytes', 'lastEndMs']
      .map(f => [f, delta(before.summary.groups[phase][g][f], after.summary.groups[phase][g][f])]))]));
  }
  return {
    schema: `${SCHEMA}-diff`,
    generatedAt: new Date().toISOString(),
    before: { file: files[0], generatedAt: before.generatedAt, target: before.target, conditions: before.conditions },
    after: { file: files[1], generatedAt: after.generatedAt, target: after.target, conditions: after.conditions },
    sameConditions: comparable(before.conditions) === comparable(after.conditions),
    thresholds: { bytes: BYTES_THRESHOLD, timeMs: TIME_THRESHOLD },
    metrics: Object.fromEntries(Object.keys(after.summary.metrics).map(k => [k, delta(before.summary.metrics[k], after.summary.metrics[k])])),
    budget: Object.fromEntries(after.summary.checks.map(c => [c.name, { before: before.summary.checks.find(x => x.name === c.name)?.pass ?? null, after: c.pass }])),
    milestones: Object.fromEntries(['cold', 'warm'].map(phase => [phase, Object.fromEntries(Object.keys(MILESTONE_LABEL)
      .map(k => [k, delta(before.summary.milestones[phase][k], after.summary.milestones[phase][k])]))])),
    groups,
    resources,
  };
}

const signed = (v, fmt) => (v === null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt(Math.abs(v))}`);
const passLabel = v => (v === null || v === undefined ? '—' : v ? '通过' : '超标');

function markdownDiff(diff) {
  const row = (label, d, fmt) => `| ${label} | ${d.before === null ? '—' : fmt(d.before)} | ${d.after === null ? '—' : fmt(d.after)} | ${signed(d.delta, fmt)} | ${d.pct === null ? '—' : `${d.pct > 0 ? '+' : ''}${d.pct}%`} |`;
  const head = ['| 项 | 前 | 后 | 变化 | 比例 |', '| --- | ---: | ---: | ---: | ---: |'];
  const lines = [
    '# 众生之门启动性能：前后比较',
    '',
    `- 前：\`${diff.before.file}\`（${diff.before.generatedAt}，${diff.before.target.kind}）`,
    `- 后：\`${diff.after.file}\`（${diff.after.generatedAt}，${diff.after.target.kind}）`,
    `- 条件${diff.sameConditions ? '一致' : '**不一致**，数字不可直接比较'}；资源变化阈值：传输 ≥ ${kb(BYTES_THRESHOLD)} 或结束时间 ≥ ${TIME_THRESHOLD} ms`,
    '',
    '## 预算指标',
    '',
    ...head,
    ...Object.entries(diff.metrics).map(([k, d]) => row(`${k}（${passLabel(diff.budget[k]?.before)} → ${passLabel(diff.budget[k]?.after)}）`, d, FORMAT[k] || ms)),
    '',
  ];
  for (const phase of ['cold', 'warm']) {
    lines.push(`## 时间点（${PHASE_LABEL[phase]}）`, '', ...head,
      ...Object.entries(diff.milestones[phase]).filter(([, d]) => d.before !== null || d.after !== null).map(([k, d]) => row(`${MILESTONE_LABEL[k]} \`${k}\``, d, ms)), '');
    lines.push(`## 分组（${PHASE_LABEL[phase]}）`, '', '| 类型 | 请求 | 传输 | 最晚结束 |', '| --- | ---: | ---: | ---: |',
      ...GROUPS.filter(g => diff.groups[phase][g].count.before || diff.groups[phase][g].count.after).map(g => {
        const x = diff.groups[phase][g];
        return `| ${g} | ${x.count.before ?? 0} → ${x.count.after ?? 0} | ${kb(x.bytes.before)} → ${kb(x.bytes.after)}（${signed(x.bytes.delta, kb)}） | ${ms(x.lastEndMs.before)} → ${ms(x.lastEndMs.after)} |`;
      }), '');
    const r = diff.resources[phase];
    lines.push(`## 资源变化（${PHASE_LABEL[phase]}）`, '');
    if (!r.added.length && !r.removed.length && !r.changed.length) lines.push('- 无超过阈值的变化');
    for (const x of r.added) lines.push(`- 新增 ${x.group} \`${x.key}\`：${kb(x.bytes)}，结束 ${ms(x.endMs)}`);
    for (const x of r.removed) lines.push(`- 移除 ${x.group} \`${x.key}\`：${kb(x.bytes)}`);
    for (const x of r.changed) lines.push(`- 变化 ${x.group} \`${x.key}\`：传输 ${signed(x.bytes.delta, kb)}，结束 ${signed(x.endMs.delta, ms)}`);
    lines.push('');
  }
  return lines.join('\n');
}

function writeDiff(diff, outDir, base) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, `${base}.json`), JSON.stringify(diff, null, 2));
  writeFileSync(path.join(outDir, `${base}.md`), markdownDiff(diff));
  for (const [k, d] of Object.entries(diff.metrics)) console.log(`DIFF ${k}: ${d.before} → ${d.after} (${d.delta === null ? '—' : (d.delta > 0 ? '+' : '') + d.delta})`);
  console.log(`[perf] diff: ${path.join(outDir, base)}.{json,md}`);
}

/* ---------- 入口 ---------- */

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
    return 0;
  }
  const outDir = args.out || path.join(projectRoot, 'work', 'qa', 'perf', localDate());
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (args.diff) {
    const files = args.diff.map(repoPath);
    writeDiff(diffReports(loadReport(args.diff[0]), loadReport(args.diff[1]), files), outDir, `zszm-startup-diff-${stamp}`);
    return 0;
  }
  const baseline = args.compare ? loadReport(args.compare) : null;
  const { chromium } = loadPlaywright();

  let server = null;
  let builtDir = null;
  let url;
  let target;
  if (args.url) {
    url = args.url;
    target = { kind: 'url', location: url };
  } else {
    let dist = args.dist || path.join(projectRoot, '.releases', 'candidate', 'cards');
    if (args.build) {
      console.log('[perf] 构建当前工作树到临时目录…');
      builtDir = dist = await buildToTemp();
    }
    if (!existsSync(path.join(dist, 'index.html'))) throw new Error(`${dist} 中没有 index.html`);
    server = await serveDist(dist);
    url = `http://127.0.0.1:${server.address().port}/`;
    target = { kind: args.build ? 'build' : 'dist', location: args.build ? 'working tree (temporary build)' : repoPath(dist) };
  }

  const browser = await chromium.launch({ channel: args.channel, headless: !args.headed });
  const browserVersion = browser.version();
  const runs = [];
  try {
    for (let i = 1; i <= args.runs; i++) {
      process.stdout.write(`[perf] run ${i}/${args.runs}… `);
      const run = await runOnce(browser, url, args, i);
      runs.push(run);
      console.log(`cold frame ${run.cold.firstGateFrame} ms, enter ${run.cold.milestones.enterClickable} ms, onboarding ${run.cold.milestones.onboardingInteractive} ms, JS ${kb(run.cold.jsBeforeFrame)}, cross-origin ${run.cold.crossOriginBlocking}, bytes ${mb(run.cold.onboardingBytes)}; warm frame ${run.warm.firstGateFrame} ms, hall ${run.warm.warmHallEnter} ms`);
    }
  } finally {
    await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    if (builtDir) rmSync(builtDir, { recursive: true, force: true });
  }

  const summary = summarize(runs);
  const report = {
    schema: SCHEMA,
    generatedAt: new Date().toISOString(),
    target,
    conditions: {
      throttle: args.throttle, network: args.throttle ? FAST_4G : null, cpuSlowdown: args.throttle ? CPU_SLOWDOWN : 1,
      browser: `${args.channel} ${browserVersion}${args.headed ? '' : ' headless'}`, blockCrossOrigin: args.blockCrossOrigin,
      viewport: '1440x900', apiMock: 'anonymous guest', runs: args.runs,
    },
    budget: BUDGET,
    // 规格要求的四个输出字段（冷缓存中位数；跨子域阻塞取最大值）。
    result: {
      firstGateFrame: summary.metrics.firstGateFrame, jsBeforeFrame: summary.metrics.jsBeforeFrame,
      crossOriginBlocking: summary.metrics.crossOriginBlocking, onboardingBytes: summary.metrics.onboardingBytes,
    },
    summary,
    runs,
  };
  mkdirSync(outDir, { recursive: true });
  const base = `zszm-startup-${target.kind}${args.blockCrossOrigin ? '-blocked' : ''}-${stamp}`;
  const reportFile = path.join(outDir, `${base}.json`);
  writeFileSync(reportFile, JSON.stringify(report, null, 2));
  writeFileSync(path.join(outDir, `${base}.md`), markdownReport(report));

  console.log(JSON.stringify(report.result));
  for (const c of summary.checks) console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.name} (${c.condition}): ${FORMAT[c.name](c.value)} / budget ${FORMAT[c.name](c.budget)}`);
  console.log(`[perf] report: ${path.join(outDir, base)}.{json,md}`);
  if (baseline) {
    const files = [repoPath(args.compare), repoPath(reportFile)];
    writeDiff(diffReports(baseline, report, files), outDir, `${base}.diff`);
  }
  return summary.checks.every(c => c.pass) ? 0 : 1;
}

main().then(code => { process.exitCode = code; }, error => {
  console.error(`[perf] ${error.stack || error.message}`);
  process.exitCode = 2;
});
