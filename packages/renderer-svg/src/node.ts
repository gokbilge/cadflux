// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { CadFluxProfile } from '@cadflux/core'
import {
  type BlockReferenceEntity,
  type CircleEntity,
  type DrawingBlock,
  type DrawingColor,
  type DrawingDocument,
  type DrawingEntity,
  type EntityStyle,
  type DrawingLayer,
  type LineEntity,
  type Matrix2D,
  type MTextEntity,
  type Point2D,
  type PolylineEntity,
  type TextEntity
} from '@cadflux/drawing-model'

const PAPER_SIZES_MM: Record<CadFluxProfile['paper'], { width: number; height: number }> = {
  A0: { width: 841, height: 1189 },
  A1: { width: 594, height: 841 },
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 }
}

const DEFAULT_PROFILE: CadFluxProfile = {
  id: 'default',
  label: 'Default',
  paper: 'A4',
  orientation: 'auto',
  scale: 'fit',
  color: 'color',
  formats: ['svg']
}

export interface SvgRenderRequest {
  document: DrawingDocument
  outputPath: string
  profile?: CadFluxProfile
}

export async function exportSvgFile(
  inputOrDocument: string | DrawingDocument,
  outputPath: string,
  signal?: AbortSignal,
  profile: CadFluxProfile = DEFAULT_PROFILE
): Promise<string> {
  if (signal?.aborted) {
    throw new Error('SVG rendering aborted.')
  }

  if (typeof inputOrDocument === 'string') {
    throw new Error(
      `Direct SVG rendering now requires a parsed DrawingDocument for ${path.basename(inputOrDocument)}.`
    )
  }

  const svg = renderDrawingDocumentToSvg({
    document: inputOrDocument,
    outputPath,
    profile
  })
  await writeFile(outputPath, svg, 'utf8')
  return outputPath
}

export function renderDrawingDocumentToSvg(request: SvgRenderRequest): string {
  const profile = request.profile ?? DEFAULT_PROFILE
  const page = resolvePageSize(profile, request.document)
  const marginMm = 10
  const transform = createPageTransform(
    request.document,
    page.width,
    page.height,
    marginMm
  )
  const blockMap = new Map(request.document.blocks.map(block => [block.id, block]))
  const layerMap = new Map(request.document.layers.map(layer => [layer.id, layer]))

  const body = renderEntities(
    request.document.entities,
    blockMap,
    layerMap,
    transform,
    profile,
    identityMatrix()
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}mm" height="${page.height}mm" viewBox="0 0 ${page.width} ${page.height}">
  <rect x="0" y="0" width="${page.width}" height="${page.height}" fill="white" />
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
${indent(body, 4)}
  </g>
</svg>
`
}

function renderEntities(
  entities: DrawingEntity[],
  blockMap: Map<string, DrawingBlock>,
  layerMap: Map<string, DrawingLayer>,
  transform: ReturnType<typeof createPageTransform>,
  profile: CadFluxProfile,
  entityMatrix: Matrix2D
): string[] {
  const lines: string[] = []
  for (const entity of entities) {
    if (!isEntityVisible(entity, layerMap)) {
      continue
    }

    if (entity.kind === 'line') {
      lines.push(renderLine(entity, layerMap, transform, profile, entityMatrix))
      continue
    }
    if (entity.kind === 'polyline') {
      lines.push(renderPolyline(entity, layerMap, transform, profile, entityMatrix))
      continue
    }
    if (entity.kind === 'circle') {
      lines.push(renderCircle(entity, layerMap, transform, profile, entityMatrix))
      continue
    }
    if (entity.kind === 'text' || entity.kind === 'mtext') {
      lines.push(renderText(entity, layerMap, transform, profile, entityMatrix))
      continue
    }
    if (entity.kind === 'block-reference') {
      const nested = renderBlockReference(entity, blockMap, layerMap, transform, profile, entityMatrix)
      lines.push(...nested)
      continue
    }
  }
  return lines.filter(Boolean)
}

function renderBlockReference(
  entity: BlockReferenceEntity,
  blockMap: Map<string, DrawingBlock>,
  layerMap: Map<string, DrawingLayer>,
  transform: ReturnType<typeof createPageTransform>,
  profile: CadFluxProfile,
  parentMatrix: Matrix2D
): string[] {
  const block = blockMap.get(entity.blockId)
  if (!block) {
    return []
  }
  const combined = multiplyMatrix(parentMatrix, entity.transform)
  return renderEntities(block.entities, blockMap, layerMap, transform, profile, combined)
}

function renderLine(
  entity: LineEntity,
  layerMap: Map<string, DrawingLayer>,
  transform: ReturnType<typeof createPageTransform>,
  profile: CadFluxProfile,
  entityMatrix: Matrix2D
): string {
  const start = transformPoint(transform, applyMatrixToPoint(entityMatrix, entity.start))
  const end = transformPoint(transform, applyMatrixToPoint(entityMatrix, entity.end))
  return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" ${strokeAttrs(entity, layerMap, profile)} />`
}

function renderPolyline(
  entity: PolylineEntity,
  layerMap: Map<string, DrawingLayer>,
  transform: ReturnType<typeof createPageTransform>,
  profile: CadFluxProfile,
  entityMatrix: Matrix2D
): string {
  const points = entity.vertices
    .map(point => transformPoint(transform, applyMatrixToPoint(entityMatrix, point)))
    .map(point => `${point.x},${point.y}`)
    .join(' ')
  const tag = entity.closed ? 'polygon' : 'polyline'
  return `<${tag} points="${points}" ${strokeAttrs(entity, layerMap, profile)} ${entity.closed ? 'fill="none"' : ''} />`
}

