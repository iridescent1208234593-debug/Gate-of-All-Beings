#!/usr/bin/env node
// Build the Bilibili Toy package for 西木会馆 from apps/bilibili-toy and refuse anything unsafe.
//
//   node tools/toy/build-toy-bundle.mjs --out <empty-or-new-dir> [--release]
//   node tools/toy/build-toy-bundle.mjs --check <existing-package-dir>
//
// The output folder is what the owner uploads with their own `toy` CLI or the Toy web page.
// This script never logs in, uploads or submits anything.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP, ROOT, approvedHosts, isApprovedUrl, projectRoots, readContent, siteUrl } from './toy-site.mjs';

const SDK_URL = 'https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js';
const ENTRY_LIMIT = 1024 * 1024; // platform: entry index.html ≤ 1MB after unzip
const PACKAGE_LIMIT = 50 * 1024 * 1024; // platform default package cap
const IMAGE_TYPES = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);
const TEXT_TYPES = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt']);
const ALLOWED_RIGHTS = new Set(['owner', 'licensed']);
const NAVIGATE_TYPES = new Set(['space', 'tribee', 'video', 'opus', 'search', 'toy']);

function fail(message) {
  console.error(`[toy] ERROR ${message}`);
  process.exitCode = 1;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Every host the project owns: the three roots and every subdomain. Approved links are removed
// from a line before this runs, so any remaining mention is an unapproved one.
function ownHostPatterns() {
  const roots = projectRoots().map((r) => r.replace(/\./g, '\\.'));
  // Root names without the TLD as well, so "iridescently" in any form is caught.
  const stems = [...new Set(projectRoots().map((r) => r.split('.')[0]))];
  return [new RegExp(`(?:${roots.join('|')})`, 'i'), new RegExp(`\\b(?:${stems.join('|')})\\b`, 'i')];
}

export function linksFrom(content) {
  const links = [];
  const b = content.bilibili || {};
  if (b.space_mid) links.push({ type: 'space', id: String(b.space_mid), label: '作者空间' });
  if (b.tribee_id) links.push({ type: 'tribee', id: String(b.tribee_id), label: '西木会馆小站' });
  for (const v of b.videos || []) {
    if (v && v.bvid) links.push({ type: 'video', id: String(v.bvid), label: v.label || '介绍视频' });
  }
  return links;
}

export function validateContent(content, { release }) {
  const errors = [];
  if (content.schema_version !== 1) errors.push('content.json schema_version must be 1');
  for (const key of ['title', 'publisher']) if (!content[key]) errors.push(`content.json ${key} is empty`);
  const b = content.bilibili || {};
  if (b.space_mid && !/^\d{1,20}$/.test(String(b.space_mid))) errors.push('bilibili.space_mid must be digits');
  if (b.tribee_id && !/^\d{1,20}$/.test(String(b.tribee_id))) errors.push('bilibili.tribee_id must be digits');
  for (const v of b.videos || []) {
    if (!/^BV[0-9A-Za-z]{10}$/.test(String(v.bvid || ''))) errors.push(`video bvid "${v.bvid}" is not a BV id`);
  }
  for (const link of linksFrom(content)) if (!NAVIGATE_TYPES.has(link.type)) errors.push(`unsupported navigate type ${link.type}`);
  if (release && !b.space_mid) errors.push('--release needs bilibili.space_mid (the project account that publishes the Toy)');
  try {
    approvedHosts(content);
    for (const link of content.site_links || []) siteUrl(content, link.service, link.path);
    archiveUrl(content);
  } catch (error) {
    errors.push(error.message);
  }
  if (content.site_links?.length && content.site?.root !== 'iridescently.cn') {
    errors.push('site.root: the Toy platform approved iridescently.cn only; another root needs a new platform approval first');
  }
  return errors;
}

// The archive is read live from the approved huiguan host; the page renders it with textContent.
export function archiveUrl(content) {
  const a = content.archive;
  return a && a.endpoint ? siteUrl(content, 'huiguan', a.endpoint, { dataEndpoint: true }) : '';
}

function renderArchive(content) {
  if (!archiveUrl(content)) return '';
  return `<section class="card archive" id="archive" aria-labelledby="archive-h">
    <h2 id="archive-h">西木会馆档案室</h2>
    <p class="hint" id="archive-status">正在翻开会馆档案…</p>
    <h3 hidden id="fan-h">同人档案 · 人气前十</h3>
    <div class="oc-grid" id="fan-grid"></div>
    <h3 hidden id="official-h">官方角色档案</h3>
    <div class="oc-grid official" id="official-grid"></div>
    <p><a class="more" href="${escapeHtml(siteUrl(content, 'huiguan', '/'))}" target="_blank" rel="noopener">打开完整档案室</a></p>
  </section>`;
}

function renderSiteLinks(content) {
  const links = content.site_links || [];
  if (!links.length) return '';
  const items = links.map((l) => `<a class="site-link" href="${escapeHtml(siteUrl(content, l.service, l.path))}" target="_blank" rel="noopener"><b>${escapeHtml(l.label)}</b>${l.desc ? `<span>${escapeHtml(l.desc)}</span>` : ''}</a>`).join('\n    ');
  return `<section class="card" aria-labelledby="site-h">
    <h2 id="site-h">去会馆和众生之门</h2>
    <div class="site-links">
    ${items}
    </div>
    <p class="hint">游戏和登录在会馆网站上进行，会在浏览器中打开。</p>
  </section>`;
}

function render(template, content) {
  const paragraphs = (content.intro || []).map((p) => `<p>${escapeHtml(p)}</p>`).join('\n    ');
  const projects = (content.projects || [])
    .map((p) => `<li><b>${escapeHtml(p.name)}</b><span>${escapeHtml(p.desc || '')}</span></li>`).join('');
  const notices = (content.notices || []).filter((n) => n && n.text);
  const noticesHtml = notices.length
    ? `<section class="card notices" aria-labelledby="notices-h">\n    <h2 id="notices-h">公告</h2>\n    ${notices
      .map((n) => `<p>${n.date ? `<time>${escapeHtml(n.date)}</time>` : ''}${escapeHtml(n.text)}</p>`).join('\n    ')}\n  </section>`
    : '';
  // JSON inside <script> must not be able to close the tag.
  const linksJson = JSON.stringify({ navigate: linksFrom(content), archive: archiveUrl(content), hosts: approvedHosts(content) })
    .replace(/</g, '\\u003c');
  const values = {
    title: escapeHtml(content.title), subtitle: escapeHtml(content.subtitle || ''), intro: paragraphs,
    projects, notices: noticesHtml, ip_notice: escapeHtml(content.legal?.ip_notice || ''),
    disclaimer: escapeHtml(content.legal?.disclaimer || ''), publisher: escapeHtml(content.publisher), linksJson,
    archive: renderArchive(content), site_links: renderSiteLinks(content),
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`unknown template token ${key}`);
    return values[key];
  });
}

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

