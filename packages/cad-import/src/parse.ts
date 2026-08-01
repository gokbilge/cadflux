// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { mlightcadCadParserAdapter } from './mlightcad/adapter'
import type { CadInput, CadParseOptions, CadParseResult } from './types'

export async function parseCadInput(
  input: CadInput,
  options?: CadParseOptions
): Promise<CadParseResult> {
  return mlightcadCadParserAdapter.parse(input, options)
}
