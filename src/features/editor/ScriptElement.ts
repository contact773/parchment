import { Extension } from '@tiptap/core'
import { SCRIPT_ELEMENTS, type ScriptElement as ScriptEl } from '@/lib/constants'

/** What element a new line becomes when you press Enter from the current one. */
const ADVANCE: Record<ScriptEl, ScriptEl> = {
  'scene-heading': 'action',
  action: 'action',
  character: 'dialogue',
  dialogue: 'action',
  parenthetical: 'dialogue',
  transition: 'scene-heading',
  shot: 'action',
}

function cycle(current: ScriptEl | null, dir: 1 | -1): ScriptEl {
  const idx = current ? SCRIPT_ELEMENTS.indexOf(current) : -1
  const next = (idx + dir + SCRIPT_ELEMENTS.length) % SCRIPT_ELEMENTS.length
  return SCRIPT_ELEMENTS[next]
}

/**
 * Adds a `script` attribute to paragraphs so they can be styled as screenplay
 * elements (scene heading, action, character, dialogue, …) and flow naturally
 * via Tab / Enter. Only included on script-type documents.
 */
export const ScriptElementExt = Extension.create({
  name: 'scriptElement',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph'],
        attributes: {
          script: {
            default: null,
            parseHTML: (el) => el.getAttribute('data-script'),
            renderHTML: (attrs) => (attrs.script ? { 'data-script': attrs.script } : {}),
          },
        },
      },
    ]
  },

  addKeyboardShortcuts() {
    const setCurrent = (script: ScriptEl) =>
      this.editor.chain().focus().updateAttributes('paragraph', { script }).run()

    const current = (): ScriptEl | null => {
      const node = this.editor.state.selection.$from.parent
      return node.type.name === 'paragraph' ? (node.attrs.script as ScriptEl | null) : null
    }

    return {
      Tab: () => {
        if (this.editor.state.selection.$from.parent.type.name !== 'paragraph') return false
        return setCurrent(cycle(current(), 1))
      },
      'Shift-Tab': () => {
        if (this.editor.state.selection.$from.parent.type.name !== 'paragraph') return false
        return setCurrent(cycle(current(), -1))
      },
      Enter: () => {
        const cur = current()
        if (!cur) return false
        const next = ADVANCE[cur]
        return this.editor.chain().splitBlock().updateAttributes('paragraph', { script: next }).run()
      },
    }
  },
})

export { SCRIPT_ELEMENTS }
export type { ScriptEl }
