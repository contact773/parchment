/**
 * Detects committed signing material.
 *
 * The naive version of this check greps for a header like
 * `untrusted comment: rsign encrypted secret key`. That fails twice over:
 *
 *  1. Tauri does not store the key in that form. `tauri signer generate -w`
 *     writes the whole rsign key file **base64-encoded as a single blob**, so
 *     the header never appears as literal text and a grep finds nothing. A
 *     check that cannot detect the thing it checks for is worse than none — it
 *     reads as safety.
 *  2. Any file that *discusses* the header — this one, the workflow, the
 *     tests — matches the grep and fails the build on itself.
 *
 * So: decode the base64 blobs and look at what they actually are. Parchment's
 * **public** key is committed on purpose and decodes to a `minisign public key`
 * header, which is why the marker is the word "secret" rather than the shared
 * `untrusted comment:` prefix.
 *
 * `scripts/check-no-secrets.mjs` supplies the files; this module holds the
 * judgement so it can be tested against a synthetic key.
 */

/** Extensions that should never hold anything worth committing. */
const KEY_EXTENSIONS = ['.key', '.pem', '.p12', '.pfx', '.jks', '.keystore']

/**
 * Base64 runs long enough to be a key rather than an id. An rsign key blob is
 * several hundred characters; 80 keeps the decode work trivial.
 */
const BASE64_RUN = /[A-Za-z0-9+/]{80,}={0,2}/g

/** Headers that mark a *private* key once decoded. */
const SECRET_MARKERS = ['secret key', 'private key']

export interface SecretFinding {
  file: string
  reason: string
}

export function looksLikeKeyFilename(path: string): boolean {
  const lower = path.toLowerCase()
  return KEY_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** True when `text` decodes to something with a private-key header. */
export function decodesToPrivateKey(text: string): boolean {
  for (const [blob] of text.matchAll(BASE64_RUN)) {
    let decoded: string
    try {
      decoded = Buffer.from(blob, 'base64').toString('utf8')
    } catch {
      continue
    }
    if (!decoded.startsWith('untrusted comment:')) continue
    const header = decoded.slice(0, decoded.indexOf('\n') === -1 ? decoded.length : decoded.indexOf('\n'))
    if (SECRET_MARKERS.some((marker) => header.toLowerCase().includes(marker))) return true
  }
  return false
}

/**
 * Private-key material sitting in the file as plain text rather than base64 —
 * the shape you get from pasting a PEM or an unwrapped rsign key. Anchored to a
 * whole line so prose quoting a header does not trip it.
 */
const PLAIN_KEY_LINE = /^(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|untrusted comment:.*secret key)\s*$/m

export function containsPrivateKeyMaterial(content: string): boolean {
  return PLAIN_KEY_LINE.test(content) || decodesToPrivateKey(content)
}

export interface ScannedFile {
  path: string
  /** `null` for a file that could not be read as text (binary, too large). */
  content: string | null
}

/**
 * Judge a set of tracked files. Returns every problem found, so one run reports
 * the whole story rather than the first offender.
 */
export function scanForSecrets(files: readonly ScannedFile[]): SecretFinding[] {
  const findings: SecretFinding[] = []
  for (const file of files) {
    if (looksLikeKeyFilename(file.path)) {
      findings.push({ file: file.path, reason: 'a private-key file extension' })
      continue
    }
    if (file.content !== null && containsPrivateKeyMaterial(file.content)) {
      findings.push({ file: file.path, reason: 'private-key material in its contents' })
    }
  }
  return findings
}
