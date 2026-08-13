/**
 * The release manifest (`latest.json`) that installed copies poll.
 *
 * Tauri's updater fetches, parses and signature-checks this file natively, so
 * nothing here runs on the writer's machine. It exists so that *we* can prove,
 * before a release is published, that the manifest CI produced is the manifest
 * installed copies expect: right version, every promised platform present, no
 * empty signatures, no URLs pointing at the wrong release.
 *
 * `scripts/verify-release.mjs` imports this module directly (Node strips the
 * types), which is why it uses relative imports and no DOM APIs.
 *
 * Manifest shape (Tauri v2 static JSON):
 *
 *   {
 *     "version": "0.2.0",
 *     "notes": "…",
 *     "pub_date": "2026-08-13T10:00:00Z",
 *     "platforms": {
 *       "windows-x86_64": { "signature": "…", "url": "https://…nsis.zip" }
 *     }
 *   }
 */
import { isValidVersion } from './semver.ts'

export interface PlatformAsset {
  /** Detached minisign signature, base64. */
  signature: string
  /** Absolute https URL of the updater archive. */
  url: string
}

export interface ReleaseManifest {
  version: string
  notes: string
  /** Publication date exactly as published; not parsed, only carried. */
  pubDate: string
  platforms: Record<string, PlatformAsset>
}

/**
 * Platform keys Parchment promises to publish, in the order they appear in
 * release notes. Windows first, deliberately: macOS and Linux join once their
 * signing and install behaviour have been verified on those systems.
 */
export const REQUIRED_TARGETS = ['windows-x86_64'] as const

/** Every key the updater understands, for validating a manifest we did not write. */
const KNOWN_TARGETS = new Set([
  'windows-x86_64',
  'windows-aarch64',
  'windows-i686',
  'darwin-x86_64',
  'darwin-aarch64',
  'darwin-universal',
  'linux-x86_64',
  'linux-aarch64',
  'linux-armv7',
  'linux-i686',
])

export class ManifestError extends Error {
  readonly field: string
  constructor(field: string, message: string) {
    super(`${field}: ${message}`)
    this.name = 'ManifestError'
    this.field = field
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Parse and validate a manifest. Throws {@link ManifestError} naming the exact
 * field, because "the release is broken" is not an actionable CI failure.
 */
export function parseReleaseManifest(input: unknown): ReleaseManifest {
  const raw = typeof input === 'string' ? safeJson(input) : input
  if (!isRecord(raw)) throw new ManifestError('$', 'expected a JSON object')

  const version = raw.version
  if (typeof version !== 'string' || !version) throw new ManifestError('version', 'missing')
  if (!isValidVersion(version)) {
    throw new ManifestError('version', `${JSON.stringify(version)} is not a valid semantic version`)
  }

  const platformsRaw = raw.platforms
  if (!isRecord(platformsRaw)) throw new ManifestError('platforms', 'missing or not an object')
  const names = Object.keys(platformsRaw)
  if (names.length === 0) throw new ManifestError('platforms', 'contains no platforms')

  const platforms: Record<string, PlatformAsset> = {}
  for (const name of names) {
    const entry = platformsRaw[name]
    const at = `platforms.${name}`
    if (!KNOWN_TARGETS.has(name)) throw new ManifestError(at, 'is not a target the updater recognises')
    if (!isRecord(entry)) throw new ManifestError(at, 'expected an object')
    const { signature, url } = entry
    if (typeof signature !== 'string' || signature.trim() === '') {
      throw new ManifestError(`${at}.signature`, 'missing — an unsigned artifact can never be installed')
    }
    if (typeof url !== 'string' || url.trim() === '') throw new ManifestError(`${at}.url`, 'missing')
    if (!/^https:\/\//i.test(url)) {
      throw new ManifestError(`${at}.url`, 'must be an https URL')
    }
    platforms[name] = { signature, url }
  }

  return {
    version,
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    // Tauri writes `pub_date`; accept the camelCase spelling too so a
    // hand-written manifest does not silently lose its date.
    pubDate: typeof raw.pub_date === 'string' ? raw.pub_date : typeof raw.pubDate === 'string' ? raw.pubDate : '',
    platforms,
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (err) {
    throw new ManifestError('$', `is not valid JSON (${(err as Error).message})`)
  }
}

/** Build the updater's platform key, e.g. `windows-x86_64`. */
export function updaterTargetKey(os: string, arch: string): string {
  return `${os}-${arch}`
}

/** The asset for a platform key, or `null` when this release skipped it. */
export function selectPlatformAsset(manifest: ReleaseManifest, target: string): PlatformAsset | null {
  return manifest.platforms[target] ?? null
}

export interface ManifestExpectation {
  /** The version the release is supposed to publish. */
  version: string
  /** Platform keys that must all be present. Defaults to {@link REQUIRED_TARGETS}. */
  targets?: readonly string[]
  /**
   * Every asset URL must contain this string — normally the git tag, which
   * catches a manifest accidentally pointing at a previous release's assets.
   */
  urlMustContain?: string
}

/**
 * Check a parsed manifest against what the release was supposed to produce.
 * Returns every problem found rather than the first, so one CI run reports the
 * whole story. An empty array means the release is safe to publish.
 */
export function verifyManifest(manifest: ReleaseManifest, expect: ManifestExpectation): string[] {
  const problems: string[] = []
  if (manifest.version !== expect.version) {
    problems.push(`manifest version is ${manifest.version}, expected ${expect.version}`)
  }
  for (const target of expect.targets ?? REQUIRED_TARGETS) {
    const asset = selectPlatformAsset(manifest, target)
    if (!asset) {
      problems.push(`missing required target ${target}`)
      continue
    }
    if (expect.urlMustContain && !asset.url.includes(expect.urlMustContain)) {
      problems.push(`${target} url does not reference ${expect.urlMustContain}: ${asset.url}`)
    }
  }
  return problems
}

/**
 * Substitute the placeholders Tauri supports in a configured endpoint.
 * Used to prove the committed endpoints resolve to a real URL before a release
 * depends on them.
 */
export function resolveEndpoint(
  template: string,
  vars: { target: string; arch: string; currentVersion: string },
): string {
  const known: Record<string, string> = {
    target: vars.target,
    arch: vars.arch,
    current_version: vars.currentVersion,
  }
  const resolved = template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, name: string) => {
    const value = known[name.toLowerCase()]
    if (value === undefined) throw new ManifestError('endpoint', `unknown placeholder ${whole}`)
    return value
  })
  if (!/^https:\/\//i.test(resolved)) {
    throw new ManifestError('endpoint', `must be an https URL, got ${JSON.stringify(resolved)}`)
  }
  return resolved
}
