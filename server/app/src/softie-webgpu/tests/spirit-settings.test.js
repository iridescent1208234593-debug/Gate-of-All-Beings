import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_SPIRIT_SETTINGS, SPIRIT_SETTINGS_API, SPIRIT_SETTINGS_LIMITS,
  normalizeSpiritSettings, spiritRadius, validateSpiritSettings,
} from '../src/games/spirit-playground/settings.js';
import { normalizeBodyShape } from '../src/games/spirit-playground/body-shape.js';
import {
  MAX_SETTINGS_BODY_BYTES, createSpiritSettingsMiddleware, spiritSettingsPlugin,
} from '../server/spirit-settings.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'softie-spirit-settings-'));
  t.after(async () => {
    // Only remove the explicit, unique temporary fixture created by this test.
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(basename(root).startsWith('softie-spirit-settings-'));
    await rm(root, { recursive: true, force: true });
  });
  return {
    root,
    directory: join(root, '.local'),
    file: join(root, '.local', 'spirit-settings.json'),
    middleware: createSpiritSettingsMiddleware({ directory: join(root, '.local') }),
  };
}

async function request(middleware, {
  method = 'GET', url = SPIRIT_SETTINGS_API, body, chunks,
  headers = {}, address = '127.0.0.1', encrypted = false,
} = {}) {
  const payload = typeof body === 'string' ? body : body === undefined ? '' : JSON.stringify(body);
  const req = Readable.from(chunks ?? (payload ? [Buffer.from(payload)] : []));
  req.method = method;
  req.url = url;
  req.headers = {
    host: '127.0.0.1:5180', 'content-type': 'application/json',
    origin: 'http://127.0.0.1:5180', ...headers,
  };
  req.socket = { remoteAddress: address, encrypted };
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value) { this.body = value; },
  };
  let nextCalls = 0;
  await middleware(req, res, () => { nextCalls += 1; });
  return { ...res, json: res.body ? JSON.parse(res.body) : undefined, nextCalls };
}

test('normalization returns independent defaults and clamps finite numbers', () => {
  assert.equal(DEFAULT_SPIRIT_SETTINGS.skin, 'softie');
  assert.deepEqual(normalizeSpiritSettings(null), DEFAULT_SPIRIT_SETTINGS);
  assert.deepEqual(normalizeSpiritSettings([]), DEFAULT_SPIRIT_SETTINGS);
  const config = normalizeSpiritSettings({
    version: 99, name: '  小黑  ', color: '#ABCDEF', size: 9,
    stiffness: -1, damping: 2, opacity: 0, acceleration: 100,
  });
  assert.deepEqual(config, {
    ...DEFAULT_SPIRIT_SETTINGS, name: '小黑', color: '#abcdef', size: 1.35,
    stiffness: 0, damping: 1, opacity: 0.35, acceleration: 28,
  });
  config.size = 1;
  assert.equal(DEFAULT_SPIRIT_SETTINGS.size, 1);
  assert.deepEqual(normalizeSpiritSettings({
    name: '\n', color: 'red', size: '1.2', stiffness: NaN,
    damping: Infinity, opacity: null, acceleration: undefined,
  }), DEFAULT_SPIRIT_SETTINGS);
});