// Static safety gate for a finished package. Returns a list of problems; empty means publishable.
export function checkPackage(dir, hosts = approvedHosts(readContent()), dataUrls = [archiveUrl(readContent())].filter(Boolean)) {
  const problems = [];
  const files = listFiles(dir);
  const own = ownHostPatterns();
  if (!files.includes('index.html')) problems.push('index.html missing at package root');
  let total = 0;
  for (const rel of files) {
    const full = path.join(dir, rel);
    const size = fs.statSync(full).size;
    total += size;
    const base = path.basename(rel);
    if (base.startsWith('.') || /(^|\/)(node_modules|__MACOSX|\.git)(\/|$)/.test(rel)) problems.push(`${rel}: hidden or tooling file`);
    if (/\.(map|env|pem|key|db|sqlite3?|log|bak|zip|py|sh|ps1|md|yaml|yml|ts)$/i.test(base) || base === 'toy.yaml') {
      problems.push(`${rel}: file type must not ship in a Toy package`);
    }
    if (rel === 'index.html' && size > ENTRY_LIMIT) problems.push(`index.html is ${size} bytes, over the 1MB entry limit`);
    const ext = path.extname(rel).toLowerCase();
    if (!TEXT_TYPES.has(ext)) continue;
    const text = fs.readFileSync(full, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((raw, i) => {
      const at = `${rel}:${i + 1}`;
      let line = raw.split(SDK_URL).join('');
      for (const url of dataUrls) line = line.split(url).join('');
      // The page config lists approved hosts as plain JSON strings.
      for (const host of hosts) line = line.split(`"${host}"`).join('""');
      // Approved links (https, approved host, public page path) are allowed and removed before
      // the remaining checks; HTML-escaped ampersands are undone so query strings parse.
      line = line.replace(/https:\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}[^\s"'<>)]*/g, (url) => (isApprovedUrl(url.replace(/&amp;/g, '&'), hosts) ? '' : url));
      for (const pattern of own) if (pattern.test(line)) problems.push(`${at}: names a project domain (Toy must not lead off-site)`);
      for (const m of line.matchAll(/(?:https?:)?\/\/[A-Za-z0-9.-]+\.[A-Za-z]{2,}[^\s"'<>)]*/g)) {
        problems.push(`${at}: external URL ${m[0]} (only the official Toy SDK and approved project pages are allowed)`);
      }
      if (/\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0)\b|\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(line)) problems.push(`${at}: host or IP address`);
      if (/\/(?:api|app|admin|uploads|assets\/uploads)\//i.test(line)) problems.push(`${at}: site route (/api, /app, /admin, /uploads)`);
      if (/(?:secret|token|passw(?:or)?d|api[_-]?key|cookie|HX_SSO|TURNSTILE|SMTP|CLIENT_ID)/i.test(line)
          && !/toyOpenId/.test(line)) problems.push(`${at}: credential-like word`);
      if (/<(?:iframe|form|input|textarea|object|embed)\b/i.test(line)) problems.push(`${at}: iframe or user-input element (Toy forbids iframes and free UGC)`);
      // The page script may fetch, but only the configured archive URL reaches it (see toy-page.js).
      const fetchAllowed = rel === 'toy-page.js' && dataUrls.length > 0;
      if (/\b(?:window\.open|location\.(?:href|assign|replace))\b|XMLHttpRequest|WebSocket|sendBeacon/.test(line)
          || (!fetchAllowed && /\bfetch\s*\(/.test(line))) {
        problems.push(`${at}: direct navigation or network call (use toy.navigate only)`);
      }
      if (/\b(?:src|href)\s*=\s*["']\//i.test(line) && !/["']\/\//.test(line)) problems.push(`${at}: root-absolute path breaks under /toy/<slug>/`);
    });
  }
  if (total > PACKAGE_LIMIT) problems.push(`package is ${total} bytes, over 50MB`);
  return problems;
}

function copyAssets(outDir) {
  const manifest = readJson(path.join(APP, 'assets/assets.json'));
  const listed = new Map((manifest.files || []).map((f) => [f.path, f]));
  const onDisk = listFiles(path.join(APP, 'assets')).filter((f) => f !== 'assets.json');
  for (const rel of onDisk) {
    const entry = listed.get(rel);
    if (!IMAGE_TYPES.has(path.extname(rel).toLowerCase())) { fail(`assets/${rel}: only images may ship`); continue; }
    if (!entry) { fail(`assets/${rel}: not registered in assets/assets.json`); continue; }
    if (!ALLOWED_RIGHTS.has(entry.rights) || !entry.author) {
      fail(`assets/${rel}: needs author and rights "owner" or "licensed" (collaborators' work needs their written permission)`);
      continue;
    }
    const target = path.join(outDir, 'assets', rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(APP, 'assets', rel), target);
  }
  for (const rel of listed.keys()) if (!onDisk.includes(rel)) fail(`assets/assets.json lists missing file ${rel}`);
}

function main(argv) {
  const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const check = arg('--check');
  if (check) {
    const problems = checkPackage(path.resolve(check));
    problems.forEach((p) => fail(p));
    if (!problems.length) console.log(`[toy] OK ${check} passed the safety check`);
    return;
  }
  const out = arg('--out');
  if (!out) { fail('usage: --out <dir> [--release] | --check <dir>'); return; }
  const outDir = path.resolve(out);
  if (outDir === ROOT || outDir.startsWith(ROOT + path.sep)) { fail('--out must be outside the repository'); return; }
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) { fail(`${outDir} is not empty`); return; }

  const content = readContent();
  const errors = validateContent(content, { release: argv.includes('--release') });
  errors.forEach((e) => fail(e));
  if (errors.length) return;

  fs.mkdirSync(outDir, { recursive: true });
  try {
    build(outDir, content);
  } finally {
    // A refused package is removed so it cannot be uploaded by mistake.
    if (process.exitCode) fs.rmSync(outDir, { recursive: true, force: true });
  }
}

function build(outDir, content) {
  const html = render(fs.readFileSync(path.join(APP, 'src/index.html'), 'utf8'), content);
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  for (const file of ['style.css', 'toy-page.js']) fs.copyFileSync(path.join(APP, 'src', file), path.join(outDir, file));
  copyAssets(outDir);
  if (process.exitCode) return;

  const problems = checkPackage(outDir, approvedHosts(content), [archiveUrl(content)].filter(Boolean));
  problems.forEach((p) => fail(p));
  if (problems.length) return;
  if (!archiveUrl(content)) console.warn('[toy] WARN archive.endpoint not set; the 档案室 section is left out');
  if (!linksFrom(content).length) console.warn('[toy] WARN no B站 navigation targets set; the "在 B站 找到我们" block stays hidden');
  console.log(`[toy] OK package written to ${outDir}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
