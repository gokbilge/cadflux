// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { AcApSettingManager } from '@mlightcad/cad-simple-viewer'
import {
  AcApDocManager,
  AcEdOpenMode,
  LIBREDWG_PARSER_WORKER_FILE,
  MTEXT_RENDERER_WORKER_FILE
} from '@mlightcad/cad-simple-viewer'
import { accmYieldForPaint } from '@mlightcad/data-model'

declare global {
  interface Window {
    exportCadToPdf: (fileName: string, bytes: Uint8Array) => Promise<number[]>
  }
}

let ready = false

async function ensureViewer(): Promise<void> {
  if (ready) {
    return
  }
  const container = document.getElementById('cad-root') as HTMLDivElement
  AcApDocManager.createInstance({
    container,
    width: 1280,
    height: 720,
    autoResize: false,
    baseUrl: 'https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/',
    useMainThreadDraw: true,
    webworkerFileUrls: {
      dwgParser: `./workers/${LIBREDWG_PARSER_WORKER_FILE}`,
      mtextRender: `./workers/${MTEXT_RENDERER_WORKER_FILE}`
    }
  })
  ready = true
}

window.exportCadToPdf = async (fileName, bytes) => {
  await ensureViewer()
  const [{ AcSvgRenderer }, { jsPDF }, { svg2pdf }] = await Promise.all([
    import('@mlightcad/cad-svg-plugin/renderer'),
    import('jspdf'),
    import('svg2pdf.js')
  ])
  const docManager = AcApDocManager.instance
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  )
  const opened = await docManager.openDocument(fileName, buffer, {
    mode: AcEdOpenMode.Read
  })
  if (!opened) {
    throw new Error(`Failed to open "${fileName}".`)
  }

  await accmYieldForPaint()

  AcSvgRenderer.prepareExport()
  const renderer = new AcSvgRenderer()
  const context = docManager.context
  const db = context.doc.database
  renderer.ltscale = db.ltscale
  renderer.celtscale = db.celtscale
  renderer.showLineWeight = !!db.lwdisplay
  renderer.setFontMapping(AcApSettingManager.instance.fontMapping)

  const bg = context.view?.backgroundColor ?? 0xffffff
  renderer.currentBackgroundColor = bg
  renderer.changeForeground(bg === 0 ? 0xffffff : 0x000000)

  const entities = context.doc.database.tables.blockTable.modelSpace.newIterator()
  for (const entity of entities) {
    entity.worldDraw(renderer)
  }

  const svgString = await renderer.exportAsync()
  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgEl = svgDoc.documentElement as unknown as SVGSVGElement
  const vb = svgEl.getAttribute('viewBox')?.split(' ').map(Number)
  const width = vb && vb.length === 4 ? Math.abs(vb[2]) : 297
  const height = vb && vb.length === 4 ? Math.abs(vb[3]) : 210
  const pdf = new jsPDF({
    orientation: width >= height ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [width, height]
  })

  await svg2pdf(svgEl, pdf, { x: 0, y: 0, width, height })
  const arrayBuffer = pdf.output('arraybuffer')
  return Array.from(new Uint8Array(arrayBuffer))
}
