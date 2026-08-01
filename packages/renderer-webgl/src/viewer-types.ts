// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type {
  DrawingBounds,
  DrawingColor,
  DrawingDocument,
  Point2D
} from '@cadflux/drawing-model'

export type ViewerBackground = string

export interface ViewerSize {
  width: number
  height: number
}

export interface ViewerTransform {
  scale: number
  offsetX: number
  offsetY: number
}

export interface ViewerSnapshot {
  document: DrawingDocument
  layoutId: string
  visibleLayerIds: ReadonlySet<string>
}

export interface RenderedPrimitiveBase {
  id: string
  layerId?: string
  color: string
}

export interface RenderedLine extends RenderedPrimitiveBase {
  kind: 'line'
  start: Point2D
  end: Point2D
}

export interface RenderedPolyline extends RenderedPrimitiveBase {
  kind: 'polyline'
  points: Point2D[]
  closed: boolean
}

export interface RenderedCircle extends RenderedPrimitiveBase {
  kind: 'circle'
  center: Point2D
  radius: number
}

export interface RenderedArc extends RenderedPrimitiveBase {
  kind: 'arc'
  center: Point2D
  radius: number
  startAngle: number
  endAngle: number
}

export interface RenderedEllipse extends RenderedPrimitiveBase {
  kind: 'ellipse'
  center: Point2D
  radiusX: number
  radiusY: number
  rotation: number
}

export interface RenderedText extends RenderedPrimitiveBase {
  kind: 'text'
  text: string
  position: Point2D
  rotation: number
  fontSize: number
}

export type RenderedPrimitive =
  | RenderedLine
  | RenderedPolyline
  | RenderedCircle
  | RenderedArc
  | RenderedEllipse
  | RenderedText

export interface RenderPlan {
  bounds: DrawingBounds
  primitives: RenderedPrimitive[]
}

export interface CadFluxViewerOptions {
  container: HTMLElement
  background?: ViewerBackground
}

export interface CadFluxViewer {
  readonly document: DrawingDocument | null
  readonly activeLayoutId: string | null
  load(document: DrawingDocument): Promise<void>
  resize(width?: number, height?: number): void
  fitToView(): void
  zoomIn(): void
  zoomOut(): void
  panBy(deltaX: number, deltaY: number): void
  setLayerVisibility(layerId: string, visible: boolean): void
  isLayerVisible(layerId: string): boolean
  setActiveLayout(layoutId: string): void
  setBackground(background: ViewerBackground): void
  destroy(): void
}

export function drawingColorToCss(color?: DrawingColor): string {
  if (!color) return 'rgba(255, 255, 255, 1)'
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a == null ? 1 : color.a})`
}
