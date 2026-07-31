import { resolve } from 'path'
import peerDepsExternal from 'rollup-plugin-peer-deps-external'
import { defineConfig, PluginOption } from 'vite'
import {
  createLibEntryFileName,
  createLibRollupOutput
} from '../vite-config/pluginRollupOutput'

const packageName = '@mlightcad/cad-svg-plugin'
const pluginId = 'cad-svg-plugin'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        command: resolve(__dirname, 'src/AcApConvertToSvgCmd.ts'),
        convertor: resolve(__dirname, 'src/AcApSvgConvertor.ts'),
        factory: resolve(__dirname, 'src/createSvgPlugin.ts'),
        plugin: resolve(__dirname, 'src/AcApSvgPlugin.ts'),
        register: resolve(__dirname, 'src/register.ts'),
        renderer: resolve(__dirname, 'src/AcSvgRenderer.ts')
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
