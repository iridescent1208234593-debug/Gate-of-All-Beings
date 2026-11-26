// SERVE-SHARED-PATH regression test.
//
// The AEON dev server (apps/aeon/serve.mjs) only served files from its own
// folder. But `src/main.js` imports `/shared/shared-session/progress.js` — an
// absolute site path — so in the monorepo the ES module graph could not load
// and the page hung on the loading screen.
//
// The same handler also happily served `../../package.json` through a `..`
// segment, leaking files from outside the site root.
//
// After the fix the server:
//   * resolves /shared/* against BOTH layouts (the published `shared/` dir and
//     the monorepo `packages/` dir),
//   * rejects path traversal inside /shared/,
//   * answers Chrome's implicit /favicon.ico probe with 204,
//   * stubs /api/progress/* with a guest payload for local dev
//     (AEON_PROGRESS_STUB=0 turns the stub off to exercise the offline path).
//
// Run: node --test test/serve-shared-path.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVE = join(HERE, '..', 'serve.mjs');

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Start serve.mjs on a free port and wait until it answers. */
async function startServer(env = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, [SERVE], {
    env: { ...process.env, PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.resume();
  child.stderr.resume();

  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(`${base}/favicon.ico`);
      return { child, base };
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  child.kill();
  throw new Error('serve.mjs did not come up in time');
}

/**
 * Raw HTTP GET with the path sent verbatim.
 *
 * `fetch()` normalises `..` segments away (WHATWG URL), so it can NOT be used
 * to test path traversal — the traversal would never reach the server.
 */
function rawGet(base, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(base);
    const req = request(
      { host: url.hostname, port: url.port, path, method: 'GET' },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode,
          body: Buffer.concat(chunks).toString('utf8'),
        }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

test('the dev server serves the shared module the page imports', async (t) => {
  const { child, base } = await startServer();
  t.after(() => child.kill());

  const res = await fetch(`${base}/shared/shared-session/progress.js`);
  assert.equal(res.status, 200, '/shared/shared-session/progress.js must resolve');

  const body = await res.text();
  assert.match(body, /reportProgress/, 'the real shared module must be served, not a stub');
  assert.match(res.headers.get('content-type') || '', /javascript/, 'the MIME type must be JS');
});

test('the dev server still serves its own site files', async (t) => {
  const { child, base } = await startServer();
  t.after(() => child.kill());

  const res = await fetch(`${base}/index.html`);
  assert.equal(res.status, 200, 'the site root must still work');
});

test('the dev server does not leak files outside the site root', async (t) => {
  const { child, base } = await startServer();
  t.after(() => child.kill());

  // Raw path: `..` must survive to the server for this to be a real test.
  const res = await rawGet(base, '/shared/../package.json');

  assert.notEqual(res.status, 200, 'a traversal must not be served');
  assert.doesNotMatch(res.body, /"name"\s*:\s*"aeon"/, 'no repository file may leak');
});

test('a deeper traversal is refused too', async (t) => {
  const { child, base } = await startServer();
  t.after(() => child.kill());

  const res = await rawGet(base, '/shared/../../package.json');

  assert.notEqual(res.status, 200, 'a traversal must not be served');
});

test('the implicit favicon probe is answered without an error', async (t) => {
  const { child, base } = await startServer();
  t.after(() => child.kill());

  const res = await fetch(`${base}/favicon.ico`);
  assert.equal(res.status, 204, '/favicon.ico must answer 204, not 404');
});

test('the local progress endpoint returns a guest payload', async (t) => {
  const { child, base } = await startServer();
  t.after(() => child.kill());

  const res = await fetch(`${base}/api/progress/report`);
  assert.equal(res.status, 200, '/api/progress/* must be stubbed for local dev');

  const payload = await res.json();
  assert.equal(payload.ranked, false, 'a guest is never ranked');
  assert.equal(payload.game, 'aeon');
  assert.equal(payload.local, true);
});

test('the progress stub can be switched off to exercise the offline path', async (t) => {
  const { child, base } = await startServer({ AEON_PROGRESS_STUB: '0' });
  t.after(() => child.kill());

  const res = await fetch(`${base}/api/progress/report`);
  assert.equal(res.status, 404, 'with the stub off the backend is genuinely absent');
});
