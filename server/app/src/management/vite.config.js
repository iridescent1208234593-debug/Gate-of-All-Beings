import { defineConfig } from 'vite';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: '.',
  base: './',
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
