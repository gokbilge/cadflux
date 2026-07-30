// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { resolve } from 'node:path'

import type { AliasOptions } from 'vite'

export function createCadFluxWebAliases(appRoot: string): AliasOptions {
  return [
    {
      find: /^(\.\.\/)+app$/,
      replacement: resolve(
        appRoot,
        '../../packages/renderer-webgl/src/cadflux-app/index.ts'
      )
    },
    {
      find: /^(\.\.\/)+i18n$/,
      replacement: resolve(
        appRoot,
        '../../packages/renderer-webgl/src/cadflux-i18n/index.ts'
      )
    },
    {
      find: /^(\.\.\/)+i18n\/AcApI18n$/,
      replacement: resolve(
        appRoot,
        '../../packages/renderer-webgl/src/cadflux-i18n/AcApI18n.ts'
      )
    },
    {
      find: './AcEdCommandLine',
      replacement: resolve(
        appRoot,
        '../../packages/renderer-webgl/src/cadflux-editor/AcEdCommandLine.ts'
      )
    },
    {
      find: '../ui/AcEdCommandLine',
      replacement: resolve(
        appRoot,
        '../../packages/renderer-webgl/src/cadflux-editor/AcEdCommandLine.ts'
      )
    },
    {
      find: './AcEdViewKeyHandler',
      replacement: resolve(
        appRoot,
        '../../packages/renderer-webgl/src/cadflux-editor/AcEdViewKeyHandler.ts'
      )
    },
    {
      find: '../editor/grip/AcEdGripManager',
      replacement: resolve(
        appRoot,
        '../../packages/renderer-webgl/src/cadflux-editor/AcEdGripManager.ts'
      )
    },
    {
      find: '@cadflux/config',
      replacement: resolve(appRoot, '../../packages/config/src/index.ts')
    },
    {
      find: '@cadflux/drawing-model',
      replacement: resolve(appRoot, '../../packages/drawing-model/src/index.ts')
    },
    {
      find: '@cadflux/file-ingest',
      replacement: resolve(appRoot, '../../packages/file-ingest/src/index.ts')
    },
    {
      find: '@cadflux/presets',
      replacement: resolve(appRoot, '../../packages/presets/src/index.ts')
    },
    {
      find: '@cadflux/renderer-webgl',
      replacement: resolve(appRoot, '../../packages/renderer-webgl/src/index.ts')
    },
    {
      find: '@mlightcad/cad-agent-plugin/register',
      replacement: resolve(appRoot, './src/shims/cad-agent-plugin-register.ts')
    },
    {
      find: '@mlightcad/cad-agent-plugin/style.css',
      replacement: resolve(appRoot, './src/shims/cad-agent-plugin.css')
    },
    {
      find: '@mlightcad/cad-agent-plugin',
      replacement: resolve(appRoot, './src/shims/cad-agent-plugin.ts')
    },
    {
      find: '@mlightcad/cad-html-plugin/register',
      replacement: resolve(appRoot, './src/shims/cad-html-plugin-register.ts')
    },
    {
      find: '@mlightcad/cad-html-plugin',
      replacement: resolve(appRoot, './src/shims/cad-html-plugin.ts')
    },
    {
      find: '@mlightcad/cad-pdf-plugin/register',
      replacement: resolve(appRoot, '../../packages/cad-pdf-plugin/src/register.ts')
    },
    {
      find: '@mlightcad/cad-pdf-plugin/convertor',
      replacement: resolve(
        appRoot,
        '../../packages/cad-pdf-plugin/src/AcApPdfConvertor.ts'
      )
    },
    {
      find: '@mlightcad/data-model',
      replacement: resolve(
        appRoot,
        '../../packages/cad-simple-viewer/node_modules/@mlightcad/data-model/lib/index.js'
      )
    },
    {
      find: '@mlightcad/libredwg-converter',
      replacement: resolve(
        appRoot,
        '../../packages/cad-simple-viewer/node_modules/@mlightcad/libredwg-converter/lib/index.js'
      )
    },
    {
      find: '@mlightcad/mtext-renderer',
      replacement: resolve(
        appRoot,
        '../../packages/cad-simple-viewer/node_modules/@mlightcad/mtext-renderer/dist/index.js'
      )
    },
    {
      find: '@mlightcad/cad-pdf-plugin',
      replacement: resolve(appRoot, '../../packages/cad-pdf-plugin/src/index.ts')
    },
    {
      find: '@mlightcad/cad-simple-viewer',
      replacement: resolve(appRoot, '../../packages/cad-simple-viewer/src/index.ts')
    },
    {
      find: '@mlightcad/cad-svg-plugin/register',
      replacement: resolve(appRoot, '../../packages/cad-svg-plugin/src/register.ts')
    },
    {
      find: '@mlightcad/cad-svg-plugin/convertor',
      replacement: resolve(
        appRoot,
        '../../packages/cad-svg-plugin/src/AcApSvgConvertor.ts'
      )
    },
    {
      find: '@mlightcad/cad-svg-plugin',
      replacement: resolve(appRoot, '../../packages/cad-svg-plugin/src/index.ts')
    },
    {
      find: '@mlightcad/three-renderer',
      replacement: resolve(appRoot, '../../packages/three-renderer/src/index.ts')
    }
  ]
}

export function cadfluxWebManualChunks(id: string): string | undefined {
  if (id.includes('node_modules/vue')) {
    return 'vendor-vue'
  }

  if (
    id.includes('packages/cad-svg-plugin/src/AcSvgFontMap')
  ) {
    return 'cad-export-fonts'
  }

  if (
    id.includes('packages/cad-svg-plugin/src/AcSvgMText') ||
    id.includes('packages/cad-svg-plugin/src/AcSvgMTextUtil') ||
    id.includes('node_modules/.pnpm/@mlightcad+mtext-parser') ||
    id.includes('node_modules/.pnpm/@mlightcad+mtext-renderer')
  ) {
    return 'cad-export-mtext'
  }

  if (
    id.includes('packages/cad-svg-plugin/src/AcSvgShape') ||
    id.includes('packages/cad-svg-plugin/src/AcSvgShapeUtil') ||
    id.includes('packages/cad-svg-plugin/src/CadFluxBrowserExport') ||
    id.includes('packages/cad-pdf-plugin/src/CadFluxBrowserExport') ||
    id.includes('node_modules/.pnpm/@mlightcad+mtext-renderer')
  ) {
    return 'cad-export-shape'
  }

  if (
    id.includes('packages/cad-svg-plugin/src/AcSvg') ||
    id.includes('node_modules/dompurify')
  ) {
    return 'cad-export-core'
  }

  return undefined
}
