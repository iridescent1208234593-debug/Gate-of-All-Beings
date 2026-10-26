const siteDomains = createRequire(import.meta.url)('../../packages/site-domains/index.js');
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {realpathSync} from 'node:fs';
import {defineConfig, type Plugin} from 'vite';
import {cardBalancePlugin} from './server/cardBalanceServer';
import {preloadManifestPlugin} from './server/preloadManifest';
import {createRequire} from 'node:module';
const runtimePaths = createRequire(import.meta.url)('../../services/platform/runtime-paths.cjs');

// index.html 在生产里引用已发布的会馆设计系统（稳定发布路径）；开发时改读工作区源码，改 design-system.css 立即生效。
const designSystemDir = realpathSync(path.resolve(__dirname, '../huiguan/design-system'));
function localDesignSystem(): Plugin {
  return {
    name: 'zszm-local-design-system',
    apply: 'serve',
    transformIndexHtml: html => html.replace(/\/design-system\/(design-system\.css)(\?[^"']*)?/g,
      (_, file: string) => `/@fs/${designSystemDir.replace(/\\/g, '/')}/${file}`),
  };
}

export default defineConfig(() => {
  return {
    plugins: [cardBalancePlugin(runtimePaths.dataPath('cards','card-balance')), localDesignSystem(), preloadManifestPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      fs: { allow: [__dirname, '../../packages', '../../packages/shared-types', '../../packages/shared-data', '../../packages/shared-ui'].map(p => realpathSync(path.resolve(__dirname,p))).concat(designSystemDir) },
      allowedHosts: siteDomains.allowedHosts,
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
