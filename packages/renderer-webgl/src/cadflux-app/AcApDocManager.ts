// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import {
  AcCmEventManager,
  AcDbDatabaseConverterManager,
  AcDbFileType,
  acdbHostApplicationServices
} from '@mlightcad/data-model'
import { AcDbLibreDwgConverter } from '@mlightcad/libredwg-converter'
import { FontManager } from '@mlightcad/mtext-renderer'
import { AcTrMTextRenderer } from '@mlightcad/three-renderer'

import { AcApContext } from '../../../cad-simple-viewer/src/app/AcApContext'
import { AcApDocument } from '../../../cad-simple-viewer/src/app/AcApDocument'
import { AcApFontLoader } from '../../../cad-simple-viewer/src/app/AcApFontLoader'
import type { AcApOpenDatabaseOptions } from '../../../cad-simple-viewer/src/app/AcDbOpenDatabaseOptions'
import { AcEdCommandStack, AcEdOpenMode } from '../../../cad-simple-viewer/src/editor'
import { AcTrView2d } from '../../../cad-simple-viewer/src/view'
import {
  LIBREDWG_PARSER_WORKER_FILE,
  MTEXT_RENDERER_WORKER_FILE
} from '../../../cad-simple-viewer/src/app/AcApWorkerAssets'

export interface AcDbDocumentEventArgs {
  doc: AcApDocument
  mode: AcEdOpenMode
}

export interface AcApWebworkerFiles {
  dwgParser?: string | URL
  mtextRender?: string | URL
}

export interface AcApDocManagerOptions {
  container?: HTMLElement
  width?: number
  height?: number
  autoResize?: boolean
  baseUrl?: string
  builtinOpenFileDialog?: boolean
  webworkerFileUrls?: AcApWebworkerFiles
  notLoadDefaultFonts?: boolean
}

const DEFAULT_BASE_URL = 'https://cdn.jsdelivr.net/gh/mlightcad/cad-data/'
const DEFAULT_FONTS_PRESET = 'modern' as const
const DEFAULT_WEBWORKER_FILE_URLS: Required<AcApWebworkerFiles> = {
  dwgParser: `./assets/${LIBREDWG_PARSER_WORKER_FILE}`,
  mtextRender: `./assets/${MTEXT_RENDERER_WORKER_FILE}`
}

class CadFluxCommandManagerStub {
  getCommandAliases(): string[] {
    return []
  }
}

export class AcApDocManager {
  private static _instance?: AcApDocManager

  static createInstance(options: AcApDocManagerOptions = {}) {
    if (!this._instance) {
      this._instance = new AcApDocManager(options)
    }
    return this._instance
  }

  static get instance() {
    if (!this._instance) {
      throw new Error('AcApDocManager instance is not created yet!')
    }
    return this._instance
  }

  readonly events = {
    documentActivated: new AcCmEventManager<AcDbDocumentEventArgs>()
  }

  readonly commandManager = new CadFluxCommandManagerStub()

  private readonly _context: AcApContext
  private readonly _fontLoader: AcApFontLoader
  private readonly _baseUrl: string
  private _destroyed = false

  private constructor(options: AcApDocManagerOptions = {}) {
    this._baseUrl = options.baseUrl || DEFAULT_BASE_URL
    FontManager.instance.setDefaultFonts(DEFAULT_FONTS_PRESET)

    const doc = new AcApDocument()
    const initialSize = options.container?.getBoundingClientRect() ?? {
      width: 300,
      height: 150
    }
    const view = new AcTrView2d({
      container: options.container,
      calculateSizeCallback: () => ({
        width: options.autoResize
          ? Math.max(1, Math.floor(options.container?.clientWidth ?? initialSize.width))
          : Math.max(1, Math.floor(options.width ?? initialSize.width)),
        height: options.autoResize
          ? Math.max(1, Math.floor(options.container?.clientHeight ?? initialSize.height))
          : Math.max(1, Math.floor(options.height ?? initialSize.height))
      })
    })

    this._context = new AcApContext(view, doc)
    this._fontLoader = new AcApFontLoader()
    this._fontLoader.baseUrl = this._resolveFontBaseUrl()
    acdbHostApplicationServices().workingDatabase = doc.database

    this.registerWorkers(options.webworkerFileUrls)

    if (!options.notLoadDefaultFonts) {
      void this.loadDefaultFonts()
    }
  }

  get context() {
    return this._context
  }

