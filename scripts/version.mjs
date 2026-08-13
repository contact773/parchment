/**
 * Parchment version authority.
 *
 * `package.json` owns the application version. Everything a release needs to
 * agree on is derived from it:
 *
 *   package.json            .version                 (source of truth)
 *   package-lock.json       .version + .packages[""]
 *   src-tauri/tauri.conf.json  .version              (installer + updater manifest)
 *   src-tauri/Cargo.toml    [package] version        (crate + binary metadata)
 *   src-tauri/Cargo.lock    parchment package entry  (keeps the tree clean)
 *
 * Usage:
 *   node scripts/version.mjs print          Print the current version
 *   node scripts/version.mjs check          Fail if the files disagree (CI gate)
 *   node scripts/version.mjs sync           Copy package.json's version outward
 *   node scripts/version.mjs set <version>  Bump everywhere; refuses a version
 *                                           that is not strictly newer
 *   node scripts/version.mjs set <version> --allow-rollback
 *   node scripts/version.mjs preview <n>    CI: derive a preview version from
 *                                           the current one and build number <n>
 *
 * `set` deliberately does not create a git tag or commit — the release runbook
 * (docs/RELEASE.md) keeps those as explicit, reviewable steps.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
// Node strips the types at load time (>= 22.18), so the updater and the release
// tooling share one definition of "newer".
import { compareVersions, isValidVersion, parseVersion } from '../src/lib/semver.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const PKG = resolve(root, 'package.json')
const LOCK = resolve(root, 'package-lock.json')
const TAURI_CONF = resolve(root, 'src-tauri', 'tauri.conf.json')
const CARGO_TOML = resolve(root, 'src-tauri', 'Cargo.toml')
const CARGO_LOCK = resolve(root, 'src-tauri', 'Cargo.lock')

const read = (p) => readFileSync(p, 'utf8')
/** Preserve the repo's newline-terminated, 2-space JSON formatting. */
const writeJson = (p, value) => writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`)

/** `version = "1.2.3"` inside Cargo.toml's `[package]` table only. */
const CARGO_TOML_RE = /(\[package\][^[]*?\bversion\s*=\s*")([^"]+)(")/
/** The `parchment` entry in Cargo.lock, matched as a whole block. */
const CARGO_LOCK_RE = /(\[\[package\]\]\s*\nname = "parchment"\s*\nversion = ")([^"]+)(")/

/** Every place the version lives, with a reader and a writer. */
const sites = [
  {
    label: 'package.json',
    path: PKG,
    read: () => JSON.parse(read(PKG)).version,
    write: (v) => {
      const json = JSON.parse(read(PKG))
      json.version = v
      writeJson(PKG, json)
    },
  },
  {
    label: 'package-lock.json',
    path: LOCK,
    optional: true,
    read: () => JSON.parse(read(LOCK)).version,
    write: (v) => {
      const json = JSON.parse(read(LOCK))
      json.version = v
      if (json.packages?.['']) json.packages[''].version = v
      writeJson(LOCK, json)
    },
  },
  {
    label: 'src-tauri/tauri.conf.json',
    path: TAURI_CONF,
    read: () => JSON.parse(read(TAURI_CONF)).version,
    write: (v) => {
      const json = JSON.parse(read(TAURI_CONF))
      json.version = v
      writeJson(TAURI_CONF, json)
    },
  },
  {
    label: 'src-tauri/Cargo.toml',
    path: CARGO_TOML,
    read: () => CARGO_TOML_RE.exec(read(CARGO_TOML))?.[2],
    write: (v) => writeFileSync(CARGO_TOML, read(CARGO_TOML).replace(CARGO_TOML_RE, `$1${v}$3`)),
  },
  {
    label: 'src-tauri/Cargo.lock',
    path: CARGO_LOCK,
    optional: true,
    read: () => CARGO_LOCK_RE.exec(read(CARGO_LOCK))?.[2],
    write: (v) => writeFileSync(CARGO_LOCK, read(CARGO_LOCK).replace(CARGO_LOCK_RE, `$1${v}$3`)),
  },
]

const present = () => sites.filter((s) => existsSync(s.path) || !s.optional)

const currentVersion = () => {
  const v = sites[0].read()
  if (!isValidVersion(v)) fail(`package.json version ${JSON.stringify(v)} is not a valid semantic version`)
  return v
}

function fail(message) {
  console.error(`[version] ${message}`)
  process.exit(1)
}

function check() {
  const expected = currentVersion()
  const wrong = []
  for (const site of present()) {
    const actual = site.read()
    if (actual === undefined) fail(`could not read a version from ${site.label}`)
    if (actual !== expected) wrong.push(`  ${site.label}: ${actual}`)
  }
  if (wrong.length) {
    console.error(`[version] out of sync — package.json says ${expected} but:`)
    console.error(wrong.join('\n'))
    console.error('[version] run:  npm run version:sync')
    process.exit(1)
  }
  console.log(`[version] ${expected} — package.json, tauri.conf.json and Cargo.toml agree`)
}

function sync() {
  const expected = currentVersion()
  const changed = []
  for (const site of present().slice(1)) {
    if (site.read() === expected) continue
    site.write(expected)
    changed.push(site.label)
  }
  console.log(
    changed.length
      ? `[version] synced ${expected} into ${changed.join(', ')}`
      : `[version] ${expected} — already in sync`,
  )
}

function set(next, { allowRollback }) {
  if (!isValidVersion(next)) {
    fail(`${JSON.stringify(next)} is not a valid semantic version (expected e.g. 0.2.0 or 0.2.0-preview.1)`)
  }
  const normalized = next.replace(/^v/, '')
  const current = currentVersion()
  const order = compareVersions(normalized, current)
  if (order === 0) fail(`already at ${current} — nothing to do`)
  if (order < 0 && !allowRollback) {
    fail(
      `refusing to go backwards: ${normalized} is older than ${current}.\n` +
        `[version] every published update must be strictly newer than the installed build.\n` +
        `[version] pass --allow-rollback only for a local experiment that will never be released.`,
    )
  }
  for (const site of present()) site.write(normalized)
  console.log(`[version] ${current} -> ${normalized} in ${present().map((s) => s.label).join(', ')}`)
  console.log('[version] next:  git commit -am "Release <version>" && git tag v' + normalized)
}

/**
 * Derive the preview version for CI build `n`.
 *
 * A preview must sit strictly above the released version it is built from and
 * strictly below the release it anticipates, so it takes the next patch with a
 * `-preview.n` tail: released 0.2.0 -> previews 0.2.1-preview.1, .2, … -> the
 * eventual stable 0.2.1 supersedes all of them. That means a maintainer never
 * has to remember to bump main after a release for previews to keep working.
 */
function previewVersionFor(current, buildNumber) {
  const parsed = parseVersion(current)
  if (!parsed) fail(`cannot derive a preview version from ${JSON.stringify(current)}`)
  const n = Number(buildNumber)
  if (!Number.isInteger(n) || n < 1) fail(`build number must be a positive integer, got ${JSON.stringify(buildNumber)}`)
  // Already a preview (a re-run on an unreleased main): keep the same base.
  const patch = parsed.prerelease.length > 0 ? parsed.patch : parsed.patch + 1
  return `${parsed.major}.${parsed.minor}.${patch}-preview.${n}`
}

const [command = 'check', ...rest] = process.argv.slice(2)
const flags = new Set(rest.filter((a) => a.startsWith('--')))
const args = rest.filter((a) => !a.startsWith('--'))

switch (command) {
  case 'print':
    console.log(currentVersion())
    break
  case 'check':
    check()
    break
  case 'sync':
    sync()
    break
  case 'set':
    if (!args[0]) fail('usage: node scripts/version.mjs set <version>')
    set(args[0], { allowRollback: flags.has('--allow-rollback') })
    break
  case 'preview': {
    if (!args[0]) fail('usage: node scripts/version.mjs preview <build number>')
    const next = previewVersionFor(currentVersion(), args[0])
    if (flags.has('--print')) console.log(next)
    else set(next, { allowRollback: false })
    break
  }
  default:
    fail(`unknown command ${JSON.stringify(command)} — expected print, check, sync, set or preview`)
}
