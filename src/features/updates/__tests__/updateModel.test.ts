import { describe, expect, it } from 'vitest'
import {
  channelForVersion,
  classifyUpdateError,
  describeStatus,
  initialUpdateState,
  isBusy,
  updateError,
  updateReducer,
  type UpdateEvent,
  type UpdateState,
} from '@/features/updates/updateModel'

const start = (overrides: Partial<UpdateState> = {}): UpdateState => ({
  ...initialUpdateState('0.1.0', true),
  ...overrides,
})

const run = (state: UpdateState, ...events: UpdateEvent[]) => events.reduce(updateReducer, state)

const offered = { version: '0.2.0', currentVersion: '0.1.0', notes: 'New things' }

describe('the happy path', () => {
  it('walks idle -> checking -> available -> downloading -> ready -> installing -> restarting', () => {
    let s = start()
    expect(s.status).toBe('idle')

    s = updateReducer(s, { type: 'check', manual: true })
    expect(s.status).toBe('checking')

    s = updateReducer(s, { type: 'check-result', update: offered, at: 1000 })
    expect(s.status).toBe('available')
    expect(s.update?.version).toBe('0.2.0')
    expect(s.lastCheckedAt).toBe(1000)

    s = run(
      s,
      { type: 'download' },
      { type: 'download-started', totalBytes: 400 },
      { type: 'download-progress', chunkBytes: 100 },
    )
    expect(s.status).toBe('downloading')
    expect(s.progress).toBeCloseTo(0.25)

    s = run(s, { type: 'download-progress', chunkBytes: 300 }, { type: 'download-finished' })
    expect(s.status).toBe('ready')
    expect(s.progress).toBe(1)

    s = run(s, { type: 'install' }, { type: 'installed' })
    expect(s.status).toBe('restarting')
  })

  it('reports unknown progress when the server sends no content length', () => {
    const s = run(
      start({ status: 'available', update: offered }),
      { type: 'download' },
      { type: 'download-started', totalBytes: null },
      { type: 'download-progress', chunkBytes: 5000 },
    )
    expect(s.progress).toBeNull()
    expect(s.downloadedBytes).toBe(5000)
  })

  it('clamps a mis-reported content length to 100%', () => {
    const s = run(
      start({ status: 'available', update: offered }),
      { type: 'download' },
      { type: 'download-started', totalBytes: 100 },
      { type: 'download-progress', chunkBytes: 400 },
    )
    expect(s.progress).toBe(1)
  })
})

describe('version safety', () => {
  it('treats an equal version as up to date', () => {
    const s = run(start(), { type: 'check', manual: true }, {
      type: 'check-result',
      update: { version: '0.1.0', currentVersion: '0.1.0' },
      at: 1,
    })
    expect(s.status).toBe('up-to-date')
    expect(s.update).toBeNull()
  })

  it('never offers a downgrade', () => {
    const s = run(start({ currentVersion: '0.5.0' }), { type: 'check', manual: true }, {
      type: 'check-result',
      update: { version: '0.4.9', currentVersion: '0.5.0' },
      at: 1,
    })
    expect(s.status).toBe('up-to-date')
  })

  it('offers a stable release over an installed preview', () => {
    const s = run(start({ currentVersion: '0.3.0-preview.4' }), { type: 'check', manual: true }, {
      type: 'check-result',
      update: { version: '0.3.0', currentVersion: '0.3.0-preview.4' },
      at: 1,
    })
    expect(s.status).toBe('available')
  })

  it('ignores a manifest version it cannot parse', () => {
    const s = run(start(), { type: 'check', manual: true }, {
      type: 'check-result',
      update: { version: 'nightly-build', currentVersion: '0.1.0' },
      at: 1,
    })
    expect(s.status).toBe('up-to-date')
  })
})

