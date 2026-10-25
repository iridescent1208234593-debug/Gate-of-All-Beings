import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DEFAULT_SPIRIT_SETTINGS, SPIRIT_SETTINGS_API, validateSpiritSettings } from '../src/games/spirit-playground/settings.js';
import { createRequire } from 'node:module';
const runtimePaths = createRequire(import.meta.url)('../../../../runtime-paths.cjs');

export const MAX_SETTINGS_BODY_BYTES = 8 * 1024;
const localHost = hostname => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
const localAddress = address => address === '::1' || /^(?:::ffff:)?127(?:\.\d{1,3}){3}$/.test(address ?? '');
const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

function requireLocalRequest(request) {
  if (!localAddress(request.socket?.remoteAddress)) throw httpError(403, '此接口仅允许本机访问。');
  let host;
  const protocol = request.socket?.encrypted ? 'https:' : 'http:';
  try { host = new URL(`${protocol}//${request.headers.host}`); } catch { throw httpError(403, '本机请求地址无效。'); }
  if (!localHost(host.hostname) || host.username || host.password || host.pathname !== '/' || host.search || host.hash) {
    throw httpError(403, '此接口仅允许本机访问。');
  }
  if (request.headers.origin) {
    let origin;
    try { origin = new URL(request.headers.origin); } catch { throw httpError(403, '请求来源无效。'); }
    if (origin.origin !== host.origin
      || origin.username || origin.password) throw httpError(403, '请从本地试验场保存配置。');
  }
}

async function readJson(request) {
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers['content-type'] ?? '')) {
    throw httpError(415, '请使用 JSON 格式提交配置。');
  }
  const length = request.headers['content-length'];
  if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > MAX_SETTINGS_BODY_BYTES)) {
    request.resume();
    throw httpError(/^\d+$/.test(length) ? 413 : 400, '配置文件超过限制或长度无效。');
  }
  const body = await new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    const cleanup = () => {
      request.off('data', onData); request.off('end', onEnd);
      request.off('error', onError); request.off('aborted', onAbort);
    };
    const onError = error => { cleanup(); reject(error); };
    const onAbort = () => onError(httpError(400, '配置提交已中断。'));
    const onData = chunk => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > MAX_SETTINGS_BODY_BYTES) {
        cleanup(); request.resume(); reject(httpError(413, '配置文件不能超过 8 KiB。'));
      } else chunks.push(buffer);
    };
    const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks).toString('utf8')); };
    request.on('data', onData); request.on('end', onEnd);
    request.on('error', onError); request.on('aborted', onAbort);
  });
  try { return JSON.parse(body); } catch { throw httpError(400, '配置内容不是有效 JSON。'); }
}

async function loadSettings(file) {
  let raw;
  try { raw = await readFile(file, 'utf8'); } catch (error) {
    if (error.code === 'ENOENT') return { ...DEFAULT_SPIRIT_SETTINGS };
    throw error;
  }
  try { return validateSpiritSettings(JSON.parse(raw)); } catch { return { ...DEFAULT_SPIRIT_SETTINGS }; }
}

async function saveSettings(directory, settings) {
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `.spirit-settings-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(settings, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    await rename(temporary, join(directory, 'spirit-settings.json'));
  } finally {
    await rm(temporary, { force: true });
  }
}

/** Connect middleware; Vite owns the HTTP server. A queue serializes atomic writes. */
export function createSpiritSettingsMiddleware({ directory = runtimePaths.dataPath('spirit') } = {}) {
  const file = join(directory, 'spirit-settings.json');
  let pendingWrite = Promise.resolve();
  return async (request, response, next) => {
    if (request.url?.split('?')[0] !== SPIRIT_SETTINGS_API) return next();
    const send = (status, value) => {
      response.statusCode = status;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.end(JSON.stringify(value));
    };
    try {
      requireLocalRequest(request);
      if (request.method === 'GET') {
        await pendingWrite;
        return send(200, await loadSettings(file));
      }
      if (request.method === 'PUT') {
        const body = await readJson(request);
        let settings;
        try { settings = validateSpiritSettings(body); } catch (error) { throw httpError(400, error.message); }
        const write = pendingWrite.then(() => saveSettings(directory, settings));
        pendingWrite = write.catch(() => {});
        await write;
        return send(200, settings);
      }
      response.setHeader('Allow', 'GET, PUT');
      return send(405, { error: '此接口仅支持 GET 和 PUT。' });
    } catch (error) {
      return send(error.statusCode ?? 500, { error: error.statusCode ? error.message : '本地配置读取或保存失败，请重试。' });
    }
  };
}

export function spiritSettingsPlugin() {
  const attach = server => {
    runtimePaths.requireReady();
    server.middlewares.use(createSpiritSettingsMiddleware());
  };
  return {
    name: 'local-spirit-settings',
    configureServer: attach,
    configurePreviewServer: attach,
  };
}
