// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { resolve } from 'node:path'

import type { AliasOptions } from 'vite'

export function createCadFluxWebAliases(appRoot: string): AliasOptions {
  return {
    '@cadflux/config': resolve(appRoot, '../../packages/config/src/index.ts'),
    '@cadflux/drawing-model': resolve(
      appRoot,
      '../../packages/drawing-model/src/index.ts'
    ),
    '@cadflux/file-ingest': resolve(
      appRoot,
      '../../packages/file-ingest/src/index.ts'
    ),
    '@cadflux/presets': resolve(appRoot, '../../packages/presets/src/index.ts'),
    '@cadflux/renderer-webgl': resolve(
      appRoot,
      '../../packages/renderer-webgl/src/index.ts'
    ),
    '@mlightcad/cad-agent-plugin/register': resolve(
      appRoot,
      './src/shims/cad-agent-plugin-register.ts'
    ),
    '@mlightcad/cad-agent-plugin/style.css': resolve(
      appRoot,
      './src/shims/cad-agent-plugin.css'
    ),
    '@mlightcad/cad-agent-plugin': resolve(
      appRoot,
      './src/shims/cad-agent-plugin.ts'
    ),
    '@mlightcad/cad-html-plugin/register': resolve(
      appRoot,
      './src/shims/cad-html-plugin-register.ts'
    ),
    '@mlightcad/cad-html-plugin': resolve(
      appRoot,
      './src/shims/cad-html-plugin.ts'
    ),
    '@mlightcad/cad-pdf-plugin/register': resolve(
      appRoot,
      '../../packages/cad-pdf-plugin/src/register.ts'
    ),
    '@mlightcad/data-model': resolve(
      appRoot,
      '../../packages/cad-simple-viewer/node_modules/@mlightcad/data-model/lib/index.js'
    ),
    '@mlightcad/cad-pdf-plugin': resolve(
      appRoot,
      '../../packages/cad-pdf-plugin/src/index.ts'
    ),
    '@mlightcad/cad-simple-viewer': resolve(
      appRoot,
      '../../packages/cad-simple-viewer/src/index.ts'
    ),
    '@mlightcad/cad-svg-plugin/register': resolve(
      appRoot,
      '../../packages/cad-svg-plugin/src/register.ts'
    ),
    '@mlightcad/cad-svg-plugin': resolve(
      appRoot,
      '../../packages/cad-svg-plugin/src/index.ts'
    ),
    '@mlightcad/three-renderer': resolve(
      appRoot,
      '../../packages/three-renderer/src/index.ts'
    )
  }
}

export function cadfluxWebManualChunks(id: string): string | undefined {
  if (id.includes('node_modules/vue')) {
    return 'vendor-vue'
  }

  if (
    id.includes('packages/cad-svg-plugin') ||
    id.includes('packages/renderer-svg') ||
    id.includes('node_modules/dompurify')
  ) {
    return 'cad-export-svg'
  }

  if (
    id.includes('packages/cad-pdf-plugin') ||
    id.includes('packages/renderer-pdf') ||
    id.includes('node_modules/jspdf') ||
    id.includes('node_modules/svg2pdf.js')
  ) {
    return 'cad-export-pdf'
  }

  return undefined
}
