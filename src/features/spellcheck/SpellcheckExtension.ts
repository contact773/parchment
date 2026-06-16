import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import type { LanguageCode } from '@/types'
import { spellService } from './spellService'

export interface Misspelling {
  from: number
  to: number
  word: string
}

interface SpellState {
  decorations: DecorationSet
  misspellings: Misspelling[]
}

export const spellcheckKey = new PluginKey<SpellState>('parchment-spellcheck')

const WORD_RE = /\p{L}[\p{L}\p{M}'’-]*/gu

export interface SpellcheckOptions {
  enabled: boolean
  language: LanguageCode
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    spellcheck: {
      /** Update spellcheck language/enabled in place (no editor rebuild) and re-scan. */
      configureSpellcheck: (opts: Partial<SpellcheckOptions>) => ReturnType
    }
  }
}

function scan(doc: PMNode, enabled: boolean, language: LanguageCode): SpellState {
  if (!enabled) return { decorations: DecorationSet.empty, misspellings: [] }
  const decorations: Decoration[] = []
  const misspellings: Misspelling[] = []

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    // Skip code spans.
    if (node.marks.some((m) => m.type.name === 'code')) return
    const text = node.text
    let m: RegExpExecArray | null
    WORD_RE.lastIndex = 0
    while ((m = WORD_RE.exec(text)) !== null) {
      let word = m[0]
      // Trim trailing punctuation-like chars.
      word = word.replace(/['’-]+$/g, '')
      if (word.length < 2) continue
      if (/\d/.test(word)) continue
      if (word === word.toUpperCase() && word.length <= 5) continue // acronyms / SCENE CUES
      const start = pos + m.index
      const end = start + word.length
      if (!spellService.correct(language, word)) {
        decorations.push(Decoration.inline(start, end, { class: 'spell-error' }))
        misspellings.push({ from: start, to: end, word })
      }
    }
  })

  return { decorations: DecorationSet.create(doc, decorations), misspellings }
}

export function misspellingAt(state: SpellState | undefined, pos: number): Misspelling | null {
  if (!state) return null
  return state.misspellings.find((m) => pos >= m.from && pos <= m.to) ?? null
}

export const Spellcheck = Extension.create<SpellcheckOptions>({
  name: 'spellcheck',

  addOptions() {
    return { enabled: true, language: 'en' }
  },

  addProseMirrorPlugins() {
    const extension = this
    let rescanTimer: ReturnType<typeof setTimeout> | null = null
    return [
      new Plugin<SpellState>({
        key: spellcheckKey,
        state: {
          init: (_, state) => scan(state.doc, extension.options.enabled, extension.options.language),
          apply(tr, value, _old, newState) {
            const forced = tr.getMeta(spellcheckKey)
            if (forced) return scan(newState.doc, extension.options.enabled, extension.options.language)
            if (tr.docChanged && extension.options.enabled) {
              // Keep existing markers roughly in place by mapping them through the
              // change; a debounced full re-scan (see view()) corrects them once
              // typing pauses. This avoids a full O(doc) scan on every keystroke,
              // which janks large chapters.
              return {
                decorations: value.decorations.map(tr.mapping, tr.doc),
                misspellings: value.misspellings
                  .map((mm) => ({ word: mm.word, from: tr.mapping.map(mm.from), to: tr.mapping.map(mm.to) }))
                  .filter((mm) => mm.to > mm.from),
              }
            }
            return value
          },
        },
        view() {
          return {
            update(view, prev) {
              if (view.state.doc === prev.doc || !extension.options.enabled) return
              if (rescanTimer) clearTimeout(rescanTimer)
              rescanTimer = setTimeout(() => {
                rescanTimer = null
                if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(spellcheckKey, true))
              }, 400)
            },
            destroy() {
              if (rescanTimer) clearTimeout(rescanTimer)
            },
          }
        },
        props: {
          decorations(state) {
            return spellcheckKey.getState(state)?.decorations
          },
        },
      }),
    ]
  },

  addCommands() {
    return {
      configureSpellcheck:
        (opts) =>
        ({ editor, dispatch }) => {
          if (opts.language !== undefined) this.options.language = opts.language
          if (opts.enabled !== undefined) this.options.enabled = opts.enabled
          if (this.options.enabled) void spellService.load(this.options.language)
          if (dispatch) editor.view.dispatch(editor.state.tr.setMeta(spellcheckKey, true))
          return true
        },
    }
  },

  onCreate() {
    // Re-run decoration once a language dictionary finishes loading.
    const unsub = spellService.onReady(() => {
      const { view } = this.editor
      if (view) view.dispatch(view.state.tr.setMeta(spellcheckKey, true))
    })
    ;(this.storage as { unsub?: () => void }).unsub = unsub
    // Warm the dictionary for the active language.
    if (this.options.enabled) void spellService.load(this.options.language)
  },

  onDestroy() {
    ;(this.storage as { unsub?: () => void }).unsub?.()
  },
})
