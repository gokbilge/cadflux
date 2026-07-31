import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cadfluxRunnerManualChunks } from '../vite-config/index'
import { defineConfig } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: resolve(__dirname, 'runner'),
  base: './',
  resolve: {
    alias: {
      '@cadflux/core': resolve(__dirname, '../core/src/index.ts'),
      '@mlightcad/cad-svg-plugin/renderer': resolve(
        __dirname,
        '../cad-svg-plugin/src/AcSvgRenderer.ts'
      ),
      '@mlightcad/cad-simple-viewer': resolve(
        __dirname,
        '../cad-simple-viewer/src/index.ts'
      ),
      '@mlightcad/cad-svg-plugin': resolve(
        __dirname,
        '../cad-svg-plugin/src/index.ts'
      ),
      '@mlightcad/three-renderer': resolve(
        __dirname,
        '../three-renderer/src/index.ts'
      )
    }
  },
  build: {
    outDir: resolve(__dirname, 'dist-runner'),
    emptyOutDir: true,
    minify: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: cadfluxRunnerManualChunks
      }
    }
  }
})
