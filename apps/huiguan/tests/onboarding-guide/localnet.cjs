// Route every https://*.iridescently.cn request to the local portal; block everything else external.
const http = require('http');
const PORT = +process.env.PORTAL_PORT || 18099;
const ROOT = 'iridescently.cn';
function forward(route) {
  const req = route.request(); const u = new URL(req.url());
  if (!(u.hostname === ROOT || u.hostname.endsWith('.' + ROOT))) {
    if (u.hostname === '127.0.0.1' || u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    return route.abort('blockedbyclient');           // no third-party calls (analytics, CDNs)
  }
  const body = req.postDataBuffer();
  const headers = { ...req.headers(), host: u.hostname, 'x-forwarded-proto': 'https' };
  if (body) headers['content-length'] = String(body.length);
  return new Promise(resolve => {
    const r = http.request({ host: '127.0.0.1', port: PORT, method: req.method(), path: u.pathname + u.search, headers }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => {
        const h = {}; for (const [k, v] of Object.entries(res.headers)) h[k] = Array.isArray(v) ? v.join(k === 'set-cookie' ? '\n' : ', ') : v;
        route.fulfill({ status: res.statusCode, headers: h, body: Buffer.concat(chunks) }).then(resolve, resolve);
      });
    });
    r.on('error', e => { route.abort('connectionfailed').then(resolve, resolve); });
    if (body) r.write(body); r.end();
  });
}
module.exports = async function useLocalNet(ctx) { await ctx.route('**/*', forward); };
module.exports.ROOT = ROOT;
