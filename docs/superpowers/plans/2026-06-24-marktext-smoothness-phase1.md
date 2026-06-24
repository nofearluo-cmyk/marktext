# MarkText Smoothness Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve everyday editing smoothness by reducing source-mode DOM work, throttling high-frequency menu IPC, and deferring expensive WYSIWYG derived-data updates.

**Architecture:** This first phase only changes desktop renderer hot paths and leaves the current Muya engine migration work untouched. Each task has an automated regression test before the implementation step. Larger work from `docs/PERFORMANCE_PLAN.md`, such as file streaming and viewport-aware WYSIWYG rendering, is intentionally outside this execution slice.

**Tech Stack:** Electron 42, Vue 3, Pinia 3, CodeMirror 5, Vitest 4, Playwright.

---

## Scope And Ground Rules

- Work from the repo root `D:\00project\marktext`.
- Keep the existing dirty `packages/muya/*` performance edits out of this phase unless the user explicitly asks to continue that thread.
- Do not change `packages/muyajs/*` in this phase.
- Every code task below adds an automated test before implementation, matching `AGENTS.md` and `R-003`.
- Run the targeted test after each task and run `pnpm run typecheck` before handing off.

## File Structure

- Modify `packages/desktop/src/renderer/src/components/editorWithTabs/sourceCode.vue`: set CodeMirror source mode to a finite viewport buffer.
- Create `packages/desktop/test/e2e/source-viewport.spec.ts`: verify source mode no longer uses `viewportMargin: Infinity`.
- Create `packages/desktop/src/renderer/src/util/trailingThrottle.ts`: shared trailing throttle helper for renderer hot paths.
- Create `packages/desktop/test/unit/specs/trailing-throttle.spec.ts`: deterministic fake-timer coverage for the throttle helper.
- Modify `packages/desktop/src/renderer/src/store/editor.ts`: use the throttle helper for `mt::editor-selection-changed`.
- Create `packages/desktop/test/e2e/selection-ipc-throttle.spec.ts`: verify rapid caret movement emits bounded selection IPC.
- Create `packages/desktop/src/renderer/src/components/editorWithTabs/deferredContentChange.ts`: helper that splits immediate content updates from delayed derived metadata updates.
- Create `packages/desktop/test/unit/specs/deferred-content-change.spec.ts`: fake-timer coverage for the deferred dispatcher.
- Modify `packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue`: wire the deferred dispatcher into the `json-change` handler.
- Modify `packages/desktop/src/renderer/src/store/editor.ts`: add a lightweight derived-content update action that updates word count, TOC, and blocks without re-running save/dirty logic.
- Create `packages/desktop/test/e2e/editor-derived-content.spec.ts`: verify rapid WYSIWYG typing persists markdown and updates derived state after the debounce.

---

### Task 0: Baseline And Worktree Guard

**Files:**
- Read only: `docs/PERFORMANCE_PLAN.md`
- Read only: `docs/state.md`
- Read only: `docs/requirements.md`
- Read only: `docs/decisions.md`

- [ ] **Step 1: Confirm current worktree before editing**

Run:

```bash
git status --short
```

Expected: existing unrelated dirty files may include `CLAUDE.md` and `packages/muya/*`. Do not revert or stage them.

- [ ] **Step 2: Run current targeted smoke tests**

Run:

```bash
pnpm -C packages/desktop exec playwright test test/e2e/view-modes.spec.ts test/e2e/editor-input.spec.ts
pnpm -C packages/desktop exec vitest run test/unit/specs/synthetic-history.spec.ts
```

Expected: all listed tests pass before optimization work starts.

- [ ] **Step 3: Record the baseline result in `docs/state.md`**

Append one dated line under `## 进行中`:

```markdown
- [ ] MarkText 流畅度优化 Phase 1 — 关联:待建性能需求 — 进展:基线测试已记录,准备执行源码模式/IPC/派生数据三项优化 — 下一步:执行 Task 1
```

- [ ] **Step 4: Commit only if no unrelated files are staged**

Run:

```bash
git diff --cached --name-only
```

Expected: no output. This task does not require a commit.

---

### Task 1: Source Mode Finite Viewport

**Files:**
- Create: `packages/desktop/test/e2e/source-viewport.spec.ts`
- Modify: `packages/desktop/src/renderer/src/components/editorWithTabs/sourceCode.vue`

