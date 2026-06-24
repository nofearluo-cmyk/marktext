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

export const createDeferredContentChange = ({
  delayMs,
  readImmediateSnapshot,
  readDerivedSnapshot,
  dispatchImmediate,
  dispatchDerived
}: DeferredContentChangeOptions): DeferredContentChangeDispatcher => {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingId: string | null = null

  const cancelTimer = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const flush = (): void => {
    const id = pendingId
    cancelTimer()
    pendingId = null
    if (!id) return

    const snapshot = readDerivedSnapshot(id)
    if (snapshot) {
      dispatchDerived(snapshot)
    }
  }

  const handleChange = (): void => {
    const snapshot = readImmediateSnapshot()
    if (!snapshot) return

    dispatchImmediate(snapshot)
    pendingId = snapshot.id
    cancelTimer()
    timer = setTimeout(flush, delayMs)
  }

  const cancel = (): void => {
    cancelTimer()
    pendingId = null
  }

  return {
    handleChange,
    flush,
    cancel
  }
}
