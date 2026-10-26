// Starts on the start screen: registers zszm-sw.js and hands it preload-manifest.json (written by the build),
// so the hall, onboarding, door scene and music are cached before the player gets there.
// The manifest is re-read whenever the page comes back into view; a new version clears the old caches.
type Entry = { url: string; size: number };
type Manifest = { version: string; critical: Entry[]; extra: Entry[] };
type Connection = { saveData?: boolean; effectiveType?: string };
const BASE = import.meta.env.BASE_URL;
// On a metered or slow connection the extra list skips large files (the onboarding fonts are several MB each).
const SLOW_EXTRA_LIMIT = 512 * 1024;
let started = false;

async function readManifest(): Promise<Manifest | null> {
  try {
    const response = await fetch(`${BASE}preload-manifest.json`, { cache: 'no-store' });
    // Without a published manifest the SPA fallback answers with index.html: no caching then.
    if (!response.ok || !(response.headers.get('content-type') || '').includes('json')) return null;
    const manifest = await response.json() as Manifest;
    return typeof manifest.version === 'string' && Array.isArray(manifest.critical) && Array.isArray(manifest.extra) ? manifest : null;
  } catch { return null; }
}

function extraFor(manifest: Manifest) {
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  const slow = !!connection && (connection.saveData || /(^|-)2g|3g/.test(connection.effectiveType || ''));
  return slow ? manifest.extra.filter(entry => entry.size <= SLOW_EXTRA_LIMIT) : manifest.extra;
}

export function startPreload() {
  if (started || !import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  started = true;
  void (async () => {
    let manifest = await readManifest();
    if (!manifest) return;
    try {
      // The game page is the site root on zszm.iridescently.xyz, which serves this module's files at /, so the
      // worker must be registered there to see the page's requests. Other hosts don't serve it and reject this.
      const registration = await navigator.serviceWorker.register('/zszm-sw.js', { scope: '/' });
      const worker = () => registration.active || registration.waiting || registration.installing;
      await navigator.serviceWorker.ready;
      const send = (next: Manifest) => worker()?.postMessage({ type: 'zszm-preload', version: next.version, critical: next.critical, extra: extraFor(next) });
      send(manifest);
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState !== 'visible') return;
        const next = await readManifest();
        if (next && next.version !== manifest?.version) { manifest = next; send(next); }
      });
    } catch { /* caching is an optimisation; the page works without it */ }
  })();
}
