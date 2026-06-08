import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockStyle: {
      setBlockLineHeight: (lineHeight: string | null) => ReturnType
      setBlockSpacing: (spacing: string | null) => ReturnType
    }
  }
}

/** Per-block line-height and paragraph spacing (margin-bottom) on paragraphs and
 *  headings — overrides the theme default for the selected block(s). */
export const BlockStyle = Extension.create({
  name: 'blockStyle',

  addOptions() {
    return { types: ['paragraph', 'heading'] as string[] }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.lineHeight || null,
            renderHTML: (attrs) => (attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {}),
          },
          spacingAfter: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.marginBottom || null,
            renderHTML: (attrs) => (attrs.spacingAfter ? { style: `margin-bottom: ${attrs.spacingAfter}` } : {}),
          },
          pstyle: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).getAttribute('data-pstyle') || null,
            renderHTML: (attrs) => (attrs.pstyle ? { 'data-pstyle': attrs.pstyle } : {}),
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setBlockLineHeight:
        (lineHeight) =>
        ({ commands }) => {
          this.options.types.forEach((t) => commands.updateAttributes(t, { lineHeight }))
          return true
        },
      setBlockSpacing:
        (spacing) =>
        ({ commands }) => {
          this.options.types.forEach((t) => commands.updateAttributes(t, { spacingAfter: spacing }))
          return true
        },
    }
  },
})
