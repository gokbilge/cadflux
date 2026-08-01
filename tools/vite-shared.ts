// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { resolve } from 'node:path'

import type { AliasOptions } from 'vite'
import type { ManualChunksOption } from 'rollup'

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
      find: '@mlightcad/cad-simple-viewer',
      replacement: resolve(repoRoot, 'packages/cad-simple-viewer/src/index.ts')
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

  if (
    normalizedId.includes('node_modules/.pnpm/@mlightcad+mtext-renderer') ||
    normalizedId.includes('@mlightcad/mtext-renderer/dist/index.js')
  ) {
    return 'cad-export-mtext-renderer'
  }
  return undefined
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
