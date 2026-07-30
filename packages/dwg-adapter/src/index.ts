// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type { CadFluxInputSource, CadFluxInspection } from '@cadflux/core'

export function inspectDwgInput(input: CadFluxInputSource): CadFluxInspection {
  return {
    input,
    detectedFormat: 'dwg',
    warnings: []
  }
}
