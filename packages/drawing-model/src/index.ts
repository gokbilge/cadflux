// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

export const DRAWING_MODEL_SCHEMA_VERSION = 1 as const

export {
  parseMText,
  type DrawingTextRun,
  type DrawingTextStyle,
  type ParseMTextOptions,
  type ParsedMText,
  type TextHorizontalAlignment,
  type TextVerticalAlignment
} from './text'

export type DrawingFormat = 'dwg' | 'dxf'
export type DrawingUnits = 'unitless' | 'inch' | 'foot' | 'mile' | 'mm' | 'cm' | 'm' | 'km'

export interface Point2D {
  x: number
  y: number
}

export interface DrawingBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface Matrix2D {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export interface DrawingColor {
  r: number
  g: number
  b: number
  a?: number
  source?: 'explicit' | 'by-layer' | 'by-block' | 'aci'
  aci?: number
}

export interface EntityStyle {
  color?: DrawingColor
  lineType?: string
  lineWeight?: number
  opacity?: number
  visible?: boolean
}

export interface DrawingSourceInfo {
  fileName: string
  format: DrawingFormat
  version?: string
  sizeBytes?: number
}

export interface DrawingDiagnostic {
  severity: 'info' | 'warning' | 'error'
  code: string
  message: string
  entityId?: string
  sourceType?: string
  details?: Record<string, unknown>
}

export interface DrawingLayer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  color?: DrawingColor
  lineType?: string
  lineWeight?: number
}

export interface DrawingLayout {
  id: string
  name: string
  type: 'model' | 'paper'
  paperWidth?: number
  paperHeight?: number
  units?: DrawingUnits
  entities?: string[]
}

export type TextStyle = import('./text').DrawingTextStyle
export type MTextFormattingRun = import('./text').DrawingTextRun

export interface BaseDrawingEntity {
  id: string
  kind: string
  sourceType: string
  layerId?: string
  layoutId?: string
  bounds?: DrawingBounds
  style?: EntityStyle
}

export interface LineEntity extends BaseDrawingEntity {
  kind: 'line'
  start: Point2D
  end: Point2D
}

export interface PolylineEntity extends BaseDrawingEntity {
  kind: 'polyline'
  closed?: boolean
  vertices: Point2D[]
}

export interface CircleEntity extends BaseDrawingEntity {
  kind: 'circle'
  center: Point2D
  radius: number
}

export interface ArcEntity extends BaseDrawingEntity {
  kind: 'arc'
  center: Point2D
  radius: number
  startAngle: number
  endAngle: number
}

export interface EllipseEntity extends BaseDrawingEntity {
  kind: 'ellipse'
  center: Point2D
  radiusX: number
  radiusY: number
  rotation?: number
}

export interface SplineEntity extends BaseDrawingEntity {
  kind: 'spline'
  degree?: number
  controlPoints: Point2D[]
}

export interface TextEntity extends BaseDrawingEntity {
  kind: 'text'
  text: string
  insertionPoint: Point2D
  style: TextStyle
}

export interface MTextEntity extends BaseDrawingEntity {
  kind: 'mtext'
  rawText: string
  plainText: string
  runs: MTextFormattingRun[]
  insertionPoint: Point2D
  width?: number
  height?: number
  direction?: Point2D
  style: TextStyle
}

export interface BlockReferenceEntity extends BaseDrawingEntity {
  kind: 'block-reference'
  blockId: string
  transform: Matrix2D
  attributes?: TextEntity[]
}

export interface HatchEntity extends BaseDrawingEntity {
  kind: 'hatch'
  patternName?: string
}

export interface ImageEntity extends BaseDrawingEntity {
  kind: 'image'
  path?: string
  width?: number
  height?: number
}

export interface DimensionEntity extends BaseDrawingEntity {
  kind: 'dimension'
  text?: string
}

export interface UnsupportedEntity extends BaseDrawingEntity {
  kind: 'unsupported'
  metadata?: Record<string, unknown>
}

export type DrawingEntity =
  | LineEntity
  | PolylineEntity
  | CircleEntity
  | ArcEntity
  | EllipseEntity
  | SplineEntity
  | TextEntity
  | MTextEntity
  | BlockReferenceEntity
  | HatchEntity
  | ImageEntity
  | DimensionEntity
  | UnsupportedEntity

export interface DrawingBlock {
  id: string
  name: string
  basePoint: Point2D
  entities: DrawingEntity[]
}

export interface DrawingResources {
  fonts: string[]
  images: string[]
  xrefs: string[]
}

export interface DrawingDocument {
  schemaVersion: typeof DRAWING_MODEL_SCHEMA_VERSION
  id: string
  source: DrawingSourceInfo
  units: DrawingUnits
  bounds: DrawingBounds
  layers: DrawingLayer[]
  layouts: DrawingLayout[]
  blocks: DrawingBlock[]
  entities: DrawingEntity[]
  resources: DrawingResources
  diagnostics: DrawingDiagnostic[]
}

export interface DrawingHandleInput {
  name: string
  relativePath?: string
  lastModifiedMs?: number
}

export interface CadFluxDrawingHandle {
  id: string
  input: DrawingHandleInput
  title: string
  openedAt: string
}

export function createDrawingHandle(
  input: DrawingHandleInput
): CadFluxDrawingHandle {
  return {
    id: `${input.relativePath ?? input.name}:${input.lastModifiedMs ?? 0}`,
    input,
    title: input.name,
    openedAt: new Date().toISOString()
  }
}

export function identityMatrix(): Matrix2D {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
}

export function multiplyMatrices(left: Matrix2D, right: Matrix2D): Matrix2D {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f
  }
}

export function translateMatrix(x: number, y: number): Matrix2D {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y }
}

export function scaleMatrix(x: number, y = x): Matrix2D {
  return { a: x, b: 0, c: 0, d: y, e: 0, f: 0 }
}

export function rotateMatrix(angleRadians: number): Matrix2D {
  const cos = Math.cos(angleRadians)
  const sin = Math.sin(angleRadians)
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 }
}

export function applyMatrixToPoint(matrix: Matrix2D, point: Point2D): Point2D {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f
  }
}
