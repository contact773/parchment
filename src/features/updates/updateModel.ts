/**
 * The update state machine — pure, so it can be tested without Tauri, a
 * network, or React.
 *
 *   idle ─────────► checking ─┬─► up-to-date
 *                             └─► available ──► downloading ──► ready
 *                                                                 │
 *                                                    installing ◄──┘
 *                                                         │
 *                                                    restarting
 *
 * Any of checking / downloading / installing can land in `error`; `reset`
 * returns to the last safe resting state so a failed download does not lose a
 * perfectly good "an update is available" result.
 *
 * The orchestration (talking to the Tauri updater plugin, flushing pending
 * writes, restarting) lives in `updateService.ts`. Keeping the transitions here
 * means there is one place that decides what is allowed to happen next.
 */
import { isNewerVersion, isPrerelease } from '@/lib/semver'

export type UpdateStatus =
  /** Running in a browser: there is no installed binary to replace. */
  | 'unsupported'
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  /** Downloaded and signature-verified; waiting for the writer to say go. */
  | 'ready'
  | 'installing'
  /** The installer has taken over; the app is about to be replaced. */
  | 'restarting'
  | 'error'

export type UpdateErrorKind =
  /** The endpoint could not be reached at all. */
  | 'offline'
  /** The endpoint was reached but did not answer in time. */
  | 'timeout'
  /** The artifact's signature did not verify against the built-in public key. */
  | 'signature'
  /** No endpoint or public key is configured in this build. */
  | 'not-configured'
  /** The endpoint answered with something that is not a valid release manifest. */
  | 'manifest'
  | 'download'
  | 'install'
  | 'unknown'

export interface UpdateError {
  kind: UpdateErrorKind
  /** One sentence a writer can act on. Never a stack trace. */
  message: string
  /** Raw detail for the "copy diagnostics" path. Never shown by default. */
  detail?: string
}

export interface AvailableUpdate {
  version: string
  /** Version of the build that found it, recorded so stale results are detectable. */
  currentVersion: string
  /** Release notes, as published in the release manifest. */
  notes?: string
  /** ISO-ish publication date string straight from the manifest. */
  date?: string
}

export interface UpdateState {
  status: UpdateStatus
  currentVersion: string
  channel: ReleaseChannel
  update: AvailableUpdate | null
  /** 0–1 while downloading; `null` when the server sent no content length. */
  progress: number | null
  downloadedBytes: number
  totalBytes: number | null
  error: UpdateError | null
  /** Epoch ms of the last completed check, successful or not. */
  lastCheckedAt: number | null
  /** True when the running check was started by the writer rather than by policy. */
  manual: boolean
}

export type ReleaseChannel = 'stable' | 'preview'

/** A prerelease version means this build was installed from the preview channel. */
export function channelForVersion(version: string): ReleaseChannel {
  return isPrerelease(version) ? 'preview' : 'stable'
}

export function initialUpdateState(currentVersion: string, supported: boolean): UpdateState {
  return {
    status: supported ? 'idle' : 'unsupported',
    currentVersion,
    channel: channelForVersion(currentVersion),
    update: null,
    progress: null,
    downloadedBytes: 0,
    totalBytes: null,
    error: null,
    lastCheckedAt: null,
    manual: false,
  }
}

export type UpdateEvent =
  | { type: 'check'; manual: boolean }
  | { type: 'check-result'; update: AvailableUpdate | null; at: number }
  | { type: 'download' }
  | { type: 'download-started'; totalBytes: number | null }
  | { type: 'download-progress'; chunkBytes: number }
  | { type: 'download-finished' }
  | { type: 'install' }
  | { type: 'installed' }
  | { type: 'fail'; error: UpdateError; at?: number }
  /** Forget the current result and return to the last safe resting state. */
  | { type: 'reset' }

/** Statuses from which a fresh check may start. */
const CHECKABLE: readonly UpdateStatus[] = ['idle', 'up-to-date', 'available', 'error']

/**
 * Where `reset` lands. An already-downloaded update stays offered; anything
 * else returns to idle so the next check starts from a clean slate.
 */
function restingStatus(state: UpdateState): UpdateStatus {
  if (state.status === 'unsupported') return 'unsupported'
  return state.update ? 'available' : 'idle'
}

/**
 * Apply an event. Events that are not legal for the current status are ignored
 * rather than throwing: they are almost always a late callback from a gesture
 * the writer already abandoned, and losing one is better than crashing the
 * settings page.
 */
