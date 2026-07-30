// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import path from 'node:path'

import type { CadFluxConversionRequest, CadFluxFormat } from '@cadflux/core'

export function resolveArtifactOutputPath(
  request: CadFluxConversionRequest,
  format: CadFluxFormat
): string {
  const relativeDirectory =
    request.preserveTree && request.input.relativePath
      ? path.dirname(request.input.relativePath)
      : ''
  const baseName = path.basename(
    request.input.name,
    path.extname(request.input.name)
  )
  return path.join(request.outputDirectory, relativeDirectory, `${baseName}.${format}`)
}
