import type { AcApContext } from '@mlightcad/cad-simple-viewer/src/app/AcApContext'
import { AcEdCommand } from '@mlightcad/cad-simple-viewer/src/editor/command/AcEdCommand'

import { AcApPdfImportConvertor } from './AcApPdfImportConvertor'

/**
 * Command for importing vector geometry from a PDF file.
 * The command name is `ipdf`.
 */
export class AcApImportPdfCmd extends AcEdCommand {
  /**
   * Opens a file picker and imports vector geometry from the selected PDF.
   *
   * @param context - Application context for the target document
   */
  async execute(context: AcApContext) {
    const convertor = new AcApPdfImportConvertor()
    convertor.importFromFilePicker(context)
  }
}
