import { expect, test } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import { launchElectron, waitForMenuReady, clickMenuById } from './helpers'

test.describe('Application menu wiring', () => {
  let app: ElectronApplication

  test.beforeAll(async() => {
    const { app: electronApp } = await launchElectron()
    app = electronApp
    await waitForMenuReady(app)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Top-level menu has the expected categories', async() => {
    const labels = await app.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu()
      return menu ? menu.items.map((i) => i.label) : []
    })
    expect(labels.length).toBeGreaterThanOrEqual(5)
  })

  test('Custom titlebar shows horizontal menus without covering window controls', async() => {
    test.skip(process.platform === 'darwin', 'macOS uses its native horizontal menu bar')
    const page = await app.firstWindow()
    const buttons = page.locator('.application-menu-bar button')
    await expect(buttons).toHaveCount(8)
    await expect(buttons.first()).toHaveText('文件')
    const nativeLabels = await app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu()!.items.map(item => item.label.replace(/\(&[^)]+\)/g, '').replace(/&(.)/g, '$1'))
    )
    expect(await buttons.allTextContents()).toEqual(nativeLabels)
    for (const width of [1000, 550]) {
      await app.evaluate(({ BrowserWindow }, width) => {
        BrowserWindow.getAllWindows()[0].setSize(width, 700)
      }, width)
      await expect.poll(async() => Math.abs(await page.evaluate(() => window.innerWidth) - width)).toBeLessThanOrEqual(4)
      const boxes = await buttons.evaluateAll(nodes => nodes.map(node => {
        const r = node.getBoundingClientRect()
        return { x: r.x, y: r.y, right: r.right, height: r.height }
      }))
      expect(boxes.every(b => b.y === boxes[0].y && b.height > 0)).toBe(true)
      for (let i = 1; i < boxes.length; i++) expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].right)
      const controls = await page.locator('.frameless-titlebar-minimize').boundingBox()
      expect(boxes[7].right).toBeLessThanOrEqual(controls!.x)
    }
    await page.screenshot({ path: 'test-results/horizontal-menu.png' })
  })

  test('Known menu IDs are registered', async() => {
    const expected = [
      'heading1MenuItem',
      'heading2MenuItem',
      'heading3MenuItem',
      'quoteBlockMenuItem',
      'codeFencesMenuItem',
      'bulletListMenuItem',
      'orderListMenuItem',
      'taskListMenuItem',
      'horizontalLineMenuItem',
      'mathBlockMenuItem',
      'paragraphMenuItem',
      'strongMenuItem',
      'emphasisMenuItem',
      'inlineCodeMenuItem',
      'strikeMenuItem',
      'highlightMenuItem',
      'underlineMenuItem',
      'superscriptMenuItem',
      'subscriptMenuItem',
      'inlineMathMenuItem',
      'sourceCodeModeMenuItem',
      'typewriterModeMenuItem',
      'focusModeMenuItem',
      'sideBarMenuItem',
      'tabBarMenuItem',
      'tocMenuItem',
      'autoSaveMenuItem',
      'dark',
      'light',
      'dracula',
      'nord'
    ]
    const present = await app.evaluate(({ Menu }, ids) => {
      const menu = Menu.getApplicationMenu()
      if (!menu) return ids.map(() => false)
      return ids.map((id) => !!menu.getMenuItemById(id))
    }, expected)
    expected.forEach((id, idx) => {
      expect(present[idx], `menu id "${id}" should exist`).toBe(true)
    })
  })

  test('Horizontal menu has an opaque background above the sidebar in both themes', async() => {
    test.skip(process.platform === 'darwin', 'macOS uses its native menu bar')
    const page = await app.firstWindow()
    const sidebar = page.locator('.side-bar')
    if (!(await sidebar.isVisible())) await clickMenuById(app, 'sideBarMenuItem')
    await expect(sidebar).toBeVisible()

    for (const theme of ['dark', 'light']) {
      await clickMenuById(app, theme)
      await expect.poll(() => page.evaluate(() => document.body.classList.contains('dark'))).toBe(theme === 'dark')
      const colors = await page.evaluate(() => {
        const bar = document.querySelector('.title-bar')!
        const editorBackground = document.querySelector('.title-bar-editor-bg')!
        return {
          menu: getComputedStyle(bar).backgroundColor,
          editor: getComputedStyle(editorBackground).backgroundColor
        }
      })
      expect(colors.menu).not.toBe('rgba(0, 0, 0, 0)')
      expect(colors.menu).toBe(colors.editor)
    }
    await page.screenshot({ path: 'test-results/horizontal-menu-background.png' })
  })
})
