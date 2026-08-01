// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import path from 'node:path'

import { parseCadInput } from '@cadflux/cad-import'
import { CADFLUX_PRESETS } from '@cadflux/presets'

import { renderDrawingDocumentToSvg } from './node'

describe('@cadflux/renderer-svg direct node renderer', () => {
  test('renders minimal DXF to SVG markup', async () => {
    const parsed = await parseCadInput({
      name: 'minimal-line.dxf',
      format: 'dxf',
      path: path.resolve('fixtures/minimization/minimal-line.dxf')
    })
    const svg = renderDrawingDocumentToSvg({
      document: parsed.document,
      outputPath: 'ignored.svg',
      profile: CADFLUX_PRESETS[0]
    })

    expect(svg.startsWith('<?xml')).toBe(true)
    expect(svg).toContain('<svg')
    expect(svg).toContain('<line')
  })
})
