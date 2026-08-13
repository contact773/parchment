/**
 * The one place that talks to the Tauri updater.
 *
 * Everything else — Settings, the startup notification, the native Help menu —
 * calls the functions here and reads {@link useUpdates}. That keeps a single
 * state machine (`updateModel.ts`) instead of three half-implemented ones, and
 * it keeps the two safety rules in a single readable place:
 *
 *  1. Nothing is installed that is not strictly newer and signature-verified.
 *     Verification is Tauri's job; refusing an equal/older version is ours.
 *  2. Nothing restarts the app before pending editor and map writes have been
 *     flushed to IndexedDB (see `lib/pendingWrites.ts`).
 *
 * In a browser the whole feature reports `unsupported`: there is no installed
 * binary to replace, and the page reloads itself on the next visit anyway.
 */
import { create } from 'zustand'
import { APP_VERSION } from '@/lib/appInfo'
import { isDesktop } from '@/lib/desktop'
import { flushPendingWrites } from '@/lib/pendingWrites'
import { useSettings } from '@/store/useSettings'
import {
  classifyUpdateError,
  initialUpdateState,
  isBusy,
  updateError,
  updateReducer,
  type UpdateEvent,
  type UpdateState,
} from './updateModel'

/** Emitted by the native Help ▸ Check for Updates… menu item (see src-tauri/src/main.rs). */
export const CHECK_FOR_UPDATES_EVENT = 'parchment://check-for-updates'

/** How long a check may take before we call it a timeout. */
const CHECK_TIMEOUT_MS = 20_000
/** Automatic checks stay quiet for this long after the last one. */
const AUTO_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
/** Delay before the startup check, so it never competes with the first render. */
const STARTUP_CHECK_DELAY_MS = 8_000
/** Pending editor/map writes get this long to reach IndexedDB before a restart. */
const FLUSH_TIMEOUT_MS = 5_000

// ── Backend seam ────────────────────────────────────────────────────────────
// The Tauri plugin is loaded lazily (it is desktop-only and would otherwise be
// bundled into the browser build's main chunk). Tests substitute a fake.

export interface DownloadProgress {
  kind: 'started' | 'progress' | 'finished'
  /** Total bytes, when the server sent a content length. `started` only. */
  totalBytes?: number | null
  /** Bytes in this chunk. `progress` only. */
  chunkBytes?: number
}

export interface RemoteUpdate {
  version: string
  currentVersion: string
  date?: string
  notes?: string
  download(onProgress: (p: DownloadProgress) => void): Promise<void>
  install(): Promise<void>
  /** Release the native handle when the update is discarded. */
  close(): Promise<void>
}

export interface UpdaterBackend {
  check(options: { timeoutMs: number }): Promise<RemoteUpdate | null>
  relaunch(): Promise<void>
}

let backendOverride: UpdaterBackend | null = null

/** Test seam. Pass `null` to restore the real Tauri backend. */
export function setUpdaterBackend(backend: UpdaterBackend | null): void {
  backendOverride = backend
}

const tauriBackend: UpdaterBackend = {
  async check({ timeoutMs }) {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check({ timeout: timeoutMs })
    if (!update) return null
    return {
      version: update.version,
      currentVersion: update.currentVersion,
      date: update.date,
      notes: update.body,
      download: (onProgress) =>
        update.download((event) => {
          if (event.event === 'Started') onProgress({ kind: 'started', totalBytes: event.data.contentLength ?? null })
          else if (event.event === 'Progress') onProgress({ kind: 'progress', chunkBytes: event.data.chunkLength })
          else onProgress({ kind: 'finished' })
        }),
      install: () => update.install(),
      close: () => update.close(),
    }
  },
  async relaunch() {
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
  },
}

const backend = (): UpdaterBackend => backendOverride ?? tauriBackend

/** True when this build can actually replace itself. */
export function updatesSupported(): boolean {
  return backendOverride !== null || isDesktop()
}

// ── Store ───────────────────────────────────────────────────────────────────

interface UpdateStore extends UpdateState {
  dispatch: (event: UpdateEvent) => void
}

