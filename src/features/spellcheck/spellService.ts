import nspell from 'nspell'
import type { LanguageCode, UserDictionary } from '@/types'

export interface Speller {
  correct: (word: string) => boolean
  suggest: (word: string) => string[]
  add: (word: string) => void
}

type Listener = (lang: LanguageCode) => void

/**
 * Local-first spelling engine. Loads Hunspell .aff/.dic dictionaries (served as
 * static assets from /public/dictionaries) and wraps nspell. Designed behind a
 * minimal surface so a richer engine (e.g. server-side LanguageTool) can replace
 * it later without touching the editor.
 */
class SpellService {
  private cache = new Map<LanguageCode, Promise<Speller>>()
  private ready = new Set<LanguageCode>()
  private listeners = new Set<Listener>()
  /** User words & ignores kept in-memory for instant effect. */
  private added: Record<LanguageCode, Set<string>> = blank()
  private ignored: Record<LanguageCode, Set<string>> = blank()

  onReady(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  isReady(lang: LanguageCode): boolean {
    return this.ready.has(lang)
  }

  /** Mirror the persisted user dictionary into memory and live spellers. */
  syncUserWords(dict: UserDictionary): void {
    ;(Object.keys(dict.added) as LanguageCode[]).forEach((lang) => {
      this.added[lang] = new Set(dict.added[lang].map((w) => w.toLowerCase()))
      this.ignored[lang] = new Set(dict.ignored[lang].map((w) => w.toLowerCase()))
      // Push into an already-loaded speller so nspell-based suggestions improve.
      const p = this.cache.get(lang)
      if (p) p.then((sp) => dict.added[lang].forEach((w) => sp.add(w))).catch(() => {})
    })
  }

  load(lang: LanguageCode): Promise<Speller> {
    let p = this.cache.get(lang)
    if (!p) {
      p = this._load(lang)
      this.cache.set(lang, p)
    }
    return p
  }

  private async _load(lang: LanguageCode): Promise<Speller> {
    const base = import.meta.env.BASE_URL || '/'
    const [aff, dic] = await Promise.all([
      fetch(`${base}dictionaries/${lang}.aff`).then((r) => r.text()),
      fetch(`${base}dictionaries/${lang}.dic`).then((r) => r.text()),
    ])
    const speller = nspell(aff, dic) as unknown as Speller
    this.added[lang].forEach((w) => speller.add(w))
    this.ready.add(lang)
    // Populate the synchronous mirror BEFORE notifying listeners, so the
    // re-scan triggered by onReady can resolve words immediately.
    resolvedCache.set(lang, speller)
    this.listeners.forEach((fn) => fn(lang))
    return speller
  }

  /** Synchronous check. Words from not-yet-loaded languages are treated as OK. */
  correct(lang: LanguageCode, word: string): boolean {
    const lower = word.toLowerCase()
    if (this.added[lang]?.has(lower) || this.ignored[lang]?.has(lower)) return true
    if (!this.ready.has(lang)) {
      void this.load(lang)
      return true
    }
    // Speller is loaded synchronously-resolvable here.
    let ok = true
    const p = this.cache.get(lang)
    // We rely on a synchronously-available resolved speller via a side cache.
    const sp = resolvedCache.get(lang)
    if (sp) ok = sp.correct(word)
    else if (p) p.then((s) => resolvedCache.set(lang, s)).catch(() => {})
    return ok
  }

  async suggest(lang: LanguageCode, word: string): Promise<string[]> {
    const sp = await this.load(lang)
    return sp.suggest(word).slice(0, 7)
  }

  addWord(lang: LanguageCode, word: string): void {
    this.added[lang].add(word.toLowerCase())
    const p = this.cache.get(lang)
    if (p) p.then((sp) => sp.add(word)).catch(() => {})
  }

  ignore(lang: LanguageCode, word: string): void {
    this.ignored[lang].add(word.toLowerCase())
  }
}

// A synchronous mirror of resolved spellers so `correct()` can run inside the
// ProseMirror decoration pass without awaiting.
const resolvedCache = new Map<LanguageCode, Speller>()

function blank(): Record<LanguageCode, Set<string>> {
  return { en: new Set(), nl: new Set(), fr: new Set(), de: new Set(), es: new Set() }
}

export const spellService = new SpellService()
