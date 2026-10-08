import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  on: vi.fn(),
  handle: vi.fn(),
  popup: vi.fn(),
  rootPopup: vi.fn(),
  win: { id: 1 },
  item: { enabled: true, visible: true, submenu: { popup: vi.fn() } }
}))
vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: () => mocks.win },
  Menu: { getApplicationMenu: () => ({ items: [mocks.item], popup: mocks.rootPopup }) },
  MenuItem: class {},
  ipcMain: { on: mocks.on, handle: mocks.handle }
}))
vi.mock('electron-log', () => ({ default: { error: vi.fn() } }))
import { registerWindowHandlers } from '../../../src/main/ipc/window'

describe('application submenu IPC', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.item.enabled = true
    mocks.item.visible = true
    registerWindowHandlers()
  })

  function open(index?: number) {
    const handler = mocks.on.mock.calls.find(([channel]) => channel === 'mt::menu::popup-application')![1]
    handler({ sender: {} }, { x: 12, y: 32 }, index)
  }

  it('opens the existing submenu with its window context', () => {
    open(0)
    expect(mocks.item.submenu.popup).toHaveBeenCalledWith({ window: mocks.win, x: 12, y: 32 })
    expect(mocks.rootPopup).not.toHaveBeenCalled()
  })

  it('retains the whole-menu API for existing callers', () => {
    open()
    expect(mocks.rootPopup).toHaveBeenCalledOnce()
  })

  it('ignores invalid, hidden and disabled categories', () => {
    for (const index of [-1, 1, 0.5, NaN]) open(index)
    mocks.item.enabled = false
    open(0)
    mocks.item.enabled = true
    mocks.item.visible = false
    open(0)
    expect(mocks.item.submenu.popup).not.toHaveBeenCalled()
    expect(mocks.rootPopup).not.toHaveBeenCalled()
  })
})
