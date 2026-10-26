const siteDomains = createRequire(import.meta.url)('../../../packages/site-domains/index.js');
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'
import glsl from 'vite-plugin-glsl'
import { externalGallery } from './gallery-plugin.js'
import { createRequire } from 'node:module'
const runtimePaths = createRequire(import.meta.url)('../../../server/runtime-paths.cjs')

export default defineConfig({
  server: { allowedHosts: siteDomains.allowedHosts },
  base: './',
  plugins: [
    glsl(),
    externalGallery(
      process.env.GALLERY_DIR || path.join(runtimePaths.assetsRoot, 'source/罗小黑战记数据库/罗小黑节气贺图（gallery素材）')
    ),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
