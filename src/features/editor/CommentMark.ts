import { Mark, mergeAttributes } from '@tiptap/core'
import { uid } from '@/lib/id'

export interface CommentAttrs {
  id: string
  text: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      setComment: (text: string) => ReturnType
      unsetComment: () => ReturnType
    }
  }
}

/** Inline annotation mark — stores the note text inline so it travels with the
 *  content and can be collected for the Notes panel. */
export const CommentMark = Mark.create({
  name: 'comment',
  inclusive: false,

  addAttributes() {
    return {
      id: { default: null },
      text: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        { 'data-comment-id': HTMLAttributes.id, 'data-comment-text': HTMLAttributes.text, class: 'pm-comment' },
      ),
      0,
    ]
  },

  addCommands() {
    return {
      setComment:
        (text: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { id: uid(8), text }),
      unsetComment:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})
