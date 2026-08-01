// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import {
  applyMatrixToPoint,
  identityMatrix,
  multiplyMatrices,
  type BlockReferenceEntity,
  type DrawingBlock,
  type DrawingBounds,
  type DrawingDocument,
  type DrawingEntity,
  type Matrix2D,
  type Point2D
} from '@cadflux/drawing-model'

import {
  drawingColorToCss,
  type RenderPlan,
  type RenderedPrimitive
} from './viewer-types'

export interface BuildRenderPlanOptions {
  activeLayoutId?: string | null
  visibleLayerIds?: ReadonlySet<string>
}

export function buildRenderPlan(
  document: DrawingDocument,
  options: BuildRenderPlanOptions = {}
): RenderPlan {
  const visibleLayerIds =
    options.visibleLayerIds ??
    new Set(
      document.layers
        .filter(layer => layer.visible !== false)
        .map(layer => layer.id)
    )
  const activeLayoutId =
    options.activeLayoutId ??
    document.layouts.find(layout => layout.type === 'model')?.id ??
    document.layouts[0]?.id ??
    null

  const blocksById = new Map(document.blocks.map(block => [block.id, block]))
  const layout = activeLayoutId
    ? document.layouts.find(candidate => candidate.id === activeLayoutId) ?? null
    : null
  const allowedEntityIds = layout?.entities ? new Set(layout.entities) : null
  const primitives: RenderedPrimitive[] = []

  for (const entity of document.entities) {
    if (allowedEntityIds && !allowedEntityIds.has(entity.id)) {
      continue
    }
    appendEntityPrimitives(
      primitives,
      entity,
      identityMatrix(),
      blocksById,
      visibleLayerIds,
      0
    )
  }

  const bounds = computePlanBounds(primitives, document.bounds)
  return { bounds, primitives }
}

function appendEntityPrimitives(
  target: RenderedPrimitive[],
  entity: DrawingEntity,
  transform: Matrix2D,
  blocksById: Map<string, DrawingBlock>,
  visibleLayerIds: ReadonlySet<string>,
  depth: number
) {
  if (depth > 8) return
  if (entity.layerId && !visibleLayerIds.has(entity.layerId)) return
  const color = drawingColorToCss(entity.style?.color)

  switch (entity.kind) {
    case 'line':
      target.push({
        kind: 'line',
        id: entity.id,
        layerId: entity.layerId,
        color,
        start: applyMatrixToPoint(transform, entity.start),
        end: applyMatrixToPoint(transform, entity.end)
      })
      return
    case 'polyline':
      target.push({
        kind: 'polyline',
        id: entity.id,
        layerId: entity.layerId,
        color,
        points: entity.vertices.map(vertex => applyMatrixToPoint(transform, vertex)),
        closed: entity.closed === true
      })
      return
    case 'circle': {
      const center = applyMatrixToPoint(transform, entity.center)
      const edge = applyMatrixToPoint(transform, {
        x: entity.center.x + entity.radius,
        y: entity.center.y
      })
      target.push({
        kind: 'circle',
        id: entity.id,
        layerId: entity.layerId,
        color,
        center,
        radius: distance(center, edge)
      })
      return
    }
    case 'arc': {
      const center = applyMatrixToPoint(transform, entity.center)
      const edge = applyMatrixToPoint(transform, {
        x: entity.center.x + entity.radius,
        y: entity.center.y
      })
      target.push({
        kind: 'arc',
        id: entity.id,
        layerId: entity.layerId,
        color,
        center,
        radius: distance(center, edge),
        startAngle: entity.startAngle,
        endAngle: entity.endAngle
      })
      return
    }
    case 'ellipse': {
      const center = applyMatrixToPoint(transform, entity.center)
      const rxEdge = applyMatrixToPoint(transform, {
        x: entity.center.x + entity.radiusX,
        y: entity.center.y
      })
      const ryEdge = applyMatrixToPoint(transform, {
        x: entity.center.x,
        y: entity.center.y + entity.radiusY
      })
      target.push({
        kind: 'ellipse',
        id: entity.id,
        layerId: entity.layerId,
        color,
        center,
        radiusX: distance(center, rxEdge),
        radiusY: distance(center, ryEdge),
        rotation: entity.rotation ?? 0
      })
      return
    }
    case 'text':
      target.push({
        kind: 'text',
        id: entity.id,
        layerId: entity.layerId,
        color,
        text: entity.text,
        position: applyMatrixToPoint(transform, entity.insertionPoint),
        rotation: entity.style.rotation ?? 0,
        fontSize: Math.max(10, entity.style.height || 10)
      })
      return
    case 'mtext':
      target.push({
        kind: 'text',
        id: entity.id,
        layerId: entity.layerId,
        color,
        text: entity.plainText,
        position: applyMatrixToPoint(transform, entity.insertionPoint),
        rotation: entity.style.rotation ?? 0,
        fontSize: Math.max(10, entity.style.height || 10)
      })
      return
    case 'block-reference':
      appendBlockReferencePrimitives(
        target,
        entity,
        transform,
        blocksById,
        visibleLayerIds,
        depth
      )
      return
    default:
      return
  }
}

function appendBlockReferencePrimitives(
  target: RenderedPrimitive[],
  entity: BlockReferenceEntity,
  parentTransform: Matrix2D,
  blocksById: Map<string, DrawingBlock>,
  visibleLayerIds: ReadonlySet<string>,
  depth: number
) {
  const block = blocksById.get(entity.blockId)
  if (!block) return
  const nextTransform = multiplyMatrices(parentTransform, entity.transform)
  for (const child of block.entities) {
    appendEntityPrimitives(
      target,
      child,
      nextTransform,
      blocksById,
      visibleLayerIds,
      depth + 1
    )
  }
}

function computePlanBounds(
  primitives: RenderedPrimitive[],
  fallback: DrawingBounds
): DrawingBounds {
  const points: Point2D[] = []

  for (const primitive of primitives) {
    switch (primitive.kind) {
      case 'line':
        points.push(primitive.start, primitive.end)
        break
      case 'polyline':
        points.push(...primitive.points)
        break
      case 'circle':
      case 'arc':
        points.push(
          {
            x: primitive.center.x - primitive.radius,
            y: primitive.center.y - primitive.radius
          },
          {
            x: primitive.center.x + primitive.radius,
            y: primitive.center.y + primitive.radius
          }
        )
        break
      case 'ellipse':
        points.push(
          {
            x: primitive.center.x - primitive.radiusX,
            y: primitive.center.y - primitive.radiusY
          },
          {
            x: primitive.center.x + primitive.radiusX,
            y: primitive.center.y + primitive.radiusY
          }
        )
        break
      case 'text':
        points.push(primitive.position)
        break
    }
  }

  if (points.length === 0) {
    return fallback
  }

  return {
    minX: Math.min(...points.map(point => point.x)),
    minY: Math.min(...points.map(point => point.y)),
    maxX: Math.max(...points.map(point => point.x)),
    maxY: Math.max(...points.map(point => point.y))
  }
}

function distance(left: Point2D, right: Point2D): number {
  return Math.hypot(right.x - left.x, right.y - left.y)
}