export const useUpdates = create<UpdateStore>((set) => ({
  ...initialUpdateState(APP_VERSION, updatesSupported()),
  dispatch: (event) => set((s) => ({ ...s, ...updateReducer(s, event) })),
}))

const state = () => useUpdates.getState()
const dispatch = (event: UpdateEvent) => state().dispatch(event)

/**
 * Re-evaluate whether updates are supported. `isDesktop()` is reliable from the
 * first render inside Tauri, but tests install a backend after module load.
 */
export function refreshUpdateSupport(): void {
  const supported = updatesSupported()
  const current = state()
  if (supported && current.status === 'unsupported') {
    useUpdates.setState({ ...initialUpdateState(APP_VERSION, true) })
  } else if (!supported && current.status !== 'unsupported') {
    useUpdates.setState({ ...initialUpdateState(APP_VERSION, false) })
  }
}

/** The update handle held between check and install; closed when discarded. */
let held: RemoteUpdate | null = null

async function releaseHeld(): Promise<void> {
  const previous = held
  held = null
  if (!previous) return
  try {
    await previous.close()
  } catch {
    // Closing a native handle is best-effort; a leak here is harmless and a
    // thrown error would mask the real failure the caller is reporting.
  }
}

// ── Actions ─────────────────────────────────────────────────────────────────

export interface CheckOptions {
  /** A writer pressed a button. Manual checks ignore the interval and always run. */
  manual?: boolean
}

/**
 * Ask the release endpoint whether something newer exists.
 * Never throws: every failure becomes an `error` state with an explanation.
 */
export async function checkForUpdates({ manual = false }: CheckOptions = {}): Promise<void> {
  const current = state()
  if (current.status === 'unsupported') return
  if (isBusy(current.status)) return
  if (!manual && !dueForAutomaticCheck(current.lastCheckedAt)) return

  await releaseHeld()
  dispatch({ type: 'check', manual })
  // A rejected transition (e.g. two clicks racing) must not start a request.
  if (state().status !== 'checking') return

  try {
    const remote = await backend().check({ timeoutMs: CHECK_TIMEOUT_MS })
    const at = Date.now()
    recordCheck(at)
    if (!remote) {
      dispatch({ type: 'check-result', update: null, at })
      return
    }
    held = remote
    dispatch({
      type: 'check-result',
      at,
      update: {
        version: remote.version,
        currentVersion: remote.currentVersion || APP_VERSION,
        notes: remote.notes,
        date: remote.date,
      },
    })
    // The reducer refuses anything not strictly newer; drop the handle if so.
    if (state().status !== 'available') await releaseHeld()
  } catch (err) {
    const at = Date.now()
    recordCheck(at)
    await releaseHeld()
    dispatch({ type: 'fail', error: classifyUpdateError(err), at })
  }
}

/** Download the available update. The installed copy stays runnable throughout. */
export async function downloadUpdate(): Promise<void> {
  if (state().status !== 'available') return
  if (!held) {
    dispatch({ type: 'fail', error: updateError('download', 'no update handle — check again') })
    return
  }
  const update = held
  dispatch({ type: 'download' })
  if (state().status !== 'downloading') return

  try {
    await update.download((p) => {
      if (p.kind === 'started') dispatch({ type: 'download-started', totalBytes: p.totalBytes ?? null })
      else if (p.kind === 'progress') dispatch({ type: 'download-progress', chunkBytes: p.chunkBytes ?? 0 })
    })
    dispatch({ type: 'download-finished' })
  } catch (err) {
    dispatch({ type: 'fail', error: classifyUpdateError(err) })
  }
}

/**
 * Install the downloaded update and restart.
 *
 * Pending editor and map writes are flushed first and the result is honoured:
 * if a writer could not be flushed we stop rather than restart over the top of
 * unsaved work. The installed copy is untouched at that point, so stopping is
 * always the safe outcome.
 */
