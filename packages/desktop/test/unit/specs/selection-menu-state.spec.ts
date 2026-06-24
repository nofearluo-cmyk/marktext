import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createSelectionChange = (type: string): never => ({
  start: {
    key: type,
    offset: 0,
    block: { text: type },
    type: 'span'
  },
  end: {
    key: type,
    offset: 0,
    block: {},
    type: 'span'
  },
  affiliation: [{ type }]
}) as never

describe('selection menu state', () => {
  let send: ReturnType<typeof vi.fn>
  const selectionMenuCalls = (): unknown[][] =>
    send.mock.calls.filter(([channel]) => channel === 'mt::editor-selection-changed')

  beforeEach(async() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    vi.resetModules()
    send = vi.fn()

    Object.assign(window, {
      path: {
        sep: '\\',
        dirname: () => ''
      },
      electron: {
        process: {
          platform: 'win32',
          env: {}
        },
        ipcRenderer: {
          send,
          on: vi.fn()
        }
      },
      marktext: {
        env: {
          windowId: 1
        }
      }
    })

    const { createPinia, setActivePinia } = await import('pinia')
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('cancels pending menu IPC updates', async() => {
    const { useEditorStore } = await import('@/store/editor')
    const editorStore = useEditorStore()
    const tab = {
      id: 'tab-1',
      markdown: '# Heading\n\nparagraph',
      trimTrailingNewline: 3,
      wordCount: { paragraph: 2, word: 2, character: 19, all: 19 },
      blocks: [],
      history: {
        stack: [{ id: 0 }],
        index: 0,
        lastEditIndex: 0,
        lastInitIndex: -1
      },
      lastSavedHistoryId: 0,
      isSaved: false,
      filename: 'Untitled-1',
      pathname: ''
    }

    editorStore.tabs = [tab as never]
    editorStore.currentFile = editorStore.tabs[0]
    editorStore.tabIdToIndex = { 'tab-1': 0 }

    editorStore.SELECTION_CHANGE(createSelectionChange('p'))
    expect(selectionMenuCalls()).toHaveLength(1)
    send.mockClear()

    vi.advanceTimersByTime(10)
    editorStore.SELECTION_CHANGE(createSelectionChange('h1'))
    expect(selectionMenuCalls()).toHaveLength(0)

    editorStore.CANCEL_SELECTION_MENU_STATE()
    vi.advanceTimersByTime(100)

    expect(selectionMenuCalls()).toHaveLength(0)
  })
})
