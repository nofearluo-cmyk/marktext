import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  enterSourceMode,
  exitSourceMode,
  getMarkdownContent,
  launchWithMarkdown,
  typeIntoEditor
} from './helpers'

interface EditorStoreSnapshot {
  markdown: string
  wordCountWord: number
  listTocLength: number
  firstTocContent: string
  hasBlocks: boolean
}

interface RendererEditorPinia {
  state: {
    value: {
      editor: {
        currentFile?: {
          id?: string
          markdown?: string
          wordCount?: { word?: number }
          blocks?: unknown
        }
        listToc?: Array<{ content?: string }>
      }
    }
  }
}

const readEditorStoreSnapshot = async(page: Page): Promise<EditorStoreSnapshot> => {
  return await page.evaluate(() => {
    const appRoot = document.querySelector('#app') as
      | (Element & { __vue_app__?: { _context?: { provides?: Record<PropertyKey, unknown> } } })
      | null
    const provides = appRoot?.__vue_app__?._context?.provides
    if (!provides) {
      throw new Error('Vue app provides are unavailable')
    }

    const values = [
      ...Object.getOwnPropertyNames(provides).map((key) => provides[key]),
      ...Object.getOwnPropertySymbols(provides).map((key) => provides[key])
    ]
    const pinia = values.find((value) => {
      const candidate = value as { state?: { value?: { editor?: unknown } } } | undefined
      return !!candidate?.state?.value?.editor
    }) as RendererEditorPinia | undefined

    if (!pinia) {
      throw new Error('Pinia editor state is unavailable')
    }

    const editor = pinia.state.value.editor
    const currentFile = editor.currentFile
    const blocks = currentFile?.blocks
    return {
      markdown: currentFile?.markdown ?? '',
      wordCountWord: currentFile?.wordCount?.word ?? 0,
      listTocLength: editor.listToc?.length ?? 0,
      firstTocContent: editor.listToc?.[0]?.content ?? '',
      hasBlocks: Array.isArray(blocks)
        ? blocks.length > 0
        : !!blocks && typeof blocks === 'object' && Object.keys(blocks).length > 0
    }
  })
}

test.describe('Deferred WYSIWYG derived content updates', () => {
  let app: ElectronApplication | null = null
  let page: Page

  const getApp = (): ElectronApplication => {
    if (!app) {
      throw new Error('Electron app is unavailable')
    }
    return app
  }

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown('# Derived\n\nstart')
    app = launched.app
    page = launched.page
  })

  test.afterEach(async() => {
    if (app) {
      await app.close()
      app = null
    }
  })

  test('keeps markdown current and refreshes derived heading content after idle', async() => {
    const before = await readEditorStoreSnapshot(page)
    await typeIntoEditor(page, ' rapid-derived-token')

    await expect.poll(async() => {
      const snapshot = await readEditorStoreSnapshot(page)
      return {
        hasMarkdown: snapshot.markdown.includes('rapid-derived-token'),
        wordCountIncreased: snapshot.wordCountWord > before.wordCountWord,
        listTocLength: snapshot.listTocLength,
        firstTocContent: snapshot.firstTocContent,
        hasBlocks: snapshot.hasBlocks
      }
    }).toEqual({
      hasMarkdown: true,
      wordCountIncreased: true,
      listTocLength: 1,
      firstTocContent: 'Derived',
      hasBlocks: true
    })

    await expect(page.locator('.editor-component h1').filter({ hasText: 'Derived' })).toBeVisible()

    const markdown = await getMarkdownContent(page, getApp())
    expect(markdown).toContain('rapid-derived-token')

    await expect(page.locator('.editor-component h1').filter({ hasText: 'Derived' })).toBeVisible()
  })

  test('does not let stale WYSIWYG derived updates overwrite source-mode edits', async() => {
    await typeIntoEditor(page, ' wysiwyg-before-source')
    await enterSourceMode(page, getApp())
    await page.click('.source-code .CodeMirror', { timeout: 5000 })
    await page.keyboard.press('End')
    await page.keyboard.type('\nsource-mode-token', { delay: 0 })

    await expect.poll(async() => {
      return (await readEditorStoreSnapshot(page)).markdown.includes('source-mode-token')
    }).toBe(true)

    await page.waitForTimeout(350)

    const snapshot = await readEditorStoreSnapshot(page)
    expect(snapshot.markdown).toContain('wysiwyg-before')
    expect(snapshot.markdown).toContain('source-mode-token')

    const sourceMarkdown = await getMarkdownContent(page, getApp())
    expect(sourceMarkdown).toContain('source-mode-token')
  })

  test('flushes pending WYSIWYG derived metadata before source-mode roundtrip', async() => {
    const before = await readEditorStoreSnapshot(page)
    await page.click('.editor-component h1', { timeout: 5000 })
    await page.keyboard.type(' roundtrip-derived-token', { delay: 0 })
    await expect.poll(async() => {
      return (await readEditorStoreSnapshot(page)).markdown.includes('roundtrip-derived-token')
    }).toBe(true)
    await enterSourceMode(page, getApp())
    await exitSourceMode(page, getApp())

    await expect.poll(async() => {
      const snapshot = await readEditorStoreSnapshot(page)
      return {
        hasMarkdown: snapshot.markdown.includes('roundtrip-derived-token'),
        wordCountIncreased: snapshot.wordCountWord > before.wordCountWord,
        listTocLength: snapshot.listTocLength,
        tocUpdated: snapshot.firstTocContent.includes('roundtrip-derived-token')
      }
    }).toEqual({
      hasMarkdown: true,
      wordCountIncreased: true,
      listTocLength: 1,
      tocUpdated: true
    })
  })
})
