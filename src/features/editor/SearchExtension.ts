import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'

export interface SearchState {
  term: string
  caseSensitive: boolean
  matches: { from: number; to: number }[]
  active: number
}

export const searchKey = new PluginKey<SearchState>('parchment-search')

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    search: {
      setSearchTerm: (term: string, caseSensitive?: boolean) => ReturnType
      searchNext: () => ReturnType
      searchPrev: () => ReturnType
      replaceCurrent: (replacement: string) => ReturnType
      replaceAllMatches: (replacement: string) => ReturnType
    }
  }
}

function findMatches(doc: PMNode, term: string, caseSensitive: boolean): { from: number; to: number }[] {
  if (!term) return []
  const matches: { from: number; to: number }[] = []
  const needle = caseSensitive ? term : term.toLowerCase()
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const hay = caseSensitive ? node.text : node.text.toLowerCase()
    let idx = hay.indexOf(needle)
    while (idx !== -1) {
      matches.push({ from: pos + idx, to: pos + idx + term.length })
      idx = hay.indexOf(needle, idx + Math.max(1, term.length))
    }
  })
  return matches
}

export const SearchExtension = Extension.create({
  name: 'search',

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => ({ term: '', caseSensitive: false, matches: [], active: 0 }),
          apply(tr, value) {
            const meta = tr.getMeta(searchKey) as Partial<SearchState> | undefined
            let next = value
            if (meta) next = { ...value, ...meta }
            if (tr.docChanged || meta?.term !== undefined || meta?.caseSensitive !== undefined) {
              const matches = findMatches(tr.doc, next.term, next.caseSensitive)
              const active = Math.min(next.active, Math.max(0, matches.length - 1))
              next = { ...next, matches, active }
            }
            return next
          },
        },
        props: {
          decorations(state) {
            const s = searchKey.getState(state)
            if (!s || !s.matches.length) return DecorationSet.empty
            return DecorationSet.create(
              state.doc,
              s.matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === s.active ? 'search-match search-active' : 'search-match' })),
            )
          },
        },
      }),
    ]
  },

  addCommands() {
    return {
      setSearchTerm:
        (term, caseSensitive = false) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchKey, { term, caseSensitive, active: 0 }))
          return true
        },
      searchNext:
        () =>
        ({ state, dispatch, tr }) => {
          const s = searchKey.getState(state)
          if (!s || !s.matches.length) return false
          const active = (s.active + 1) % s.matches.length
          if (dispatch) dispatch(tr.setMeta(searchKey, { active }))
          return true
        },
      searchPrev:
        () =>
        ({ state, dispatch, tr }) => {
          const s = searchKey.getState(state)
          if (!s || !s.matches.length) return false
          const active = (s.active - 1 + s.matches.length) % s.matches.length
          if (dispatch) dispatch(tr.setMeta(searchKey, { active }))
          return true
        },
      replaceCurrent:
        (replacement) =>
        ({ state, dispatch, tr }) => {
          const s = searchKey.getState(state)
          if (!s || !s.matches.length) return false
          const m = s.matches[s.active]
          if (!m) return false
          if (dispatch) dispatch(tr.insertText(replacement, m.from, m.to))
          return true
        },
      replaceAllMatches:
        (replacement) =>
        ({ state, dispatch, tr }) => {
          const s = searchKey.getState(state)
          if (!s || !s.matches.length) return false
          // Replace from last to first so positions stay valid.
          const ordered = [...s.matches].sort((a, b) => b.from - a.from)
          ordered.forEach((m) => tr.insertText(replacement, m.from, m.to))
          if (dispatch) dispatch(tr)
          return true
        },
    }
  },
})
