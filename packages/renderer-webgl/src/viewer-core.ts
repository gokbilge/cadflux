// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import type { DrawingBounds, DrawingDocument, Point2D } from '@cadflux/drawing-model'

import { buildRenderPlan } from './render-plan'
import type {
  CadFluxViewer,
  CadFluxViewerOptions,
  RenderPlan,
  ViewerBackground,
  ViewerTransform
} from './viewer-types'

const DEFAULT_BACKGROUND = '#0f1419'
const DEFAULT_PADDING = 24
const ZOOM_STEP = 1.2

export class CadFluxViewerCore implements CadFluxViewer {
  readonly canvas: HTMLCanvasElement
  readonly context: CanvasRenderingContext2D

  document: DrawingDocument | null = null
  activeLayoutId: string | null = null

  private readonly container: HTMLElement
  private readonly resizeObserver: ResizeObserver | null
  private readonly visibleLayerIds = new Set<string>()
  private background: ViewerBackground
  private plan: RenderPlan | null = null
  private transform: ViewerTransform = { scale: 1, offsetX: 0, offsetY: 0 }
  private pointerState: { pointerId: number; x: number; y: number } | null = null

  constructor(options: CadFluxViewerOptions) {
    this.container = options.container
    this.background = options.background ?? DEFAULT_BACKGROUND
    this.canvas = document.createElement('canvas')
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.display = 'block'
    this.canvas.style.touchAction = 'none'
    this.container.replaceChildren(this.canvas)

    const context = this.canvas.getContext('2d')
    if (!context) {
      throw new Error('2D canvas context is not available.')
    }
    this.context = context

    this.handleWheel = this.handleWheel.bind(this)
    this.handlePointerDown = this.handlePointerDown.bind(this)
    this.handlePointerMove = this.handlePointerMove.bind(this)
    this.handlePointerUp = this.handlePointerUp.bind(this)

    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false })
    this.canvas.addEventListener('pointerdown', this.handlePointerDown)
    this.canvas.addEventListener('pointermove', this.handlePointerMove)
    this.canvas.addEventListener('pointerup', this.handlePointerUp)
    this.canvas.addEventListener('pointercancel', this.handlePointerUp)

    this.resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => this.resize())
    this.resizeObserver?.observe(this.container)
    this.resize()
  }

  async load(document: DrawingDocument): Promise<void> {
    this.document = document
    this.activeLayoutId =
      document.layouts.find(layout => layout.type === 'model')?.id ??
      document.layouts[0]?.id ??
      null
    this.visibleLayerIds.clear()
    for (const layer of document.layers) {
      this.visibleLayerIds.add(layer.id)
    }
    this.rebuildPlan()
    this.fitToView()
  }

  resize(width?: number, height?: number): void {
    const nextWidth = Math.max(
      1,
      Math.floor(width ?? this.container.clientWidth ?? this.canvas.width ?? 1)
    )
    const nextHeight = Math.max(
      1,
      Math.floor(height ?? this.container.clientHeight ?? this.canvas.height ?? 1)
    )
    this.canvas.width = nextWidth
    this.canvas.height = nextHeight
    this.render()
  }

  fitToView(): void {
    this.transform = fitBoundsToViewport(this.plan?.bounds ?? emptyBounds(), {
      width: this.canvas.width,
      height: this.canvas.height
    })
    this.render()
  }

  zoomIn(): void {
    this.scaleAroundViewportCenter(ZOOM_STEP)
  }

  zoomOut(): void {
    this.scaleAroundViewportCenter(1 / ZOOM_STEP)
  }

  panBy(deltaX: number, deltaY: number): void {
    this.transform = {
      ...this.transform,
      offsetX: this.transform.offsetX + deltaX,
      offsetY: this.transform.offsetY + deltaY
    }
    this.render()
  }

  setLayerVisibility(layerId: string, visible: boolean): void {
    if (visible) {
      this.visibleLayerIds.add(layerId)
    } else {
      this.visibleLayerIds.delete(layerId)
    }
    this.rebuildPlan()
    this.render()
  }

  isLayerVisible(layerId: string): boolean {
    return this.visibleLayerIds.has(layerId)
  }

  setActiveLayout(layoutId: string): void {
    if (this.activeLayoutId === layoutId) return
    this.activeLayoutId = layoutId
    this.rebuildPlan()
    this.fitToView()
  }

  setBackground(background: ViewerBackground): void {
    this.background = background
    this.render()
  }

  destroy(): void {
    this.resizeObserver?.disconnect()
    this.canvas.removeEventListener('wheel', this.handleWheel)
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)
    this.canvas.removeEventListener('pointerup', this.handlePointerUp)
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp)
    this.pointerState = null
    this.container.replaceChildren()
  }

  private rebuildPlan() {
    if (!this.document) {
      this.plan = null
      return
    }
    this.plan = buildRenderPlan(this.document, {
      activeLayoutId: this.activeLayoutId,
      visibleLayerIds: this.visibleLayerIds
    })
  }

  private render() {
    const context = this.context
    context.save()
    context.fillStyle = this.background
    context.fillRect(0, 0, this.canvas.width, this.canvas.height)
    context.restore()

    if (!this.plan) return

    for (const primitive of this.plan.primitives) {
      context.save()
      context.strokeStyle = primitive.color
      context.fillStyle = primitive.color
      context.lineWidth = 1
      context.beginPath()

      switch (primitive.kind) {
        case 'line': {
          const start = worldToScreen(primitive.start, this.plan.bounds, this.transform, this.canvas)
          const end = worldToScreen(primitive.end, this.plan.bounds, this.transform, this.canvas)
          context.moveTo(start.x, start.y)
          context.lineTo(end.x, end.y)
          context.stroke()
          break
        }
        case 'polyline': {
          if (primitive.points.length === 0) break
          const first = worldToScreen(
            primitive.points[0],
            this.plan.bounds,
            this.transform,
            this.canvas
          )
          context.moveTo(first.x, first.y)
          for (const point of primitive.points.slice(1)) {
            const next = worldToScreen(point, this.plan.bounds, this.transform, this.canvas)
            context.lineTo(next.x, next.y)
          }
          if (primitive.closed) {
            context.closePath()
          }
          context.stroke()
          break
        }
        case 'circle': {
          const center = worldToScreen(
            primitive.center,
            this.plan.bounds,
            this.transform,
            this.canvas
          )
          context.arc(center.x, center.y, primitive.radius * this.transform.scale, 0, Math.PI * 2)
          context.stroke()
          break
        }
        case 'arc': {
          const center = worldToScreen(
            primitive.center,
            this.plan.bounds,
            this.transform,
            this.canvas
          )
          context.arc(
            center.x,
            center.y,
            primitive.radius * this.transform.scale,
            -primitive.startAngle,
            -primitive.endAngle,
            primitive.startAngle < primitive.endAngle
          )
          context.stroke()
          break
        }
        case 'ellipse': {
          const center = worldToScreen(
            primitive.center,
            this.plan.bounds,
            this.transform,
            this.canvas
          )
          context.ellipse(
            center.x,
            center.y,
            primitive.radiusX * this.transform.scale,
            primitive.radiusY * this.transform.scale,
            -primitive.rotation,
            0,
            Math.PI * 2
          )
          context.stroke()
          break
        }
        case 'text': {
          const position = worldToScreen(
            primitive.position,
            this.plan.bounds,
            this.transform,
            this.canvas
          )
          context.translate(position.x, position.y)
          context.rotate(-primitive.rotation)
          context.font = `${Math.max(12, primitive.fontSize * this.transform.scale * 0.25)}px sans-serif`
          context.textBaseline = 'middle'
          context.fillText(primitive.text, 0, 0)
          break
        }
      }

      context.restore()
    }
  }

  private scaleAroundViewportCenter(factor: number) {
    this.transform = {
      ...this.transform,
      scale: Math.max(0.0001, this.transform.scale * factor)
    }
    this.render()
  }

  private handleWheel(event: WheelEvent) {
    event.preventDefault()
    if (event.deltaY < 0) {
      this.zoomIn()
      return
    }
    this.zoomOut()
  }

  private handlePointerDown(event: PointerEvent) {
    this.pointerState = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    }
    this.canvas.setPointerCapture(event.pointerId)
  }

  private handlePointerMove(event: PointerEvent) {
    if (!this.pointerState || this.pointerState.pointerId !== event.pointerId) {
      return
    }
    const deltaX = event.clientX - this.pointerState.x
    const deltaY = event.clientY - this.pointerState.y
    this.pointerState = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    }
    this.panBy(deltaX, deltaY)
  }

  private handlePointerUp(event: PointerEvent) {
    if (this.pointerState?.pointerId === event.pointerId) {
      this.pointerState = null
      this.canvas.releasePointerCapture(event.pointerId)
    }
  }
}

export function fitBoundsToViewport(
  bounds: DrawingBounds,
  viewport: { width: number; height: number }
): ViewerTransform {
  const width = Math.max(1, viewport.width)
  const height = Math.max(1, viewport.height)
  const drawingWidth = Math.max(bounds.maxX - bounds.minX, 1)
  const drawingHeight = Math.max(bounds.maxY - bounds.minY, 1)
  const scale = Math.max(
    0.0001,
    Math.min(
      (width - DEFAULT_PADDING * 2) / drawingWidth,
      (height - DEFAULT_PADDING * 2) / drawingHeight
    )
  )
  return { scale, offsetX: 0, offsetY: 0 }
}

export function worldToScreen(
  point: Point2D,
  bounds: DrawingBounds,
  transform: ViewerTransform,
  viewport: { width: number; height: number }
): Point2D {
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  return {
    x: (point.x - centerX) * transform.scale + viewport.width / 2 + transform.offsetX,
    y: viewport.height / 2 - (point.y - centerY) * transform.scale + transform.offsetY
  }
}

function emptyBounds(): DrawingBounds {
  return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
}
