import type { DocContent } from '@/types'

const WORDS_PER_MINUTE = 238 // average adult silent reading speed
const WORDS_PER_PAGE = 250 // standard manuscript page

/** Recursively extract plain text from a TipTap/ProseMirror JSON document. */
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
    // Block boundaries → newline so word/sentence counts stay sane.
    if (node.type && BLOCK_TYPES.has(node.type)) {
      parts.push('\n')
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

/** Count words in a plain-text string (unicode-aware-ish). */
export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  const matches = trimmed.match(/[\p{L}\p{N}'’-]+/gu)
  return matches ? matches.length : 0
}

export function countCharacters(text: string, includeSpaces = true): number {
  return includeSpaces ? text.length : text.replace(/\s/g, '').length
}

export function countSentences(text: string): number {
  const matches = text.match(/[^.!?…]+[.!?…]+(\s|$)/g)
  // Fallback: at least 1 sentence if there's any text.
  const n = matches ? matches.length : 0
  return n === 0 && text.trim().length > 0 ? 1 : n
}

export function countParagraphs(text: string): number {
  const paras = text.split(/\n{1,}/).filter((p) => p.trim().length > 0)
  return paras.length
}

export function readingMinutes(words: number): number {
  return words / WORDS_PER_MINUTE
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

export function analyzeText(text: string): TextStats {
  const words = countWords(text)
  return {
    words,
    characters: countCharacters(text, true),
    charactersNoSpaces: countCharacters(text, false),
    sentences: countSentences(text),
    paragraphs: countParagraphs(text),
    readingMinutes: readingMinutes(words),
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
