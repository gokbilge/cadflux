// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { resolve } from 'node:path'

import type { AliasOptions, LibraryFormats } from 'vite'
import type { ManualChunksOption, OutputOptions } from 'rollup'

export function createCadFluxWebAliases(repoRoot: string): AliasOptions {
  return [
    {
      find: /^(\.\.\/)+app$/,
      replacement: resolve(
        repoRoot,
        'packages/renderer-webgl/src/cadflux-app/index.ts'
      )
    },
    {
      find: /^(\.\.\/)+i18n$/,
      replacement: resolve(
        repoRoot,
        'packages/renderer-webgl/src/cadflux-i18n/index.ts'
      )
    },
    {
      find: /^(\.\.\/)+i18n\/AcApI18n$/,
      replacement: resolve(
        repoRoot,
        'packages/renderer-webgl/src/cadflux-i18n/AcApI18n.ts'
      )
    },
    {
      find: './AcEdCommandLine',
      replacement: resolve(
        repoRoot,
        'packages/renderer-webgl/src/cadflux-editor/AcEdCommandLine.ts'
      )
    },
    {
      find: '../ui/AcEdCommandLine',
      replacement: resolve(
        repoRoot,
        'packages/renderer-webgl/src/cadflux-editor/AcEdCommandLine.ts'
      )
    },
    {
      find: './AcEdViewKeyHandler',
      replacement: resolve(
        repoRoot,
        'packages/renderer-webgl/src/cadflux-editor/AcEdViewKeyHandler.ts'
      )
    },
    {
      find: '../editor/input/ui/AcEdMTextEditor',
      replacement: resolve(
        repoRoot,
        'packages/renderer-webgl/src/cadflux-editor/AcEdMTextEditor.ts'
      )
    },
    {
      find: '../input/ui/AcEdMTextEditor',
      replacement: resolve(
        repoRoot,
        'packages/renderer-webgl/src/cadflux-editor/AcEdMTextEditor.ts'
      )
    },
    {
      find: '../input/AcEditor',
      replacement: resolve(
        repoRoot,
        'packages/renderer-webgl/src/cadflux-editor/AcEditor.ts'
      )
    },
    {
      find: '../input/AcEdOsnapResolver',
      replacement: resolve(
        repoRoot,
        'packages/renderer-webgl/src/cadflux-editor/AcEdOsnapResolver.ts'
      )
    },
    {
      find: '../editor/grip/AcEdGripManager',
      replacement: resolve(
        repoRoot,
        'packages/renderer-webgl/src/cadflux-editor/AcEdGripManager.ts'
      )
    },
    {
      find: '@cadflux/batch-engine',
      replacement: resolve(repoRoot, 'packages/batch-engine/src/index.ts')
    },
    {
      find: '@cadflux/config',
      replacement: resolve(repoRoot, 'packages/config/src/index.ts')
    },
    {
      find: '@cadflux/core',
      replacement: resolve(repoRoot, 'packages/core/src/index.ts')
    },
    {
      find: '@cadflux/drawing-model',
      replacement: resolve(repoRoot, 'packages/drawing-model/src/index.ts')
    },
    {
      find: '@cadflux/file-ingest',
      replacement: resolve(repoRoot, 'packages/file-ingest/src/index.ts')
    },
    {
      find: '@cadflux/presets',
      replacement: resolve(repoRoot, 'packages/presets/src/index.ts')
    },
    {
      find: '@cadflux/renderer-webgl',
      replacement: resolve(repoRoot, 'packages/renderer-webgl/src/index.ts')
    },
    {
      find: '@mlightcad/cad-pdf-plugin/register',
      replacement: resolve(repoRoot, 'packages/cad-pdf-plugin/src/register.ts')
    },
    {
      find: '@mlightcad/cad-pdf-plugin/convertor',
      replacement: resolve(
        repoRoot,
        'packages/cad-pdf-plugin/src/AcApPdfConvertor.ts'
      )
    },
    {
      find: '@mlightcad/data-model',
      replacement: resolve(
        repoRoot,
        'packages/cad-simple-viewer/node_modules/@mlightcad/data-model/lib/index.js'
      )
    },
    {
      find: '@mlightcad/libredwg-converter',
      replacement: resolve(
        repoRoot,
        'packages/cad-simple-viewer/node_modules/@mlightcad/libredwg-converter/lib/index.js'
      )
    },
    {
      find: '@mlightcad/mtext-renderer',
      replacement: resolve(
        repoRoot,
        'packages/cad-simple-viewer/node_modules/@mlightcad/mtext-renderer/dist/index.js'
      )
    },
    {
      find: '@mlightcad/cad-pdf-plugin',
      replacement: resolve(repoRoot, 'packages/cad-pdf-plugin/src/index.ts')
    },
    {
      find: '@mlightcad/cad-simple-viewer',
      replacement: resolve(repoRoot, 'packages/cad-simple-viewer/src/index.ts')
    },
    {
      find: '@mlightcad/cad-svg-plugin/register',
      replacement: resolve(repoRoot, 'packages/cad-svg-plugin/src/register.ts')
    },
    {
      find: '@mlightcad/cad-svg-plugin/convertor',
      replacement: resolve(
        repoRoot,
        'packages/cad-svg-plugin/src/AcApSvgConvertor.ts'
      )
    },
    {
      find: '@mlightcad/cad-svg-plugin',
      replacement: resolve(repoRoot, 'packages/cad-svg-plugin/src/index.ts')
    },
    {
      find: '@mlightcad/three-renderer',
      replacement: resolve(repoRoot, 'packages/three-renderer/src/index.ts')
    }
  ]
}

