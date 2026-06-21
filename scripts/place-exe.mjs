// Copies the freshly-built Tauri release binary to the repository root as
// `Parchment.exe` so the user has one stable, pinnable launcher that always
// starts the desktop app. The raw binary is self-contained (the web assets are
// embedded and it uses the system WebView2 runtime), so a plain copy at the
// root launches the full app — no installer required.
//
// Run automatically by `npm run desktop:build`; can also be run on its own
// after a manual `tauri build --no-bundle`.
import { copyFileSync, existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Tauri names the binary after the Cargo package (`parchment`), not productName.
const src = resolve(root, 'src-tauri', 'target', 'release', 'parchment.exe')
const dest = resolve(root, 'Parchment.exe')

if (!existsSync(src)) {
  console.error(
    `[place-exe] no release binary at ${src}\n` +
      `[place-exe] build it first:  npm run desktop:build`,
  )
  process.exit(1)
}

copyFileSync(src, dest)
const mb = (statSync(dest).size / 1024 / 1024).toFixed(1)
console.log(`[place-exe] Parchment.exe (${mb} MB) refreshed at repo root → ${dest}`)
