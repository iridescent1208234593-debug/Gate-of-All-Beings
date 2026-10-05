import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {realpathSync} from 'node:fs';
import {defineConfig} from 'vite';
import {cardBalancePlugin} from './server/cardBalanceServer';

export default defineConfig(() => {
  return {
    plugins: [cardBalancePlugin(path.resolve(__dirname,'data/card-balance')), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      fs: { allow: [__dirname, '../../../../shared/shared-types', '../../../../shared/shared-data', '../../../../shared/shared-ui'].map(p => realpathSync(path.resolve(__dirname,p))) },
      allowedHosts: ['.iridescently.xyz', '.trycloudflare.com'],
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:5174',
          changeOrigin: true,
        },
      },
    },
  };
});
