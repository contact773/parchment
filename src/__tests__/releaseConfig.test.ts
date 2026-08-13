/**
 * Locks the release configuration.
 *
 * Everything asserted here is a decision that is expensive or impossible to
 * reverse once a build is in a writer's hands: the application identifier, the
 * updater public key, the endpoint installed copies poll, and the workflow
 * rules that stop an unsigned or half-built release from being published.
 *
 * If a change here fails, the right response is almost never to update the
 * expectation — it is to check what the change would do to somebody who
 * already has Parchment installed.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolveEndpoint } from '@/lib/releaseManifest'
import { containsPrivateKeyMaterial } from '@/lib/secretScan'
import { isValidVersion } from '@/lib/semver'

const root = fileURLToPath(new URL('../..', import.meta.url))
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')
const readJson = (p: string) => JSON.parse(read(p))

const pkg = readJson('package.json')
const tauriConf = readJson('src-tauri/tauri.conf.json')
const previewConf = readJson('src-tauri/tauri.preview.conf.json')
const ciConf = readJson('src-tauri/tauri.ci.conf.json')
const capabilities = readJson('src-tauri/capabilities/default.json')
const cargoToml = read('src-tauri/Cargo.toml')

describe('version authority', () => {
  it('package.json holds a valid semantic version', () => {
    expect(isValidVersion(pkg.version)).toBe(true)
  })

  it('tauri.conf.json and Cargo.toml agree with it', () => {
    expect(tauriConf.version).toBe(pkg.version)
    const cargoVersion = /\[package\][^[]*?\bversion\s*=\s*"([^"]+)"/.exec(cargoToml)?.[1]
    expect(cargoVersion).toBe(pkg.version)
  })

  it('exposes the release scripts a maintainer and CI both depend on', () => {
    for (const script of ['version:check', 'version:sync', 'version:set', 'release:verify', 'updater:keygen']) {
      expect(pkg.scripts, `missing npm script ${script}`).toHaveProperty(script)
    }
  })
})

describe('installer', () => {
  it('keeps the application identifier stable forever', () => {
    // Changing this creates a SECOND installation on every existing machine,
    // with its own empty database. It is effectively unchangeable after the
    // first public release.
    expect(tauriConf.identifier).toBe('com.grinmedia.parchment')
  })

  it('bundles the Windows setup program, not a bare executable', () => {
    expect(tauriConf.bundle.active).toBe(true)
    expect(tauriConf.bundle.targets).toContain('nsis')
  })

  it('installs per user so no writer needs an administrator', () => {
    expect(tauriConf.bundle.windows.nsis.installMode).toBe('currentUser')
  })

  it('carries the publisher metadata an installer needs', () => {
    expect(tauriConf.productName).toBe('Parchment')
    expect(tauriConf.bundle.publisher).toBeTruthy()
    expect(tauriConf.bundle.copyright).toBeTruthy()
    expect(tauriConf.bundle.shortDescription).toBeTruthy()
    expect(tauriConf.bundle.icon.length).toBeGreaterThan(0)
  })
})

describe('updater configuration', () => {
  const updater = tauriConf.plugins?.updater

  it('produces signed updater artifacts', () => {
    expect(tauriConf.bundle.createUpdaterArtifacts).toBe(true)
  })

  it('embeds a minisign PUBLIC key — and never a private one', () => {
    expect(updater?.pubkey, 'no updater public key configured').toBeTruthy()
    const decoded = Buffer.from(updater.pubkey, 'base64').toString('utf8')
    expect(decoded).toContain('minisign public key')
    expect(decoded).not.toContain('secret key')
    // The same detector CI runs across every tracked file.
    expect(containsPrivateKeyMaterial(read('src-tauri/tauri.conf.json'))).toBe(false)
  })

  it('polls exactly one https endpoint, and it is the stable one', () => {
    expect(Array.isArray(updater.endpoints)).toBe(true)
    expect(updater.endpoints).toHaveLength(1)
    const [endpoint] = updater.endpoints
    expect(endpoint).toMatch(/^https:\/\/github\.com\/contact773\/parchment\/releases\/latest\/download\/latest\.json$/)
    // …and it resolves without leaving an unsubstituted placeholder behind.
    expect(resolveEndpoint(endpoint, { target: 'windows', arch: 'x86_64', currentVersion: pkg.version })).toBe(endpoint)
  })

  it('installs on Windows without a wizard the writer has to click through', () => {
    expect(updater.windows.installMode).toBe('passive')
  })

  it('grants the app the permissions the updater needs, and no more', () => {
    expect(capabilities.permissions).toContain('updater:default')
    expect(capabilities.permissions).toContain('process:allow-restart')
    // A blanket process permission would let any page code kill the app.
    expect(capabilities.permissions).not.toContain('process:default')
  })

  it('has the Rust plugins compiled in', () => {
    expect(cargoToml).toMatch(/tauri-plugin-updater\s*=/)
    expect(cargoToml).toMatch(/tauri-plugin-process\s*=/)
  })
})

describe('preview channel overlay', () => {
  it('points at the rolling preview manifest instead of the stable one', () => {
    const [endpoint] = previewConf.plugins.updater.endpoints
    expect(endpoint).toBe('https://github.com/contact773/parchment/releases/download/preview/latest.json')
    expect(endpoint).not.toBe(tauriConf.plugins.updater.endpoints[0])
  })

  it('stays the same application, so a preview upgrades rather than duplicates', () => {
    expect(previewConf.identifier).toBeUndefined()
    expect(previewConf.productName).toBeUndefined()
  })

  it('does not override the public key — both channels are signed by one key', () => {
    expect(previewConf.plugins.updater.pubkey).toBeUndefined()
  })
})

describe('CI overlay', () => {
  it('only disables updater artifacts, so unsigned builds cannot masquerade as releases', () => {
    expect(ciConf.bundle.createUpdaterArtifacts).toBe(false)
    expect(Object.keys(ciConf.bundle)).toEqual(['createUpdaterArtifacts'])
    expect(ciConf.plugins).toBeUndefined()
  })
})

describe('every Tauri config is schema-clean', () => {
  // Tauri validates its configuration with `additionalProperties: false`, and
  // JSON has no comments — so a well-meaning `"//"` explanation key fails the
  // build outright with "Additional properties are not allowed". The prose that
  // used to live in those keys is in src-tauri/README.md instead.
  const schemaProperties = new Set<string>(
    Object.keys(readJson('node_modules/@tauri-apps/cli/config.schema.json').properties),
  )

  const configs: Record<string, Record<string, unknown>> = {
    'tauri.conf.json': tauriConf,
    'tauri.preview.conf.json': previewConf,
    'tauri.ci.conf.json': ciConf,
  }

  it('uses only top-level keys the Tauri schema allows', () => {
    expect(schemaProperties.size).toBeGreaterThan(0)
    for (const [name, conf] of Object.entries(configs)) {
      for (const key of Object.keys(conf)) {
        expect(schemaProperties.has(key), `${name}: unsupported top-level key ${JSON.stringify(key)}`).toBe(true)
      }
    }
  })
})

describe('workflows', () => {
  const ci = read('.github/workflows/ci.yml')
  const release = read('.github/workflows/release.yml')
  const preview = read('.github/workflows/preview.yml')

  it('runs the full quality gate on pull requests', () => {
    expect(ci).toContain('pull_request')
    expect(ci).toContain('npm run version:check')
    expect(ci).toContain('npm run typecheck')
    expect(ci).toContain('npm test -- --run')
    expect(ci).toContain('npm run build')
  })

  it('builds an unsigned installer on pull requests using the CI overlay', () => {
    expect(ci).toContain('src-tauri/tauri.ci.conf.json')
    expect(ci).not.toContain('TAURI_SIGNING_PRIVATE_KEY')
  })

  it('releases only from a version tag', () => {
    expect(release).toMatch(/tags:\s*\['v\*'\]/)
  })

  it('fails closed when the signing key is missing', () => {
    expect(release).toContain('Refusing to publish an unsigned release')
    expect(preview).toContain('Refusing to publish an unsigned preview')
  })

  it('refuses a tag that does not match package.json', () => {
    expect(release).toContain('does not match package.json version')
  })

  it('publishes only after the manifest has been verified', () => {
    const draftAt = release.indexOf('releaseDraft: true')
    const verifyAt = release.indexOf('scripts/verify-release.mjs')
    const publishAt = release.indexOf('draft=false')
    expect(draftAt).toBeGreaterThan(-1)
    expect(verifyAt).toBeGreaterThan(draftAt)
    expect(publishAt).toBeGreaterThan(verifyAt)
  })

  it('marks previews as prereleases so stable users never see them', () => {
    expect(preview).toContain('prerelease: true')
    expect(preview).toContain('tagName: preview')
    expect(preview).toContain('src-tauri/tauri.preview.conf.json')
  })

  it('does not publish previews from main until a maintainer opts in', () => {
    expect(preview).toContain('PUBLISH_PREVIEWS')
    expect(preview).toContain("github.repository == 'contact773/parchment'")
  })

  it('scans for committed keys with the tested detector, not an inline grep', () => {
    // An inline grep for a key header matched this workflow, the tests and the
    // docs — every file that discusses the header — and could not detect a real
    // Tauri key anyway, since those are base64-wrapped. See src/lib/secretScan.ts.
    expect(ci).toContain('npm run check:secrets')
  })

  it('grants write access only to the jobs that publish', () => {
    expect(ci).toContain('permissions:\n  contents: read')
    expect(release).toContain('permissions:\n  contents: read')
    expect(release).toContain('contents: write')
  })
})

describe('no signing material in the working tree', () => {
  it('does not keep a private key anywhere in the repository', () => {
    for (const candidate of [
      'parchment-updater.key',
      'src-tauri/parchment-updater.key',
      '.tauri/parchment.key',
      'updater.key',
    ]) {
      expect(existsSync(resolve(root, candidate)), `${candidate} must not exist`).toBe(false)
    }
  })

  it('ignores key files by pattern so one cannot be added by accident', () => {
    const gitignore = read('.gitignore')
    expect(gitignore).toMatch(/\*\.key/)
  })
})
