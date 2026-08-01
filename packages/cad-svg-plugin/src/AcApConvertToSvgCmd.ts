import type { AcApContext } from '@mlightcad/cad-simple-viewer/src/app/AcApContext'
import { AcEdCommand } from '@mlightcad/cad-simple-viewer/src/editor/command/AcEdCommand'

import { AcApSvgConvertor } from './AcApSvgConvertor'

/**
 * Command for converting the current CAD drawing to SVG format.
 * The command name is `csvg`.
 */
export class AcApConvertToSvgCmd extends AcEdCommand {
  /**
   * Renders the current drawing to SVG and downloads it in the browser.
   *
   * @param context - Application context for the active document
   */
  async execute(context: AcApContext) {
    const converter = new AcApSvgConvertor()
    await converter.convert(context)
  }
}