- [ ] **Step 1: Write the failing Playwright test**

Create `packages/desktop/test/e2e/source-viewport.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { clickMenuById, launchWithMarkdown } from './helpers'

test.describe('Source mode viewport', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const markdown = Array.from({ length: 5000 }, (_, i) => `line ${i}`).join('\n')
    const launched = await launchWithMarkdown(markdown)
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('CodeMirror uses a finite viewport buffer for large files', async() => {
    await clickMenuById(app, 'sourceCodeModeMenuItem')
    await page.waitForSelector('.source-code .CodeMirror', { state: 'attached', timeout: 10000 })

    const info = await page.evaluate(() => {
      const root = document.querySelector('.source-code .CodeMirror') as
        | (Element & { CodeMirror?: { getOption(name: string): unknown } })
        | null

      return {
        viewportMargin: root?.CodeMirror?.getOption('viewportMargin'),
        renderedLineNodes: document.querySelectorAll('.source-code .CodeMirror-code > div').length
      }
    })

    expect(info.viewportMargin).toBe(1000)
    expect(info.renderedLineNodes).toBeLessThan(1500)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm -C packages/desktop exec playwright test test/e2e/source-viewport.spec.ts
```

Expected: FAIL because `viewportMargin` is currently `Infinity`.

- [ ] **Step 3: Implement the finite viewport buffer**

In `packages/desktop/src/renderer/src/components/editorWithTabs/sourceCode.vue`, add the constant after `const { currentFile: currentTab } = storeToRefs(editorStore)`:

```ts
const SOURCE_CODE_VIEWPORT_MARGIN = 1000
```

Then replace the CodeMirror option:

```ts
    viewportMargin: SOURCE_CODE_VIEWPORT_MARGIN,
```

- [ ] **Step 4: Run the source viewport test**

Run:

```bash
pnpm -C packages/desktop exec playwright test test/e2e/source-viewport.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Run existing source-mode smoke coverage**

Run:

```bash
pnpm -C packages/desktop exec playwright test test/e2e/view-modes.spec.ts test/e2e/source-math.spec.ts test/e2e/editor-input.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add packages/desktop/src/renderer/src/components/editorWithTabs/sourceCode.vue packages/desktop/test/e2e/source-viewport.spec.ts
git commit -m "perf: limit source mode viewport rendering"
```

Expected: commit succeeds.

---

### Task 2: Selection IPC Throttle

**Files:**
- Create: `packages/desktop/src/renderer/src/util/trailingThrottle.ts`
- Create: `packages/desktop/test/unit/specs/trailing-throttle.spec.ts`
- Create: `packages/desktop/test/e2e/selection-ipc-throttle.spec.ts`
- Modify: `packages/desktop/src/renderer/src/store/editor.ts`

- [ ] **Step 1: Write the failing unit test for the throttle helper**

Create `packages/desktop/test/unit/specs/trailing-throttle.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trailingThrottle } from '@/util/trailingThrottle'

describe('trailingThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs the first call immediately and keeps the latest trailing call', () => {
    const calls: string[] = []
    const fn = trailingThrottle((value: string) => calls.push(value), 100)

    fn('a')
    fn('b')
    fn('c')

    expect(calls).toEqual(['a'])
    vi.advanceTimersByTime(99)
    expect(calls).toEqual(['a'])
    vi.advanceTimersByTime(1)
    expect(calls).toEqual(['a', 'c'])
  })

  it('can flush the pending trailing call', () => {
    const calls: string[] = []
    const fn = trailingThrottle((value: string) => calls.push(value), 100)

    fn('a')
    fn('b')
    fn.flush()

    expect(calls).toEqual(['a', 'b'])
  })

  it('can cancel the pending trailing call', () => {
    const calls: string[] = []
    const fn = trailingThrottle((value: string) => calls.push(value), 100)

    fn('a')
    fn('b')
    fn.cancel()
    vi.advanceTimersByTime(100)

    expect(calls).toEqual(['a'])
  })
})
```

- [ ] **Step 2: Run the unit test and verify it fails**

Run:

```bash
pnpm -C packages/desktop exec vitest run test/unit/specs/trailing-throttle.spec.ts
```

Expected: FAIL because `@/util/trailingThrottle` does not exist.

- [ ] **Step 3: Implement the throttle helper**

Create `packages/desktop/src/renderer/src/util/trailingThrottle.ts`:

```ts
export interface TrailingThrottle<TArgs extends unknown[]> {
  (...args: TArgs): void
  flush: () => void
  cancel: () => void
}

