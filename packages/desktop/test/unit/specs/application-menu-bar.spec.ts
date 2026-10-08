import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import MenuBar from '../../../src/renderer/src/components/titleBar/menuBar.vue'
import zh from '../../../static/locales/zh-CN.json'
import en from '../../../static/locales/en.json'

let app: App
let host: HTMLElement
const originalElectron = window.electron
afterEach(() => {
  app?.unmount()
  host?.remove()
  window.electron = originalElectron
  vi.restoreAllMocks()
})

function mount() {
  const popup = vi.fn()
  window.electron = {
    windowControl: { popupApplicationMenu: popup },
    webFrame: { getZoomFactor: () => 1.5 }
  } as unknown as Window['electron']
  const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh, en } })
  host = document.createElement('div')
  document.body.append(host)
  app = createApp(MenuBar).use(i18n)
  app.mount(host)
  return { popup, i18n, buttons: [...host.querySelectorAll('button')] }
}

describe('horizontal application menu', () => {
  it('renders all eight Chinese categories and updates when language changes', async() => {
    const { buttons, i18n } = mount()
    expect(buttons.map(b => b.textContent?.trim())).toEqual(['文件', '编辑', '段落', '格式', '窗口', '主题', '视图', '帮助'])
    i18n.global.locale.value = 'en'
    await nextTick()
    expect(buttons[0]?.textContent?.trim()).toBe('File')
  })

  it('opens the selected live submenu below its button with zoom applied', () => {
    const { popup, buttons } = mount()
    buttons.forEach((button, index) => {
      vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ left: index * 40, bottom: 32 } as DOMRect)
      button.click()
      expect(popup).toHaveBeenLastCalledWith({ x: index * 60, y: 48 }, index)
    })
  })

  it('supports arrow navigation, wrapping and opening with ArrowDown', async() => {
    const { popup, buttons } = mount()
    // Dispatch after listener attachment; Vue ignores same-tick bubbling events.
    await new Promise(resolve => setTimeout(resolve, 1))
    buttons[0]?.focus()
    buttons[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(document.activeElement).toBe(buttons[7])
    buttons[7]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(buttons[0])
    buttons[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(document.activeElement).toBe(buttons[7])
    buttons[7]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(popup).toHaveBeenLastCalledWith({ x: 0, y: 0 }, 7)
    await nextTick()
    expect(buttons[7]?.tabIndex).toBe(0)
    expect(buttons[0]?.tabIndex).toBe(-1)
  })
})
