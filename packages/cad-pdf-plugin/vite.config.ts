import { resolve } from 'path'
import peerDepsExternal from 'rollup-plugin-peer-deps-external'
import { defineConfig, PluginOption } from 'vite'
import {
  createLibEntryFileName,
  createLibRollupOutput
} from '../../tools/vite-shared'

const packageName = '@mlightcad/cad-pdf-plugin'
const pluginId = 'cad-pdf-plugin'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        command: resolve(__dirname, 'src/AcApConvertToPdfCmd.ts'),
        convertor: resolve(__dirname, 'src/AcApPdfConvertor.ts'),
        factory: resolve(__dirname, 'src/createPdfPlugin.ts'),
        'import-command': resolve(__dirname, 'src/AcApImportPdfCmd.ts'),
        'import-convertor': resolve(__dirname, 'src/AcApPdfImportConvertor.ts'),
        plugin: resolve(__dirname, 'src/AcApPdfPlugin.ts'),
        register: resolve(__dirname, 'src/register.ts')
      },
      name: pluginId,
      fileName: (format, entryName) =>
        createLibEntryFileName(pluginId, format, entryName)
    },
    minify: true,
    rollupOptions: {
      external: [packageName],
      output: createLibRollupOutput(pluginId)
    }
  },
  plugins: [peerDepsExternal() as PluginOption]
})