export const trailingThrottle = <TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  waitMs: number
): TrailingThrottle<TArgs> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  let latestArgs: TArgs | null = null
  let lastInvokeAt = 0

  const invoke = (args: TArgs): void => {
    lastInvokeAt = Date.now()
    latestArgs = null
    fn(...args)
  }

  const throttled = ((...args: TArgs): void => {
    const now = Date.now()
    const remaining = waitMs - (now - lastInvokeAt)
    latestArgs = args

    if (remaining <= 0 || remaining > waitMs) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      invoke(args)
      return
    }

    if (!timer) {
      timer = setTimeout(() => {
        timer = null
        if (latestArgs) invoke(latestArgs)
      }, remaining)
    }
  }) as TrailingThrottle<TArgs>

  throttled.flush = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (latestArgs) invoke(latestArgs)
  }

  throttled.cancel = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    latestArgs = null
  }

  return throttled
}
```

- [ ] **Step 4: Run the throttle unit test**

Run:

```bash
pnpm -C packages/desktop exec vitest run test/unit/specs/trailing-throttle.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Write the failing IPC throttle E2E test**

Create `packages/desktop/test/e2e/selection-ipc-throttle.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

test.describe('Selection menu IPC throttle', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const markdown = '# Selection throttle\n\n' + 'word '.repeat(300)
    const launched = await launchWithMarkdown(markdown)
    app = launched.app
    page = launched.page

    await app.evaluate(({ ipcMain }) => {
      const g = global as unknown as {
        __mt_selection_ipc_count__?: number
        __mt_selection_ipc_counter_installed__?: boolean
      }
      g.__mt_selection_ipc_count__ = 0
      if (!g.__mt_selection_ipc_counter_installed__) {
        g.__mt_selection_ipc_counter_installed__ = true
        ipcMain.on('mt::editor-selection-changed', () => {
          g.__mt_selection_ipc_count__ = (g.__mt_selection_ipc_count__ ?? 0) + 1
        })
      }
    })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('rapid caret movement emits bounded menu updates', async() => {
    await page.locator('.editor-component').click()
    await page.keyboard.down('ArrowRight')
    await page.waitForTimeout(1200)
    await page.keyboard.up('ArrowRight')
    await page.waitForTimeout(250)

    const count = await app.evaluate(() => {
      const g = global as unknown as { __mt_selection_ipc_count__?: number }
      return g.__mt_selection_ipc_count__ ?? 0
    })

    expect(count).toBeLessThanOrEqual(16)
  })
})
```

- [ ] **Step 6: Run the IPC E2E test and verify it fails**

Run:

```bash
pnpm -C packages/desktop exec playwright test test/e2e/selection-ipc-throttle.spec.ts
```

Expected: FAIL because every selection change currently sends `mt::editor-selection-changed`.

- [ ] **Step 7: Wire the throttle into the editor store**

In `packages/desktop/src/renderer/src/store/editor.ts`, add the import near the other renderer utility imports:

```ts
import { trailingThrottle } from '../util/trailingThrottle'
```

After `const autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()`, add:

```ts
const SELECTION_MENU_IPC_THROTTLE_MS = 100

const sendSelectionMenuChange = trailingThrottle(
  (windowId: number, changes: ApplicationMenuState): void => {
    window.electron.ipcRenderer.send('mt::editor-selection-changed', windowId, changes)
  },
  SELECTION_MENU_IPC_THROTTLE_MS
)
```

In `SELECTION_CHANGE`, replace the direct IPC call with:

```ts
      const { windowId } = window.marktext?.env ?? { windowId: -1 }
      sendSelectionMenuChange(windowId, createApplicationMenuState(changes))
```

- [ ] **Step 8: Run Task 2 tests**

Run:

```bash
pnpm -C packages/desktop exec vitest run test/unit/specs/trailing-throttle.spec.ts
pnpm -C packages/desktop exec playwright test test/e2e/selection-ipc-throttle.spec.ts
```

Expected: PASS.

- [ ] **Step 9: Run related menu and editor smoke tests**

Run:

```bash
pnpm -C packages/desktop exec playwright test test/e2e/menu-sanity.spec.ts test/e2e/editor-input.spec.ts
```

Expected: PASS.

