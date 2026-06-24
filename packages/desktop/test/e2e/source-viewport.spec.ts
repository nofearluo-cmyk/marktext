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

  test('wheel scrolling over the source pane side margin scrolls CodeMirror', async() => {
    await page.setViewportSize({ width: 1800, height: 720 })
    const inSourceMode = await page.evaluate(() => {
      return !!document.querySelector('.source-code .CodeMirror')
    })
    if (!inSourceMode) await clickMenuById(app, 'sourceCodeModeMenuItem')
    await page.waitForSelector('.source-code .CodeMirror', { state: 'attached', timeout: 10000 })

    const point = await page.evaluate(() => {
      const pane = document.querySelector('.source-code') as HTMLElement | null
      const cm = document.querySelector('.source-code .CodeMirror') as
        | (HTMLElement & { CodeMirror?: { getScrollerElement(): HTMLElement } })
        | null
      if (!pane || !cm || !cm.CodeMirror) return null

      const paneRect = pane.getBoundingClientRect()
      const cmRect = cm.getBoundingClientRect()
      const leftMargin = cmRect.left - paneRect.left
      if (leftMargin <= 10) {
        throw new Error(`Expected source pane side margin, got ${leftMargin}px`)
      }
      cm.CodeMirror.getScrollerElement().scrollTop = 0

      return {
        x: paneRect.left + leftMargin / 2,
        y: cmRect.top + Math.min(40, cmRect.height / 2)
      }
    })
    if (!point) {
      throw new Error('Expected source pane side-margin scroll point')
    }

    const before = await page.evaluate(() => {
      const root = document.querySelector('.source-code .CodeMirror') as
        | (Element & { CodeMirror?: { getScrollerElement(): HTMLElement } })
        | null
      return root?.CodeMirror?.getScrollerElement().scrollTop ?? 0
    })

    await page.mouse.move(point.x, point.y)
    await page.mouse.wheel(0, 600)

    await page.waitForFunction(
      (previous) => {
        const root = document.querySelector('.source-code .CodeMirror') as
          | (Element & { CodeMirror?: { getScrollerElement(): HTMLElement } })
          | null
        const scroller = root?.CodeMirror?.getScrollerElement()
        return !!scroller && scroller.scrollTop > previous
      },
      before,
      { timeout: 5000 }
    )
  })
})
