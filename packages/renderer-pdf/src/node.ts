// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { CadFluxProfile } from '@cadflux/core'
import type {
  CircleEntity,
  DrawingBlock,
  DrawingColor,
  DrawingDocument,
  DrawingEntity,
  EntityStyle,
  DrawingLayer,
  LineEntity,
  Matrix2D,
  MTextEntity,
  Point2D,
  PolylineEntity,
  TextEntity
} from '@cadflux/drawing-model'
import { jsPDF } from 'jspdf'

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
  formats: ['pdf']
}

export interface PdfRenderRequest {
  document: DrawingDocument
  outputPath: string
  profile?: CadFluxProfile
}

export interface PdfRenderResult {
  outputPath: string
  rendererBackend: 'direct-node-vector'
}

export interface PdfRendererBackend {
  readonly id: string
  readonly requiresBrowser: boolean

  render(
    request: PdfRenderRequest,
    signal?: AbortSignal
  ): Promise<PdfRenderResult>
}

class DirectNodeVectorPdfRendererBackend implements PdfRendererBackend {
  readonly id = 'direct-node-vector' as const
  readonly requiresBrowser = false

  async render(
    request: PdfRenderRequest,
    signal?: AbortSignal
  ): Promise<PdfRenderResult> {
    if (signal?.aborted) {
      throw new Error('PDF rendering aborted.')
    }
    const pdf = renderDrawingDocumentToPdf(request.document, request.profile ?? DEFAULT_PROFILE)
    const bytes = pdf.output('arraybuffer')
    await writeFile(request.outputPath, Buffer.from(bytes))
    return {
      outputPath: request.outputPath,
      rendererBackend: this.id
    }
  }
}

const defaultPdfRendererBackend = new DirectNodeVectorPdfRendererBackend()

export async function exportPdfFile(
  inputOrDocument: string | DrawingDocument,
  outputPath: string,
  signal?: AbortSignal,
  profile: CadFluxProfile = DEFAULT_PROFILE
): Promise<string> {
  if (typeof inputOrDocument === 'string') {
    throw new Error(
      `Direct PDF rendering now requires a parsed DrawingDocument for ${path.basename(inputOrDocument)}.`
    )
  }
  const result = await defaultPdfRendererBackend.render(
    {
      document: inputOrDocument,
      outputPath,
      profile
    },
    signal
  )
  return result.outputPath
}

export function renderDrawingDocumentToPdf(document: DrawingDocument, profile: CadFluxProfile): jsPDF {
  const page = resolvePageSize(profile, document)
  const orientation = page.width >= page.height ? 'landscape' : 'portrait'
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [page.width, page.height]
  })
  const marginMm = 10
  const transform = createPageTransform(document, page.width, page.height, marginMm)
  const blockMap = new Map(document.blocks.map(block => [block.id, block]))
  const layerMap = new Map(document.layers.map(layer => [layer.id, layer]))

  pdf.setLineJoin('round')
  pdf.setLineCap('round')
  renderEntities(pdf, document.entities, blockMap, layerMap, transform, profile, identityMatrix())
  return pdf
}

function renderEntities(
  pdf: jsPDF,
  entities: DrawingEntity[],
  blockMap: Map<string, DrawingBlock>,
  layerMap: Map<string, DrawingLayer>,
  transform: ReturnType<typeof createPageTransform>,
  profile: CadFluxProfile,
  entityMatrix: Matrix2D
) {
  for (const entity of entities) {
    if (!isEntityVisible(entity, layerMap)) {
      continue
    }
    if (entity.kind === 'line') {
      drawLine(pdf, entity, layerMap, transform, profile, entityMatrix)
      continue
    }
    if (entity.kind === 'polyline') {
      drawPolyline(pdf, entity, layerMap, transform, profile, entityMatrix)
      continue
    }
    if (entity.kind === 'circle') {
      drawCircle(pdf, entity, layerMap, transform, profile, entityMatrix)
      continue
    }
    if (entity.kind === 'text' || entity.kind === 'mtext') {
      drawText(pdf, entity, layerMap, transform, profile, entityMatrix)
      continue
    }
    if (entity.kind === 'block-reference') {
      const block = blockMap.get(entity.blockId)
      if (!block) continue
      renderEntities(pdf, block.entities, blockMap, layerMap, transform, profile, multiplyMatrix(entityMatrix, entity.transform))
    }
  }
}

function drawLine(
  pdf: jsPDF,
  entity: LineEntity,
  layerMap: Map<string, DrawingLayer>,
  transform: ReturnType<typeof createPageTransform>,
  profile: CadFluxProfile,
  entityMatrix: Matrix2D
) {
  const start = transformPoint(transform, applyMatrixToPoint(entityMatrix, entity.start))
  const end = transformPoint(transform, applyMatrixToPoint(entityMatrix, entity.end))
  applyStroke(pdf, entity, layerMap, profile)
  pdf.line(start.x, start.y, end.x, end.y)
}

