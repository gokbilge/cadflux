// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { resolve } from 'node:path'

import type { AliasOptions } from 'vite'

export function createCadFluxWebAliases(repoRoot: string): AliasOptions {
  return [
    {
      find: '@cadflux/batch-engine',
      replacement: resolve(repoRoot, 'packages/batch-engine/src/index.ts')
    },
    {
      find: '@cadflux/cad-import',
      replacement: resolve(repoRoot, 'packages/cad-import/src/index.ts')
    },
    {
      find: '@cadflux/config',
      replacement: resolve(repoRoot, 'packages/config/src/index.ts')
    },
    {
      find: '@cadflux/contracts',
      replacement: resolve(repoRoot, 'packages/contracts/src/index.ts')
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
    }
  ]
}

export function cadfluxWebManualChunks(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, '/')
  if (normalizedId.includes('node_modules/vue')) {
    return 'vendor-vue'
  }
  return undefined
}
