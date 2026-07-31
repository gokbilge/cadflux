import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@mlightcad/three-renderer': resolve(
        __dirname,
        '../three-renderer/dist/index.js'
      )
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/AcExHtmlViewerRuntime.ts',
      name: 'AcExHtmlViewer',
      formats: ['iife'],
      fileName: () => 'viewer-runtime.iife.js'
    },
    minify: true,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
})
