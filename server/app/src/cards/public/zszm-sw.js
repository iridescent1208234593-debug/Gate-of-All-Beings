// 众生之门 asset cache. Only serves exact URLs listed in preload-manifest.json (content-hashed files);
// pages, APIs and anything unlisted always go to the network.
// zszm-core-<version>: critical files, kept across reloads until the server publishes a new version.
// zszm-extra: everything else, emptied at the start of every page load.
const PREFIX = 'zszm-';
const EXTRA = `${PREFIX}extra`;
const coreName = version => `${PREFIX}core-${version}`;
let job = Promise.resolve();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

async function fill(cacheName, entries, isCurrent) {
  const cache = await caches.open(cacheName);
  const queue = entries.slice();
  const worker = async () => {
    while (queue.length && isCurrent()) {
      const { url } = queue.shift();
      if (await cache.match(url)) continue;
      try {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (response.ok && response.status === 200) await cache.put(url, response);
      } catch { /* offline or aborted: the page loads it from the network later */ }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

let currentVersion = '';
async function preload({ version, critical, extra }) {
  const isCurrent = () => currentVersion === version;
  const keep = coreName(version);
  // Every load empties the extra cache; a new server version also drops the older critical caches.
  for (const name of await caches.keys()) {
    if (name.startsWith(PREFIX) && name !== keep) await caches.delete(name);
  }
  await fill(keep, critical, isCurrent);
  await fill(EXTRA, extra, isCurrent);
}

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type !== 'zszm-preload' || typeof data.version !== 'string' || !Array.isArray(data.critical) || !Array.isArray(data.extra)) return;
  currentVersion = data.version; // a newer request stops the one still filling
  job = job.then(() => preload(data)).catch(() => {});
  event.waitUntil(job);
});

// <audio> asks for byte ranges; answer them from the cached file.
async function ranged(request, response) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  if (!match) return response;
  const body = await response.blob();
  const start = match[1] ? Number(match[1]) : Math.max(0, body.size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), body.size - 1) : body.size - 1;
  if (start >= body.size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${body.size}` } });
  const headers = new Headers(response.headers);
  headers.set('Content-Range', `bytes ${start}-${end}/${body.size}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(body.slice(start, end + 1), { status: 206, headers });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.includes('/assets/')) return;
  event.respondWith((async () => {
    const cached = await caches.match(url.pathname);
    if (!cached) return fetch(request);
    return request.headers.has('range') ? ranged(request, cached) : cached;
  })().catch(() => fetch(request)));
});
