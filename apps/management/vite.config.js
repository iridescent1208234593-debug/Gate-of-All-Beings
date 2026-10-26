const siteDomains = createRequire(import.meta.url)('../../packages/site-domains/index.js');
import { createRequire } from 'node:module';
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
        if (siteDomains.service(host) === 'lingjing' && !req.url?.startsWith('/api/')) {
          res.writeHead(308, { Location: siteDomains.url('zszm', '/#management', host) });
          res.end();
          return;
        }
        next();
      });
    },
  }],
  server: {
    fs: { allow: ['.', '../../packages', '../../packages/shared-types', '../../packages/shared-ui'].map(p => realpathSync(fileURLToPath(new URL(p, import.meta.url)))) },
    allowedHosts: siteDomains.allowedHosts,
      port: 5179,
    open: false,
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
