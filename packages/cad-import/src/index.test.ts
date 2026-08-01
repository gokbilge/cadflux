// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import path from 'node:path'

import {
  inspectCadInput,
  parseCadInput
} from './index'

describe('@cadflux/cad-import', () => {
  test('inspects and parses a DXF fixture through the facade', async () => {
    const filePath = path.resolve('fixtures/minimization/minimal-line.dxf')
    const inspection = await inspectCadInput({
      name: 'minimal-line.dxf',
      format: 'dxf',
      path: filePath
    })

    expect(inspection.format).toBe('dxf')

    const parsed = await parseCadInput({
      name: 'minimal-line.dxf',
      format: 'dxf',
      path: filePath
    })

    expect(parsed.adapterId).toBe('mlightcad-legacy-inspection')
    expect(parsed.document.schemaVersion).toBe(1)
    expect(parsed.document.source.format).toBe('dxf')
    expect(parsed.document.entities[0]?.kind).toBe('unsupported')
    expect(() => JSON.stringify(parsed.document)).not.toThrow()
    expect(structuredClone(parsed.document)).toEqual(parsed.document)
  })
})
