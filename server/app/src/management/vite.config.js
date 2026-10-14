import { defineConfig } from 'vite';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: '.',
  base: './',
  plugins: [{
    name: 'redirect-legacy-lingjing-host',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const host = String(req.headers.host || '').split(':')[0].toLowerCase();
        if (host === 'lingjing.iridescently.xyz' && !req.url?.startsWith('/api/')) {
          res.writeHead(308, { Location: 'https://zszm.iridescently.xyz/#management' });
          res.end();
          return;
        }
        next();
      });
    },
  }],
  server: {
    fs: { allow: ['.', '../../../../shared/shared-types', '../../../../shared/shared-ui'].map(p => realpathSync(fileURLToPath(new URL(p, import.meta.url)))) },
    allowedHosts: ['.iridescently.xyz', '.trycloudflare.com'],
      port: 5179,
    open: false,
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
