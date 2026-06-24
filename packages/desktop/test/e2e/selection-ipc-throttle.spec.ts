import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { enterSourceMode, exitSourceMode, launchWithMarkdown } from './helpers'

const BURST_COUNT = 3
const SELECTION_CHANGES_PER_BURST = 12

interface SelectionMenuPayload {
  affiliation?: Record<string, boolean>
}

interface SelectionIpcCounter {
  count: number
  payloads: SelectionMenuPayload[]
  lastPayload: SelectionMenuPayload | null
}

test.describe('Selection menu IPC throttle', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const markdown = '# Final heading\n\n' + 'word '.repeat(300)
    const launched = await launchWithMarkdown(markdown)
    app = launched.app
    page = launched.page

    await app.evaluate(({ ipcMain }) => {
      const g = global as unknown as {
        __mt_selection_ipc_count__?: number
        __mt_selection_ipc_payloads__?: unknown[]
        __mt_selection_ipc_counter_installed__?: boolean
      }
      g.__mt_selection_ipc_count__ = 0
      g.__mt_selection_ipc_payloads__ = []
      if (!g.__mt_selection_ipc_counter_installed__) {
        g.__mt_selection_ipc_counter_installed__ = true
        ipcMain.on('mt::editor-selection-changed', (_event, _windowId, payload) => {
          g.__mt_selection_ipc_count__ = (g.__mt_selection_ipc_count__ ?? 0) + 1
          if (!g.__mt_selection_ipc_payloads__) {
            g.__mt_selection_ipc_payloads__ = []
          }
          g.__mt_selection_ipc_payloads__.push(payload)
        })
      }
    })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  const resetCounter = async(): Promise<void> => {
    await app.evaluate(() => {
      const g = global as unknown as {
        __mt_selection_ipc_count__?: number
        __mt_selection_ipc_payloads__?: unknown[]
      }
      g.__mt_selection_ipc_count__ = 0
      g.__mt_selection_ipc_payloads__ = []
    })
  }

  const getCounter = async(): Promise<SelectionIpcCounter> => {
    return await app.evaluate(() => {
      const g = global as unknown as {
        __mt_selection_ipc_count__?: number
        __mt_selection_ipc_payloads__?: unknown[]
      }
      const payloads = (g.__mt_selection_ipc_payloads__ ?? []) as SelectionMenuPayload[]
      return {
        count: g.__mt_selection_ipc_count__ ?? 0,
        payloads,
        lastPayload: payloads[payloads.length - 1] ?? null
      }
    })
  }

  const generateSelectionChanges = async(options: {
    bursts: number
    changesPerBurst: number
    finalTarget: 'heading' | 'paragraph'
    delayBetweenBurstsMs?: number
  }): Promise<number> => {
    return await page.evaluate(async({
      bursts,
      changesPerBurst,
      finalTarget,
      delayBetweenBurstsMs
    }) => {
      const root = document.querySelector('.editor-component') as HTMLElement | null
      if (!root) return 0

      const paragraph = root.querySelector('p span.mu-paragraph-content') as HTMLElement | null
      const heading = root.querySelector('h1 span.mu-content') as HTMLElement | null
      if (!paragraph || !heading) return 0

      const textNodeAt = (
        target: HTMLElement,
        offset: number
      ): { node: Node; offset: number } | null => {
        const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT)
        let remaining = offset
        let node = walker.nextNode()
        while (node) {
          const length = (node.textContent ?? '').length
          if (remaining <= length) {
            return { node, offset: Math.min(remaining, length) }
          }
          remaining -= length
          node = walker.nextNode()
        }
        return null
      }

      const moveCaret = (target: HTMLElement, offset: number): boolean => {
        const position = textNodeAt(target, offset)
        if (!position) return false

        root.focus()
        const range = document.createRange()
        range.setStart(position.node, position.offset)
        range.collapse(true)

        const selection = window.getSelection()
        if (!selection) return false
        selection.removeAllRanges()
        selection.addRange(range)

        document.dispatchEvent(new Event('selectionchange'))
        root.dispatchEvent(
          new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true, cancelable: true })
        )
        return true
      }

      let generated = 0
      const paragraphTextLength = paragraph.textContent?.length ?? 0
      for (let burst = 0; burst < bursts; burst++) {
        for (let i = 0; i < changesPerBurst; i++) {
          const isFinalChange = burst === bursts - 1 && i === changesPerBurst - 1
          const target = isFinalChange && finalTarget === 'heading' ? heading : paragraph
          const targetLength = target.textContent?.length ?? 0
          const offset = isFinalChange && finalTarget === 'heading'
            ? targetLength
            : Math.min(burst * changesPerBurst + i + 1, paragraphTextLength)
          if (moveCaret(target, offset)) generated++
        }

        if (delayBetweenBurstsMs && burst < bursts - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayBetweenBurstsMs))
        }
      }

      return generated
    }, options)
  }

  test('rapid caret movement emits multiple bounded menu updates', async() => {
    await resetCounter()
    const generatedCount = await generateSelectionChanges({
      bursts: BURST_COUNT,
      changesPerBurst: SELECTION_CHANGES_PER_BURST,
      finalTarget: 'heading',
      delayBetweenBurstsMs: 130
    })

    expect(generatedCount).toBe(BURST_COUNT * SELECTION_CHANGES_PER_BURST)
    await page.waitForTimeout(250)

    const { count, lastPayload } = await getCounter()

    expect(count).toBeGreaterThan(1)
    expect(count).toBeLessThan(generatedCount)
    expect(lastPayload?.affiliation?.h1).toBe(true)
  })

  test('drops a pending WYSIWYG selection payload after entering source mode', async() => {
    await exitSourceMode(page, app)
    await resetCounter()

    const generatedCount = await generateSelectionChanges({
      bursts: 1,
      changesPerBurst: 2,
      finalTarget: 'heading'
    })

    expect(generatedCount).toBe(2)
    await enterSourceMode(page, app)
    await page.waitForTimeout(250)

    const { count, payloads } = await getCounter()
    const staleHeadingPayloads = payloads.filter((payload) => payload.affiliation?.h1)

    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(generatedCount)
    expect(staleHeadingPayloads).toHaveLength(0)
  })
})
