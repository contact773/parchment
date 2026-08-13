// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_VERSION } from '@/lib/appInfo'
import { flushPendingWrites, registerPendingWrite } from '@/lib/pendingWrites'
import { useSettings } from '@/store/useSettings'
import { initialUpdateState } from '@/features/updates/updateModel'
import {
  checkForUpdates,
  downloadAndInstall,
  downloadUpdate,
  installUpdate,
  resetUpdateState,
  setUpdaterBackend,
  shouldNotify,
  skipVersion,
  updateDiagnostics,
  useUpdates,
  type RemoteUpdate,
  type UpdaterBackend,
} from '@/features/updates/updateService'

/** A stand-in for the Tauri plugin, so the whole flow runs without a desktop. */
function fakeBackend(overrides: Partial<UpdaterBackend & { update: Partial<RemoteUpdate> | null }> = {}) {
  const calls: string[] = []
  const update: RemoteUpdate = {
    version: '0.9.0',
    currentVersion: APP_VERSION,
    notes: 'Faster maps',
    async download(onProgress) {
      calls.push('download')
      onProgress({ kind: 'started', totalBytes: 200 })
      onProgress({ kind: 'progress', chunkBytes: 200 })
      onProgress({ kind: 'finished' })
    },
    async install() {
      calls.push('install')
    },
    async close() {
      calls.push('close')
    },
    ...(overrides.update ?? {}),
  }
  const backend: UpdaterBackend = {
    check: vi.fn(async () => {
      calls.push('check')
      return overrides.update === null ? null : update
    }),
    relaunch: vi.fn(async () => {
      calls.push('relaunch')
    }),
    ...(overrides.check ? { check: overrides.check } : {}),
    ...(overrides.relaunch ? { relaunch: overrides.relaunch } : {}),
  }
  return { backend, update, calls }
}

const status = () => useUpdates.getState().status

const resetPrefs = () =>
  useSettings.getState().setSettings({
    updates: { checkOnStartup: true, lastCheckedAt: null, skippedVersion: null },
  })

beforeEach(() => {
  resetPrefs()
  useUpdates.setState(initialUpdateState(APP_VERSION, true))
})

afterEach(() => {
  setUpdaterBackend(null)
  vi.restoreAllMocks()
})

describe('checkForUpdates', () => {
  it('offers a newer version and records the check time', async () => {
    const { backend } = fakeBackend()
    setUpdaterBackend(backend)

    await checkForUpdates({ manual: true })

    expect(status()).toBe('available')
    expect(useUpdates.getState().update).toMatchObject({ version: '0.9.0', notes: 'Faster maps' })
    expect(useSettings.getState().settings.updates.lastCheckedAt).toBeTypeOf('number')
  })

  it('reports up to date when the endpoint has nothing newer', async () => {
    const { backend } = fakeBackend({ update: null })
    setUpdaterBackend(backend)

    await checkForUpdates({ manual: true })

    expect(status()).toBe('up-to-date')
    expect(useUpdates.getState().update).toBeNull()
  })

  it('releases the native handle when the offered version is not newer', async () => {
    const { backend, calls } = fakeBackend({ update: { version: '0.0.1' } })
    setUpdaterBackend(backend)

    await checkForUpdates({ manual: true })

    expect(status()).toBe('up-to-date')
    expect(calls).toContain('close')
  })

  it('turns a network failure into an explained offline error', async () => {
    const { backend } = fakeBackend({
      check: vi.fn(async () => {
        throw new Error('error sending request: connection refused')
      }),
    })
    setUpdaterBackend(backend)

    await checkForUpdates({ manual: true })

    expect(status()).toBe('error')
    expect(useUpdates.getState().error?.kind).toBe('offline')
    // A failed check still counts as a check, so the app does not retry in a loop.
    expect(useSettings.getState().settings.updates.lastCheckedAt).toBeTypeOf('number')
  })

  it('surfaces a signature failure distinctly', async () => {
    const { backend } = fakeBackend({
      check: vi.fn(async () => {
        throw new Error('Signature verification failed')
      }),
    })
    setUpdaterBackend(backend)

    await checkForUpdates({ manual: true })

    expect(useUpdates.getState().error?.kind).toBe('signature')
    expect(useUpdates.getState().error?.message).toMatch(/signed by its publisher/)
  })

  it('skips an automatic check that is not due yet, but never a manual one', async () => {
    const { backend } = fakeBackend()
    setUpdaterBackend(backend)
    useSettings.getState().setSettings({
      updates: { checkOnStartup: true, lastCheckedAt: Date.now(), skippedVersion: null },
    })

    await checkForUpdates()
    expect(backend.check).not.toHaveBeenCalled()

    await checkForUpdates({ manual: true })
    expect(backend.check).toHaveBeenCalledOnce()
  })

  it('does nothing in a browser build', async () => {
    const { backend } = fakeBackend()
    setUpdaterBackend(backend)
    useUpdates.setState(initialUpdateState(APP_VERSION, false))

    await checkForUpdates({ manual: true })

    expect(status()).toBe('unsupported')
    expect(backend.check).not.toHaveBeenCalled()
  })
})

