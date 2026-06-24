import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDeferredContentChange } from '@/components/editorWithTabs/deferredContentChange'

describe('createDeferredContentChange', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('dispatches the immediate snapshot for every change', () => {
    const immediateSnapshots = [
      { id: 'tab-1', markdown: 'a' },
      { id: 'tab-1', markdown: 'ab' },
      { id: 'tab-1', markdown: 'abc' }
    ]
    const immediateDispatches: unknown[] = []
    const derivedDispatches: unknown[] = []
    const dispatcher = createDeferredContentChange({
      delayMs: 150,
      readImmediateSnapshot: () => immediateSnapshots.shift() ?? null,
      readDerivedSnapshot: (id: string) => ({ id, markdown: 'abc', wordCount: { words: 1 } }),
      dispatchImmediate: snapshot => immediateDispatches.push(snapshot),
      dispatchDerived: snapshot => derivedDispatches.push(snapshot)
    })

    dispatcher.handleChange()
    dispatcher.handleChange()
    dispatcher.handleChange()

    expect(immediateDispatches).toEqual([
      { id: 'tab-1', markdown: 'a' },
      { id: 'tab-1', markdown: 'ab' },
      { id: 'tab-1', markdown: 'abc' }
    ])
    expect(derivedDispatches).toEqual([])
  })

  it('dispatches derived content once after the user is idle', () => {
    const immediateSnapshots = [
      { id: 'tab-1', markdown: 'a' },
      { id: 'tab-1', markdown: 'ab' },
      { id: 'tab-1', markdown: 'abc' }
    ]
    const derivedDispatches: unknown[] = []
    const dispatcher = createDeferredContentChange({
      delayMs: 150,
      readImmediateSnapshot: () => immediateSnapshots.shift() ?? null,
      readDerivedSnapshot: (id: string) => ({ id, markdown: 'abc', toc: [{ key: 'derived' }] }),
      dispatchImmediate: () => {},
      dispatchDerived: snapshot => derivedDispatches.push(snapshot)
    })

    dispatcher.handleChange()
    vi.advanceTimersByTime(50)
    dispatcher.handleChange()
    vi.advanceTimersByTime(50)
    dispatcher.handleChange()
    vi.advanceTimersByTime(149)

    expect(derivedDispatches).toEqual([])

    vi.advanceTimersByTime(1)

    expect(derivedDispatches).toEqual([
      { id: 'tab-1', markdown: 'abc', toc: [{ key: 'derived' }] }
    ])
  })

  it('suppresses a pending derived dispatch when cancelled', () => {
    const derivedDispatches: unknown[] = []
    const dispatcher = createDeferredContentChange({
      delayMs: 150,
      readImmediateSnapshot: () => ({ id: 'tab-1', markdown: 'a' }),
      readDerivedSnapshot: (id: string) => ({ id, markdown: 'a', blocks: [{ type: 'paragraph' }] }),
      dispatchImmediate: () => {},
      dispatchDerived: snapshot => derivedDispatches.push(snapshot)
    })

    dispatcher.handleChange()
    dispatcher.cancel()
    vi.advanceTimersByTime(150)

    expect(derivedDispatches).toEqual([])
  })

  it('flushes pending derived content immediately once', () => {
    const derivedDispatches: unknown[] = []
    const dispatcher = createDeferredContentChange({
      delayMs: 150,
      readImmediateSnapshot: () => ({ id: 'tab-1', markdown: 'a' }),
      readDerivedSnapshot: (id: string) => ({ id, markdown: 'a', wordCount: { words: 1 } }),
      dispatchImmediate: () => {},
      dispatchDerived: snapshot => derivedDispatches.push(snapshot)
    })

    dispatcher.handleChange()
    dispatcher.flush()

    expect(derivedDispatches).toEqual([{ id: 'tab-1', markdown: 'a', wordCount: { words: 1 } }])
  })

  it('clears the pending timer when flushed and can be flushed repeatedly', () => {
    const derivedDispatches: unknown[] = []
    const dispatcher = createDeferredContentChange({
      delayMs: 150,
      readImmediateSnapshot: () => ({ id: 'tab-1', markdown: 'a' }),
      readDerivedSnapshot: (id: string) => ({ id, markdown: 'a', toc: [{ key: 'derived' }] }),
      dispatchImmediate: () => {},
      dispatchDerived: snapshot => derivedDispatches.push(snapshot)
    })

    dispatcher.handleChange()
    dispatcher.flush()
    dispatcher.flush()
    vi.advanceTimersByTime(150)

    expect(derivedDispatches).toEqual([
      { id: 'tab-1', markdown: 'a', toc: [{ key: 'derived' }] }
    ])
  })

  it('does nothing on flush when derived snapshot is unavailable', () => {
    const derivedDispatches: unknown[] = []
    const dispatcher = createDeferredContentChange({
      delayMs: 150,
      readImmediateSnapshot: () => ({ id: 'tab-1', markdown: 'a' }),
      readDerivedSnapshot: () => null,
      dispatchImmediate: () => {},
      dispatchDerived: snapshot => derivedDispatches.push(snapshot)
    })

    dispatcher.handleChange()
    dispatcher.flush()
    vi.advanceTimersByTime(150)

    expect(derivedDispatches).toEqual([])
  })
})

describe('UPDATE_DERIVED_CONTENT_STATE', () => {
  beforeEach(() => {
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
          send: vi.fn(),
          on: vi.fn()
        }
      },
      marktext: {
        env: {
          windowId: 1
        }
      }
    })
    setActivePinia(createPinia())
  })

  it('does not let stale derived markdown overwrite current tab content', async() => {
    const { useEditorStore } = await import('@/store/editor')
    const editorStore = useEditorStore()
    const tab = {
      id: 'tab-1',
      markdown: '# Derived\n\nsource-mode-token',
      trimTrailingNewline: 3,
      wordCount: { paragraph: 1, word: 2, character: 12, all: 12 },
      blocks: [{ type: 'current' }],
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
    editorStore.listToc = [{ key: 'current', lvl: 1, content: 'Derived' }]

    editorStore.UPDATE_DERIVED_CONTENT_STATE({
      id: 'tab-1',
      markdown: '# Derived\n\nstale-wysiwyg-token',
      wordCount: { paragraph: 1, word: 999, character: 999, all: 999 },
      toc: [{ key: 'stale', lvl: 1, content: 'Stale' }],
      blocks: [{ type: 'stale' }]
    })

    expect(editorStore.tabs[0].markdown).toContain('source-mode-token')
    expect(editorStore.tabs[0].markdown).not.toContain('stale-wysiwyg-token')
    expect(editorStore.tabs[0].wordCount.word).toBe(2)
    expect(editorStore.tabs[0].blocks).toEqual([{ type: 'current' }])
    expect(editorStore.listToc).toEqual([{ key: 'current', lvl: 1, content: 'Derived' }])
  })
})