- [ ] **Step 10: Commit Task 2**

Run:

```bash
git add packages/desktop/src/renderer/src/util/trailingThrottle.ts packages/desktop/test/unit/specs/trailing-throttle.spec.ts packages/desktop/test/e2e/selection-ipc-throttle.spec.ts packages/desktop/src/renderer/src/store/editor.ts
git commit -m "perf: throttle selection menu ipc"
```

Expected: commit succeeds.

---

### Task 3: Deferred WYSIWYG Derived Content Updates

**Files:**
- Create: `packages/desktop/src/renderer/src/components/editorWithTabs/deferredContentChange.ts`
- Create: `packages/desktop/test/unit/specs/deferred-content-change.spec.ts`
- Create: `packages/desktop/test/e2e/editor-derived-content.spec.ts`
- Modify: `packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue`
- Modify: `packages/desktop/src/renderer/src/store/editor.ts`

- [ ] **Step 1: Write the failing unit test for deferred content changes**

Create `packages/desktop/test/unit/specs/deferred-content-change.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeferredContentChangeDispatcher } from '@/components/editorWithTabs/deferredContentChange'

describe('createDeferredContentChangeDispatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('dispatches immediate snapshots on every change and derived snapshots once after idle', () => {
    let markdown = 'a'
    const immediate = vi.fn()
    const derived = vi.fn()

    const dispatcher = createDeferredContentChangeDispatcher({
      delayMs: 150,
      readImmediateSnapshot: () => ({
        id: 'tab-a',
        markdown,
        cursor: { focus: 1 },
        history: { stack: [], lastEditIndex: 0, lastInitIndex: 0 }
      }),
      readDerivedSnapshot: (id) => ({
        id,
        markdown,
        wordCount: { paragraph: 1, word: markdown.length },
        toc: [],
        blocks: [{ name: 'paragraph', text: markdown }]
      }),
      dispatchImmediate: immediate,
      dispatchDerived: derived
    })

    dispatcher.handleChange()
    markdown = 'ab'
    dispatcher.handleChange()
    markdown = 'abc'
    dispatcher.handleChange()

    expect(immediate).toHaveBeenCalledTimes(3)
    expect(derived).not.toHaveBeenCalled()

    vi.advanceTimersByTime(149)
    expect(derived).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(derived).toHaveBeenCalledTimes(1)
    expect(derived).toHaveBeenLastCalledWith({
      id: 'tab-a',
      markdown: 'abc',
      wordCount: { paragraph: 1, word: 3 },
      toc: [],
      blocks: [{ name: 'paragraph', text: 'abc' }]
    })
  })

  it('does not dispatch derived snapshots after cancel', () => {
    const derived = vi.fn()
    const dispatcher = createDeferredContentChangeDispatcher({
      delayMs: 150,
      readImmediateSnapshot: () => ({
        id: 'tab-a',
        markdown: 'a'
      }),
      readDerivedSnapshot: (id) => ({
        id,
        markdown: 'a',
        wordCount: { paragraph: 1, word: 1 },
        toc: [],
        blocks: []
      }),
      dispatchImmediate: vi.fn(),
      dispatchDerived: derived
    })

    dispatcher.handleChange()
    dispatcher.cancel()
    vi.advanceTimersByTime(150)

    expect(derived).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the unit test and verify it fails**

Run:

```bash
pnpm -C packages/desktop exec vitest run test/unit/specs/deferred-content-change.spec.ts
```

Expected: FAIL because `@/components/editorWithTabs/deferredContentChange` does not exist.

- [ ] **Step 3: Implement the deferred dispatcher helper**

Create `packages/desktop/src/renderer/src/components/editorWithTabs/deferredContentChange.ts`:

```ts
export interface ImmediateContentSnapshot {
  id: string
  markdown: string
  cursor?: unknown
  history?: unknown
}

export interface DerivedContentSnapshot {
  id: string
  markdown: string
  wordCount?: unknown
  toc?: unknown
  blocks?: unknown
}

export interface DeferredContentChangeOptions {
  delayMs: number
  readImmediateSnapshot: () => ImmediateContentSnapshot | null
  readDerivedSnapshot: (id: string) => DerivedContentSnapshot | null
  dispatchImmediate: (snapshot: ImmediateContentSnapshot) => void
  dispatchDerived: (snapshot: DerivedContentSnapshot) => void
}