test('strict validation requires a complete config and allows range boundaries', () => {
  assert.deepEqual(validateSpiritSettings(DEFAULT_SPIRIT_SETTINGS), DEFAULT_SPIRIT_SETTINGS);
  for (const [key, [min, max]] of Object.entries(SPIRIT_SETTINGS_LIMITS)) {
    assert.equal(validateSpiritSettings({ ...DEFAULT_SPIRIT_SETTINGS, [key]: min })[key], min);
    assert.equal(validateSpiritSettings({ ...DEFAULT_SPIRIT_SETTINGS, [key]: max })[key], max);
    for (const invalid of [min - 0.01, max + 0.01, `${min}`, NaN, Infinity, null]) {
      assert.throws(() => validateSpiritSettings({ ...DEFAULT_SPIRIT_SETTINGS, [key]: invalid }), TypeError);
    }
  }
  const missing = { ...DEFAULT_SPIRIT_SETTINGS };
  delete missing.name;
  for (const invalid of [null, [], missing, { ...DEFAULT_SPIRIT_SETTINGS, extra: 1 },
    { ...DEFAULT_SPIRIT_SETTINGS, version: 4 }, { ...DEFAULT_SPIRIT_SETTINGS, version: '1' },
    { ...DEFAULT_SPIRIT_SETTINGS, skin: 'unknown' }]) {
    assert.throws(() => validateSpiritSettings(invalid), TypeError);
  }
  for (const name of ['', ' ', '小\n灵', '灵'.repeat(21)]) {
    assert.throws(() => validateSpiritSettings({ ...DEFAULT_SPIRIT_SETTINGS, name }), TypeError);
  }
  for (const color of ['#abc', '#abcdef00', 'red', 123]) {
    assert.throws(() => validateSpiritSettings({ ...DEFAULT_SPIRIT_SETTINGS, color }), TypeError);
  }
  assert.equal(validateSpiritSettings({ ...DEFAULT_SPIRIT_SETTINGS, name: '🌿'.repeat(20) }).name, '🌿'.repeat(20));
  const legacy = { version: 1, name: '旧小灵', color: '#a5e0cd', size: 1,
    stiffness: 0.35, damping: 0.45, opacity: 1, acceleration: 20 };
  assert.deepEqual(validateSpiritSettings(legacy), { ...DEFAULT_SPIRIT_SETTINGS, ...legacy, version: 3, skin: 'softie' });
  assert.throws(() => validateSpiritSettings({ ...legacy, eyeSize: 1 }), TypeError);
});

test('bud is a supported spirit profile with its own authoritative collision radius', () => {
  const bud = { ...DEFAULT_SPIRIT_SETTINGS, skin: 'bud', size: 1.2 };
  assert.deepEqual(normalizeSpiritSettings(bud), bud);
  assert.deepEqual(validateSpiritSettings(bud), bud);
  assert.ok(Math.abs(spiritRadius(bud) - 0.5) < 1e-12);
  assert.ok(Math.abs(spiritRadius({ skin: 'unknown', size: 1 }) - 1.66 / 3) < 1e-12);
});

test('custom profile persists only its normalized body and appearance settings', async t => {
  const f = await fixture(t);
  const bodyShape = normalizeBodyShape(Array.from({ length: 64 }, (_, i) => ({
    x: Math.cos(i * Math.PI / 32), y: Math.sin(i * Math.PI / 32),
  })));
  const profile = { ...DEFAULT_SPIRIT_SETTINGS, skin: 'custom', bodyShape };
  const saved = await request(f.middleware, { method: 'PUT', body: profile });
  assert.equal(saved.statusCode, 200);
  assert.deepEqual(saved.json, profile);
  assert.deepEqual(JSON.parse(await readFile(f.file, 'utf8')), profile);
  assert.equal(Object.hasOwn(saved.json, 'velocity'), false);
});

test('the optional test charm is profile-safe and old v3 saves still validate', () => {
  const legacy = { ...DEFAULT_SPIRIT_SETTINGS };
  delete legacy.accessory;
  assert.equal(validateSpiritSettings(legacy).accessory, 'none');
  assert.equal(validateSpiritSettings({ ...legacy, accessory: 'test-badge' }).accessory, 'test-badge');
  assert.throws(() => validateSpiritSettings({ ...legacy, accessory: 'unknown' }), /挂饰/);
});

test('GET returns defaults without creating a file', async t => {
  const f = await fixture(t);
  const result = await request(f.middleware);
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.json, DEFAULT_SPIRIT_SETTINGS);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  await assert.rejects(stat(f.directory), { code: 'ENOENT' });
});

