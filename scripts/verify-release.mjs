/**
 * Gate a release on the manifest installed copies will actually poll.
 *
 * CI builds the installer, uploads it to a *draft* GitHub Release, downloads the
 * `latest.json` that was generated alongside it, and runs this. Only if it
 * passes does the release get published — so a half-built release, a manifest
 * left pointing at the previous tag, or a missing signature can never become
 * the "latest" that every installed copy fetches.
 *
 * Usage:
 *   node scripts/verify-release.mjs --manifest latest.json --version 0.2.0 --tag v0.2.0
 *   node scripts/verify-release.mjs --manifest latest.json            (version from package.json)
 *   node scripts/verify-release.mjs --manifest latest.json --targets windows-x86_64,darwin-aarch64
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseReleaseManifest, verifyManifest, REQUIRED_TARGETS } from '../src/lib/releaseManifest.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}

const manifestPath = arg('manifest')
if (!manifestPath) {
  console.error('[verify-release] --manifest <path to latest.json> is required')
  process.exit(2)
}

const packageVersion = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version
const expectedVersion = (arg('version', packageVersion) ?? '').replace(/^v/, '')
const tag = arg('tag')
const targets = arg('targets')?.split(',').map((t) => t.trim()).filter(Boolean) ?? [...REQUIRED_TARGETS]

let manifest
try {
  manifest = parseReleaseManifest(readFileSync(resolve(manifestPath), 'utf8'))
} catch (err) {
  console.error(`[verify-release] ${manifestPath} is not a usable release manifest`)
  console.error(`[verify-release]   ${err.message}`)
  process.exit(1)
}

const problems = verifyManifest(manifest, {
  version: expectedVersion,
  targets,
  // Assets live under /releases/download/<tag>/…, so the tag must appear in
  // every URL. This is what catches a manifest built against a stale release.
  urlMustContain: tag ?? undefined,
})

if (problems.length) {
  console.error(`[verify-release] ${manifestPath} is not safe to publish:`)
  for (const problem of problems) console.error(`[verify-release]   - ${problem}`)
  process.exit(1)
}

console.log(`[verify-release] ${manifest.version} looks publishable`)
console.log(`[verify-release]   targets: ${Object.keys(manifest.platforms).join(', ')}`)
console.log(`[verify-release]   every required target present: ${targets.join(', ')}`)
if (tag) console.log(`[verify-release]   every asset URL references ${tag}`)