export interface DeferredContentChangeDispatcher {
  handleChange: () => void
  flush: () => void
  cancel: () => void
}

export const createDeferredContentChangeDispatcher = ({
  delayMs,
  readImmediateSnapshot,
  readDerivedSnapshot,
  dispatchImmediate,
  dispatchDerived
}: DeferredContentChangeOptions): DeferredContentChangeDispatcher => {
  let timer: ReturnType<typeof setTimeout> | null = null
  let latestId: string | null = null

  const clearTimer = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const runDerived = (): void => {
    clearTimer()
    if (!latestId) return

    const snapshot = readDerivedSnapshot(latestId)
    if (snapshot) dispatchDerived(snapshot)
  }

  return {
    handleChange: (): void => {
      const snapshot = readImmediateSnapshot()
      if (!snapshot) return

      latestId = snapshot.id
      dispatchImmediate(snapshot)
      clearTimer()
      timer = setTimeout(runDerived, delayMs)
    },
    flush: runDerived,
    cancel: (): void => {
      clearTimer()
      latestId = null
    }
  }
}
```

- [ ] **Step 4: Add a lightweight derived-state store action**

In `packages/desktop/src/renderer/src/store/editor.ts`, add the interface after `ContentChangePayload`:

```ts
interface DerivedContentChangePayload {
  id: string
  markdown: string
  wordCount?: IFileState['wordCount']
  toc?: TocItem[]
  blocks?: unknown
}
```

Add this action immediately after `LISTEN_FOR_CONTENT_CHANGE`:

```ts
    UPDATE_DERIVED_CONTENT_STATE({
      id,
      markdown,
      wordCount,
      toc,
      blocks
    }: DerivedContentChangePayload): void {
      if (!id) {
        throw new Error('Update derived content state but id was not set!')
      } else if (this.tabs.length === 0) {
        return
      } else if (!(id in this.tabIdToIndex)) {
        return
      }

      const tab = this.tabs[this.tabIdToIndex[id]!]
      if (!tab) return

      markdown = adjustTrailingNewlines(markdown, tab.trimTrailingNewline)
      tab.markdown = markdown

      if (wordCount) tab.wordCount = wordCount
      if (blocks) tab.blocks = blocks

      if (id === this.currentFile?.id && toc && !equal(toc, this.listToc)) {
        this.listToc = toc
        this.toc = listToTree<TocItem>(toc)
      }

      debouncedSendBufferedState()
    },
```

- [ ] **Step 5: Wire the dispatcher into `editor.vue`**

In `packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue`, add the import near `SyntheticHistory`:

```ts
import {
  createDeferredContentChangeDispatcher,
  type DeferredContentChangeDispatcher
} from './deferredContentChange'
```

Add these declarations near the existing `type MuyaInstance = any` block:

```ts
const DERIVED_CONTENT_CHANGE_DELAY_MS = 150
let contentChangeDispatcher: DeferredContentChangeDispatcher | null = null
```

Replace the current `editor.value.on('json-change', () => { ... })` body with:

```ts
  contentChangeDispatcher = createDeferredContentChangeDispatcher({
    delayMs: DERIVED_CONTENT_CHANGE_DELAY_MS,
    readImmediateSnapshot: () => {
      if (!currentFile.value || !editor.value) return null
      const { id } = currentFile.value
      if (!id) return null

      const markdown = editor.value.getMarkdown()
      const engineHistory = editor.value.getHistory()
      engineHistoryByTab.set(id, engineHistory)

      return {
        id,
        markdown,
        cursor: serializeCursor(editor.value.getSelection()),
        history: makeSyntheticHistory(id, markdown)
      }
    },
    readDerivedSnapshot: (id) => {
      if (!currentFile.value || currentFile.value.id !== id || !editor.value) return null

      const markdown = editor.value.getMarkdown()
      return {
        id,
        markdown,
        wordCount: muyaWordCount(markdown),
        toc: editor.value.getTOC(),
        blocks: editor.value.getState()
      }
    },
    dispatchImmediate: (snapshot) => {
      editorStore.LISTEN_FOR_CONTENT_CHANGE(snapshot)
    },
    dispatchDerived: (snapshot) => {
      editorStore.UPDATE_DERIVED_CONTENT_STATE(snapshot)
    }
  })

  editor.value.on('json-change', () => {
    contentChangeDispatcher?.handleChange()
  })