test('PUT persists canonical config and atomically replaces existing settings', async t => {
  const f = await fixture(t);
  const first = { ...DEFAULT_SPIRIT_SETTINGS, name: '  小黑  ', color: '#FEDCBA', size: 1.2 };
  const result = await request(f.middleware, { method: 'PUT', body: first });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.json, { ...first, name: '小黑', color: '#fedcba' });
  assert.deepEqual(JSON.parse(await readFile(f.file, 'utf8')), result.json);
  const second = { ...result.json, name: '小白', acceleration: 8 };
  assert.equal((await request(f.middleware, { method: 'PUT', body: second })).statusCode, 200);
  assert.deepEqual((await request(f.middleware, { url: `${SPIRIT_SETTINGS_API}?fresh=1` })).json, second);
  assert.deepEqual(await readdir(f.directory), ['spirit-settings.json']);
});

test('invalid JSON and config return 400 without overwriting the save', async t => {
  const f = await fixture(t);
  await request(f.middleware, { method: 'PUT', body: DEFAULT_SPIRIT_SETTINGS });
  const saved = await readFile(f.file, 'utf8');
  for (const body of ['{', {}, { ...DEFAULT_SPIRIT_SETTINGS, size: 4 },
    { ...DEFAULT_SPIRIT_SETTINGS, stiffness: '0.5' }, { ...DEFAULT_SPIRIT_SETTINGS, unexpected: true }]) {
    const result = await request(f.middleware, { method: 'PUT', body });
    assert.equal(result.statusCode, 400);
    assert.equal(typeof result.json.error, 'string');
    assert.equal(await readFile(f.file, 'utf8'), saved);
  }
});

test('PUT limits both declared and streamed body size, and requires JSON', async t => {
  const f = await fixture(t);
  assert.equal((await request(f.middleware, {
    method: 'PUT', body: DEFAULT_SPIRIT_SETTINGS, headers: { 'content-type': 'text/plain' },
  })).statusCode, 415);
  assert.equal((await request(f.middleware, {
    method: 'PUT', body: DEFAULT_SPIRIT_SETTINGS,
    headers: { 'content-length': `${MAX_SETTINGS_BODY_BYTES + 1}` },
  })).statusCode, 413);
  assert.equal((await request(f.middleware, {
    method: 'PUT', chunks: [Buffer.alloc(4096), Buffer.alloc(4097)],
  })).statusCode, 413);
  assert.equal((await request(f.middleware, {
    method: 'PUT', body: DEFAULT_SPIRIT_SETTINGS, headers: { 'content-length': 'invalid' },
  })).statusCode, 400);
  await assert.rejects(stat(f.file), { code: 'ENOENT' });
});

test('API rejects remote access and cross-origin local writes', async t => {
  const f = await fixture(t);
  for (const options of [
    { address: '192.168.1.4' },
    { address: undefined },
    { headers: { host: 'example.com:5180' } },
    { headers: { origin: 'http://example.com:5180' } },
    { headers: { origin: 'http://127.0.0.1:5190' } },
    { headers: { origin: 'https://127.0.0.1:5180' } },
    { headers: { origin: 'null' } },
  ]) {
    // An explicitly missing peer is distinct from the request helper's default.
    const result = await request(f.middleware, {
      method: 'PUT', body: DEFAULT_SPIRIT_SETTINGS, ...options,
      ...(Object.hasOwn(options, 'address') && options.address === undefined ? { address: '' } : {}),
    });
    assert.equal(result.statusCode, 403);
  }
  await assert.rejects(stat(f.file), { code: 'ENOENT' });
});

test('API accepts IPv6, mapped loopback, localhost and originless local tools', async t => {
  const f = await fixture(t);
  for (const options of [
    { address: '::1', headers: { host: '[::1]:5180', origin: 'http://[::1]:5180' } },
    { address: '::ffff:127.0.0.1' },
    { headers: { host: 'localhost:5180', origin: 'http://localhost:5180' } },
    { headers: { origin: undefined } },
    { encrypted: true, headers: { origin: 'https://127.0.0.1:5180' } },
  ]) assert.equal((await request(f.middleware, options)).statusCode, 200);
});

test('unsupported methods return 405 and unrelated routes continue through Vite', async t => {
  const f = await fixture(t);
  const wrongMethod = await request(f.middleware, { method: 'POST' });
  assert.equal(wrongMethod.statusCode, 405);
  assert.equal(wrongMethod.headers.Allow, 'GET, PUT');
  for (const url of ['/', '/api/spirit-settings-extra', '/games/spirit-playground']) {
    const result = await request(f.middleware, { url });
    assert.equal(result.nextCalls, 1);
    assert.equal(result.body, undefined);
  }
});

