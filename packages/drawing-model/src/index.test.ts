// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import {
  DRAWING_MODEL_SCHEMA_VERSION,
  applyMatrixToPoint,
  identityMatrix,
  multiplyMatrices,
  parseMText,
  rotateMatrix,
  scaleMatrix,
  translateMatrix,
  type DrawingDocument
} from './index'

describe('@cadflux/drawing-model', () => {
  test('matrix helpers compose deterministically', () => {
    const matrix = multiplyMatrices(
      translateMatrix(10, 5),
      multiplyMatrices(rotateMatrix(Math.PI / 2), scaleMatrix(2, 3))
    )
    const point = applyMatrixToPoint(matrix, { x: 1, y: 2 })
    expect(point.x).toBeCloseTo(4)
    expect(point.y).toBeCloseTo(7)
  })

  test('document is JSON serializable and cloneable', () => {
    const document: DrawingDocument = {
      schemaVersion: DRAWING_MODEL_SCHEMA_VERSION,
      id: 'dxf:minimal-line',
      source: { fileName: 'minimal-line.dxf', format: 'dxf', sizeBytes: 42 },
      units: 'unitless',
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      layers: [{ id: 'layer:0', name: '0', visible: true, locked: false }],
      layouts: [{ id: 'layout:model', name: 'Model', type: 'model', entities: ['line:1'] }],
      blocks: [{ id: 'block:model-space', name: '*Model_Space', basePoint: { x: 0, y: 0 }, entities: [] }],
      entities: [
        {
          id: 'block-ref:1',
          kind: 'block-reference',
          sourceType: 'INSERT',
          blockId: 'block:model-space',
          transform: identityMatrix()
        }
      ],
      resources: { fonts: [], images: [], xrefs: [] },
      diagnostics: []
    }

    expect(JSON.parse(JSON.stringify(document))).toEqual(document)
    expect(structuredClone(document)).toEqual(document)
  })

  test('parseMText normalizes plain text and runs deterministically', () => {
    const parsed = parseMText('CadFlux\\P\\LViewer\\l \\C1;Red \\H2x;Big \\S1/2;', {
      defaultStyle: {
        height: 5,
        widthFactor: 1
      }
    })

    expect(parsed.plainText).toContain('CadFlux')
    expect(parsed.plainText).toContain('\n')
    expect(parsed.plainText).toContain('Viewer')
    expect(parsed.plainText).toContain('Red')
    expect(parsed.plainText).toContain('Big')
    expect(parsed.plainText).toContain('1/2')
    expect(parsed.runs.length).toBeGreaterThan(1)
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed)
    expect(structuredClone(parsed)).toEqual(parsed)
  })
})
