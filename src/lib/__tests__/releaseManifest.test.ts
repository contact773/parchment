import { describe, expect, it } from 'vitest'
import {
  ManifestError,
  REQUIRED_TARGETS,
  parseReleaseManifest,
  resolveEndpoint,
  selectPlatformAsset,
  updaterTargetKey,
  verifyManifest,
} from '@/lib/releaseManifest'

const valid = {
  version: '0.2.0',
  notes: 'Signed installer and in-app updates.',
  pub_date: '2026-08-13T10:00:00Z',
  platforms: {
    'windows-x86_64': {
      signature: 'dW50cnVzdGVkIGNvbW1lbnQ6IHNpZw==',
      url: 'https://github.com/contact773/parchment/releases/download/v0.2.0/Parchment_0.2.0_x64-setup.exe',
    },
  },
}

describe('parseReleaseManifest', () => {
  it('accepts a manifest of the shape Tauri publishes', () => {
    const manifest = parseReleaseManifest(valid)
    expect(manifest.version).toBe('0.2.0')
    expect(manifest.pubDate).toBe('2026-08-13T10:00:00Z')
    expect(manifest.platforms['windows-x86_64'].url).toContain('v0.2.0')
  })

  it('accepts the manifest as a JSON string', () => {
    expect(parseReleaseManifest(JSON.stringify(valid)).version).toBe('0.2.0')
  })

  it('defaults optional fields instead of failing', () => {
    const manifest = parseReleaseManifest({ ...valid, notes: undefined, pub_date: undefined })
    expect(manifest.notes).toBe('')
    expect(manifest.pubDate).toBe('')
  })

  it('names the offending field when something is wrong', () => {
    const cases: [unknown, string][] = [
      ['not json at all', '$'],
      [[], '$'],
      [{ ...valid, version: undefined }, 'version'],
      [{ ...valid, version: 'latest' }, 'version'],
      [{ ...valid, platforms: undefined }, 'platforms'],
      [{ ...valid, platforms: {} }, 'platforms'],
      [{ ...valid, platforms: { 'toaster-x86_64': valid.platforms['windows-x86_64'] } }, 'platforms.toaster-x86_64'],
      [
        { ...valid, platforms: { 'windows-x86_64': { url: valid.platforms['windows-x86_64'].url } } },
        'platforms.windows-x86_64.signature',
      ],
      [
        { ...valid, platforms: { 'windows-x86_64': { signature: 'sig', url: '' } } },
        'platforms.windows-x86_64.url',
      ],
      [
        { ...valid, platforms: { 'windows-x86_64': { signature: 'sig', url: 'http://insecure/app.zip' } } },
        'platforms.windows-x86_64.url',
      ],
    ]
    for (const [input, field] of cases) {
      let thrown: unknown
      try {
        parseReleaseManifest(input)
      } catch (err) {
        thrown = err
      }
      expect(thrown, `expected ${JSON.stringify(input)} to be rejected`).toBeInstanceOf(ManifestError)
      expect((thrown as ManifestError).field).toBe(field)
    }
  })

  it('refuses an empty signature — an unsigned artifact can never install', () => {
    expect(() =>
      parseReleaseManifest({ ...valid, platforms: { 'windows-x86_64': { signature: '   ', url: 'https://a/b.zip' } } }),
    ).toThrow(/signature/)
  })
})

describe('platform selection', () => {
  it('builds the updater target key', () => {
    expect(updaterTargetKey('windows', 'x86_64')).toBe('windows-x86_64')
    expect(updaterTargetKey('darwin', 'aarch64')).toBe('darwin-aarch64')
  })

  it('returns the asset for a published platform and null otherwise', () => {
    const manifest = parseReleaseManifest(valid)
    expect(selectPlatformAsset(manifest, 'windows-x86_64')?.url).toContain('x64-setup.exe')
    expect(selectPlatformAsset(manifest, 'darwin-aarch64')).toBeNull()
  })
})

