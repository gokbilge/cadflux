// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { mlightcadCadParserAdapter } from './mlightcad/adapter'
import type { CadInput, CadInspectResult, CadParseOptions } from './types'

export async function inspectCadInput(
  input: CadInput,
  options?: CadParseOptions
): Promise<CadInspectResult> {
  return mlightcadCadParserAdapter.inspect(input, options)
}
