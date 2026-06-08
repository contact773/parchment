import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { type Editor, useEditorState } from '@tiptap/react'
import { Bold, Italic, Underline, Strikethrough, Highlighter, MessageSquarePlus, Wand2, Sparkles } from 'lucide-react'
import { toggleBold, toggleItalic, toggleUnderline, toggleStrike, setHighlight } from './editorActions'
import { cn } from '@/lib/utils'

/** Floating mini-toolbar that appears above a non-empty text selection. */
export function BubbleToolbar({
  editor,
  suppressed,
  onComment,
  onAsk,
  onImprove,
}: {
  editor: Editor
  suppressed: boolean
  onComment: () => void
  onAsk: () => void
  onImprove: () => void
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      empty: e.state.selection.empty,
      from: e.state.selection.from,
      to: e.state.selection.to,
      focused: e.isFocused,
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      highlight: e.isActive('highlight'),
    }),
  }) ?? { empty: true, from: 0, to: 0, focused: false, bold: false, italic: false, underline: false, strike: false, highlight: false }

  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const visible = !suppressed && !s.empty && s.focused

  useLayoutEffect(() => {
    if (!visible) {
      setCoords(null)
      return
    }
    try {
      const start = editor.view.coordsAtPos(s.from)
      const end = editor.view.coordsAtPos(s.to)
      const left = (start.left + end.left) / 2
      const top = Math.min(start.top, end.top) - 46
      setCoords({ top: Math.max(8, top), left })
    } catch {
      setCoords(null)
    }
  }, [visible, s.from, s.to, editor])

  if (!visible || !coords) return null

  const Btn = ({ active, label, onClick, children }: { active?: boolean; label: string; onClick: () => void; children: React.ReactNode }) => (
    <button
      title={label}
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      className={cn('flex h-8 w-8 items-center justify-center rounded-md text-text/80 hover:bg-surface-2 hover:text-text', active && 'bg-accent/15 text-accent')}
    >
      {children}
    </button>
  )

  return createPortal(
    <div
      className="fixed z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-panel animate-fade-in"
      style={{ top: coords.top, left: coords.left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Btn active={s.bold} label="Bold" onClick={() => toggleBold(editor)}>
        <Bold size={15} />
      </Btn>
      <Btn active={s.italic} label="Italic" onClick={() => toggleItalic(editor)}>
        <Italic size={15} />
      </Btn>
      <Btn active={s.underline} label="Underline" onClick={() => toggleUnderline(editor)}>
        <Underline size={15} />
      </Btn>
      <Btn active={s.strike} label="Strikethrough" onClick={() => toggleStrike(editor)}>
        <Strikethrough size={15} />
      </Btn>
      <Btn active={s.highlight} label="Highlight" onClick={() => setHighlight(editor, s.highlight ? '' : '#fde68a')}>
        <Highlighter size={15} />
      </Btn>
      <div className="mx-0.5 h-5 w-px bg-border" />
      <Btn label="Comment" onClick={onComment}>
        <MessageSquarePlus size={15} />
      </Btn>
      <Btn label="Improve with assistant" onClick={onImprove}>
        <Wand2 size={15} />
      </Btn>
      <Btn label="Ask assistant" onClick={onAsk}>
        <Sparkles size={15} />
      </Btn>
    </div>,
    document.body,
  )
}
