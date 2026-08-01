import { AcEdViewKeyHandler } from '../src/view/AcEdViewKeyHandler'
import type { AcTrView2d } from '../src/view/AcTrView2d'

function keyboardEvent(partial: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    code: 'KeyZ',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: null,
    isComposing: false,
    keyCode: 0,
    preventDefault: jest.fn(),
    ...partial
  } as KeyboardEvent
}

function createMockView(isEditorActive = false): AcTrView2d {
  return {
    editor: { isActive: isEditorActive },
    selectionSet: { clear: jest.fn() }
  } as unknown as AcTrView2d
}

describe('AcEdViewKeyHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('handleKeyDown clears selection on escape', () => {
    const handler = new AcEdViewKeyHandler(createMockView())
    const clearSelection = handler['view'].selectionSet.clear as jest.Mock

    const handled = handler.handleKeyDown(keyboardEvent({ code: 'Escape' }))
    expect(handled).toBe(false)
    expect(clearSelection).toHaveBeenCalledTimes(1)
  })

  test('handleKeyDown ignores unrelated keys', () => {
    const handler = new AcEdViewKeyHandler(createMockView(true))
    const clearSelection = handler['view'].selectionSet.clear as jest.Mock

    const handled = handler.handleKeyDown(keyboardEvent({ code: 'KeyZ' }))

    expect(handled).toBe(false)
    expect(clearSelection).not.toHaveBeenCalled()
  })
})
