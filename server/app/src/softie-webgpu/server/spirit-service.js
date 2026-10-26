import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { createSpiritMultiplayer, SPIRIT_ROOM_WS } from './spirit-multiplayer.js';
import { createSpiritSettingsMiddleware } from './spirit-settings.js';

const paths = createRequire(import.meta.url)('../../../../../services/platform/runtime-paths.cjs');
paths.requireReady('spirit');
const settings = createSpiritSettingsMiddleware();
const multiplayer = createSpiritMultiplayer();
const server = createServer((request, response) => {
  if (request.url === '/healthz') {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ ok: true, service: 'spirit' }));
    return;
  }
  settings(request, response, () => { response.writeHead(404); response.end(); });
});
server.on('upgrade', (request, socket, head) => {
  if (request.url?.split('?')[0] !== SPIRIT_ROOM_WS) {
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    return;
  }
  multiplayer.upgrade(request, socket, head);
});
server.once('close', () => multiplayer.close());
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => {
  console.log(`[spirit] ${JSON.stringify(server.address())}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  multiplayer.close(); server.close();
});