export async function installUpdate(): Promise<void> {
  if (state().status !== 'ready') return
  if (!held) {
    dispatch({ type: 'fail', error: updateError('install', 'no update handle — check again') })
    return
  }
  const update = held
  dispatch({ type: 'install' })
  if (state().status !== 'installing') return

  const report = await flushPendingWrites(FLUSH_TIMEOUT_MS)
  if (report.failed.length > 0 || report.timedOut) {
    dispatch({
      type: 'fail',
      error: updateError(
        'install',
        `unsaved work could not be written to disk (${report.failed.join(', ') || 'timed out'}) — update cancelled`,
      ),
    })
    return
  }

  try {
    await update.install()
    held = null
    dispatch({ type: 'installed' })
    // On Windows the NSIS installer takes over and ends this process; on other
    // platforms we ask for the restart explicitly. Either way the app is gone
    // after this line, so nothing below may assume it still runs.
    await backend().relaunch()
  } catch (err) {
    dispatch({ type: 'fail', error: classifyUpdateError(err) })
  }
}

/** Download and install in one gesture, for the "Install now" button. */
export async function downloadAndInstall(): Promise<void> {
  await downloadUpdate()
  if (state().status === 'ready') await installUpdate()
}

/**
 * Stop offering this version. It stays visible in Settings — this only silences
 * the startup notification, and only until something newer is published.
 */
export function skipVersion(version: string): void {
  const { settings, setSettings } = useSettings.getState()
  setSettings({ updates: { ...settings.updates, skippedVersion: version } })
}

/** Clear an error and return to the last safe resting state. */
export async function resetUpdateState(): Promise<void> {
  if (state().status === 'error' && !state().update) await releaseHeld()
  dispatch({ type: 'reset' })
}

// ── Policy ──────────────────────────────────────────────────────────────────

function dueForAutomaticCheck(lastCheckedAt: number | null): boolean {
  const stored = useSettings.getState().settings.updates.lastCheckedAt
  const last = lastCheckedAt ?? stored
  if (last === null) return true
  return Date.now() - last >= AUTO_CHECK_INTERVAL_MS
}

function recordCheck(at: number): void {
  const { settings, setSettings } = useSettings.getState()
  setSettings({ updates: { ...settings.updates, lastCheckedAt: at } })
}

/**
 * Should the startup notification appear? Only for a genuinely new version the
 * writer has not already skipped — a nag that reappears every launch is worse
 * than no notification at all.
 */
export function shouldNotify(state: UpdateState, skippedVersion: string | null): boolean {
  if (state.status !== 'available' && state.status !== 'ready') return false
  if (!state.update) return false
  return state.update.version !== skippedVersion
}

/**
 * Wire the feature up for the lifetime of the app: listen for the native menu
 * item and run the startup check on a timer.
 *
 * Returns a teardown function. Safe to call in a browser, where it does nothing
 * beyond marking the feature unsupported.
 */
export function initUpdates(): () => void {
  refreshUpdateSupport()
  if (state().status === 'unsupported') return () => {}

  const timer = setTimeout(() => {
    if (useSettings.getState().settings.updates.checkOnStartup) void checkForUpdates()
  }, STARTUP_CHECK_DELAY_MS)

  let unlisten: (() => void) | undefined
  let cancelled = false
  if (isDesktop()) {
    void import('@tauri-apps/api/event')
      .then(({ listen }) => listen(CHECK_FOR_UPDATES_EVENT, () => void checkForUpdates({ manual: true })))
      .then((off) => {
        if (cancelled) off()
        else unlisten = off
      })
      .catch((err) => console.error('[updates] could not listen for the native menu event', err))
  }

  return () => {
    cancelled = true
    clearTimeout(timer)
    unlisten?.()
  }
}

/**
 * A support-friendly summary: versions, channel, state and the raw error
 * detail. Deliberately contains no project content and no secrets.
 */
export function updateDiagnostics(): string {
  const s = state()
  return [
    `Parchment ${s.currentVersion} (${s.channel})`,
    `platform: ${typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent}`,
    `status: ${s.status}`,
    `offered: ${s.update ? s.update.version : 'none'}`,
    `last checked: ${s.lastCheckedAt ? new Date(s.lastCheckedAt).toISOString() : 'never'}`,
    `error: ${s.error ? `${s.error.kind} — ${s.error.detail ?? s.error.message}` : 'none'}`,
  ].join('\n')
}