  get curDocument() {
    return this._context.doc
  }

  get curView() {
    return this._context.view as AcTrView2d
  }

  get editor() {
    return this._context.view.editor
  }

  get avaiableFonts() {
    return this._fontLoader.avaiableFonts
  }

  async destroy() {
    if (this._destroyed) {
      return
    }
    this._destroyed = true
    this.curView.stopAnimationLoop()
    this.curView.clear()
    this._context.doc.destroy()
    AcTrMTextRenderer.resetInstance()
    AcApDocManager._instance = undefined
  }

  async loadDefaultFonts(fonts?: string[]) {
    if (fonts == null) {
      await this._fontLoader.load([...FontManager.instance.getFontsToLoad()])
      return
    }
    await this._fontLoader.load(fonts)
  }

  async openDocument(
    fileName: string,
    content: ArrayBuffer,
    options: AcApOpenDatabaseOptions = {}
  ) {
    const resolvedOptions = this.setOptions(options)
    this.onBeforeOpenDocument(resolvedOptions)
    const isSuccess = await this.context.doc.openDocument(
      fileName,
      content,
      resolvedOptions
    )
    this.onAfterOpenDocument(isSuccess, resolvedOptions)
    return isSuccess
  }

  lookupLocalCmd() {
    return undefined
  }

  lookupGlobalCmd() {
    return undefined
  }

  searchCommandsByPrefix() {
    return []
  }

  async sendStringToExecute(_command: string) {
    return
  }

  private onBeforeOpenDocument(options?: AcApOpenDatabaseOptions) {
    this.curView.bindDrawDatabase(this.context.doc.database)
    this.curView.progressiveRendering = options?.progressiveRendering ?? false
    this.curView.clear()
    acdbHostApplicationServices().workingDatabase = this.context.doc.database
  }

  private onAfterOpenDocument(
    isSuccess: boolean,
    options?: AcApOpenDatabaseOptions
  ) {
    const recoveredPartialContent =
      !isSuccess && this.hasRecoverablePartialContent()
    if (!(isSuccess || recoveredPartialContent)) {
      return
    }

    this.context.doc.destroy()
    const doc = this.context.doc
    const db = doc.database
    this.events.documentActivated.dispatch({
      doc,
      mode: options?.mode ?? AcEdOpenMode.Read
    })

    this.curView.activeLayoutBtrId = db.currentSpaceId
    this.curView.modelSpaceBtrId = db.tables.blockTable.modelSpace.objectId
    this.curView.syncDisplaySysVars(db)
    this.curView.zoomToFitDrawing()
    this.curView.markLayoutAsInitialized(db.currentSpaceId)
    acdbHostApplicationServices().workingDatabase = db
  }

  private hasRecoverablePartialContent(): boolean {
    const db = this.context.doc.database
    const modelSpace = db.tables.blockTable.modelSpace
    if (modelSpace) {
      return modelSpace.newIterator().count > 0
    }
    return !db.extents.isEmpty()
  }

  private setOptions(options?: AcApOpenDatabaseOptions) {
    const next = options ?? {}
    if (next.fontLoader == null) {
      next.fontLoader = this._fontLoader
    }
    if (next.drawNoPlotLayers == null) {
      next.drawNoPlotLayers = false
    }
    if (next.progressiveRendering == null) {
      next.progressiveRendering = false
    }
    return next
  }

  private _resolveFontBaseUrl() {
    return this._baseUrl.endsWith('/') ? `${this._baseUrl}fonts/` : `${this._baseUrl}/fonts/`
  }

  private registerWorkers(webworkerFileUrls?: AcApWebworkerFiles) {
    try {
      const converter = new AcDbLibreDwgConverter({
        convertByEntityType: false,
        useWorker: true,
        parserWorkerUrl:
          webworkerFileUrls?.dwgParser ?? DEFAULT_WEBWORKER_FILE_URLS.dwgParser
      })
      AcDbDatabaseConverterManager.instance.register(
        AcDbFileType.DWG,
        converter
      )
    } catch {
      // ignore duplicate or unsupported registration in CadFlux web runtime
    }

    const mtextRenderer = AcTrMTextRenderer.getInstance()
    mtextRenderer.initialize(
      webworkerFileUrls?.mtextRender ?? DEFAULT_WEBWORKER_FILE_URLS.mtextRender
    )
    void mtextRenderer.setDefaultFonts(DEFAULT_FONTS_PRESET)
  }
}
