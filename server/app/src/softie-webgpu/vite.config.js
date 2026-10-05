import { defineConfig } from 'vite';
import { spiritSettingsPlugin } from './server/spirit-settings.js';
import { spiritMultiplayerPlugin } from './server/spirit-multiplayer.js';

export default defineConfig({
  plugins: [spiritSettingsPlugin(), spiritMultiplayerPlugin()],
  base: '/',
  build: { target: 'esnext', chunkSizeWarningLimit: 800 },
});
