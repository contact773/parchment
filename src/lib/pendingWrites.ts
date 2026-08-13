/**
 * A registry of debounced writers that owe the database something.
 *
 * Several surfaces keep the last few hundred milliseconds of user work in
 * memory on purpose — the editor's 700 ms autosave, the world map's 300 ms
 * geometry save. That is fine while the app keeps running, but an application
 * update ends with the process being replaced. Anything still sitting in a
 * timer at that moment is simply gone.
 *
 * Each surface registers a `flush` here for its lifetime; anything that is
 * about to end the process (currently the updater) calls
 * {@link flushPendingWrites} and waits for it before handing control over.
 *
 * Flushers must be safe to call when nothing is pending — the common case.
 */

type Flusher = () => void | Promise<void>

interface Entry {
  label: string
  flush: Flusher
}

const entries = new Map<symbol, Entry>()

/**
 * Register a flush callback. Returns an unregister function suitable for
 * returning straight out of a React effect.
 */
export function registerPendingWrite(label: string, flush: Flusher): () => void {
  const key = Symbol(label)
  entries.set(key, { label, flush })
  return () => {
    entries.delete(key)
  }
}

export interface FlushReport {
  /** How many registered writers were asked to flush. */
  total: number
  /** Labels of writers that threw or rejected. */
  failed: string[]
  /** True when the deadline expired before every writer settled. */
  timedOut: boolean
}

/**
 * Flush every registered writer.
 *
 * Resolves even if a writer hangs: `timeoutMs` bounds the wait so a single
 * stuck save can never block an update (or, later, a quit) indefinitely. The
 * report is deliberately returned rather than thrown — the caller decides
 * whether a partial flush is a reason to stop.
 */
export async function flushPendingWrites(timeoutMs = 4000): Promise<FlushReport> {
  const snapshot = [...entries.values()]
  const failed: string[] = []
  if (snapshot.length === 0) return { total: 0, failed, timedOut: false }

  let timer: ReturnType<typeof setTimeout> | undefined
  const settled = Promise.allSettled(
    snapshot.map(async (entry) => {
      try {
        await entry.flush()
      } catch (err) {
        failed.push(entry.label)
        console.error(`[pendingWrites] ${entry.label} failed to flush`, err)
      }
    }),
  ).then(() => false as const)

  const deadline = new Promise<true>((resolve) => {
    timer = setTimeout(() => resolve(true), timeoutMs)
  })

  const timedOut = await Promise.race([settled, deadline])
  if (timer !== undefined) clearTimeout(timer)
  if (timedOut) console.warn(`[pendingWrites] flush timed out after ${timeoutMs}ms`)
  return { total: snapshot.length, failed, timedOut }
}

/** Test/diagnostic helper: how many writers are currently registered. */
export function pendingWriteCount(): number {
  return entries.size
}
