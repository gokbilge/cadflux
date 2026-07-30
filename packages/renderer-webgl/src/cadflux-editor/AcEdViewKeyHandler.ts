// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 CadFlux contributors

import { AcEdMTextEditor } from '../../../cad-simple-viewer/src/editor/input/ui/AcEdMTextEditor'
import type { AcTrView2d } from '../../../cad-simple-viewer/src/view/AcTrView2d'

export class AcEdViewKeyHandler {
  constructor(private readonly view: AcTrView2d) {}

  handleKeyDown(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null
    if (
      event.isComposing ||
      event.keyCode === 229 ||
      target?.tagName === 'TEXTAREA' ||
      target?.isContentEditable
    ) {
      return false
    }

    if (target?.tagName === 'INPUT') {
      const input = target as HTMLInputElement
      if (input.value.trim() !== '') {
        return false
      }
    }

    if (AcEdMTextEditor.getActiveInputBox()) {
      return false
    }

    if (event.code === 'Escape') {
      this.view.selectionSet.clear()
    }

    return false
  }
}
