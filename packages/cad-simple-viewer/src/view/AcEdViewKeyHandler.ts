import type { AcTrView2d } from './AcTrView2d'

/**
 * Handles minimal global keyboard shortcuts for the read-only CAD view.
 *
 * Only selection-reset behavior is preserved here. Legacy editing shortcuts
 * such as erase, undo, redo, and inline MText-specific suppression are no
 * longer part of the active CadFlux viewer path.
 */
export class AcEdViewKeyHandler {
  constructor(private readonly view: AcTrView2d) {}

  /**
   * Handles a document `keydown` event for the minimal read-only shortcut set.
   *
   * @returns `true` when the event was consumed and default action prevented.
   */
  handleKeyDown(e: KeyboardEvent): boolean {
    if (e.code !== 'Escape') {
      return false
    }

    this.view.selectionSet.clear()
    return false
  }
}
