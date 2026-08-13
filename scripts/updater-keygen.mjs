/**
 * Generate (or re-print) the Parchment updater signing key pair.
 *
 * Tauri's updater refuses any download whose detached signature does not verify
 * against the public key compiled into the application. That makes the private
 * key the single most sensitive artifact in this repository's release process:
 *
 *   - It is written OUTSIDE the repository (default: ~/.parchment/updater/).
 *     This script refuses to write anywhere under the working tree.
 *   - Its contents are never printed here. Only the public key is, because the
 *     public key is what gets committed into src-tauri/tauri.conf.json.
 *   - CI receives it as the TAURI_SIGNING_PRIVATE_KEY repository secret.
 *
 * Rotating the key invalidates updates for every already-installed copy: those
 * copies verify against the old public key and will reject the new artifacts,
 * so their users must reinstall by hand. Rotate only before the first public
 * release, or as a deliberate, announced break.
 *
 * Usage:
 *   node scripts/updater-keygen.mjs                 Create the key pair if absent
 *   node scripts/updater-keygen.mjs --print         Print the public key of an existing pair
 *   node scripts/updater-keygen.mjs --path <file>   Use a different location
 *   node scripts/updater-keygen.mjs --force         Overwrite an existing key (see warning above)
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, relative, resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const argv = process.argv.slice(2)
const flag = (name) => argv.includes(name)
const value = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}

const keyPath = resolve(value('--path') ?? resolve(homedir(), '.parchment', 'updater', 'parchment-updater.key'))
const pubPath = `${keyPath}.pub`

const insideRepo = () => {
  const rel = relative(root, keyPath)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

if (insideRepo()) {
  console.error(
    `[keygen] refusing to write a private signing key inside the repository:\n` +
      `[keygen]   ${keyPath}\n` +
      `[keygen] choose a path outside ${root} (default: ~/.parchment/updater/).`,
  )
  process.exit(1)
}

function printPublicKey() {
  if (!existsSync(pubPath)) {
    console.error(`[keygen] no public key at ${pubPath} — run without --print to create the pair.`)
    process.exit(1)
  }
  const pub = readFileSync(pubPath, 'utf8').trim()
  console.log(`\n[keygen] private key (keep secret, never commit):\n  ${keyPath}`)
  console.log(`\n[keygen] public key — paste into src-tauri/tauri.conf.json at plugins.updater.pubkey:\n`)
  console.log(pub)
  console.log(`
[keygen] Then configure the GitHub repository secrets (Settings -> Secrets and
[keygen] variables -> Actions -> New repository secret):

    TAURI_SIGNING_PRIVATE_KEY           the FULL contents of
                                        ${keyPath}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD  ONLY if you gave the key a password.
                                        GitHub will not store an empty secret,
                                        and an absent one already interpolates
                                        to the empty string the signer expects.

[keygen] Store a copy of the private key in a password manager. Losing it means
[keygen] no already-installed copy can ever be updated again.
`)
}

if (flag('--print')) {
  printPublicKey()
  process.exit(0)
}

if (existsSync(keyPath) && !flag('--force')) {
  console.log(`[keygen] key pair already exists at ${keyPath} — printing the public key.`)
  console.log('[keygen] pass --force to replace it (this breaks updates for installed copies).')
  printPublicKey()
  process.exit(0)
}

mkdirSync(dirname(keyPath), { recursive: true })

// `tauri signer generate` prompts for a password on a TTY; --ci keeps it
// non-interactive and, with no -p, produces an unencrypted key — which is what
// the workflow expects unless you also set TAURI_SIGNING_PRIVATE_KEY_PASSWORD.
const password = value('--password')
const args = ['tauri', 'signer', 'generate', '--ci', '-w', keyPath]
if (password) args.push('-p', password)
if (flag('--force')) args.push('-f')

// Call the local CLI through node rather than `npx` so no shell is involved.
const cli = resolve(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js')
const res = spawnSync(process.execPath, [cli, ...args.slice(1)], { stdio: ['ignore', 'pipe', 'inherit'] })
if (res.status !== 0) {
  console.error('[keygen] tauri signer generate failed')
  process.exit(res.status ?? 1)
}
// The CLI echoes the private key to stdout; swallow it and read the files instead.
console.log(`[keygen] created ${keyPath}`)
printPublicKey()
