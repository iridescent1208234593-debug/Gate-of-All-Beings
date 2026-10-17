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
const cardsRoot = path.join(projectRoot, 'server', 'app', 'src', 'cards');
const BASE = '/app/modules/cards/';
const MARK = 'gate:first-frame';

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

async function runOnce(browser, url, args, index) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  const origin = new URL(url).origin;
  const errors = [];
  try {
    /* 冷缓存：新玩家，门景首帧 → 跳过 → 初始化可交互 + 字体与网络静止。 */
    const cold = await newThrottledPage(context, origin, args);
    cold.page.on('pageerror', e => errors.push(`cold: ${e.message}`));
    await cold.cdp.send('Network.clearBrowserCache');
    const coldNav = await measureNavigation({ page: cold.page, cdp: cold.cdp, url, args, phase: `run ${index} cold` });
    await cold.page.locator('.gate-skip').click({ timeout: args.timeout });
    await cold.page.locator('.gate-onboarding #username').waitFor({ state: 'visible', timeout: args.timeout });
    const onboardingInteractiveMs = await cold.page.evaluate(() => performance.now());
    await cold.page.evaluate(() => document.fonts.ready.then(() => undefined));
    const quiet = await waitNetworkQuiet(coldNav.requests, 1500, args.timeout);
    const all = [...coldNav.requests.values()];
    const onboardingBytes = all.reduce((sum, r) => sum + (r.bytes || 0), 0);
    const largest = all.filter(r => r.bytes > 0).sort((a, b) => b.bytes - a.bytes).slice(0, 12)
      .map(r => ({ url: r.url, type: r.type, bytes: r.bytes }));
    await cold.page.close();

    /* 热缓存：同一上下文（HTTP 缓存保留），已完成资料的老玩家 → 门景首帧 → 跳过 → 门庭。 */
    await context.addInitScript(identity => {
      try { sessionStorage.setItem('zszm.gateIdentity.v1', JSON.stringify(identity)); } catch { /* ignore */ }
    }, GUEST_COMPLETE);
    const warm = await newThrottledPage(context, origin, args);
    warm.page.on('pageerror', e => errors.push(`warm: ${e.message}`));
    const warmNav = await measureNavigation({ page: warm.page, cdp: warm.cdp, url, args, phase: `run ${index} warm` });
    const enterAt = await warm.page.evaluate(() => performance.now());
    await warm.page.locator('.gate-skip').click({ timeout: args.timeout });
    await warm.page.locator('.zszm-game .game-main').waitFor({ state: 'visible', timeout: args.timeout });
    const hallAt = await warm.page.evaluate(() => performance.now());
    await warm.page.close();

    return {
      cold: {
        ...coldNav.result,
        onboardingBytes,
        onboardingInteractive: Math.round(onboardingInteractiveMs),
        onboardingNetworkQuiet: quiet,
        onboardingRequests: all.length,
        largestTransfers: largest,
      },
      warm: {
        ...warmNav.result,
        warmHallEnter: Math.round(hallAt - enterAt),
        warmFromCache: [...warmNav.requests.values()].filter(r => r.fromCache).length,
      },
      errors,
    };
  } finally {
    await context.close();
  }
}

/* ---------- 汇总与报告 ---------- */

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};
const kb = bytes => `${(bytes / 1024).toFixed(1)} KB`;
const mb = bytes => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
const FORMAT = {
  firstGateFrame: v => `${v} ms`, jsBeforeFrame: kb, crossOriginBlocking: v => String(v),
  onboardingBytes: mb, warmHallEnter: v => `${v} ms`,
};

function summarize(runs) {
  const metrics = {
    firstGateFrame: median(runs.map(r => r.cold.firstGateFrame)),
    jsBeforeFrame: median(runs.map(r => r.cold.jsBeforeFrame)),
    crossOriginBlocking: Math.max(...runs.map(r => r.cold.crossOriginBlocking)),
    onboardingBytes: median(runs.map(r => r.cold.onboardingBytes)),
  };
  const warm = {
    firstGateFrame: median(runs.map(r => r.warm.firstGateFrame)),
    jsBeforeFrame: median(runs.map(r => r.warm.jsBeforeFrame)),
    crossOriginBlocking: Math.max(...runs.map(r => r.warm.crossOriginBlocking)),
    warmHallEnter: median(runs.map(r => r.warm.warmHallEnter)),
  };
  const checks = [
    ...Object.entries(metrics).map(([name, value]) => ({ name, condition: 'cold', value, budget: BUDGET[name], pass: value <= BUDGET[name] })),
    { name: 'warmHallEnter', condition: 'warm', value: warm.warmHallEnter, budget: BUDGET.warmHallEnter, pass: warm.warmHallEnter <= BUDGET.warmHallEnter },
  ];
  return { metrics, warm, checks };
}

