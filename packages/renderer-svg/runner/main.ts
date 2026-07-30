// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { AcApSettingManager } from '@mlightcad/cad-simple-viewer'
import {
  AcApDocManager,
  AcEdOpenMode,
  LIBREDWG_PARSER_WORKER_FILE,
  MTEXT_RENDERER_WORKER_FILE
} from '@mlightcad/cad-simple-viewer'
import { AcSvgRenderer } from '@mlightcad/cad-svg-plugin'
import { accmYieldForPaint } from '@mlightcad/data-model'

declare global {
  interface Window {
    exportCadToSvg: (fileName: string, bytes: Uint8Array) => Promise<string>
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

window.exportCadToSvg = async (fileName, bytes) => {
  await ensureViewer()
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
  return renderer.exportAsync()
}
