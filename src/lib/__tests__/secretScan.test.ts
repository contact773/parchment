import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  containsPrivateKeyMaterial,
  decodesToPrivateKey,
  looksLikeKeyFilename,
  scanForSecrets,
} from '@/lib/secretScan'

const root = fileURLToPath(new URL('../../..', import.meta.url))

/**
 * The exact shape `tauri signer generate -w` writes: the whole rsign key file,
 * base64-encoded as one blob. This is a throwaway with no real key material —
 * the header is what the scanner keys on.
 */
const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64')

const fakeTauriPrivateKey = b64(
  `untrusted comment: rsign encrypted secret key\n${'A'.repeat(220)}\n`,
)

/** What we deliberately commit: the public half. */
const realPublicKey = JSON.parse(readFileSync(`${root}/src-tauri/tauri.conf.json`, 'utf8')).plugins.updater.pubkey

describe('decodesToPrivateKey', () => {
  it('catches a base64-wrapped rsign secret key — the form Tauri actually writes', () => {
    expect(decodesToPrivateKey(fakeTauriPrivateKey)).toBe(true)
  })

  it('catches it when pasted into the middle of another file', () => {
    expect(decodesToPrivateKey(`const KEY = "${fakeTauriPrivateKey}" // oops`)).toBe(true)
  })

  it('leaves the committed public key alone', () => {
    expect(decodesToPrivateKey(realPublicKey)).toBe(false)
    expect(Buffer.from(realPublicKey, 'base64').toString('utf8')).toContain('public key')
  })

  it('ignores base64 that is not a key at all', () => {
    expect(decodesToPrivateKey(b64('x'.repeat(400)))).toBe(false)
    expect(decodesToPrivateKey('a'.repeat(400))).toBe(false)
  })

  it('ignores short base64 like an id or a hash', () => {
    expect(decodesToPrivateKey(b64('untrusted comment: rsign encrypted secret key'.slice(0, 20)))).toBe(false)
  })
})

describe('containsPrivateKeyMaterial', () => {
  it('catches an unwrapped key header on its own line', () => {
    expect(containsPrivateKeyMaterial('untrusted comment: rsign encrypted secret key\nAAAA\n')).toBe(true)
  })

  it('catches a PEM private key', () => {
    expect(containsPrivateKeyMaterial('-----BEGIN RSA PRIVATE KEY-----\nAAAA\n')).toBe(true)
  })

  it('does not fail on prose that merely mentions a header', () => {
    // This is what broke the first version of the check: the workflow, the docs
    // and this very test all discuss the header they search for.
    const prose = [
      "grep for 'untrusted comment: rsign encrypted secret key' to find a key",
      'expect(read(config)).not.toContain("minisign encrypted secret key")',
      'A minisign private key is committed. Remove it and rotate the key.',
    ].join('\n')
    expect(containsPrivateKeyMaterial(prose)).toBe(false)
  })
})

describe('looksLikeKeyFilename', () => {
  it.each(['updater.key', 'a/b/parchment-updater.key', 'cert.PEM', 'signing.p12', 'store.keystore'])(
    'flags %s',
    (path) => expect(looksLikeKeyFilename(path)).toBe(true),
  )

  it.each(['src/lib/secretScan.ts', 'notes.keyboard.md', 'docs/monkey.md'])('spares %s', (path) =>
    expect(looksLikeKeyFilename(path)).toBe(false),
  )
})

describe('scanForSecrets', () => {
  it('reports each offender with a reason and spares everything else', () => {
    const findings = scanForSecrets([
      { path: 'src-tauri/tauri.conf.json', content: `{"pubkey":"${realPublicKey}"}` },
      { path: 'secrets/updater.key', content: null },
      { path: 'src/config.ts', content: `export const K = "${fakeTauriPrivateKey}"` },
      { path: 'README.md', content: 'Parchment signs its updates.' },
      { path: 'assets/font.woff', content: null },
    ])

    expect(findings).toEqual([
      { file: 'secrets/updater.key', reason: 'a private-key file extension' },
      { file: 'src/config.ts', reason: 'private-key material in its contents' },
    ])
  })

  it('passes the repository as it stands', () => {
    // A full scan runs in CI; this is the cheap smoke test that the committed
    // public key and the docs about key handling do not trip the scanner.
    const files = [
      'src-tauri/tauri.conf.json',
      'src/lib/secretScan.ts',
      'scripts/check-no-secrets.mjs',
      'docs/RELEASE.md',
      '.github/workflows/ci.yml',
    ].map((path) => ({ path, content: readFileSync(`${root}/${path}`, 'utf8') }))

    expect(scanForSecrets(files)).toEqual([])
  })
})
