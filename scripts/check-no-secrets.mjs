/**
 * Fail the build if signing material is committed.
 *
 * Run by CI and available locally as `npm run check:secrets`. The judgement
 * lives in src/lib/secretScan.ts (and is tested there); this file only gathers
 * the tracked files and reports.
 *
 * Note that the committed updater **public** key is expected and must not be
 * flagged — see the comments in secretScan.ts for how the two are told apart.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanForSecrets } from '../src/lib/secretScan.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Anything larger is a font or an image, not a pasted key. */
const MAX_BYTES = 2 * 1024 * 1024

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\0')
  .filter(Boolean)

const files = tracked.map((path) => {
  const full = resolve(root, path)
  try {
    if (statSync(full).size > MAX_BYTES) return { path, content: null }
    const buffer = readFileSync(full)
    // A NUL byte means binary; keys are text.
    if (buffer.includes(0)) return { path, content: null }
    return { path, content: buffer.toString('utf8') }
  } catch {
    // Deleted from the working tree but still in the index; nothing to read.
    return { path, content: null }
  }
})

const findings = scanForSecrets(files)

if (findings.length) {
  console.error('[check-no-secrets] signing material is committed:')
  for (const finding of findings) {
    console.error(`[check-no-secrets]   ${finding.file} — ${finding.reason}`)
  }
  console.error('[check-no-secrets] remove it, rewrite the history that contains it, and rotate the key.')
  console.error('[check-no-secrets] rotating breaks updates for installed copies — see docs/RELEASE.md.')
  process.exit(1)
}

console.log(`[check-no-secrets] ${files.length} tracked files, no private-key material`)
