// node --test tools/toy/test-toy-bundle.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkPackage, linksFrom, validateContent } from './build-toy-bundle.mjs';

const SCRIPT = fileURLToPath(new URL('./build-toy-bundle.mjs', import.meta.url));
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'toy-bundle-'));

function packageWith(files) {
  const dir = temp();
  for (const [name, body] of Object.entries({ 'index.html': '<!doctype html><title>t</title>', ...files })) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), body);
  }
  return dir;
}

test('the committed Toy source builds into a package that passes the safety check', () => {
  const out = path.join(temp(), 'pkg');
  const run = spawnSync(process.execPath, [SCRIPT, '--out', out], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(fs.readdirSync(out).sort(), ['index.html', 'style.css', 'toy-page.js']);
  assert.deepEqual(checkPackage(out), []);
  assert.ok(fs.statSync(path.join(out, 'index.html')).size < 1024 * 1024);
});

test('--release refuses a package without the publishing account', () => {
  const out = path.join(temp(), 'pkg');
  const run = spawnSync(process.execPath, [SCRIPT, '--out', out, '--release'], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /space_mid/);
  assert.equal(fs.existsSync(out), false);
});

test('output inside the repository is refused', () => {
  const run = spawnSync(process.execPath, [SCRIPT, '--out', 'apps/bilibili-toy/out'], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /outside the repository/);
});

test('only B站 in-app navigation targets become links', () => {
  const content = { schema_version: 1, title: 't', publisher: 'p',
    bilibili: { space_mid: '123', tribee_id: '456', videos: [{ bvid: 'BV1Hh411S7Ys', label: '介绍' }] } };
  assert.deepEqual(validateContent(content, { release: true }), []);
  assert.deepEqual(linksFrom(content).map((l) => l.type), ['space', 'tribee', 'video']);
  assert.ok(validateContent({ ...content, bilibili: { space_mid: 'https://example.com' } }, { release: false }).length);
  assert.ok(validateContent({ ...content, bilibili: { videos: [{ bvid: 'javascript:x' }] } }, { release: false }).length);
});

const refused = {
  'own domain': { 'index.html': '<p>请访问 huiguan.iridescently.xyz 注册</p>' },
  'own domain on another root': { 'a.js': 'const u = "iridescently.cn"' },
  'third-party URL': { 'index.html': '<a href="https://example.com/">x</a>' },
  'protocol-relative URL': { 'index.html': '<img src="//cdn.example.com/a.png">' },
  'site API route': { 'a.js': 'const r = "/api/user"' },
  'loopback host': { 'a.js': 'const h = "127.0.0.1:8080"' },
  'credential word': { 'a.js': 'const HX_SSO_SECRET = "x"' },
  iframe: { 'index.html': '<iframe src="./a.html"></iframe>' },
  'free text input': { 'index.html': '<textarea></textarea>' },
  'direct fetch': { 'a.js': 'fetch("./x.json")' },
  'location redirect': { 'a.js': 'location.href = "./x.html"' },
  'root-absolute path': { 'index.html': '<script src="/main.js"></script>' },
  'source map': { 'a.js.map': '{}' },
  'env file': { '.env': 'A=1' },
  'oversized entry': { 'index.html': 'x'.repeat(1024 * 1024 + 1) },
};

for (const [name, files] of Object.entries(refused)) {
  test(`safety check refuses: ${name}`, () => {
    assert.notDeepEqual(checkPackage(packageWith(files)), []);
  });
}

test('the official Toy SDK script is the one allowed external URL', () => {
  const dir = packageWith({ 'index.html': '<script src="https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js"></script>' });
  assert.deepEqual(checkPackage(dir), []);
});
