import { type Editor, useEditorState } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Undo2,
  Redo2,
  Sparkles,
  MessageSquarePlus,
  Pilcrow,
} from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { Select } from '@/components/ui/Field'
import type { DocType } from '@/types'
import { SCRIPT_ELEMENTS, SCRIPT_ELEMENT_LABELS, type ScriptElement } from '@/lib/constants'

function Divider() {
  return <div className="mx-1 h-5 w-px bg-border" />
}

/** Fallback selector value when the editor is destroyed/initializing. */
const DEAD_STATE = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  h1: false,
  h2: false,
  h3: false,
  para: false,
  bullet: false,
  ordered: false,
  quote: false,
  highlight: false,
  alignL: false,
  alignC: false,
  alignR: false,
  comment: false,
  canUndo: false,
  canRedo: false,
  scriptEl: '' as ScriptElement | '',
}

export function EditorToolbar({
  editor,
  docType,
  onComment,
}: {
  editor: Editor
  docType: DocType
  onComment: () => void
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (e.isDestroyed) return DEAD_STATE
      return {
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      para: e.isActive('paragraph') && !e.isActive('heading'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      highlight: e.isActive('highlight'),
      alignL: e.isActive({ textAlign: 'left' }),
      alignC: e.isActive({ textAlign: 'center' }),
      alignR: e.isActive({ textAlign: 'right' }),
      comment: e.isActive('comment'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      scriptEl: (e.getAttributes('paragraph').script as ScriptElement) ?? '',
      }
    },
  }) ?? DEAD_STATE

  const c = () => editor.chain().focus()

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-surface px-1.5 py-1 shadow-soft">
      <IconButton size="sm" label="Undo (Ctrl+Z)" disabled={!state.canUndo} onClick={() => c().undo().run()}>
        <Undo2 size={16} />
      </IconButton>
      <IconButton size="sm" label="Redo (Ctrl+Y)" disabled={!state.canRedo} onClick={() => c().redo().run()}>
        <Redo2 size={16} />
      </IconButton>

      {docType === 'script' ? (
        <>
          <Divider />
          <Select
            aria-label="Script element"
            value={state.scriptEl}
            onChange={(e) => c().updateAttributes('paragraph', { script: e.target.value || null }).run()}
            className="h-8 w-40 py-0 text-xs"
          >
            <option value="">Action / Plain</option>
            {SCRIPT_ELEMENTS.map((el) => (
              <option key={el} value={el}>
                {SCRIPT_ELEMENT_LABELS[el]}
              </option>
            ))}
          </Select>
          <span className="ml-1 hidden text-[11px] text-muted lg:inline">Tab to cycle · Enter to flow</span>
        </>
      ) : (
        <>
          <Divider />
          <IconButton size="sm" label="Paragraph" active={state.para} onClick={() => c().setParagraph().run()}>
            <Pilcrow size={16} />
          </IconButton>
          <IconButton size="sm" label="Heading 1" active={state.h1} onClick={() => c().toggleHeading({ level: 1 }).run()}>
            <Heading1 size={16} />
          </IconButton>
          <IconButton size="sm" label="Heading 2" active={state.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={16} />
          </IconButton>
          <IconButton size="sm" label="Heading 3" active={state.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}>
            <Heading3 size={16} />
          </IconButton>
        </>
      )}

      <Divider />
      <IconButton size="sm" label="Bold (Ctrl+B)" active={state.bold} onClick={() => c().toggleBold().run()}>
        <Bold size={16} />
      </IconButton>
      <IconButton size="sm" label="Italic (Ctrl+I)" active={state.italic} onClick={() => c().toggleItalic().run()}>
        <Italic size={16} />
      </IconButton>
      <IconButton size="sm" label="Underline (Ctrl+U)" active={state.underline} onClick={() => c().toggleUnderline().run()}>
        <Underline size={16} />
      </IconButton>
      <IconButton size="sm" label="Strikethrough" active={state.strike} onClick={() => c().toggleStrike().run()}>
        <Strikethrough size={16} />
      </IconButton>
      <IconButton size="sm" label="Highlight" active={state.highlight} onClick={() => c().toggleHighlight().run()}>
        <Highlighter size={16} />
      </IconButton>

      <Divider />
      <IconButton size="sm" label="Bullet list" active={state.bullet} onClick={() => c().toggleBulletList().run()}>
        <List size={16} />
      </IconButton>
      <IconButton size="sm" label="Numbered list" active={state.ordered} onClick={() => c().toggleOrderedList().run()}>
        <ListOrdered size={16} />
      </IconButton>
      <IconButton size="sm" label="Blockquote" active={state.quote} onClick={() => c().toggleBlockquote().run()}>
        <Quote size={16} />
      </IconButton>

      {docType !== 'script' && (
        <>
          <Divider />
          <IconButton size="sm" label="Align left" active={state.alignL} onClick={() => c().setTextAlign('left').run()}>
            <AlignLeft size={16} />
          </IconButton>
          <IconButton size="sm" label="Align center" active={state.alignC} onClick={() => c().setTextAlign('center').run()}>
            <AlignCenter size={16} />
          </IconButton>
          <IconButton size="sm" label="Align right" active={state.alignR} onClick={() => c().setTextAlign('right').run()}>
            <AlignRight size={16} />
          </IconButton>
        </>
      )}

      <Divider />
      <IconButton size="sm" label="Scene break" onClick={() => c().setHorizontalRule().run()}>
        <Sparkles size={16} />
      </IconButton>
      <IconButton size="sm" label="Add comment" active={state.comment} onClick={onComment}>
        <MessageSquarePlus size={16} />
      </IconButton>
    </div>
  )
}
