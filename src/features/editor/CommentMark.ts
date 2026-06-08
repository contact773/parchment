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
      setNote: (text: string) => ReturnType
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
      kind: { default: 'comment' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const kind = HTMLAttributes.kind === 'note' ? 'note' : 'comment'
    return [
      'span',
      mergeAttributes({
        'data-comment-id': HTMLAttributes.id,
        'data-comment-text': HTMLAttributes.text,
        'data-comment-kind': kind,
        class: `pm-comment pm-${kind}`,
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setComment:
        (text: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { id: uid(8), text, kind: 'comment' }),
      setNote:
        (text: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { id: uid(8), text, kind: 'note' }),
      unsetComment:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    }
  },
})
