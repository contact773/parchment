import { describe, expect, it } from 'vitest'
import {
  compareVersions,
  isNewerVersion,
  isPrerelease,
  isValidVersion,
  maxVersion,
  parseVersion,
} from '@/lib/semver'

describe('parseVersion', () => {
  it('parses a plain release', () => {
    expect(parseVersion('1.2.3')).toMatchObject({ major: 1, minor: 2, patch: 3, prerelease: [], build: '' })
  })

  it('parses pre-release and build metadata', () => {
    expect(parseVersion('0.2.0-preview.11+abc123')).toMatchObject({
      major: 0,
      minor: 2,
      patch: 0,
      prerelease: ['preview', 11],
      build: 'abc123',
    })
  })

  it('tolerates the v prefix git tags use', () => {
    expect(parseVersion('v0.2.0')).toMatchObject({ major: 0, minor: 2, patch: 0 })
  })

  it.each(['', '1.2', '1.2.3.4', '01.2.3', 'latest', '1.2.3-', 'v', ' 1.2.3 beta'])(
    'rejects %j',
    (bad) => {
      expect(parseVersion(bad)).toBeNull()
      expect(isValidVersion(bad)).toBe(false)
    },
  )

  it('rejects non-strings', () => {
    expect(parseVersion(undefined as unknown as string)).toBeNull()
    expect(parseVersion(42 as unknown as string)).toBeNull()
  })
})

describe('compareVersions', () => {
  it('orders by major, minor, then patch', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
    expect(compareVersions('1.3.0', '1.2.9')).toBe(1)
    expect(compareVersions('0.1.10', '0.1.9')).toBe(1)
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0)
  })

  it('sorts a pre-release below its release (SemVer 11.3)', () => {
    expect(compareVersions('1.0.0-preview.1', '1.0.0')).toBe(-1)
    expect(compareVersions('1.0.0', '1.0.0-preview.1')).toBe(1)
  })

  it('orders pre-release identifiers per SemVer 11.4', () => {
    const ascending = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0',
    ]
    for (let i = 0; i < ascending.length - 1; i++) {
      expect(compareVersions(ascending[i], ascending[i + 1])).toBe(-1)
    }
  })

  it('ignores build metadata when ordering', () => {
    expect(compareVersions('1.0.0+build.1', '1.0.0+build.2')).toBe(0)
  })

  it('throws on an unparseable version so release tooling fails loudly', () => {
    expect(() => compareVersions('nightly', '1.0.0')).toThrow(TypeError)
  })
})

describe('isNewerVersion', () => {
  it('is true only for a strictly newer candidate', () => {
    expect(isNewerVersion('0.2.0', '0.1.0')).toBe(true)
    expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false)
    expect(isNewerVersion('0.0.9', '0.1.0')).toBe(false)
  })

  it('lets a stable release supersede its own previews', () => {
    expect(isNewerVersion('0.3.0', '0.3.0-preview.9')).toBe(true)
    expect(isNewerVersion('0.3.0-preview.9', '0.3.0')).toBe(false)
  })

  it('fails closed on junk rather than offering an update', () => {
    expect(isNewerVersion('', '0.1.0')).toBe(false)
    expect(isNewerVersion('not-a-version', '0.1.0')).toBe(false)
    expect(isNewerVersion('9.9.9', 'not-a-version')).toBe(false)
    expect(isNewerVersion(null as unknown as string, '0.1.0')).toBe(false)
  })
})

describe('isPrerelease / maxVersion', () => {
  it('recognises the preview channel from the version alone', () => {
    expect(isPrerelease('0.2.0-preview.1')).toBe(true)
    expect(isPrerelease('0.2.0')).toBe(false)
    expect(isPrerelease('nonsense')).toBe(false)
  })

  it('picks the highest valid version and ignores junk', () => {
    expect(maxVersion(['0.1.0', '0.3.0-preview.1', '0.2.9', 'garbage'])).toBe('0.3.0-preview.1')
    expect(maxVersion(['garbage'])).toBeNull()
    expect(maxVersion([])).toBeNull()
  })
})
