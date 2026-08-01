// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import {
  DRAWING_MODEL_SCHEMA_VERSION,
  identityMatrix,
  type DrawingDocument
} from '@cadflux/drawing-model'

import { buildRenderPlan } from './render-plan'
import { fitBoundsToViewport, worldToScreen } from './viewer-core'

function createDocument(): DrawingDocument {
  return {
    schemaVersion: DRAWING_MODEL_SCHEMA_VERSION,
    id: 'doc:test',
    source: { fileName: 'test.dxf', format: 'dxf' },
    units: 'unitless',
    bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    layers: [
      { id: 'layer:0', name: '0', visible: true, locked: false },
      { id: 'layer:hidden', name: 'hidden', visible: true, locked: false }
    ],
    layouts: [{ id: 'layout:model', name: 'Model', type: 'model', entities: ['line:1', 'insert:1'] }],
    blocks: [
      {
        id: 'block:SYMBOL',
        name: 'SYMBOL',
        basePoint: { x: 0, y: 0 },
        entities: [
          {
            id: 'block-line:1',
            kind: 'line',
            sourceType: 'LINE',
            layerId: 'layer:0',
            start: { x: 0, y: 0 },
            end: { x: 10, y: 0 }
          }
        ]
      }
    ],
    entities: [
      {
        id: 'line:1',
        kind: 'line',
        sourceType: 'LINE',
        layerId: 'layer:0',
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 }
      },
      {
        id: 'line:2',
        kind: 'line',
        sourceType: 'LINE',
        layerId: 'layer:hidden',
        start: { x: 50, y: 0 },
        end: { x: 50, y: 100 }
      },
      {
        id: 'insert:1',
        kind: 'block-reference',
        sourceType: 'INSERT',
        layerId: 'layer:0',
        blockId: 'block:SYMBOL',
        transform: {
          ...identityMatrix(),
          e: 20,
          f: 40
        }
      }
    ],
    resources: { fonts: [], images: [], xrefs: [] },
    diagnostics: []
  }
}

describe('renderer-webgl render plan', () => {
  it('filters hidden layers and expands block references', () => {
    const plan = buildRenderPlan(createDocument(), {
      activeLayoutId: 'layout:model',
      visibleLayerIds: new Set(['layer:0'])
    })

    expect(plan.primitives).toHaveLength(2)
    expect(plan.primitives[0]).toMatchObject({
      kind: 'line',
      start: { x: 0, y: 0 },
      end: { x: 100, y: 100 }
    })
    expect(plan.primitives[1]).toMatchObject({
      kind: 'line',
      start: { x: 20, y: 40 },
      end: { x: 30, y: 40 }
    })
  })
})

describe('renderer-webgl viewport math', () => {
  it('fits bounds into a viewport', () => {
    const transform = fitBoundsToViewport(
      { minX: 0, minY: 0, maxX: 200, maxY: 100 },
      { width: 400, height: 300 }
    )
    expect(transform.scale).toBeGreaterThan(1)
  })

  it('maps world coordinates to screen coordinates around the center', () => {
    const screen = worldToScreen(
      { x: 50, y: 50 },
      { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      { scale: 2, offsetX: 0, offsetY: 0 },
      { width: 500, height: 300 }
    )
    expect(screen).toEqual({ x: 250, y: 150 })
  })
})
