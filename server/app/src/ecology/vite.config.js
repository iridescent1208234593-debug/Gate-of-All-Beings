const siteDomains = createRequire(import.meta.url)('../../../../packages/site-domains/index.js');
import { createRequire } from 'node:module';
import { defineConfig } from 'vite';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 说明：项目根目录下可能残留历史验证用的无头浏览器 profile 目录（.edge_*）。
// 这些目录内的部分文件被浏览器进程独占锁定，文件监听器触碰时会抛 EBUSY 并中断 dev server，
// 因此在 watch 层面显式忽略（只影响监听范围，不影响源码与 HMR）。
export default defineConfig({
  base: "./",
  server: {
    fs: { allow: ['.', '../../../../packages', '../../../../packages/shared-types', '../../../../packages/shared-ui'].map(p => realpathSync(fileURLToPath(new URL(p, import.meta.url)))) },
    allowedHosts: siteDomains.allowedHosts,
    watch: {
      ignored: ['**/.edge_*/**', '**/dist/**'],
    },
  },
});
