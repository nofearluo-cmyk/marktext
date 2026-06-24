interface TrailingThrottledFunction<TArgs extends unknown[]> {
  (...args: TArgs): void
  flush: () => void
  cancel: () => void
}

export const trailingThrottle = <TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  wait: number
): TrailingThrottledFunction<TArgs> => {
  let lastInvokeTime: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingArgs: TArgs | null = null

  const clearTimer = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const invoke = (args: TArgs): void => {
    lastInvokeTime = Date.now()
    pendingArgs = null
    fn(...args)
  }

  const runPending = (): void => {
    timer = null
    if (pendingArgs) {
      invoke(pendingArgs)
    }
  }

  const throttled = (...args: TArgs): void => {
    if (lastInvokeTime === null) {
      invoke(args)
      return
    }

    const elapsed = Date.now() - lastInvokeTime
    const remaining = wait - elapsed
    pendingArgs = args

    if (remaining <= 0 || remaining > wait) {
      clearTimer()
      invoke(args)
      return
    }

    if (!timer) {
      timer = setTimeout(runPending, remaining)
    }
  }

  throttled.flush = (): void => {
    if (!pendingArgs) return
    clearTimer()
    invoke(pendingArgs)
  }

  throttled.cancel = (): void => {
    clearTimer()
    pendingArgs = null
  }

  return throttled
}