export function cadfluxWebManualChunks(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, '/')

  if (normalizedId.includes('node_modules/vue')) return 'vendor-vue'
  if (normalizedId.includes('/@mlightcad/common/')) return 'cad-runtime-common'
  if (normalizedId.includes('/@mlightcad/geometry-engine/')) return 'cad-runtime-geometry'
  if (normalizedId.includes('/@mlightcad/graphic-interface/')) return 'cad-runtime-graphics'
  if (normalizedId.includes('/@mlightcad/data-model/lib/base/')) return 'cad-runtime-model-core'
  if (normalizedId.includes('/@mlightcad/data-model/lib/entity/')) return 'cad-runtime-entity'

  if (
    normalizedId.includes('/@mlightcad/data-model/lib/converter/') ||
    normalizedId.includes('/@mlightcad/data-model/lib/database/') ||
    normalizedId.includes('/@mlightcad/data-model/lib/dxf/') ||
    normalizedId.includes('/@mlightcad/data-model/lib/misc/') ||
    normalizedId.includes('/@mlightcad/data-model/lib/object/') ||
    normalizedId.includes('/@mlightcad/data-model/lib/ly/') ||
    normalizedId.includes('/@mlightcad/data-model/lib/index.js')
  ) {
    return 'cad-runtime-model-core'
  }

  if (normalizedId.includes('packages/core/src/browserExport')) return 'cad-export-utils'
  if (normalizedId.includes('packages/cad-svg-plugin/src/AcSvgFontMap')) return 'cad-export-fonts'

  if (
    normalizedId.includes('packages/cad-svg-plugin/src/AcSvgMText') ||
    normalizedId.includes('packages/cad-svg-plugin/src/AcSvgMTextUtil')
  ) {
    return 'cad-export-mtext'
  }

  if (normalizedId.includes('node_modules/.pnpm/@mlightcad+mtext-parser')) return 'cad-export-mtext-parser'

  if (
    normalizedId.includes('node_modules/.pnpm/@mlightcad+mtext-renderer') ||
    normalizedId.includes('@mlightcad/mtext-renderer/dist/index.js')
  ) {
    return 'cad-export-mtext-renderer'
  }

  if (
    normalizedId.includes('packages/cad-svg-plugin/src/AcSvgShape') ||
    normalizedId.includes('packages/cad-svg-plugin/src/AcSvgShapeUtil') ||
    normalizedId.includes('packages/cad-svg-plugin/src/CadFluxBrowserExport') ||
    normalizedId.includes('packages/cad-pdf-plugin/src/CadFluxBrowserExport')
  ) {
    return 'cad-export-shape'
  }

  if (
    normalizedId.includes('packages/cad-svg-plugin/src/AcSvgImage') ||
    normalizedId.includes('packages/cad-svg-plugin/src/AcSvgExportUtil') ||
    normalizedId.includes('node_modules/dompurify')
  ) {
    return 'cad-export-image'
  }

  if (
    normalizedId.includes('packages/cad-svg-plugin/src/AcSvgArea') ||
    normalizedId.includes('packages/cad-svg-plugin/src/AcSvgCircArc') ||
    normalizedId.includes('packages/cad-svg-plugin/src/AcSvgEllipticalArc') ||
    normalizedId.includes('packages/cad-svg-plugin/src/AcSvgGroup') ||
    normalizedId.includes('packages/cad-svg-plugin/src/AcSvgLine') ||
    normalizedId.includes('packages/cad-svg-plugin/src/AcSvgLineSegments') ||
    normalizedId.includes('packages/cad-svg-plugin/src/AcSvgPoint') ||
    normalizedId.includes('packages/cad-svg-plugin/src/AcSvgRenderer')
  ) {
    return 'cad-export-geometry'
  }

  if (
    normalizedId.includes('packages/cad-pdf-plugin/src/AcApPdfConvertor') ||
    normalizedId.includes('node_modules/.pnpm/jspdf') ||
    normalizedId.includes('node_modules/.pnpm/svg2pdf.js')
  ) {
    return 'cad-export-pdf'
  }

  if (normalizedId.includes('packages/cad-svg-plugin/src/AcSvg')) return 'cad-export-core'
  return undefined
}

