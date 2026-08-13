import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPendingWrites, pendingWriteCount, registerPendingWrite } from '@/lib/pendingWrites'

const cleanups: (() => void)[] = []
const register = (label: string, fn: () => void | Promise<void>) => {
  const off = registerPendingWrite(label, fn)
  cleanups.push(off)
  return off
}

afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
  expect(pendingWriteCount()).toBe(0)
})

describe('flushPendingWrites', () => {
  it('resolves immediately when nothing is registered', async () => {
    await expect(flushPendingWrites()).resolves.toEqual({ total: 0, failed: [], timedOut: false })
  })

  it('awaits every registered writer before resolving', async () => {
    const order: string[] = []
    register('editor', async () => {
      await new Promise((r) => setTimeout(r, 10))
      order.push('editor')
    })
    register('map', () => {
      order.push('map')
    })

    const report = await flushPendingWrites()
    expect(report).toEqual({ total: 2, failed: [], timedOut: false })
    expect(order).toEqual(['map', 'editor'])
  })

  it('reports a writer that throws without losing the others', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const saved = vi.fn()
    register('broken', () => {
      throw new Error('quota exceeded')
    })
    register('map', saved)

    const report = await flushPendingWrites()
    expect(report.failed).toEqual(['broken'])
    expect(report.total).toBe(2)
    expect(saved).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })

  it('reports a rejected promise the same way', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    register('slow-db', () => Promise.reject(new Error('IndexedDB closed')))
    const report = await flushPendingWrites()
    expect(report.failed).toEqual(['slow-db'])
    consoleError.mockRestore()
  })

  it('gives up on a hung writer instead of blocking forever', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    register('hung', () => new Promise(() => {}))
    const report = await flushPendingWrites(20)
    expect(report.timedOut).toBe(true)
    consoleWarn.mockRestore()
  })

  it('stops flushing a writer once it unregisters', async () => {
    const flush = vi.fn()
    const off = register('editor:a', flush)
    off()
    cleanups.pop()
    await flushPendingWrites()
    expect(flush).not.toHaveBeenCalled()
  })

  it('keeps registrations of the same label independent', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const offFirst = register('editor', first)
    register('editor', second)
    expect(pendingWriteCount()).toBe(2)

    offFirst()
    cleanups.splice(cleanups.indexOf(offFirst), 1)
    await flushPendingWrites()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledOnce()
  })
})
