import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/** Adds a `has-focus` class to the top-level block containing the selection,
 *  enabling focus-mode dimming of everything else. */
export const FocusBlock = Extension.create({
  name: 'focusBlock',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const { selection, doc } = state
            const $from = selection.$from
            if ($from.depth < 1) return null
            const before = $from.before(1)
            const node = doc.nodeAt(before)
            if (!node) return null
            return DecorationSet.create(doc, [
              Decoration.node(before, before + node.nodeSize, { class: 'has-focus' }),
            ])
          },
        },
      }),
    ]
  },
})
