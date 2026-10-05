/**
 * 众生之门 · 轮回肉鸽 —— 后端（Node 原生 http + SQLite 持久化）
 * 单机肉鸽：玩家每做一次动作 = 推进一回合（主动节奏）。
 * 魂灵跨局累积，进度持久化到 SQLite（Node >= 22.5 内置 node:sqlite；否则 JSON 兜底）。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const engine = require('./engine');

const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// ---------- 持久化层 ----------
const DB_PATH = path.join(DATA_DIR, 'save.db');
const JSON_PATH = path.join(DATA_DIR, 'save.json');
let db = null;

try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(DB_PATH);
  db.exec('CREATE TABLE IF NOT EXISTS save_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  console.log('[持久化] SQLite 已启用 →', DB_PATH);
} catch (e) {
  console.log('[持久化] SQLite 不可用，改用 JSON 文件 →', e.message);
}

function loadValue(key) {
  if (db) {
    try { const r = db.prepare('SELECT value FROM save_state WHERE key = ?').get(key); return r ? r.value : null; } catch { return null; }
  }
  try { return JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'))[key] ?? null; } catch { return null; }
}
function saveValue(key, value) {
  if (db) {
    try { db.prepare('INSERT INTO save_state (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value)); } catch (e) { console.error('[持久化] 写入失败', e.message); }
  } else {
    try {
      let data = {}; try { data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')); } catch {}
      data[key] = value; fs.writeFileSync(JSON_PATH, JSON.stringify(data));
    } catch (e) { console.error('[持久化] 写入失败', e.message); }
  }
}

// ---------- 全局状态 ----------
let globalSoul = Number(loadValue('soul')) || 0;
let currentRun = engine.createRun(globalSoul);

function setSoul(v) { globalSoul = v; saveValue('soul', v); }

// ---------- 工具 ----------
function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => (d += c));
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
  });
}
function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  fs.readFile(path.join(__dirname, 'public', rel), (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---------- 路由 ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (req.method === 'GET' && p === '/api/state') {
    return send(res, 200, engine.getState(currentRun));
  }

  if (req.method === 'POST' && p === '/api/start') {
    const b = await readBody(req);
    const difficulty = Math.min(5, Math.max(1, Number(b.difficulty) || 3));
    if (currentRun.status !== 'running') setSoul(currentRun.soul);
    currentRun = engine.createRun(globalSoul, difficulty);
    return send(res, 200, { ok: true, ...engine.getState(currentRun) });
  }

  if (req.method === 'POST' && p === '/api/action') {
    const b = await readBody(req);
    const action = String(b.action || '');
    if (!['gather', 'transform', 'strike', 'bond', 'seize'].includes(action)) return send(res, 400, { ok: false, msg: '未知动作' });
    engine.tick(currentRun, action, b.element);
    if (currentRun.status !== 'running') setSoul(currentRun.soul);
    return send(res, 200, { ok: true, ...engine.getState(currentRun) });
  }

  if (req.method === 'GET') return serveStatic(res, p);
  send(res, 404, { ok: false, msg: 'Not Found' });
});

server.listen(PORT, () => {
  console.log(`[众生之门·轮回肉鸽] http://localhost:${PORT}`);
  console.log(`[众生之门] 累计魂灵 ${globalSoul} · 当前境界 ${engine.getRealmStage(globalSoul).name}`);
});
