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
