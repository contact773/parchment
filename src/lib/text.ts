import type { DocContent, LanguageCode } from '@/types'

const WORDS_PER_PAGE = 250 // standard manuscript page (layout constant)

// Per-language reading speed (words/min, average adult silent reading).
const WPM: Record<LanguageCode, number> = { en: 238, nl: 228, fr: 236, de: 224, es: 234 }

// Words that end in a period WITHOUT terminating a sentence (lowercased, no
// trailing dot; multi-dot forms keep internal dots, e.g. "e.g", "p.m").
const ABBREV: Record<LanguageCode, Set<string>> = {
  en: new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'vs', 'etc', 'e.g', 'i.e', 'a.m', 'p.m', 'inc', 'ltd', 'jr', 'sr', 'no', 'vol', 'fig', 'al', 'ave', 'rd', 'capt', 'gen', 'sgt', 'rev', 'hon']),
  nl: new Set(['dhr', 'mevr', 'mw', 'dr', 'prof', 'bijv', 'bv', 'enz', 'nl', 't.o.v', 'a.u.b', 'z.o.z', 'd.w.z', 'm.a.w', 'blz', 'nr']),
  fr: new Set(['m', 'mme', 'mlle', 'dr', 'pr', 'etc', 'cf', 'p.ex', 'c.-à-d', 'av', 'apr', 'éd', 'vol', 'no', 'art']),
  de: new Set(['dr', 'prof', 'hr', 'fr', 'bzw', 'z.b', 'u.a', 'd.h', 'usw', 'ggf', 'nr', 'abs', 'vgl', 'evtl', 'ca', 'bspw', 'inkl']),
  es: new Set(['sr', 'sra', 'srta', 'dr', 'dra', 'ud', 'uds', 'etc', 'p.ej', 'a.c', 'd.c', 'núm', 'pág', 'vol', 'art', 'av']),
}

const lex = <T,>(rec: Record<LanguageCode, T>, lang?: LanguageCode): T => (lang && rec[lang]) || rec.en

/** Recursively extract plain text from a TipTap/ProseMirror JSON document.
 *  Block-level nodes are separated by a blank line so paragraph and sentence
 *  counts stay sane. */
export function docToText(doc: DocContent | null | undefined): string {
  if (!doc) return ''
  const parts: string[] = []
  const walk = (node: DocContent) => {
    if (node.type === 'text' && typeof node.text === 'string') {
      parts.push(node.text)
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(walk)
    }
    if (node.type && BLOCK_TYPES.has(node.type)) {
      parts.push('\n\n')
    }
  }
  walk(doc)
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim()
}

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'listItem',
  'codeBlock',
  'horizontalRule',
])

// Titles that bind to a following capitalized name (Dr. Smith) — they suppress a
// sentence break before a capital; other abbreviations only do so before lowercase.
const TITLES = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'st', 'capt', 'col', 'gen', 'sgt', 'lt', 'rev', 'hon', 'sr', 'jr', 'm', 'mme', 'mlle', 'pr', 'hr', 'fr', 'sra', 'srta', 'dra', 'dhr', 'mevr', 'mw'])
// Introducer abbreviations that never terminate a sentence (e.g. ___, z.B. ___).
const INTRODUCERS = new Set(['e.g', 'i.e', 'z.b', 'p.ej', 'p.ex', 'bv', 'bijv', 'd.h', 'c.-à-d', 'cf', 'vs', 'd.w.z', 'viz'])

// A token must START with a letter or digit (so a lone "-" or "'" between spaces
// is never counted), and a number may keep internal . , : groups so "4.5",
// "1,000" and "3:30" each stay one word. well-known / don't / l'homme stay one.
const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’\-_]*(?:[.,:]\p{N}+)*/gu

/** Count words in a plain-text string (unicode-aware). */
export function countWords(text: string): number {
  if (!text.trim()) return 0
  const m = text.match(WORD_RE)
  return m ? m.length : 0
}

export function countCharacters(text: string, includeSpaces = true): number {
  return includeSpaces ? text.length : text.replace(/\s/g, '').length
}

/** Split into sentences, treating abbreviations, decimals, ellipses and
 *  acronyms as non-terminal. Consumers share this one segmentation. */
export function splitSentences(text: string, lang: LanguageCode = 'en'): string[] {
  const set = lex(ABBREV, lang)
  const out: string[] = []
  // Terminal punctuation, optionally wrapped by closing quotes/brackets, then
  // whitespace or end. (Glued cases like "4.5" never match — no following space.)
  const re = /[.!?…]+["'”’»)\]]*(?=\s|$)/gu
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const after = re.lastIndex
    // Bounded windows (only short tokens/the next non-space char are inspected),
    // so segmentation stays O(n) instead of re-scanning the prefix per terminator.
    const nextCh = text.slice(after, after + 40).match(/\S/u)?.[0] ?? ''
    const prevRaw = (text.slice(Math.max(0, m.index - 40), m.index).match(/([\p{L}.&'’-]+)$/u)?.[1] ?? '').replace(/\.+$/, '')
    const prevWord = prevRaw.toLowerCase()
    // A terminator immediately followed by a lowercase letter is mid-sentence
    // ("Run!" he said / etc. and / the U.S.A. last spring).
    if (/\p{Ll}/u.test(nextCh)) continue
    // Acronym components: U.S.A. (a letter right after a dot) or short all-caps (EE.).
    if ((/\p{L}/u.test(text[m.index - 1] ?? '') && text[m.index - 2] === '.') || /^\p{Lu}{2,3}$/u.test(prevRaw)) continue
    // Introducers (e.g. / i.e. / z.B.) never end a sentence.
    if (INTRODUCERS.has(prevWord)) continue
    // Titles bind to a following capitalized name (Dr. Smith).
    if (set.has(prevWord) && TITLES.has(prevWord)) continue
    out.push(text.slice(last, after).trim())
    last = after
  }
  if (last < text.length && text.slice(last).trim()) out.push(text.slice(last).trim())
  return out.filter(Boolean)
}

export function countSentences(text: string, lang: LanguageCode = 'en'): number {
  const n = splitSentences(text, lang).length
  return n === 0 && text.trim().length > 0 ? 1 : n
}

/** Paragraphs are separated by blank lines (a single newline is a soft break). */
export function countParagraphs(text: string): number {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).length
}

export function readingMinutes(words: number, lang: LanguageCode = 'en'): number {
  return words / lex(WPM, lang)
}

export function pageEstimate(words: number): number {
  return words / WORDS_PER_PAGE
}

export interface TextStats {
  words: number
  characters: number
  charactersNoSpaces: number
  sentences: number
  paragraphs: number
  readingMinutes: number
  pages: number
}

export function analyzeText(text: string, lang: LanguageCode = 'en'): TextStats {
  const words = countWords(text)
  return {
    words,
    characters: countCharacters(text, true),
    charactersNoSpaces: countCharacters(text, false),
    sentences: countSentences(text, lang),
    paragraphs: countParagraphs(text),
    readingMinutes: readingMinutes(words, lang),
    pages: pageEstimate(words),
  }
}

/** Format a reading-time number into a friendly label. */
export function formatReadingTime(minutes: number): string {
  if (minutes < 1) return '< 1 min'
  if (minutes < 60) return `${Math.round(minutes)} min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m ? `${h}h ${m}m` : `${h}h`
}
