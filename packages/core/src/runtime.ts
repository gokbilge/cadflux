// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type {
  CadFluxConversionRequest,
  CadFluxConversionResult,
  CadFluxConverter,
  CadFluxInspection,
  CadFluxInputSource
} from './types'

export class CadFluxRuntime {
  constructor(private readonly converter: CadFluxConverter) {}

  inspect(input: CadFluxInputSource): Promise<CadFluxInspection> {
    return this.converter.inspect(input)
  }

  convert(
    request: CadFluxConversionRequest
  ): Promise<CadFluxConversionResult> {
    return this.converter.convert(request)
  }
}

export function createCadFluxRuntime(converter: CadFluxConverter) {
  return new CadFluxRuntime(converter)
}
