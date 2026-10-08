import { beforeEach, describe, expect, it, vi } from 'vitest'
import defaults from '../../../static/preference.json'
import schema from '../../../src/main/preferences/schema.json'

vi.mock('electron', () => ({
  app: { getLocale: () => 'en-US' },
  BrowserWindow: { getAllWindows: () => [] },
  nativeTheme: { shouldUseDarkColors: false },
  ipcMain: { on: vi.fn() }
}))
const state = vi.hoisted(() => ({ existing: undefined as Record<string, unknown> | undefined }))
vi.mock('electron-store', () => ({
  default: class {
    store = { ...state.existing }
    set(values: Record<string, unknown>) { Object.assign(this.store, values) }
    delete(key: string) { delete this.store[key] }
  }
}))
vi.mock('electron-log', () => ({ default: { error: vi.fn() } }))
vi.mock('../../../src/main/config', () => ({ isWindows: true }))
vi.mock('../../../src/main/utils', () => ({
  hasSameKeys: (a: object, b: object) => JSON.stringify(Object.keys(a).sort()) === JSON.stringify(Object.keys(b).sort())
}))
vi.mock('fs', () => ({ default: { readFileSync: vi.fn(), existsSync: () => !!state.existing } }))

import fs from 'fs'
import Preference from '../../../src/main/preferences'

describe('Chinese build language defaults', () => {
  beforeEach(() => {
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(defaults))
  })

  function initialize(existing?: Record<string, unknown>) {
    state.existing = existing
    global.__static = 'static'
    const preference = new Preference({ preferencesPath: 'preferences' })
    return preference.getAll()
  }

  it('uses Chinese on first launch even on an English system', () => {
    expect(initialize().language).toBe('zh-CN')
    expect(schema.language.default).toBe('zh-CN')
  })

  it('adds Chinese when upgrading preferences without a language', () => {
    const { language: _language, ...legacy } = defaults
    expect(initialize(legacy).language).toBe('zh-CN')
  })

  it.each(['en', 'ja', 'zh-TW'])('preserves saved language %s', (language) => {
    expect(initialize({ ...defaults, language }).language).toBe(language)
  })

  it('initializes native menus in Chinese and still allows language changes', async() => {
    const { getCurrentLanguage, setLanguage } = await import('../../../src/main/i18n')
    expect(getCurrentLanguage()).toBe('zh-CN')
    setLanguage('en')
    expect(getCurrentLanguage()).toBe('en')
    setLanguage('zh-CN')
  })
})