export function updateReducer(state: UpdateState, event: UpdateEvent): UpdateState {
  // A browser build has no installer; nothing but the initial state applies.
  if (state.status === 'unsupported') return state

  switch (event.type) {
    case 'check':
      if (!CHECKABLE.includes(state.status)) return state
      return { ...state, status: 'checking', error: null, manual: event.manual }

    case 'check-result': {
      if (state.status !== 'checking') return state
      const base = { ...state, lastCheckedAt: event.at, error: null }
      // Fail closed: only a strictly newer version is ever offered.
      if (!event.update || !isNewerVersion(event.update.version, state.currentVersion)) {
        return { ...base, status: 'up-to-date', update: null }
      }
      return { ...base, status: 'available', update: event.update }
    }

    case 'download':
      if (state.status !== 'available') return state
      return { ...state, status: 'downloading', error: null, progress: null, downloadedBytes: 0, totalBytes: null }

    case 'download-started':
      if (state.status !== 'downloading') return state
      return { ...state, totalBytes: event.totalBytes, downloadedBytes: 0, progress: event.totalBytes ? 0 : null }

    case 'download-progress': {
      if (state.status !== 'downloading') return state
      const downloadedBytes = state.downloadedBytes + event.chunkBytes
      return {
        ...state,
        downloadedBytes,
        // Clamp: a mis-reported content length must not produce 140%.
        progress: state.totalBytes ? Math.min(1, downloadedBytes / state.totalBytes) : null,
      }
    }

    case 'download-finished':
      if (state.status !== 'downloading') return state
      return { ...state, status: 'ready', progress: 1 }

    case 'install':
      if (state.status !== 'ready') return state
      return { ...state, status: 'installing', error: null }

    case 'installed':
      if (state.status !== 'installing') return state
      return { ...state, status: 'restarting' }

    case 'fail':
      // Once the installer is running the app is no longer ours to steer.
      if (state.status === 'restarting') return state
      return {
        ...state,
        status: 'error',
        error: event.error,
        lastCheckedAt: event.at ?? state.lastCheckedAt,
      }

    case 'reset':
      return { ...state, status: restingStatus(state), error: null, progress: null, downloadedBytes: 0, totalBytes: null }
  }
}

/** True while the service is busy and a second gesture should be ignored. */
export function isBusy(status: UpdateStatus): boolean {
  return status === 'checking' || status === 'downloading' || status === 'installing' || status === 'restarting'
}

const ERROR_MESSAGES: Record<UpdateErrorKind, string> = {
  offline: 'Could not reach the update server. Check your connection and try again.',
  timeout: 'The update server took too long to answer. Try again in a moment.',
  signature:
    'This update failed its signature check and was not installed. Parchment only installs releases signed by its publisher.',
  'not-configured': 'This build has no update channel configured, so it cannot update itself.',
  manifest: 'The update server returned something Parchment could not read. Try again later.',
  download: 'The download did not finish. Your installed copy is unchanged.',
  install: 'The update could not be installed. Your installed copy is unchanged.',
  unknown: 'The update could not be completed. Your installed copy is unchanged.',
}

/** Build a user-facing error from a kind plus optional raw detail. */
export function updateError(kind: UpdateErrorKind, detail?: string): UpdateError {
  return { kind, message: ERROR_MESSAGES[kind], detail }
}

/**
 * Map whatever the updater plugin threw onto a kind we can explain.
 *
 * The plugin surfaces errors as strings from several layers (reqwest, minisign,
 * the NSIS runner), so this matches on substrings. Anything unrecognised stays
 * `unknown` — which is honest, and still tells the writer their install is fine.
 */
export function classifyUpdateError(err: unknown): UpdateError {
  const detail = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err)
  const text = (detail ?? '').toLowerCase()

  if (!text) return updateError('unknown')
  if (text.includes('signature') || text.includes('minisign') || text.includes('verif')) {
    return updateError('signature', detail)
  }
  if (text.includes('timed out') || text.includes('timeout')) return updateError('timeout', detail)
  if (
    text.includes('dns') ||
    text.includes('offline') ||
    text.includes('failed to fetch') ||
    text.includes('network') ||
    text.includes('connect') ||
    text.includes('unreachable') ||
    text.includes('could not resolve')
  ) {
    return updateError('offline', detail)
  }
  if (text.includes('endpoint') || text.includes('pubkey') || text.includes('public key') || text.includes('no configured')) {
    return updateError('not-configured', detail)
  }
  if (text.includes('json') || text.includes('deserialize') || text.includes('manifest') || text.includes('expected value')) {
    return updateError('manifest', detail)
  }
  if (text.includes('download')) return updateError('download', detail)
  if (text.includes('install') || text.includes('nsis') || text.includes('msi')) return updateError('install', detail)
  return updateError('unknown', detail)
}

/** Short status label for the Settings row and the About panel. */
export function describeStatus(state: UpdateState): string {
  switch (state.status) {
    case 'unsupported':
      return 'Updates are handled by the desktop app'
    case 'idle':
      return state.lastCheckedAt ? 'Up to date' : 'Not checked yet'
    case 'checking':
      return 'Checking for updates…'
    case 'up-to-date':
      return 'Parchment is up to date'
    case 'available':
      return `Version ${state.update?.version ?? ''} is available`
    case 'downloading':
      return state.progress === null
        ? 'Downloading update…'
        : `Downloading update… ${Math.round(state.progress * 100)}%`
    case 'ready':
      return `Version ${state.update?.version ?? ''} is ready to install`
    case 'installing':
      return 'Installing update…'
    case 'restarting':
      return 'Restarting Parchment…'
    case 'error':
      return state.error?.message ?? 'Update failed'
  }
}
