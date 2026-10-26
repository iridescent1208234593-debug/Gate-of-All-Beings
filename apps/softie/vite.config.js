const siteDomains = createRequire(import.meta.url)('../../packages/site-domains/index.js');
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';
import { spiritSettingsPlugin } from './server/spirit-settings.js';
import { spiritMultiplayerPlugin } from './server/spirit-multiplayer.js';

export default defineConfig({
  plugins: [spiritSettingsPlugin(), spiritMultiplayerPlugin()],
  server: { allowedHosts: siteDomains.allowedHosts },
  base: '/',
  build: { target: 'esnext', chunkSizeWarningLimit: 800 },
});
