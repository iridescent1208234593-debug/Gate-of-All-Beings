import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {realpathSync} from 'node:fs';
import {defineConfig, type Plugin} from 'vite';
import {cardBalancePlugin} from './server/cardBalanceServer';

// index.html 在生产里引用已发布的会馆设计系统（稳定发布路径）；开发时改读工作区源码，改 design-system.css 立即生效。
const designSystemDir = realpathSync(path.resolve(__dirname, '../../../../portal/huiguan/design-system'));
function localDesignSystem(): Plugin {
  return {
    name: 'zszm-local-design-system',
    apply: 'serve',
    transformIndexHtml: html => html.replace(/https:\/\/huiguan\.iridescently\.xyz\/design-system\/(design-system\.css)(\?[^"']*)?/g,
      (_, file: string) => `/@fs/${designSystemDir.replace(/\\/g, '/')}/${file}`),
  };
}

export default defineConfig(() => {
  return {
    plugins: [cardBalancePlugin(path.resolve(__dirname,'data/card-balance')), localDesignSystem(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      fs: { allow: [__dirname, '../../../../shared/shared-types', '../../../../shared/shared-data', '../../../../shared/shared-ui'].map(p => realpathSync(path.resolve(__dirname,p))).concat(designSystemDir) },
      allowedHosts: ['.iridescently.xyz', '.trycloudflare.com'],
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/app': 'http://127.0.0.1:8080',
        '/assets': 'http://127.0.0.1:8080',
        '/playtest': 'http://127.0.0.1:8080',
        '/design-system': 'http://127.0.0.1:8080',
        '/shared': 'http://127.0.0.1:8080',
        '/api/progress': 'http://127.0.0.1:8080',
        '/api': {
          target: process.env.ZSZM_DEV_API_TARGET || 'http://127.0.0.1:5174',
          changeOrigin: true,
        },
      },
    },
  };
});
