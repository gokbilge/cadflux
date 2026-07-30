import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@cadflux/file-ingest': resolve(
        __dirname,
        '../../packages/file-ingest/src/index.ts'
      ),
      '@cadflux/presets': resolve(
        __dirname,
        '../../packages/presets/src/index.ts'
      ),
      '@mlightcad/cad-viewer': resolve(
        __dirname,
        '../../packages/cad-viewer/src/index.ts'
      ),
      '@mlightcad/cad-simple-viewer': resolve(
        __dirname,
        '../../packages/cad-simple-viewer/src/index.ts'
      ),
      '@mlightcad/cad-svg-plugin': resolve(
        __dirname,
        '../../packages/cad-svg-plugin/src/index.ts'
      ),
      '@mlightcad/cad-svg-plugin/register': resolve(
        __dirname,
        '../../packages/cad-svg-plugin/src/register.ts'
      ),
      '@mlightcad/cad-pdf-plugin': resolve(
        __dirname,
        '../../packages/cad-pdf-plugin/src/index.ts'
      ),
      '@mlightcad/cad-pdf-plugin/register': resolve(
        __dirname,
        '../../packages/cad-pdf-plugin/src/register.ts'
      ),
      '@mlightcad/cad-html-plugin': resolve(
        __dirname,
        '../../packages/cad-html-plugin/src/index.ts'
      ),
      '@mlightcad/cad-html-plugin/register': resolve(
        __dirname,
        '../../packages/cad-html-plugin/src/register.ts'
      ),
      '@mlightcad/three-renderer': resolve(
        __dirname,
        '../../packages/three-renderer/src/index.ts'
      )
    }
  }
})
