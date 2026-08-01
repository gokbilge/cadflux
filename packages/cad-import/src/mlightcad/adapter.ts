// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type { CadFluxInputSource } from '@cadflux/core'
import {
  DRAWING_MODEL_SCHEMA_VERSION,
  identityMatrix,
  type DrawingDiagnostic,
  type DrawingDocument
} from '@cadflux/drawing-model'
import { inspectDwgInput } from '@cadflux/dwg-adapter'
import { inspectDxfInput } from '@cadflux/dxf-adapter'

import type {
  CadInput,
  CadInspectResult,
  CadParseOptions,
  CadParseResult,
  CadParserAdapter
} from '../types'

function toInputSource(input: CadInput): CadFluxInputSource {
  return {
    name: input.name,
    absolutePath: input.path,
    relativePath: input.relativePath,
    extension: `.${(input.format ?? inferFormat(input)).toLowerCase()}`,
    sizeBytes: input.sizeBytes,
    lastModifiedMs: input.lastModifiedMs
  }
}

function inferFormat(input: CadInput): 'dwg' | 'dxf' {
  if (input.format) return input.format
  return input.name.toLowerCase().endsWith('.dwg') ? 'dwg' : 'dxf'
}

function toDiagnostics(warnings: string[], sourceType: string): DrawingDiagnostic[] {
  return warnings.map(message => ({
    severity: 'warning',
    code: 'legacy_inspection_warning',
    message,
    sourceType
  }))
}

function createStubDocument(input: CadInput, diagnostics: DrawingDiagnostic[]): DrawingDocument {
  const format = inferFormat(input)
  return {
    schemaVersion: DRAWING_MODEL_SCHEMA_VERSION,
    id: `${format}:${input.relativePath ?? input.name}`,
    source: {
      fileName: input.name,
      format,
      sizeBytes: input.sizeBytes
    },
    units: 'unitless',
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
    layers: [],
    layouts: [
      {
        id: 'layout:model',
        name: 'Model',
        type: 'model',
        entities: []
      }
    ],
    blocks: [
      {
        id: 'block:model-space',
        name: '*Model_Space',
        basePoint: { x: 0, y: 0 },
        entities: []
      }
    ],
    entities: [
      {
        id: `unsupported:${format}:0`,
        kind: 'unsupported',
        sourceType: format.toUpperCase(),
        metadata: {
          adapter: 'mlightcad-legacy-inspection',
          transform: identityMatrix()
        }
      }
    ],
    resources: {
      fonts: [],
      images: [],
      xrefs: []
    },
    diagnostics
  }
}

export const mlightcadCadParserAdapter: CadParserAdapter = {
  id: 'mlightcad-legacy-inspection',
  formats: ['dwg', 'dxf'],
  async inspect(input: CadInput, _options?: CadParseOptions): Promise<CadInspectResult> {
    const source = toInputSource(input)
    const inspection =
      inferFormat(input) === 'dwg' ? inspectDwgInput(source) : inspectDxfInput(source)
    return {
      format: inspection.detectedFormat,
      warnings: toDiagnostics(inspection.warnings, inspection.detectedFormat)
    }
  },
  async parse(input: CadInput, options?: CadParseOptions): Promise<CadParseResult> {
    if (options?.signal?.aborted) {
      throw new Error('CAD parse aborted.')
    }
    const inspected = await this.inspect(input, options)
    const document = createStubDocument(input, inspected.warnings)
    return {
      document,
      diagnostics: inspected.warnings,
      adapterId: this.id
    }
  }
}
