#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const packages = [
  '@cadflux/core',
  '@cadflux/file-ingest',
  '@cadflux/dwg-adapter',
  '@cadflux/dxf-adapter',
  '@cadflux/drawing-model',
  '@cadflux/plot-engine',
  '@cadflux/renderer-svg',
  '@cadflux/renderer-pdf',
  '@cadflux/batch-engine',
  '@cadflux/diagnostics',
  '@cadflux/presets',
  '@cadflux/cli'
]

for (const pkg of packages) {
  console.log(`Publishing ${pkg}`)
  execFileSync(
    'pnpm',
    ['--filter', pkg, 'publish', '--access', 'public', '--no-git-checks', '--provenance'],
    {
      cwd: rootDir,
      stdio: 'inherit'
    }
  )
}
