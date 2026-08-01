// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type { DrawingDiagnostic, DrawingDocument, DrawingUnits } from '@cadflux/drawing-model'

export interface CadInput {
  name: string
  format?: 'dwg' | 'dxf'
  sizeBytes?: number
  path?: string
  bytes?: Uint8Array
  relativePath?: string
  lastModifiedMs?: number
}

export interface CadInspectResult {
  format: 'dwg' | 'dxf' | 'unknown'
  version?: string
  units?: DrawingUnits
  layerCount?: number
  layoutCount?: number
  warnings: DrawingDiagnostic[]
}

export interface CadParseOptions {
  includeModelSpace?: boolean
  includePaperSpace?: boolean
  includeHiddenLayers?: boolean
  maxEntities?: number
  maxBlockDepth?: number
  signal?: AbortSignal
}

export interface CadParseResult {
  document: DrawingDocument
  diagnostics: DrawingDiagnostic[]
  adapterId: string
}

export interface CadParserAdapter {
  readonly id: string
  readonly formats: ReadonlyArray<'dwg' | 'dxf'>

  inspect(input: CadInput, options?: CadParseOptions): Promise<CadInspectResult>
  parse(input: CadInput, options?: CadParseOptions): Promise<CadParseResult>
}
