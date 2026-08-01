// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import path from 'node:path'

import { parseCadInput } from '@cadflux/cad-import'
import { CADFLUX_PRESETS } from '@cadflux/presets'

import { renderDrawingDocumentToPdf } from './node'

describe('@cadflux/renderer-pdf direct node renderer', () => {
  test('renders minimal DXF to a valid PDF document', async () => {
    const parsed = await parseCadInput({
      name: 'minimal-line.dxf',
      format: 'dxf',
      path: path.resolve('fixtures/minimization/minimal-line.dxf')
    })
    const pdf = renderDrawingDocumentToPdf(parsed.document, CADFLUX_PRESETS[0]!)
    const bytes = Buffer.from(pdf.output('arraybuffer'))

    expect(bytes.subarray(0, 4).equals(Buffer.from('%PDF'))).toBe(true)
    expect(bytes.length).toBeGreaterThan(500)
    const text = bytes.toString('latin1')
    expect(text).toContain('/Type /Page')
    expect(text).toContain('/MediaBox')
  })
})
