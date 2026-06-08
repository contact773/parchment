import { type Editor, useEditorState } from '@tiptap/react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Highlighter,
  Sparkles,
  MessageSquarePlus,
  Undo2,
  Redo2,
  Eraser,
} from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import {
  TEXT_TYPES,
  FONT_OPTIONS,
  FONT_SIZES,
  TEXT_COLORS,
  HIGHLIGHT_COLORS,
  LINE_HEIGHTS,
  setTextType,
  activeTextType,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrike,
  toggleBulletList,
  toggleOrderedList,
  clearFormatting,
  setColor,
  setHighlight,
  setFontFamily,
  setFontSize,
  setAlign,
  setLineHeight,
  insertSceneBreak,
} from './editorActions'
import { cn } from '@/lib/utils'

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 border-r border-border px-2.5 last:border-r-0">
      <div className="flex items-center gap-0.5">{children}</div>
      <span className="text-[9px] uppercase tracking-wide text-muted/60">{label}</span>
    </div>
  )
}

export function Ribbon({ editor, docType, onComment }: { editor: Editor; docType: string; onComment: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      highlight: e.isActive('highlight'),
      alignL: e.isActive({ textAlign: 'left' }),
      alignC: e.isActive({ textAlign: 'center' }),
      alignR: e.isActive({ textAlign: 'right' }),
      alignJ: e.isActive({ textAlign: 'justify' }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      type: activeTextType(e),
      font: (e.getAttributes('textStyle').fontFamily as string) ?? '',
      size: (e.getAttributes('textStyle').fontSize as string) ?? '',
    }),
  }) ?? { type: 'paragraph', font: '', size: '', bold: false, italic: false, underline: false, strike: false, bullet: false, ordered: false, quote: false, highlight: false, alignL: false, alignC: false, alignR: false, alignJ: false, canUndo: false, canRedo: false }

  return (
    <div className="flex items-stretch gap-0 overflow-x-auto rounded-lg border border-border bg-surface px-1 py-1.5 shadow-soft">
      <Group label="History">
        <IconButton size="sm" label="Undo" disabled={!s.canUndo} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 size={15} />
        </IconButton>
        <IconButton size="sm" label="Redo" disabled={!s.canRedo} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 size={15} />
        </IconButton>
      </Group>

      <Group label="Style">
        <select
          value={docType === 'script' ? 'paragraph' : s.type}
          onChange={(e) => setTextType(editor, e.target.value)}
          className="h-7 w-28 rounded border border-border bg-surface-2 px-1.5 text-xs outline-none"
        >
          {TEXT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </Group>

      <Group label="Font">
        <select
          value={s.font}
          onChange={(e) => setFontFamily(editor, e.target.value)}
          className="h-7 w-28 rounded border border-border bg-surface-2 px-1.5 text-xs outline-none"
          style={{ fontFamily: s.font || undefined }}
        >
          <option value="">Default</option>
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </option>
          ))}
        </select>
        <select value={s.size} onChange={(e) => setFontSize(editor, e.target.value)} className="h-7 w-14 rounded border border-border bg-surface-2 px-1 text-xs outline-none">
          <option value="">Size</option>
          {FONT_SIZES.map((sz) => (
            <option key={sz} value={sz}>
              {sz.replace('px', '')}
            </option>
          ))}
        </select>
      </Group>

      <Group label="Format">
        <IconButton size="sm" label="Bold" active={s.bold} onClick={() => toggleBold(editor)}>
          <Bold size={15} />
        </IconButton>
        <IconButton size="sm" label="Italic" active={s.italic} onClick={() => toggleItalic(editor)}>
          <Italic size={15} />
        </IconButton>
        <IconButton size="sm" label="Underline" active={s.underline} onClick={() => toggleUnderline(editor)}>
          <Underline size={15} />
        </IconButton>
        <IconButton size="sm" label="Strikethrough" active={s.strike} onClick={() => toggleStrike(editor)}>
          <Strikethrough size={15} />
        </IconButton>
        <IconButton size="sm" label="Clear formatting" onClick={() => clearFormatting(editor)}>
          <Eraser size={15} />
        </IconButton>
      </Group>

      <Group label="Colour">
        <ColorMenu swatches={TEXT_COLORS} onPick={(v) => setColor(editor, v)}>
          <span className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-2">
            <span className="text-[13px] font-semibold underline decoration-2" style={{ textDecorationColor: '#b23b3b' }}>
              A
            </span>
          </span>
        </ColorMenu>
        <ColorMenu swatches={HIGHLIGHT_COLORS} onPick={(v) => setHighlight(editor, v)}>
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-2', s.highlight && 'text-accent')}>
            <Highlighter size={15} />
          </span>
        </ColorMenu>
      </Group>

      <Group label="Align">
        <IconButton size="sm" label="Left" active={s.alignL} onClick={() => setAlign(editor, 'left')}>
          <AlignLeft size={15} />
        </IconButton>
        <IconButton size="sm" label="Center" active={s.alignC} onClick={() => setAlign(editor, 'center')}>
          <AlignCenter size={15} />
        </IconButton>
        <IconButton size="sm" label="Right" active={s.alignR} onClick={() => setAlign(editor, 'right')}>
          <AlignRight size={15} />
        </IconButton>
        <IconButton size="sm" label="Justify" active={s.alignJ} onClick={() => setAlign(editor, 'justify')}>
          <AlignJustify size={15} />
        </IconButton>
        <select onChange={(e) => e.target.value && setLineHeight(editor, e.target.value)} value="" className="h-7 w-16 rounded border border-border bg-surface-2 px-1 text-xs outline-none" title="Line spacing">
          <option value="">Line</option>
          {LINE_HEIGHTS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </Group>

      <Group label="Lists">
        <IconButton size="sm" label="Bullets" active={s.bullet} onClick={() => toggleBulletList(editor)}>
          <List size={15} />
        </IconButton>
        <IconButton size="sm" label="Numbered" active={s.ordered} onClick={() => toggleOrderedList(editor)}>
          <ListOrdered size={15} />
        </IconButton>
        <IconButton size="sm" label="Quote" active={s.quote} onClick={() => setTextType(editor, 'quote')}>
          <Quote size={15} />
        </IconButton>
      </Group>

      <Group label="Insert">
        <IconButton size="sm" label="Scene break" onClick={() => insertSceneBreak(editor)}>
          <Sparkles size={15} />
        </IconButton>
        <IconButton size="sm" label="Comment" onClick={onComment}>
          <MessageSquarePlus size={15} />
        </IconButton>
      </Group>
    </div>
  )
}

function ColorMenu({ swatches, onPick, children }: { swatches: { name: string; value: string }[]; onPick: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="group relative">
      <button>{children}</button>
      <div className="invisible absolute left-0 top-full z-40 mt-1 flex w-max max-w-[160px] flex-wrap gap-1.5 rounded-lg border border-border bg-surface p-2 opacity-0 shadow-panel transition-opacity group-hover:visible group-hover:opacity-100">
        {swatches.map((c) => (
          <button
            key={c.name}
            title={c.name}
            onClick={() => onPick(c.value)}
            className={cn('h-5 w-5 rounded-full border border-border', !c.value && 'flex items-center justify-center text-[9px] text-muted')}
            style={c.value ? { backgroundColor: c.value } : undefined}
          >
            {!c.value && '⊘'}
          </button>
        ))}
      </div>
    </div>
  )
}
