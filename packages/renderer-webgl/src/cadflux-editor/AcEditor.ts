// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { AcCmEventManager } from '@mlightcad/data-model'

import {
  AcEdCorsorType,
  AcEdCursorManager
} from '../../../cad-simple-viewer/src/editor/input/AcEdCursorManager'
import type { AcEdInputModifiers } from '../../../cad-simple-viewer/src/editor/input/AcEdInputModifiers'
import type { AcEdInputToggles } from '../../../cad-simple-viewer/src/editor/input/AcEdInputToggles'
import type { AcEdSelectionFilter } from '../../../cad-simple-viewer/src/editor/input/AcEdSelectionFilter'
import type {
  AcEdPromptAngleOptions,
  AcEdPromptBoxOptions,
  AcEdPromptBoxResult,
  AcEdPromptDistanceOptions,
  AcEdPromptDoubleOptions,
  AcEdPromptDoubleResult,
  AcEdPromptEntityOptions,
  AcEdPromptEntityResult,
  AcEdPromptIntegerOptions,
  AcEdPromptIntegerResult,
  AcEdPromptKeywordOptions,
  AcEdPromptPointOptions,
  AcEdPromptPointResult,
  AcEdPromptResult,
  AcEdPromptSelectionOptions,
  AcEdPromptSelectionResult,
  AcEdPromptStringOptions
} from '../../../cad-simple-viewer/src/editor/input/prompt'
import { AcEdPromptStatus } from '../../../cad-simple-viewer/src/editor/input/prompt/AcEdPromptStatus'
import type { AcEdBaseView } from '../../../cad-simple-viewer/src/editor/view/AcEdBaseView'

export interface AcDbSysVarEventArgs {
  name: string
}

export interface AcEdCommandEventArgs {
  command: unknown
}

type AcEdMessageType = 'info' | 'warning' | 'error' | 'success'

const EMPTY_MODIFIERS: AcEdInputModifiers = {
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false
}

const EMPTY_TOGGLES: AcEdInputToggles = {
  ctrlArcFlip: false
}

export class AcEditor {
  private _previousCursor?: AcEdCorsorType
  private _currentCursor?: AcEdCorsorType
  private readonly _cursorManager: AcEdCursorManager
  private readonly _messages: HTMLDivElement

  protected _view: AcEdBaseView

  public readonly events = {
    sysVarChanged: new AcCmEventManager<AcDbSysVarEventArgs>(),
    commandWillStart: new AcCmEventManager<AcEdCommandEventArgs>(),
    commandEnded: new AcCmEventManager<AcEdCommandEventArgs>()
  }

  constructor(view: AcEdBaseView) {
    this._view = view
    this._cursorManager = new AcEdCursorManager(view)
    this._messages = document.createElement('div')
    this._messages.className = 'cadflux-editor-messages'
    this._view.container.appendChild(this._messages)
    this.injectCss()
  }

  get isActive() {
    return false
  }

  get isEntitySelectionActive() {
    return false
  }

  getInputModifiers(): AcEdInputModifiers {
    return EMPTY_MODIFIERS
  }

  getInputToggles(): AcEdInputToggles {
    return EMPTY_TOGGLES
  }

  resetInputToggles() {}

  cancelActiveInput() {}

  enqueueScriptInputs(_inputs: string[]) {}

  clearScriptInputs() {}

  showMessage(message: string, type: AcEdMessageType = 'info') {
    if (!message) return

    const item = document.createElement('div')
    item.className = `cadflux-editor-message cadflux-editor-message--${type}`
    item.textContent = message
    this._messages.appendChild(item)
    while (this._messages.childElementCount > 6) {
      this._messages.firstElementChild?.remove()
    }
    window.clearTimeout((item as unknown as { __timer?: number }).__timer)
    ;(item as unknown as { __timer?: number }).__timer = window.setTimeout(() => {
      item.remove()
      if (this._messages.childElementCount === 0) {
        this._messages.style.display = 'none'
      }
    }, 6000)
    this._messages.style.display = 'flex'
  }

