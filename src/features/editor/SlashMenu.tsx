import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import {
  Heading1,
  Heading2,
  Heading3,
  Type,
  Quote,
  List,
  ListOrdered,
  Sparkles,
  StickyNote,
  MessageSquare,
  FilePlus2,
  BookText,
  Clapperboard,
} from 'lucide-react'
import { setTextType, insertSceneBreak, toggleBulletList, toggleOrderedList, setScriptElement } from './editorActions'
import { SCRIPT_ELEMENTS, SCRIPT_ELEMENT_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface SlashCmd {
  id: string
  label: string
  hint: string
  keywords: string
  icon: React.ReactNode
  run: () => void
}

export function SlashMenu({
  editor,
  docType,
  onStructure,
}: {
  editor: Editor
  docType: string
  onStructure: (kind: 'scene' | 'chapter' | 'note') => void
}) {
  const [query, setQuery] = useState<string | null>(null)
  const [range, setRange] = useState<{ from: number; to: number } | null>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const [index, setIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const commands: SlashCmd[] = useMemo(() => {
    const base: SlashCmd[] = [
      { id: 'title', label: 'Title', hint: 'Large title', keywords: 'title', icon: <Type size={15} />, run: () => setTextType(editor, 'title') },
      { id: 'h1', label: 'Heading 1', hint: 'Section', keywords: 'heading h1', icon: <Heading1 size={15} />, run: () => setTextType(editor, 'h1') },
      { id: 'h2', label: 'Heading 2', hint: 'Sub-section', keywords: 'heading h2', icon: <Heading2 size={15} />, run: () => setTextType(editor, 'h2') },
      { id: 'h3', label: 'Heading 3', hint: 'Minor heading', keywords: 'heading h3', icon: <Heading3 size={15} />, run: () => setTextType(editor, 'h3') },
      { id: 'quote', label: 'Quote', hint: 'Block quote', keywords: 'quote blockquote', icon: <Quote size={15} />, run: () => setTextType(editor, 'quote') },
      { id: 'bullets', label: 'Bulleted list', hint: 'List', keywords: 'list bullet', icon: <List size={15} />, run: () => toggleBulletList(editor) },
      { id: 'numbers', label: 'Numbered list', hint: 'Ordered list', keywords: 'list number ordered', icon: <ListOrdered size={15} />, run: () => toggleOrderedList(editor) },
      { id: 'scenebreak', label: 'Scene break', hint: 'Insert ⁂', keywords: 'scene break divider hr', icon: <Sparkles size={15} />, run: () => insertSceneBreak(editor) },
    ]
    if (docType === 'script') {
      SCRIPT_ELEMENTS.forEach((el) =>
        base.push({ id: `s-${el}`, label: SCRIPT_ELEMENT_LABELS[el], hint: 'Script', keywords: `script ${el}`, icon: <Clapperboard size={15} />, run: () => setScriptElement(editor, el) }),
      )
    } else {
      base.push({ id: 'dialogue', label: 'Dialogue', hint: 'Styled line', keywords: 'dialogue speech', icon: <MessageSquare size={15} />, run: () => setTextType(editor, 'dialogue') })
      base.push({ id: 'note', label: 'Note', hint: 'Inline note block', keywords: 'note aside', icon: <StickyNote size={15} />, run: () => setTextType(editor, 'note') })
    }
    base.push({ id: 'new-scene', label: 'New scene', hint: 'Add to manuscript', keywords: 'scene new chapter', icon: <FilePlus2 size={15} />, run: () => onStructure('scene') })
    base.push({ id: 'new-chapter', label: 'New chapter', hint: 'Add to manuscript', keywords: 'chapter new', icon: <BookText size={15} />, run: () => onStructure('chapter') })
    base.push({ id: 'new-note', label: 'New note document', hint: 'Add to manuscript', keywords: 'note research', icon: <StickyNote size={15} />, run: () => onStructure('note') })
    return base
  }, [editor, docType, onStructure])

  const filtered = useMemo(() => {
    if (query === null) return []
    const q = query.toLowerCase()
    return q ? commands.filter((c) => (c.label + ' ' + c.keywords).toLowerCase().includes(q)) : commands
  }, [query, commands])

  // Detect "/..." at the start of the current block.
  useEffect(() => {
    const update = () => {
      const { state } = editor
      const { selection } = state
      if (!selection.empty) return setQuery(null)
      const $from = selection.$from
      if ($from.parent.type.name !== 'paragraph') return setQuery(null)
      const start = $from.start()
      const before = state.doc.textBetween(start, selection.from, '\n', '\0')
      const m = before.match(/^\/(\S*)$/)
      if (m) {
        setQuery(m[1])
        setIndex(0)
        setRange({ from: start, to: selection.from })
        try {
          const c = editor.view.coordsAtPos(selection.from)
          setCoords({ top: c.bottom + 4, left: c.left })
        } catch {
          setCoords(null)
        }
      } else {
        setQuery(null)
      }
    }
    editor.on('transaction', update)
    return () => {
      editor.off('transaction', update)
    }
  }, [editor])

  const pick = (cmd: SlashCmd | undefined) => {
    if (!cmd || !range) return
    editor.chain().focus().deleteRange(range).run()
    cmd.run()
    setQuery(null)
  }

  useEffect(() => {
    if (query === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIndex((i) => Math.min(filtered.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        pick(filtered[index])
      } else if (e.key === 'Escape') {
        setQuery(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filtered, index, range])

  if (query === null || !coords || filtered.length === 0) return null

  return createPortal(
    <div
      ref={listRef}
      className="fixed z-[60] max-h-72 w-64 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-panel animate-scale-in"
      style={{ top: Math.min(coords.top, window.innerHeight - 300), left: Math.min(coords.left, window.innerWidth - 270) }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted/70">Insert</div>
      {filtered.map((c, i) => (
        <button
          key={c.id}
          onMouseEnter={() => setIndex(i)}
          onClick={() => pick(c)}
          className={cn('flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm', i === index ? 'bg-accent/15 text-accent' : 'hover:bg-surface-2')}
        >
          <span className={cn('shrink-0', i === index ? 'text-accent' : 'text-muted')}>{c.icon}</span>
          <span className="flex-1 truncate">{c.label}</span>
          <span className="truncate text-[11px] text-muted">{c.hint}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
