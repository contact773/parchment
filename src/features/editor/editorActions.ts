import type { Editor } from '@tiptap/react'
import { EDITOR_FONTS, SCRIPT_ELEMENTS, SCRIPT_ELEMENT_LABELS, type ScriptElement } from '@/lib/constants'

// ── Option palettes ─────────────────────────────────────────────────────────

export const TEXT_COLORS: { name: string; value: string }[] = [
  { name: 'Default', value: '' },
  { name: 'Ink', value: '#2b2722' },
  { name: 'Crimson', value: '#b23b3b' },
  { name: 'Amber', value: '#c8832f' },
  { name: 'Forest', value: '#4d7d52' },
  { name: 'Ocean', value: '#3b6ea6' },
  { name: 'Plum', value: '#8a5da6' },
  { name: 'Rose', value: '#c4628a' },
  { name: 'Slate', value: '#6b7280' },
]

export const HIGHLIGHT_COLORS: { name: string; value: string }[] = [
  { name: 'None', value: '' },
  { name: 'Sun', value: '#fde68a' },
  { name: 'Mint', value: '#bbf7d0' },
  { name: 'Sky', value: '#bae6fd' },
  { name: 'Rose', value: '#fbcfe8' },
  { name: 'Lilac', value: '#ddd6fe' },
  { name: 'Peach', value: '#fed7aa' },
]

export const FONT_SIZES = ['14px', '16px', '18px', '20px', '24px', '28px', '32px']

export const LINE_HEIGHTS: { label: string; value: string }[] = [
  { label: 'Single', value: '1.4' },
  { label: 'Snug', value: '1.6' },
  { label: 'Relaxed', value: '1.8' },
  { label: 'Double', value: '2.2' },
]

export const PARAGRAPH_SPACINGS: { label: string; value: string }[] = [
  { label: 'None', value: '0em' },
  { label: 'Small', value: '0.5em' },
  { label: 'Medium', value: '1em' },
  { label: 'Large', value: '1.6em' },
]

export const FONT_OPTIONS = EDITOR_FONTS

export interface TextTypeDef {
  id: string
  label: string
  hint?: string
}

export const TEXT_TYPES: TextTypeDef[] = [
  { id: 'paragraph', label: 'Normal text', hint: '¶' },
  { id: 'title', label: 'Title', hint: 'T' },
  { id: 'h1', label: 'Heading 1', hint: 'H1' },
  { id: 'h2', label: 'Heading 2', hint: 'H2' },
  { id: 'h3', label: 'Heading 3', hint: 'H3' },
  { id: 'quote', label: 'Quote', hint: '“' },
  { id: 'dialogue', label: 'Dialogue', hint: '—' },
  { id: 'note', label: 'Note', hint: '✎' },
]

// ── Verbs ───────────────────────────────────────────────────────────────────

const chain = (e: Editor) => e.chain().focus()

export function setTextType(e: Editor, id: string): void {
  const c = chain(e)
  // Clear prose-style first for clean transitions.
  switch (id) {
    case 'paragraph':
      c.setParagraph().updateAttributes('paragraph', { pstyle: null, script: null }).run()
      break
    case 'title':
      c.setHeading({ level: 1 }).run()
      break
    case 'h1':
      c.setHeading({ level: 2 }).run()
      break
    case 'h2':
      c.setHeading({ level: 3 }).run()
      break
    case 'h3':
      c.setHeading({ level: 4 }).run()
      break
    case 'quote':
      c.toggleBlockquote().run()
      break
    case 'dialogue':
      c.setParagraph().updateAttributes('paragraph', { pstyle: 'dialogue' }).run()
      break
    case 'note':
      c.setParagraph().updateAttributes('paragraph', { pstyle: 'note' }).run()
      break
  }
}

export function activeTextType(e: Editor): string {
  if (e.isActive('heading', { level: 1 })) return 'title'
  if (e.isActive('heading', { level: 2 })) return 'h1'
  if (e.isActive('heading', { level: 3 })) return 'h2'
  if (e.isActive('heading', { level: 4 })) return 'h3'
  if (e.isActive('blockquote')) return 'quote'
  const pstyle = e.getAttributes('paragraph').pstyle
  if (pstyle === 'dialogue') return 'dialogue'
  if (pstyle === 'note') return 'note'
  return 'paragraph'
}

export const toggleBold = (e: Editor) => chain(e).toggleBold().run()
export const toggleItalic = (e: Editor) => chain(e).toggleItalic().run()
export const toggleUnderline = (e: Editor) => chain(e).toggleUnderline().run()
export const toggleStrike = (e: Editor) => chain(e).toggleStrike().run()
export const toggleBulletList = (e: Editor) => chain(e).toggleBulletList().run()
export const toggleOrderedList = (e: Editor) => chain(e).toggleOrderedList().run()
export const clearFormatting = (e: Editor) => chain(e).unsetAllMarks().clearNodes().run()

export function setColor(e: Editor, hex: string): void {
  if (hex) chain(e).setColor(hex).run()
  else chain(e).unsetColor().run()
}

export function setHighlight(e: Editor, hex: string): void {
  if (hex) chain(e).setHighlight({ color: hex }).run()
  else chain(e).unsetHighlight().run()
}

export function setFontFamily(e: Editor, font: string): void {
  if (font) chain(e).setFontFamily(font).run()
  else chain(e).unsetFontFamily().run()
}

export function setFontSize(e: Editor, size: string): void {
  if (size) chain(e).setFontSize(size).run()
  else chain(e).unsetFontSize().run()
}

export type Align = 'left' | 'center' | 'right' | 'justify'
export const setAlign = (e: Editor, a: Align) => chain(e).setTextAlign(a).run()

export const setLineHeight = (e: Editor, v: string) => chain(e).setBlockLineHeight(v).run()
export const setSpacing = (e: Editor, v: string) => chain(e).setBlockSpacing(v).run()

export const insertSceneBreak = (e: Editor) => chain(e).setHorizontalRule().run()

export function setScriptElement(e: Editor, el: ScriptElement | null): void {
  chain(e).updateAttributes('paragraph', { script: el }).run()
}

export { SCRIPT_ELEMENTS, SCRIPT_ELEMENT_LABELS }
