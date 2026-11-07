// Zero-dependency static file server for local dev / playtesting.
// Run:  node serve.mjs   then open http://localhost:8123
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));       // apps/aeon/
const REPO = fileURLToPath(new URL('../../', import.meta.url));  // monorepo root
const PORT = process.env.PORT || 8123;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wav': 'audio/wav',
};

// src/main.js imports site-root absolute paths such as
// `/shared/shared-session/progress.js`. In a published build those files are
// copied into a top-level `shared/` dir; in this monorepo their sources live in
// `packages/shared-*`. Without this mapping the ES module graph fails to load
// and the page hangs on the loading screen, so resolve both layouts here.
const SHARED_BASES = [
  join(ROOT, 'shared'),        // published layout (serve.mjs at the site root)
  join(REPO, 'packages'),      // monorepo layout (serve.mjs inside apps/aeon)
];

function within(base, full) {
  const prefix = base.endsWith(sep) ? base : base + sep;
  return full.startsWith(prefix);
}

async function readShared(p) {
  const rel = p.slice('/shared/'.length);
  for (const base of SHARED_BASES) {
    const full = normalize(join(base, rel));
    if (!within(base, full)) continue; // reject ../ traversal
    try { return { full, body: await readFile(full) }; } catch { /* try next layout */ }
  }
  return null;
}

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';

    // The page declares no icon. Answer Chrome's implicit /favicon.ico probe
    // with 204 instead of a 404 that shows up as a console error.
    if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }

    // Local dev has no portal_server behind /api/progress/*. Return the same
    // guest payload the real backend sends, instead of a 404 that the client
    // can only log as a failed report. Set AEON_PROGRESS_STUB=0 to exercise
    // the genuine offline failure path. Production is unaffected (no backend
    // is ever started from this file).
    if (p.startsWith('/api/progress/') && process.env.AEON_PROGRESS_STUB !== '0') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ranked: false, awarded: [], game: 'aeon', local: true }));
    }

    if (p.startsWith('/shared/')) {
      const hit = await readShared(p);
      if (!hit) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404'); }
      res.writeHead(200, { 'Content-Type': TYPES[extname(hit.full)] || 'application/octet-stream' });
      return res.end(hit.body);
    }

    const full = normalize(join(ROOT, p));
    if (!full.startsWith(ROOT)) { res.writeHead(403); return res.end('forbidden'); }
    const body = await readFile(full);
    res.writeHead(200, { 'Content-Type': TYPES[extname(full)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404');
  }
}).listen(PORT, () => {
  console.log(`AEON dev server → http://localhost:${PORT}`);
  if (process.env.AEON_PROGRESS_STUB !== '0') {
    console.log('  /api/progress/* → local guest stub (AEON_PROGRESS_STUB=0 to disable)');
  }
});
