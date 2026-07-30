// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

export interface AcEdMTextEditorResult {
  contents: string
  location: { x: number; y: number; z?: number }
  width: number
  height: number
  lineSpacingFactor: number
  attachmentPoint: number
}

export interface AcEdMTextEditorOptions {
  view: unknown
  location: { x: number; y: number; z?: number }
  initialAttachmentPoint?: number
  width: number
  textHeight: number
  initialText?: string
  toolbarFontFamilies?: string[]
  toolbarColorPicker?: unknown
  toolbarEnabled?: boolean
}

export class AcEdMTextEditor {
  static readonly defaultLineSpacingFactor = 0.3

  static getActiveInputBox() {
    return null
  }

  static addActiveInputBoxChangeListener() {}

  static removeActiveInputBoxChangeListener() {}

  static setDefaultColorPicker() {}

  static setDefaultToolbarEnabled() {}

  async open(
    _options: AcEdMTextEditorOptions
  ): Promise<AcEdMTextEditorResult | null> {
    return null
  }
}
