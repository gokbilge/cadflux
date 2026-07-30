import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@mlightcad/cad-svg-plugin/register': resolve(
        __dirname,
        '../../packages/cad-svg-plugin/src/register.ts'
      ),
      '@mlightcad/cad-pdf-plugin/register': resolve(
        __dirname,
        '../../packages/cad-pdf-plugin/src/register.ts'
      ),
      '@mlightcad/cad-html-plugin/register': resolve(
        __dirname,
        './src/shims/cad-html-plugin-register.ts'
      ),
      '@cadflux/file-ingest': resolve(
        __dirname,
        '../../packages/file-ingest/src/index.ts'
      ),
      '@cadflux/config': resolve(
        __dirname,
        '../../packages/config/src/index.ts'
      ),
      '@cadflux/drawing-model': resolve(
        __dirname,
        '../../packages/drawing-model/src/index.ts'
      ),
      '@cadflux/presets': resolve(
        __dirname,
        '../../packages/presets/src/index.ts'
      ),
      '@cadflux/renderer-webgl': resolve(
        __dirname,
        '../../packages/renderer-webgl/src/index.ts'
      ),
      '@mlightcad/cad-agent-plugin/register': resolve(
        __dirname,
        './src/shims/cad-agent-plugin-register.ts'
      ),
      '@mlightcad/cad-agent-plugin/style.css': resolve(
        __dirname,
        './src/shims/cad-agent-plugin.css'
      ),
      '@mlightcad/cad-agent-plugin': resolve(
        __dirname,
        './src/shims/cad-agent-plugin.ts'
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
      '@mlightcad/cad-pdf-plugin': resolve(
        __dirname,
        '../../packages/cad-pdf-plugin/src/index.ts'
      ),
      '@mlightcad/cad-html-plugin': resolve(
        __dirname,
        './src/shims/cad-html-plugin.ts'
      ),
      '@mlightcad/three-renderer': resolve(
        __dirname,
        '../../packages/three-renderer/src/index.ts'
      )
    }
  }
  ,
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/vue') ||
            id.includes('node_modules/vue-i18n')
          ) {
            return 'vendor-vue'
          }
          if (
            id.includes('packages/cad-pdf-plugin') ||
            id.includes('packages/cad-svg-plugin') ||
            id.includes('node_modules/jspdf') ||
            id.includes('node_modules/svg2pdf.js')
          ) {
            return 'cad-export'
          }
          return undefined
        }
      }
    }
  }
})