test('invalid persisted files fall back to defaults without changing the disk', async t => {
  const f = await fixture(t);
  await mkdir(f.directory);
  for (const raw of ['{', JSON.stringify({ ...DEFAULT_SPIRIT_SETTINGS, size: 100 })]) {
    await writeFile(f.file, raw);
    assert.deepEqual((await request(f.middleware)).json, DEFAULT_SPIRIT_SETTINGS);
    assert.equal(await readFile(f.file, 'utf8'), raw);
  }
});

test('filesystem failures return 500 and do not expose local paths', async t => {
  const f = await fixture(t);
  await writeFile(f.directory, 'directory blocked');
  const result = await request(f.middleware, { method: 'PUT', body: DEFAULT_SPIRIT_SETTINGS });
  assert.equal(result.statusCode, 500);
  assert.equal(result.json.error.includes(f.root), false);
  assert.equal(await readFile(f.directory, 'utf8'), 'directory blocked');
});

test('simultaneous saves finish with a complete JSON file and no temporary residue', async t => {
  const f = await fixture(t);
  const configs = Array.from({ length: 4 }, (_, i) => ({ ...DEFAULT_SPIRIT_SETTINGS, name: `小灵${i}`, acceleration: 10 + i }));
  const results = await Promise.all(configs.map(body => request(f.middleware, { method: 'PUT', body })));
  for (const [i, result] of results.entries()) {
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.json, configs[i]);
  }
  const saved = JSON.parse(await readFile(f.file, 'utf8'));
  assert.deepEqual(validateSpiritSettings(saved), configs.at(-1));
  assert.deepEqual(await readdir(f.directory), ['spirit-settings.json']);
});

test('Vite plugin saves dev and preview settings in isolated external storage', async t => {
  const f = await fixture(t);
  const environment = { ...process.env, IRIDESCENTLY_ENVIRONMENT: 'test', IRIDESCENTLY_STORAGE_ROOT: f.root };
  for (const name of ['DATA', 'ASSETS', 'CACHE', 'RELEASE', 'BACKUP', 'PROJECT']) delete environment[`IRIDESCENTLY_${name}_ROOT`];
  const code = `
    import assert from 'node:assert/strict';
    import {createRequire} from 'node:module';
    import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
    import {join} from 'node:path';
    import {createServer} from 'node:http';
    const paths=createRequire(import.meta.url)(${JSON.stringify(fileURLToPath(new URL('../../../../runtime-paths.cjs', import.meta.url)))});
    for(const directory of Object.values(paths.layout))mkdirSync(directory,{recursive:true});
    writeFileSync(join(paths.dataRoot,'.storage-ready.json'),JSON.stringify({schema:1,state:'ready',environment:'test',roots:paths.layout}));
    const {spiritSettingsPlugin}=await import(${JSON.stringify(new URL('../server/spirit-settings.js', import.meta.url).href)});
    const middleware=[],plugin=spiritSettingsPlugin();
    const server={middlewares:{use(handler){middleware.push(handler);}}};
    plugin.configureServer(server);plugin.configurePreviewServer(server);assert.equal(middleware.length,2);
    const http=createServer((request,response)=>middleware[0](request,response,()=>{response.statusCode=404;response.end();}));
    await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+http.address().port;
    try{
      const put=await fetch(base+${JSON.stringify(SPIRIT_SETTINGS_API)},{method:'PUT',headers:{'Content-Type':'application/json',Origin:base},body:${JSON.stringify(JSON.stringify(DEFAULT_SPIRIT_SETTINGS))}});
      assert.equal(put.status,200);
      assert.deepEqual(JSON.parse(readFileSync(join(paths.dataRoot,'spirit','spirit-settings.json'),'utf8')),${JSON.stringify(DEFAULT_SPIRIT_SETTINGS)});
    }finally{await new Promise(resolve=>http.close(resolve));}
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { env: environment, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
