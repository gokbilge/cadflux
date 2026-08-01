import type { AcApContext } from '@mlightcad/cad-simple-viewer/src/app/AcApContext'
import { AcEdCommand } from '@mlightcad/cad-simple-viewer/src/editor/command/AcEdCommand'

import { AcApPdfConvertor } from './AcApPdfConvertor'

/**
 * Command for converting the current CAD drawing to PDF format.
 * The command name is `cpdf`.
 */
export class AcApConvertToPdfCmd extends AcEdCommand {
  /**
   * Renders the current drawing to PDF and downloads it in the browser.
   *
   * @param context - Application context for the active document
   */
  async execute(context: AcApContext) {
    const converter = new AcApPdfConvertor()
    await converter.convert(context)
  }
}