function drawPolyline(
  pdf: jsPDF,
  entity: PolylineEntity,
  layerMap: Map<string, DrawingLayer>,
  transform: ReturnType<typeof createPageTransform>,
  profile: CadFluxProfile,
  entityMatrix: Matrix2D
) {
  const points = entity.vertices.map(point =>
    transformPoint(transform, applyMatrixToPoint(entityMatrix, point))
  )
  if (points.length < 2) return
  applyStroke(pdf, entity, layerMap, profile)
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]!
    const to = points[index]!
    pdf.line(from.x, from.y, to.x, to.y)
  }
  if (entity.closed) {
    pdf.line(points[points.length - 1]!.x, points[points.length - 1]!.y, points[0]!.x, points[0]!.y)
  }
}

function drawCircle(
  pdf: jsPDF,
  entity: CircleEntity,
  layerMap: Map<string, DrawingLayer>,
  transform: ReturnType<typeof createPageTransform>,
  profile: CadFluxProfile,
  entityMatrix: Matrix2D
) {
  const center = transformPoint(transform, applyMatrixToPoint(entityMatrix, entity.center))
  applyStroke(pdf, entity, layerMap, profile)
  pdf.circle(center.x, center.y, entity.radius * transform.scale, 'S')
}

function drawText(
  pdf: jsPDF,
  entity: TextEntity | MTextEntity,
  layerMap: Map<string, DrawingLayer>,
  transform: ReturnType<typeof createPageTransform>,
  profile: CadFluxProfile,
  entityMatrix: Matrix2D
) {
  const point = transformPoint(transform, applyMatrixToPoint(entityMatrix, entity.insertionPoint))
  const color = resolveColor(entity, layerMap, profile)
  pdf.setTextColor(color.r, color.g, color.b)
  pdf.setFontSize(Math.max(4, (entity.style?.height ?? 2.5) * transform.scale * 2.2))
  pdf.text(entity.kind === 'mtext' ? entity.plainText : entity.text, point.x, point.y)
}

function applyStroke(
  pdf: jsPDF,
  entity: DrawingEntity,
  layerMap: Map<string, DrawingLayer>,
  profile: CadFluxProfile
) {
  const color = resolveColor(entity, layerMap, profile)
  pdf.setDrawColor(color.r, color.g, color.b)
  pdf.setLineWidth(resolveStrokeWidth(entity))
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
  return { bounds, scale, offsetX, offsetY, pageHeight }
}

function transformPoint(transform: ReturnType<typeof createPageTransform>, point: Point2D): Point2D {
  return {
    x: roundNumber(transform.offsetX + (point.x - transform.bounds.minX) * transform.scale),
    y: roundNumber(transform.pageHeight - (transform.offsetY + (point.y - transform.bounds.minY) * transform.scale))
  }
}

function resolvePageSize(profile: CadFluxProfile, document: DrawingDocument) {
  const base = PAPER_SIZES_MM[profile.paper]
  if (profile.orientation === 'portrait') return base
  if (profile.orientation === 'landscape') return { width: base.height, height: base.width }
  const bounds = normalizeBounds(document.bounds)
  return bounds.maxX - bounds.minX > bounds.maxY - bounds.minY
    ? { width: base.height, height: base.width }
    : base
}

function normalizeBounds(bounds: DrawingDocument['bounds']) {
  if (bounds.maxX === bounds.minX && bounds.maxY === bounds.minY) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 }
  }
  return bounds
}

function resolveStrokeWidth(entity: DrawingEntity): number {
  const lineWeight = hasEntityStyle(entity.style) ? entity.style.lineWeight : undefined
  if (typeof lineWeight === 'number' && lineWeight > 0) {
    return Math.max(0.15, lineWeight / 100)
  }
  return 0.35
}

function isEntityVisible(entity: DrawingEntity, layerMap: Map<string, DrawingLayer>) {
  if (hasEntityStyle(entity.style) && entity.style.visible === false) return false
  const layer = entity.layerId ? layerMap.get(entity.layerId) : undefined
  return layer?.visible !== false
}

function resolveColor(
  entity: DrawingEntity,
  layerMap: Map<string, DrawingLayer>,
  profile: CadFluxProfile
): DrawingColor {
  if (profile.color === 'monochrome') {
    return { r: 17, g: 17, b: 17 }
  }
  const layer = entity.layerId ? layerMap.get(entity.layerId) : undefined
  return entity.style?.color ?? layer?.color ?? { r: 17, g: 17, b: 17 }
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

function roundNumber(value: number): number {
  return Math.round(value * 1000) / 1000
}

function hasEntityStyle(style: unknown): style is EntityStyle {
  return Boolean(
    style &&
    typeof style === 'object' &&
    ('visible' in style || 'lineWeight' in style || 'lineType' in style || 'opacity' in style)
  )
}
