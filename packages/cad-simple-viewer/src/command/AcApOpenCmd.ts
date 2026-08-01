import { AcApContext } from '../app'
import { AcEdCommand } from '../editor/command/AcEdCommand'
import { eventBus } from '../editor/global/eventBus'

/**
 * Command to open a CAD file.
 *
 * Emits an `open-file` event that triggers the built-in file picker installed
 * by {@link AcApDocManager}. Host applications can disable the built-in picker
 * with `builtinOpenFileDialog: false` and handle `open-file` themselves.
 */
export class AcApOpenCmd extends AcEdCommand {
  /**
   * Executes the open file command.
   *
   * @param _context - The current application context (not used in this command)
   */
  async execute(_context: AcApContext) {
    eventBus.emit('open-file', {})
  }
}