export function cadfluxRunnerManualChunks(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, '/')

  if (normalizedId.includes('node_modules/vue')) return 'vendor-vue'
  if (normalizedId.includes('/node_modules/.pnpm/three@') || normalizedId.includes('/node_modules/three/')) return 'vendor-three'
  if (normalizedId.includes('/node_modules/.pnpm/html2canvas@')) return 'vendor-html2canvas'
  if (normalizedId.includes('/node_modules/.pnpm/jspdf@') || normalizedId.includes('/node_modules/.pnpm/svg2pdf.js@')) return 'vendor-pdf'

  if (
    normalizedId.includes('/node_modules/.pnpm/@mlightcad+mtext-parser') ||
    normalizedId.includes('/node_modules/.pnpm/@mlightcad+mtext-renderer') ||
    normalizedId.includes('@mlightcad/mtext-renderer/dist/index.js')
  ) {
    return 'cad-runtime-mtext'
  }

  if (
    normalizedId.includes('/packages/cad-simple-viewer/') ||
    normalizedId.includes('/packages/three-renderer/')
  ) {
    return 'cad-runtime-viewer'
  }

  if (
    normalizedId.includes('/packages/cad-svg-plugin/') ||
    normalizedId.includes('/packages/cad-pdf-plugin/')
  ) {
    return 'cad-runtime-export'
  }

  if (
    normalizedId.includes('/@mlightcad/common/') ||
    normalizedId.includes('/@mlightcad/geometry-engine/') ||
    normalizedId.includes('/@mlightcad/graphic-interface/') ||
    normalizedId.includes('/@mlightcad/data-model/')
  ) {
    return 'cad-runtime-model'
  }

  return undefined
}

export const PLUGIN_PACKAGE_IDS = [
  'cad-pdf-plugin',
  'cad-svg-plugin'
] as const

export const VIEWER_PACKAGE_IDS = [
  'cad-simple-viewer',
  'three-renderer'
] as const

function isPluginRegisterModule(id: string, pluginId: string): boolean {
  return (
    id.includes(`${pluginId}/register`) ||
    id.includes(`${pluginId}\\register`) ||
    id.includes(`${pluginId}/dist/register.`) ||
    id.includes(`${pluginId}\\dist\\register.`) ||
    id.includes(`${pluginId}-register`)
  )
}

function matchMonorepoPackage(id: string, packageId: string): boolean {
  const normalized = id.replace(/\\/g, '/')
  return (
    normalized.includes(`/packages/${packageId}/`) ||
    normalized.includes(`/node_modules/@mlightcad/${packageId}/`) ||
    normalized.includes(`@mlightcad/${packageId}/`) ||
    normalized.includes(`@mlightcad/${packageId}`)
  )
}

export const exampleManualChunks: ManualChunksOption = (id: string) => {
  for (const pluginId of PLUGIN_PACKAGE_IDS) {
    if (!matchMonorepoPackage(id, pluginId)) continue
    if (isPluginRegisterModule(id, pluginId)) return undefined
    return pluginId
  }

  for (const packageId of VIEWER_PACKAGE_IDS) {
    if (matchMonorepoPackage(id, packageId)) return packageId
  }
}

export const exampleRollupOutput: OutputOptions = {
  manualChunks: exampleManualChunks,
  chunkFileNames: 'assets/[name]-[hash].js',
  entryFileNames: 'assets/[name]-[hash].js',
  assetFileNames: 'assets/[name]-[hash][extname]'
}

export function createLibEntryFileName(
  packageId: string,
  format: string,
  entryName = 'index'
): string {
  const base =
    entryName === 'index'
      ? packageId
      : entryName === 'register'
        ? `${packageId}-register`
        : `${packageId}-${entryName}`
  return format === 'es' ? `${base}.js` : `${base}.umd.cjs`
}

export function createLibChunkFileName(packageId: string): string {
  return `${packageId}-[name]-[hash].js`
}

export function createLibManualChunks(packageId: string): ManualChunksOption {
  return (id: string) => {
    if (/[\\/]register\.ts$/.test(id)) {
      return `${packageId}-register`
    }
    return packageId
  }
}

export function createLibRollupOutput(packageId: string): OutputOptions {
  return {
    manualChunks: createLibManualChunks(packageId),
    chunkFileNames: createLibChunkFileName(packageId)
  }
}

export function cadViewerLibraryFormats(): LibraryFormats[] {
  return ['es']
}