  peekScriptInput() {
    return undefined
  }

  consumeScriptInput() {
    return undefined
  }

  get currentCursor() {
    return this._currentCursor
  }

  restoreCursor() {
    if (this._previousCursor != null) {
      this.setCursor(this._previousCursor)
    }
  }

  setCursor(cursorType: AcEdCorsorType) {
    this._cursorManager.setCursor(cursorType)
    this._previousCursor = this._currentCursor
    this._currentCursor = cursorType
  }

  async withCursor<T>(
    cursorType: AcEdCorsorType,
    action: () => Promise<T> | T
  ): Promise<T> {
    const originalCursor = this._currentCursor
    this.setCursor(cursorType)

    try {
      return await Promise.resolve(action())
    } finally {
      if (originalCursor !== undefined) {
        this.setCursor(originalCursor)
      } else {
        this.restoreCursor()
      }
    }
  }

  setCursorColor(color: string) {
    this._cursorManager.setCursorColor(color)
  }

  syncCursorBackground(backgroundColor: number) {
    this._cursorManager.syncBackgroundColor(backgroundColor)
  }

  async getPoint(
    _options: AcEdPromptPointOptions
  ): Promise<AcEdPromptPointResult> {
    return this.cancelled()
  }

  async getAngle(
    _options: AcEdPromptAngleOptions
  ): Promise<AcEdPromptDoubleResult> {
    return this.cancelled()
  }

  async getDistance(
    _options: AcEdPromptDistanceOptions
  ): Promise<AcEdPromptDoubleResult> {
    return this.cancelled()
  }

  async getDouble(
    _options: AcEdPromptDoubleOptions
  ): Promise<AcEdPromptDoubleResult> {
    return this.cancelled()
  }

  async getInteger(
    _options: AcEdPromptIntegerOptions
  ): Promise<AcEdPromptIntegerResult> {
    return this.cancelled()
  }

  async getString(_options: AcEdPromptStringOptions): Promise<AcEdPromptResult> {
    return this.cancelled()
  }

  async getKeywords(
    _options: AcEdPromptKeywordOptions
  ): Promise<AcEdPromptResult> {
    return this.cancelled()
  }

  async getEntity(
    _options: AcEdPromptEntityOptions
  ): Promise<AcEdPromptEntityResult> {
    return this.cancelled()
  }

  async getSelection(
    _options: AcEdPromptSelectionOptions
  ): Promise<AcEdPromptSelectionResult> {
    return this.cancelled()
  }

  async getBox(_options: AcEdPromptBoxOptions): Promise<AcEdPromptBoxResult> {
    return this.cancelled()
  }

  async selectImplied(_filter?: AcEdSelectionFilter) {
    return this.cancelled()
  }

  private cancelled<T extends { status: AcEdPromptStatus }>(): T {
    return { status: AcEdPromptStatus.Cancel } as T
  }

  private injectCss() {
    if (document.getElementById('cadflux-editor-message-style')) return

    const style = document.createElement('style')
    style.id = 'cadflux-editor-message-style'
    style.textContent = `
      .cadflux-editor-messages {
        position: absolute;
        right: 16px;
        bottom: 16px;
        z-index: 28;
        display: none;
        flex-direction: column;
        gap: 8px;
        max-width: min(420px, calc(100% - 32px));
        pointer-events: none;
      }
      .cadflux-editor-message {
        border-radius: 8px;
        padding: 10px 12px;
        background: rgba(13, 17, 23, 0.92);
        color: #f5f7fa;
        font: 12px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
      }
      .cadflux-editor-message--warning {
        color: #ffcc66;
      }
      .cadflux-editor-message--error {
        color: #ff7b72;
      }
      .cadflux-editor-message--success {
        color: #7ee787;
      }
    `
    document.head.appendChild(style)
  }
}
