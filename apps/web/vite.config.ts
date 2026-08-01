import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { cadfluxWebManualChunks, createCadFluxWebAliases } from '../../tools/vite-shared'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  resolve: {
    alias: createCadFluxWebAliases(resolve(__dirname, '..', '..'))
  },
  build: {
    sourcemap: mode === 'analyze',
    rollupOptions: {
      output: {
        manualChunks: cadfluxWebManualChunks
      }
    }
  }
}))
