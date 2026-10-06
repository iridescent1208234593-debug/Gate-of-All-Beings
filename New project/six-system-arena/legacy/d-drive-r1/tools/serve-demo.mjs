#!/usr/bin/env node
/**
 * serve-demo.mjs —— 零依赖静态服务器（只为打开 demo/ 示例页）
 *
 * 为什么需要它：示例页用原生 ES module + fetch 读取 data/character-stats.json，
 * 直接双击 demo/index.html（file:// 协议）会被浏览器 CORS 拦掉，
 * 所以用本脚本在项目根起一个只读静态服务。
 *
 * 用法：
 *   node tools/serve-demo.mjs            # 默认 http://127.0.0.1:5178/demo/
 *   node tools/serve-demo.mjs --port 6000
 *
 * 安全约定：只读 GET / HEAD；路径做规范化后必须落在项目根目录内（拒绝 ../ 逃逸）；
 *           不写磁盘、不执行任何命令、不代理外部请求。
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const portArg = argv.indexOf('--port');
const PORT = portArg >= 0 ? Number(argv[portArg + 1]) : 5399;
const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('仅支持 GET / HEAD');
    return;
  }

  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/' || pathname.endsWith('/')) pathname += 'index.html';

  // 规范化 + 目录逃逸防护
  const target = normalize(join(PROJECT_ROOT, pathname));
  if (!target.startsWith(PROJECT_ROOT + sep)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('禁止访问项目根目录之外的路径');
    return;
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`404 ${pathname}`);
    return;
  }

  const type = MIME[extname(target).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(target).pipe(res);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[demo] 端口 ${PORT} 已被占用（可能是别的开发服务）。请换端口重试，例如：`);
    console.error(`[demo]   node tools/serve-demo.mjs --port 6001`);
  } else {
    console.error('[demo] 启动失败：', err.message);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`[demo] 项目根：${PROJECT_ROOT}`);
  console.log(`[demo] 示例页：http://${HOST}:${PORT}/demo/`);
  console.log('[demo] Ctrl+C 结束');
});
