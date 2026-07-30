import vue from '@vitejs/plugin-vue'
import { cadfluxWebManualChunks, createCadFluxWebAliases } from '../../packages/vite-config/index'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: createCadFluxWebAliases(__dirname)
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: cadfluxWebManualChunks
      }
    }
  }
})
