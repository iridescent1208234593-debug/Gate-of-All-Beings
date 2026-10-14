import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import glsl from 'vite-plugin-glsl'
import { externalGallery } from './gallery-plugin.js'

export default defineConfig({
  base: './',
  plugins: [
    glsl(),
    externalGallery(
      process.env.GALLERY_DIR ||
        fileURLToPath(
          new URL('../../../assets/罗小黑战记数据库/罗小黑节气贺图（gallery素材）', import.meta.url),
        )
    ),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