function markdownReport(report) {
  const { summary } = report;
  const lines = [
    `# 众生之门启动性能报告`,
    '',
    `- 时间：${report.generatedAt}`,
    `- 目标：${report.target.kind} \`${report.target.location}\``,
    `- 条件：${report.conditions.throttle ? `Fast 4G（${FAST_4G.downloadThroughput * 8 / 1e6} Mbps 下行 / ${FAST_4G.latency} ms RTT），CPU ${CPU_SLOWDOWN}× 降速` : '不节流'}；${report.conditions.browser}；视口 1440×900；${report.runs.length} 次取中位数${report.conditions.blockCrossOrigin ? '；跨子域请求被阻断' : ''}`,
    `- 首帧口径：\`performance.mark('${MARK}')\`；/api/* 由 harness 返回匿名游客应答`,
    '',
    '| 指标 | 条件 | 实测 | 预算 | 结果 |',
    '| --- | --- | ---: | ---: | --- |',
    ...summary.checks.map(c => `| ${c.name} | ${c.condition} | ${FORMAT[c.name](c.value)} | ${FORMAT[c.name](c.budget)} | ${c.pass ? '通过' : '**超标**'} |`),
    '',
    `热缓存门景首帧 ${summary.warm.firstGateFrame} ms，热缓存首帧前 JS ${kb(summary.warm.jsBeforeFrame)}，热缓存跨子域阻塞 ${summary.warm.crossOriginBlocking}。`,
    '',
    '## 每次运行',
    '',
    '| # | 冷首帧 | 冷首帧前 JS | 跨子域阻塞 | 初始化可交互 | 初始化总传输 | 热首帧 | 热进入门庭 |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.runs.map((r, i) => `| ${i + 1} | ${r.cold.firstGateFrame} ms | ${kb(r.cold.jsBeforeFrame)} | ${r.cold.crossOriginBlocking} | ${r.cold.onboardingInteractive} ms | ${mb(r.cold.onboardingBytes)}${r.cold.onboardingNetworkQuiet ? '' : '（未静止）'} | ${r.warm.firstGateFrame} ms | ${r.warm.warmHallEnter} ms |`),
    '',
    '## 首帧前的跨子域阻塞请求（第 1 次运行）',
    '',
    ...(report.runs[0].cold.detail.crossOriginBlocking.length
      ? report.runs[0].cold.detail.crossOriginBlocking.map(r => `- ${r.url}（${r.type}，${r.startMs}–${r.endMs ?? '?'} ms，${r.failed ? `失败：${r.failed}` : `HTTP ${r.status}，${kb(r.bytes)}`}）`)
      : ['- 无']),
    '',
    '## 首帧前 JS（第 1 次运行）',
    '',
    ...report.runs[0].cold.detail.jsBeforeFrame.map(r => `- ${r.url.replace(/^https?:\/\/127\.0\.0\.1:\d+/, '')}：${kb(r.bytes)}（${r.startMs}–${r.endMs ?? '?'} ms）`),
    '',
    '## 冷启动最大的传输（第 1 次运行）',
    '',
    ...report.runs[0].cold.largestTransfers.map(r => `- ${r.url.replace(/^https?:\/\/127\.0\.0\.1:\d+/, '')}：${kb(r.bytes)}`),
    '',
  ];
  const errors = report.runs.flatMap(r => r.errors);
  if (errors.length) lines.push('## 页面错误', '', ...errors.map(e => `- ${e}`), '');
  return lines.join('\n');
}

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
    target = { kind: args.build ? 'build' : 'dist', location: args.build ? 'working tree (temporary build)' : path.relative(projectRoot, dist) || dist };
  }

  const browser = await chromium.launch({ channel: args.channel, headless: !args.headed });
  const runs = [];
  try {
    for (let i = 1; i <= args.runs; i++) {
      process.stdout.write(`[perf] run ${i}/${args.runs}… `);
      const run = await runOnce(browser, url, args, i);
      runs.push(run);
      console.log(`cold frame ${run.cold.firstGateFrame} ms, JS ${kb(run.cold.jsBeforeFrame)}, cross-origin ${run.cold.crossOriginBlocking}, onboarding ${mb(run.cold.onboardingBytes)}; warm frame ${run.warm.firstGateFrame} ms, hall ${run.warm.warmHallEnter} ms`);
    }
  } finally {
    await browser.close();
    if (server) await new Promise(resolve => server.close(resolve));
    if (builtDir) rmSync(builtDir, { recursive: true, force: true });
  }

  const summary = summarize(runs);
  const report = {
    generatedAt: new Date().toISOString(),
    target,
    conditions: {
      throttle: args.throttle, network: args.throttle ? FAST_4G : null, cpuSlowdown: args.throttle ? CPU_SLOWDOWN : 1,
      browser: `${args.channel} ${browser.version()}${args.headed ? '' : ' headless'}`, blockCrossOrigin: args.blockCrossOrigin,
      viewport: '1440x900', apiMock: 'anonymous guest',
    },
    budget: BUDGET,
    summary,
    // 规格要求的四个输出字段（冷缓存中位数；跨子域阻塞取最大值）。
    result: summary.metrics,
    runs,
  };
  const outDir = args.out || path.join(projectRoot, 'work', 'qa', 'perf', localDate());
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = `zszm-startup-${target.kind}-${stamp}`;
  writeFileSync(path.join(outDir, `${base}.json`), JSON.stringify(report, null, 2));
  writeFileSync(path.join(outDir, `${base}.md`), markdownReport(report));

  console.log(JSON.stringify(summary.metrics));
  for (const c of summary.checks) console.log(`${c.pass ? 'PASS' : 'FAIL'} ${c.name} (${c.condition}): ${FORMAT[c.name](c.value)} / budget ${FORMAT[c.name](c.budget)}`);
  console.log(`[perf] report: ${path.join(outDir, base)}.{json,md}`);
  return summary.checks.every(c => c.pass) ? 0 : 1;
}

main().then(code => { process.exitCode = code; }, error => {
  console.error(`[perf] ${error.stack || error.message}`);
  process.exitCode = 2;
});