describe('verifyManifest', () => {
  it('passes a manifest that matches the release', () => {
    const problems = verifyManifest(parseReleaseManifest(valid), { version: '0.2.0', urlMustContain: 'v0.2.0' })
    expect(problems).toEqual([])
  })

  it('reports a version mismatch', () => {
    const problems = verifyManifest(parseReleaseManifest(valid), { version: '0.3.0' })
    expect(problems).toContain('manifest version is 0.2.0, expected 0.3.0')
  })

  it('reports a missing promised target', () => {
    const problems = verifyManifest(parseReleaseManifest(valid), {
      version: '0.2.0',
      targets: ['windows-x86_64', 'darwin-aarch64'],
    })
    expect(problems).toEqual(['missing required target darwin-aarch64'])
  })

  it('catches assets left pointing at a previous release', () => {
    const problems = verifyManifest(parseReleaseManifest(valid), { version: '0.2.0', urlMustContain: 'v0.3.0' })
    expect(problems[0]).toMatch(/does not reference v0.3.0/)
  })

  it('catches a stale artifact paired with a newer manifest', () => {
    // The real bug this guards: a bundle directory still holding the previous
    // build, so a 0.2.0 manifest points at the 0.1.0 installer — right tag,
    // right URL directory, wrong file, and a signature that cannot verify.
    const stale = parseReleaseManifest({
      ...valid,
      platforms: {
        'windows-x86_64': {
          signature: 'c2ln',
          url: 'https://github.com/contact773/parchment/releases/download/v0.2.0/Parchment_0.1.0_x64-setup.exe',
        },
      },
    })
    expect(verifyManifest(stale, { version: '0.2.0', urlMustContain: 'v0.2.0' })).toEqual([])
    expect(verifyManifest(stale, { version: '0.2.0', urlMustContain: ['v0.2.0', '0.2.0_x64'] })).toEqual([
      'windows-x86_64 url does not reference 0.2.0_x64: https://github.com/contact773/parchment/releases/download/v0.2.0/Parchment_0.1.0_x64-setup.exe',
    ])
  })

  it('accepts a single string or a list of required substrings', () => {
    const manifest = parseReleaseManifest(valid)
    expect(verifyManifest(manifest, { version: '0.2.0', urlMustContain: 'v0.2.0' })).toEqual([])
    expect(verifyManifest(manifest, { version: '0.2.0', urlMustContain: ['v0.2.0', '0.2.0', 'setup.exe'] })).toEqual([])
    expect(verifyManifest(manifest, { version: '0.2.0', urlMustContain: [] })).toEqual([])
  })

  it('defaults to the targets Parchment promises to publish', () => {
    expect(REQUIRED_TARGETS).toContain('windows-x86_64')
    expect(verifyManifest(parseReleaseManifest(valid), { version: '0.2.0' })).toEqual([])
  })
})

describe('resolveEndpoint', () => {
  const vars = { target: 'windows', arch: 'x86_64', currentVersion: '0.1.0' }

  it('substitutes every placeholder Tauri supports', () => {
    expect(resolveEndpoint('https://example.com/{{target}}/{{arch}}/{{current_version}}', vars)).toBe(
      'https://example.com/windows/x86_64/0.1.0',
    )
  })

  it('leaves a placeholder-free endpoint alone', () => {
    const url = 'https://github.com/contact773/parchment/releases/latest/download/latest.json'
    expect(resolveEndpoint(url, vars)).toBe(url)
  })

  it('rejects an unknown placeholder rather than fetching a broken URL', () => {
    expect(() => resolveEndpoint('https://example.com/{{channel}}/latest.json', vars)).toThrow(/unknown placeholder/)
  })

  it('rejects a plaintext endpoint', () => {
    expect(() => resolveEndpoint('http://example.com/latest.json', vars)).toThrow(/https/)
  })
})
