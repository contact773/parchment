/**
 * Compose the `latest.json` that installed copies poll.
 *
 * `tauri-action` normally generates this as a side effect of creating a GitHub
 * Release. That couples the manifest to one distribution host and to CI having
 * permission to publish. This script decouples it, which matters twice:
 *
 *  - it lets a release be published by hand when CI cannot;
 *  - it is the piece needed to publish somewhere other than GitHub Releases
 *    (object storage, own domain) while keeping the source repository private.
 *
 * Usage:
 *   node scripts/build-manifest.mjs --tag v0.2.0
 *   node scripts/build-manifest.mjs --tag v0.2.0 --out dist-release/latest.json
 *   node scripts/build-manifest.mjs --tag v0.2.0 --base-url https://releases.example.com/v0.2.0
 *
 * The result is validated with the same checks CI applies before publishing,
 * so a manifest this script emits is a manifest verify-release.mjs accepts.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseReleaseManifest, verifyManifest } from '../src/lib/releaseManifest.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}

const fail = (message) => {
  console.error(`[build-manifest] ${message}`)
  process.exit(1)
}

const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version
const tag = arg('tag', `v${version}`)
const bundleDir = resolve(root, arg('bundle', 'src-tauri/target/release/bundle'))
const outPath = resolve(root, arg('out', 'latest.json'))
const baseUrl = arg('base-url', `https://github.com/contact773/parchment/releases/download/${tag}`)

/**
 * Where each platform's updater artifact lives inside the bundle directory, and
 * the manifest key it belongs under. Windows only for now — macOS and Linux
 * join here when they join the release matrix.
 */
const TARGETS = [
  { key: 'windows-x86_64', dir: 'nsis', match: /-setup\.exe$/ },
]

const platforms = {}
const uploads = []

for (const target of TARGETS) {
  const dir = resolve(bundleDir, target.dir)
  if (!existsSync(dir)) {
    fail(`no ${target.dir} bundle at ${dir} — run: npm run tauri:build`)
  }
  // Match on the version too, not just the shape. A bundle directory keeps
  // every build ever made in it, so picking "the first setup.exe" happily
  // pairs a 0.2.0 manifest with a 0.1.0 installer and its 0.1.0 signature.
  const candidates = readdirSync(dir).filter((name) => target.match.test(name) && name.includes(version))
  if (candidates.length === 0) {
    const others = readdirSync(dir).filter((name) => target.match.test(name))
    fail(
      `no ${version} artifact in ${dir}` +
        (others.length ? `\n[build-manifest] found other versions: ${others.join(', ')} — rebuild with npm run tauri:build` : ''),
    )
  }
  if (candidates.length > 1) fail(`ambiguous ${version} artifacts in ${dir}: ${candidates.join(', ')}`)
  const [artifact] = candidates

  const sigPath = resolve(dir, `${artifact}.sig`)
  if (!existsSync(sigPath)) {
    fail(
      `${artifact} has no .sig beside it.\n` +
        `[build-manifest] the build was not signed — set TAURI_SIGNING_PRIVATE_KEY and rebuild.`,
    )
  }

  platforms[target.key] = {
    signature: readFileSync(sigPath, 'utf8').trim(),
    url: `${baseUrl}/${artifact}`,
  }
  uploads.push(resolve(dir, artifact), sigPath)
}

/** Pull this version's section out of the changelog so the update UI can show it. */
function notesFor(v) {
  const changelog = resolve(root, 'CHANGELOG.md')
  if (!existsSync(changelog)) return ''
  const text = readFileSync(changelog, 'utf8')
  const start = text.search(new RegExp(`^## ${v.replace(/\./g, '\\.')}\\b`, 'm'))
  if (start === -1) return ''
  const rest = text.slice(start)
  const nextHeading = rest.slice(1).search(/^## /m)
  return (nextHeading === -1 ? rest : rest.slice(0, nextHeading + 1)).trim()
}

const manifest = {
  version,
  notes: arg('notes', notesFor(version)),
  pub_date: new Date().toISOString(),
  platforms,
}

// Hold the output to the same standard CI holds a release to.
const problems = verifyManifest(parseReleaseManifest(manifest), {
  version,
  targets: Object.keys(platforms),
  // Tag and version both: the tag proves the right release directory, the
  // version proves the artifact is not a leftover from an earlier build.
  urlMustContain: [tag, version],
})
if (problems.length) {
  console.error('[build-manifest] refusing to write an invalid manifest:')
  for (const problem of problems) console.error(`[build-manifest]   - ${problem}`)
  process.exit(1)
}

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`[build-manifest] wrote ${outPath} for ${version} (${tag})`)
console.log('[build-manifest] upload these to the release, with exactly these filenames:')
for (const file of uploads) console.log(`[build-manifest]   ${file}`)
console.log(`[build-manifest]   ${outPath}`)
