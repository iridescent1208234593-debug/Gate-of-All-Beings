import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {createCardBalanceApi} from './cardBalanceServer';

const paths = createRequire(import.meta.url)('../../../services/platform/runtime-paths.cjs');
paths.requireReady('cards');
const api = createCardBalanceApi(paths.dataPath('cards', 'card-balance'));
const server = createServer((request, response) => {
  if (request.url === '/healthz') {
    response.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
    response.end(JSON.stringify({ok: true, service: 'card-balance'}));
    return;
  }
  const prefix = '/api/card-balance';
  if (request.url === prefix || request.url?.startsWith(prefix + '/') || request.url?.startsWith(prefix + '?')) {
    request.url = request.url.slice(prefix.length) || '/';
    api(request, response);
    return;
  }
  response.writeHead(404); response.end();
});
server.listen(Number(process.env.PORT || 5178), '127.0.0.1', () => {
  console.log(`[card-balance] ${JSON.stringify(server.address())}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