function renderCircle(
  entity: CircleEntity,
  layerMap: Map<string, DrawingLayer>,
  transform: ReturnType<typeof createPageTransform>,
  profile: CadFluxProfile,
  entityMatrix: Matrix2D
): string {
  const centerModel = applyMatrixToPoint(entityMatrix, entity.center)
  const center = transformPoint(transform, centerModel)
  const radius = entity.radius * transform.scale
  return `<circle cx="${center.x}" cy="${center.y}" r="${radius}" ${strokeAttrs(entity, layerMap, profile)} />`
}

function renderText(
  entity: TextEntity | MTextEntity,
  layerMap: Map<string, DrawingLayer>,
  transform: ReturnType<typeof createPageTransform>,
  profile: CadFluxProfile,
  entityMatrix: Matrix2D
): string {
  const point = transformPoint(transform, applyMatrixToPoint(entityMatrix, entity.insertionPoint))
  const height = Math.max(2, (entity.style?.height ?? 2.5) * transform.scale)
  const color = resolveStrokeColor(entity, layerMap, profile)
  const text = entity.kind === 'mtext' ? entity.plainText : entity.text
  return `<text x="${point.x}" y="${point.y}" font-size="${height}" fill="${color}" stroke="none">${escapeXml(text)}</text>`
}

function createPageTransform(
  document: DrawingDocument,
  pageWidth: number,
  pageHeight: number,
  marginMm: number
) {
  const bounds = normalizeBounds(document.bounds)
  const docWidth = Math.max(1, bounds.maxX - bounds.minX)
  const docHeight = Math.max(1, bounds.maxY - bounds.minY)
  const innerWidth = Math.max(1, pageWidth - marginMm * 2)
  const innerHeight = Math.max(1, pageHeight - marginMm * 2)
  const scale = Math.min(innerWidth / docWidth, innerHeight / docHeight)
  const offsetX = marginMm + (innerWidth - docWidth * scale) / 2
  const offsetY = marginMm + (innerHeight - docHeight * scale) / 2
  return {
    bounds,
    scale,
    offsetX,
    offsetY,
    pageHeight
  }
}

function transformPoint(
  transform: ReturnType<typeof createPageTransform>,
  point: Point2D
): Point2D {
  return {
    x: roundNumber(transform.offsetX + (point.x - transform.bounds.minX) * transform.scale),
    y: roundNumber(transform.pageHeight - (transform.offsetY + (point.y - transform.bounds.minY) * transform.scale))
  }
}

function resolvePageSize(profile: CadFluxProfile, document: DrawingDocument) {
  const base = PAPER_SIZES_MM[profile.paper]
  if (profile.orientation === 'portrait') {
    return base
  }
  if (profile.orientation === 'landscape') {
    return { width: base.height, height: base.width }
  }
  const bounds = normalizeBounds(document.bounds)
  const docWidth = bounds.maxX - bounds.minX
  const docHeight = bounds.maxY - bounds.minY
  return docWidth > docHeight
    ? { width: base.height, height: base.width }
    : base
}

function normalizeBounds(bounds: DrawingDocument['bounds']) {
  if (bounds.maxX === bounds.minX && bounds.maxY === bounds.minY) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 }
  }
  return bounds
}

function isEntityVisible(entity: DrawingEntity, layerMap: Map<string, DrawingLayer>) {
  if (hasEntityStyle(entity.style) && entity.style.visible === false) {
    return false
  }
  const layer = entity.layerId ? layerMap.get(entity.layerId) : undefined
  return layer?.visible !== false
}

function strokeAttrs(
  entity: DrawingEntity,
  layerMap: Map<string, DrawingLayer>,
  profile: CadFluxProfile
): string {
  return `stroke="${resolveStrokeColor(entity, layerMap, profile)}" stroke-width="${resolveStrokeWidth(entity)}"`
}

function resolveStrokeWidth(entity: DrawingEntity): number {
  const lineWeight = hasEntityStyle(entity.style) ? entity.style.lineWeight : undefined
  if (typeof lineWeight === 'number' && Number.isFinite(lineWeight) && lineWeight > 0) {
    return roundNumber(Math.max(0.15, lineWeight / 100))
  }
  return 0.35
}

function resolveStrokeColor(
  entity: DrawingEntity,
  layerMap: Map<string, DrawingLayer>,
  profile: CadFluxProfile
): string {
  if (profile.color === 'monochrome') {
    return '#111111'
  }
  const layer = entity.layerId ? layerMap.get(entity.layerId) : undefined
  return colorToHex(entity.style?.color ?? layer?.color ?? { r: 17, g: 17, b: 17 })
}

function colorToHex(color: DrawingColor): string {
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`
}

function toHex(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
}

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000
}

function indent(value: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return value
    .split('\n')
    .map(line => (line ? `${pad}${line}` : line))
    .join('\n')
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function multiplyMatrix(left: Matrix2D, right: Matrix2D): Matrix2D {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f
  }
}

function identityMatrix(): Matrix2D {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
}

function applyMatrixToPoint(matrix: Matrix2D, point: Point2D): Point2D {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f
  }
}

function hasEntityStyle(style: unknown): style is EntityStyle {
  return Boolean(
    style &&
    typeof style === 'object' &&
    ('visible' in style || 'lineWeight' in style || 'lineType' in style || 'opacity' in style)
  )
}