```

In `onBeforeUnmount`, before bus listeners are removed, add:

```ts
  contentChangeDispatcher?.flush()
  contentChangeDispatcher?.cancel()
  contentChangeDispatcher = null
```

- [ ] **Step 6: Run the deferred dispatcher unit test**

Run:

```bash
pnpm -C packages/desktop exec vitest run test/unit/specs/deferred-content-change.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Write the derived-content integration E2E test**

Create `packages/desktop/test/e2e/editor-derived-content.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { getMarkdownContent, launchWithMarkdown, typeIntoEditor } from './helpers'

test.describe('Deferred WYSIWYG derived content', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Derived\n\nstart')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('rapid typing persists markdown and updates sidebar-derived state after idle', async() => {
    await typeIntoEditor(page, ' alpha beta gamma')
    await page.waitForTimeout(350)

    const markdown = await getMarkdownContent(page, app)
    expect(markdown).toContain('alpha beta gamma')

    const derived = await page.evaluate(() => {
      const appRoot = document.querySelector('#app')
      return {
        hasApp: !!appRoot,
        headings: Array.from(document.querySelectorAll('.editor-component h1')).map((el) =>
          (el.textContent || '').trim()
        )
      }
    })

    expect(derived.hasApp).toBe(true)
    expect(derived.headings).toContain('Derived')
  })
})
```

- [ ] **Step 8: Run Task 3 E2E and related editor tests**

Run:

```bash
pnpm -C packages/desktop exec playwright test test/e2e/editor-derived-content.spec.ts test/e2e/editor-input.spec.ts test/e2e/tabs.spec.ts
```

Expected: PASS.

- [ ] **Step 9: Run the desktop typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit Task 3**

Run:

```bash
git add packages/desktop/src/renderer/src/components/editorWithTabs/deferredContentChange.ts packages/desktop/test/unit/specs/deferred-content-change.spec.ts packages/desktop/test/e2e/editor-derived-content.spec.ts packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue packages/desktop/src/renderer/src/store/editor.ts
git commit -m "perf: defer editor derived content updates"
```

Expected: commit succeeds.

---

### Task 4: Final Verification And State Update

**Files:**
- Modify: `docs/state.md`

- [ ] **Step 1: Run the focused Phase 1 verification suite**

Run:

```bash
pnpm -C packages/desktop exec vitest run test/unit/specs/trailing-throttle.spec.ts test/unit/specs/deferred-content-change.spec.ts
pnpm -C packages/desktop exec playwright test test/e2e/source-viewport.spec.ts test/e2e/selection-ipc-throttle.spec.ts test/e2e/editor-derived-content.spec.ts test/e2e/editor-input.spec.ts test/e2e/view-modes.spec.ts test/e2e/menu-sanity.spec.ts
pnpm run typecheck
```

Expected: all commands pass.

- [ ] **Step 2: Run lint for changed TypeScript/Vue files**

Run:

```bash
pnpm run lint
```

Expected: PASS.

- [ ] **Step 3: Update `docs/state.md`**

Move the Phase 1 line from `## 进行中` to `## 已完成 (最近)`:

```markdown
- [x] MarkText 流畅度优化 Phase 1: 源码模式有限 viewport、选择 IPC 节流、WYSIWYG 派生数据延迟计算 — 关联:待建性能需求 — 2026-06-24
```

Add the next work item under `## 待办 (backlog)`:

```markdown
- [ ] MarkText 流畅度优化 Phase 2 — 关联:待建性能需求 — 备注:评估文件流式读取、macOS watcher 原生事件、getState 深拷贝削减
```

- [ ] **Step 4: Commit the state update**

Run:

```bash
git add docs/state.md
git commit -m "docs: update performance phase state"
```

Expected: commit succeeds.

## Self-Review

- Spec coverage: This plan covers the first execution slice from `docs/PERFORMANCE_PLAN.md`: CodeMirror finite viewport, selection IPC throttle, and `json-change` derived-data deferral.
- Exclusions: file streaming, macOS watcher changes, `getState()` copy strategy, and viewport-aware WYSIWYG rendering are deferred to Phase 2 or later because they touch broader IO, platform, or editor-engine boundaries.
- Test coverage: each code change has either a Vitest helper test, a Playwright integration test, or both.
- Dirty worktree safety: current unrelated dirty files are explicitly excluded from this plan.