describe('downloadUpdate', () => {
  it('reports progress and ends ready to install', async () => {
    const { backend } = fakeBackend()
    setUpdaterBackend(backend)

    await checkForUpdates({ manual: true })
    await downloadUpdate()

    expect(status()).toBe('ready')
    expect(useUpdates.getState().progress).toBe(1)
    expect(useUpdates.getState().downloadedBytes).toBe(200)
  })

  it('keeps the found update after a failed download so a retry is possible', async () => {
    const { backend } = fakeBackend({
      update: {
        async download() {
          throw new Error('failed to download update')
        },
      },
    })
    setUpdaterBackend(backend)

    await checkForUpdates({ manual: true })
    await downloadUpdate()

    expect(status()).toBe('error')
    expect(useUpdates.getState().error?.kind).toBe('download')

    await resetUpdateState()
    expect(status()).toBe('available')
  })
})

describe('installUpdate', () => {
  it('flushes pending writes before installing, then restarts', async () => {
    const { backend, calls } = fakeBackend()
    setUpdaterBackend(backend)
    const off = registerPendingWrite('editor:test', async () => {
      calls.push('flush')
    })

    await checkForUpdates({ manual: true })
    await downloadUpdate()
    await installUpdate()

    expect(calls.indexOf('flush')).toBeLessThan(calls.indexOf('install'))
    expect(calls).toEqual(['check', 'download', 'flush', 'install', 'relaunch'])
    expect(status()).toBe('restarting')
    off()
  })

  it('refuses to restart when unsaved work could not be written', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { backend, calls } = fakeBackend()
    setUpdaterBackend(backend)
    const off = registerPendingWrite('editor:test', () => {
      throw new Error('IndexedDB is closed')
    })

    await checkForUpdates({ manual: true })
    await downloadUpdate()
    await installUpdate()

    expect(calls).not.toContain('install')
    expect(calls).not.toContain('relaunch')
    expect(status()).toBe('error')
    expect(useUpdates.getState().error?.detail).toMatch(/editor:test/)
    off()
    consoleError.mockRestore()
  })

  it('cannot install without a completed download', async () => {
    const { backend, calls } = fakeBackend()
    setUpdaterBackend(backend)

    await checkForUpdates({ manual: true })
    await installUpdate()

    expect(calls).not.toContain('install')
    expect(status()).toBe('available')
  })

  it('downloadAndInstall runs the whole sequence', async () => {
    const { backend, calls } = fakeBackend()
    setUpdaterBackend(backend)

    await checkForUpdates({ manual: true })
    await downloadAndInstall()

    expect(calls).toEqual(['check', 'download', 'install', 'relaunch'])
    expect(status()).toBe('restarting')
  })

  it('leaves the installed copy alone when the installer itself fails', async () => {
    const { backend, calls } = fakeBackend({
      update: {
        async install() {
          throw new Error('nsis installer exited with code 1')
        },
      },
    })
    setUpdaterBackend(backend)

    await checkForUpdates({ manual: true })
    await downloadAndInstall()

    expect(calls).not.toContain('relaunch')
    expect(useUpdates.getState().error?.kind).toBe('install')
  })
})

describe('notification policy', () => {
  it('notifies once a newer version is available', async () => {
    const { backend } = fakeBackend()
    setUpdaterBackend(backend)
    await checkForUpdates({ manual: true })

    expect(shouldNotify(useUpdates.getState(), null)).toBe(true)
  })

  it('stays quiet about a version the writer skipped', async () => {
    const { backend } = fakeBackend()
    setUpdaterBackend(backend)
    await checkForUpdates({ manual: true })
    skipVersion('0.9.0')

    expect(useSettings.getState().settings.updates.skippedVersion).toBe('0.9.0')
    expect(shouldNotify(useUpdates.getState(), '0.9.0')).toBe(false)
    // …but speaks up again for something newer still.
    expect(shouldNotify(useUpdates.getState(), '0.8.0')).toBe(true)
  })

  it('never notifies while idle, checking or up to date', () => {
    for (const s of ['idle', 'checking', 'up-to-date', 'error'] as const) {
      useUpdates.setState({ ...initialUpdateState(APP_VERSION, true), status: s })
      expect(shouldNotify(useUpdates.getState(), null)).toBe(false)
    }
  })
})

describe('diagnostics', () => {
  it('summarises state without leaking project content', async () => {
    const { backend } = fakeBackend()
    setUpdaterBackend(backend)
    await checkForUpdates({ manual: true })

    const text = updateDiagnostics()
    expect(text).toContain(`Parchment ${APP_VERSION}`)
    expect(text).toContain('status: available')
    expect(text).toContain('offered: 0.9.0')
    expect(text).toContain('error: none')
  })
})

describe('pending-write registry integration', () => {
  it('is empty once the test editors unregister', async () => {
    await expect(flushPendingWrites()).resolves.toMatchObject({ total: 0 })
  })
})
