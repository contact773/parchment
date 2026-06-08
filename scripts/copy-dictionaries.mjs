// Copies Hunspell .aff/.dic files from the installed dictionary-* packages into
// public/dictionaries so the browser can fetch them lazily at runtime.
// The dictionary packages restrict subpath imports via their `exports` field,
// so importing the data files through the bundler is not reliable — copying the
// raw assets into /public is the robust, bundler-agnostic approach.
import { mkdirSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const LANGS = ['en', 'nl', 'fr', 'de', 'es']
const outDir = resolve(root, 'public', 'dictionaries')
mkdirSync(outDir, { recursive: true })

let copied = 0
for (const lang of LANGS) {
  const pkgDir = resolve(root, 'node_modules', `dictionary-${lang}`)
  for (const ext of ['aff', 'dic']) {
    const src = resolve(pkgDir, `index.${ext}`)
    const dest = resolve(outDir, `${lang}.${ext}`)
    if (existsSync(src)) {
      copyFileSync(src, dest)
      copied++
    } else {
      console.warn(`[copy-dictionaries] missing ${src}`)
    }
  }
}
console.log(`[copy-dictionaries] copied ${copied} dictionary files into public/dictionaries`)
