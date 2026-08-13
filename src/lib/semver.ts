/**
 * Minimal SemVer 2.0.0 parsing and ordering.
 *
 * Two places must agree exactly on what "newer" means, so they share this file:
 *
 *  - `scripts/version.mjs`, the release version authority that keeps
 *    `package.json`, `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml` in
 *    step and refuses a version that is not strictly newer than the last one.
 *  - `src/features/updates/updateService.ts`, which must never install an
 *    equal or older build over the running one.
 *
 * Node imports this `.ts` file directly (native type stripping, Node >= 22.18),
 * which is why it stays dependency-free and free of enums/namespaces/decorators.
 *
 * Build metadata (`1.2.3+abc`) is parsed but ignored for ordering, per SemVer §10.
 */

export interface SemVer {
  major: number
  minor: number
  patch: number
  /** Dot-separated pre-release identifiers; empty for a stable release. */
  prerelease: (string | number)[]
  /** Build metadata without the `+`; ignored when ordering. */
  build: string
  raw: string
}

/** Strict SemVer 2.0.0: no leading zeroes, no `v` prefix, no partial versions. */
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

const NUMERIC_RE = /^(0|[1-9]\d*)$/

/** Parse a version string, tolerating a leading `v`. Returns `null` if invalid. */
export function parseVersion(input: string): SemVer | null {
  if (typeof input !== 'string') return null
  const raw = input.trim()
  const m = SEMVER_RE.exec(raw.startsWith('v') ? raw.slice(1) : raw)
  if (!m) return null
  const [, major, minor, patch, pre, build] = m
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: pre ? pre.split('.').map((id) => (NUMERIC_RE.test(id) ? Number(id) : id)) : [],
    build: build ?? '',
    raw,
  }
}

export function isValidVersion(input: string): boolean {
  return parseVersion(input) !== null
}

/** True for `0.2.0-beta.1`-style versions; false for `0.2.0`. */
export function isPrerelease(input: string): boolean {
  return (parseVersion(input)?.prerelease.length ?? 0) > 0
}

/**
 * Compare pre-release identifier lists (SemVer §11.4).
 * An empty list (stable) sorts *above* any non-empty list.
 */
function comparePrerelease(a: (string | number)[], b: (string | number)[]): number {
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    // A larger set of identifiers wins when all preceding ones are equal.
    if (i >= a.length) return -1
    if (i >= b.length) return 1
    const x = a[i]
    const y = b[i]
    if (x === y) continue
    const xNum = typeof x === 'number'
    const yNum = typeof y === 'number'
    // Numeric identifiers always have lower precedence than alphanumeric ones.
    if (xNum && !yNum) return -1
    if (!xNum && yNum) return 1
    if (xNum && yNum) return (x as number) < (y as number) ? -1 : 1
    return (x as string) < (y as string) ? -1 : 1
  }
  return 0
}

/**
 * Order two versions: `-1` if `a < b`, `0` if equal, `1` if `a > b`.
 * Throws on an unparseable input — callers that handle untrusted values
 * (release manifests) should use {@link isNewerVersion}, which never throws.
 */
export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a)
  const vb = parseVersion(b)
  if (!va) throw new TypeError(`Not a valid semantic version: ${JSON.stringify(a)}`)
  if (!vb) throw new TypeError(`Not a valid semantic version: ${JSON.stringify(b)}`)
  if (va.major !== vb.major) return va.major < vb.major ? -1 : 1
  if (va.minor !== vb.minor) return va.minor < vb.minor ? -1 : 1
  if (va.patch !== vb.patch) return va.patch < vb.patch ? -1 : 1
  return comparePrerelease(va.prerelease, vb.prerelease)
}

/**
 * True only when `candidate` is strictly newer than `current`.
 *
 * This is the updater's safety gate, so it fails closed: an unparseable or
 * missing version is *not* newer. Never loosen this without also deciding what
 * an explicit rollback mode looks like.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  try {
    return compareVersions(candidate, current) > 0
  } catch {
    return false
  }
}

/** Highest of a list of versions; invalid entries are ignored. `null` if none parse. */
export function maxVersion(versions: readonly string[]): string | null {
  let best: string | null = null
  for (const v of versions) {
    if (!isValidVersion(v)) continue
    if (best === null || compareVersions(v, best) > 0) best = v
  }
  return best
}