describe('illegal transitions are ignored', () => {
  it('cannot download without an available update', () => {
    expect(updateReducer(start(), { type: 'download' }).status).toBe('idle')
  })

  it('cannot install before the download finished', () => {
    const s = start({ status: 'downloading', update: offered })
    expect(updateReducer(s, { type: 'install' }).status).toBe('downloading')
  })

  it('cannot start a second check while one is running', () => {
    const s = start({ status: 'checking' })
    expect(updateReducer(s, { type: 'check', manual: true })).toBe(s)
  })

  it('ignores a late download callback after the download finished', () => {
    const s = start({ status: 'ready', update: offered, progress: 1 })
    expect(updateReducer(s, { type: 'download-progress', chunkBytes: 10 }).progress).toBe(1)
  })

  it('does nothing at all in a browser build', () => {
    const browser = initialUpdateState('0.1.0', false)
    expect(browser.status).toBe('unsupported')
    for (const event of [
      { type: 'check', manual: true },
      { type: 'download' },
      { type: 'install' },
    ] as UpdateEvent[]) {
      expect(updateReducer(browser, event)).toBe(browser)
    }
  })

  it('will not report a failure once the installer has taken over', () => {
    const s = start({ status: 'restarting', update: offered })
    expect(updateReducer(s, { type: 'fail', error: updateError('install') }).status).toBe('restarting')
  })
})

describe('failure and recovery', () => {
  it('keeps an already-found update after a failed download', () => {
    let s = run(start({ status: 'available', update: offered }), { type: 'download' })
    s = updateReducer(s, { type: 'fail', error: updateError('download') })
    expect(s.status).toBe('error')
    expect(s.error?.kind).toBe('download')

    s = updateReducer(s, { type: 'reset' })
    expect(s.status).toBe('available')
    expect(s.update).toEqual(offered)
    expect(s.error).toBeNull()
  })

  it('returns to idle when the failure happened before anything was found', () => {
    let s = run(start(), { type: 'check', manual: false })
    s = updateReducer(s, { type: 'fail', error: updateError('offline'), at: 42 })
    expect(s.status).toBe('error')
    expect(s.lastCheckedAt).toBe(42)
    expect(updateReducer(s, { type: 'reset' }).status).toBe('idle')
  })

  it('allows a retry after an error', () => {
    const s = start({ status: 'error', error: updateError('timeout') })
    expect(updateReducer(s, { type: 'check', manual: true }).status).toBe('checking')
  })
})

describe('classifyUpdateError', () => {
  it.each([
    ['Signature verification failed', 'signature'],
    ['minisign: incorrect signature', 'signature'],
    ['operation timed out', 'timeout'],
    ['failed to lookup address information: no such host — could not resolve', 'offline'],
    ['error sending request: connection refused', 'offline'],
    ['no configured updater endpoint', 'not-configured'],
    ['invalid pubkey', 'not-configured'],
    ['expected value at line 1 column 1', 'manifest'],
    ['failed to download update', 'download'],
    ['nsis installer exited with code 1', 'install'],
    ['something nobody predicted', 'unknown'],
  ])('maps %j to %s', (raw, kind) => {
    expect(classifyUpdateError(new Error(raw)).kind).toBe(kind)
  })

  it('always produces a message that reassures about the installed copy', () => {
    for (const kind of ['download', 'install', 'unknown'] as const) {
      expect(updateError(kind).message).toMatch(/installed copy is unchanged/)
    }
  })

  it('keeps the raw detail for diagnostics but not in the message', () => {
    const err = classifyUpdateError(new Error('Signature verification failed for asset X'))
    expect(err.detail).toContain('asset X')
    expect(err.message).not.toContain('asset X')
  })

  it('handles non-Error throwables', () => {
    expect(classifyUpdateError('timeout while connecting').kind).toBe('timeout')
    expect(classifyUpdateError({ weird: true }).kind).toBe('unknown')
  })
})

describe('presentation helpers', () => {
  it('derives the channel from the version', () => {
    expect(channelForVersion('0.2.0')).toBe('stable')
    expect(channelForVersion('0.2.0-preview.1')).toBe('preview')
  })

  it('marks exactly the states that should block a second gesture', () => {
    expect(['checking', 'downloading', 'installing', 'restarting'].every(isBusy)).toBe(true)
    expect(['idle', 'available', 'ready', 'up-to-date', 'error'].some(isBusy)).toBe(false)
  })

  it('describes every reachable status', () => {
    const statuses: UpdateState['status'][] = [
      'unsupported',
      'idle',
      'checking',
      'up-to-date',
      'available',
      'downloading',
      'ready',
      'installing',
      'restarting',
      'error',
    ]
    for (const status of statuses) {
      const text = describeStatus(start({ status, update: offered, error: updateError('offline'), progress: 0.5 }))
      expect(text, status).toBeTruthy()
    }
  })
})
