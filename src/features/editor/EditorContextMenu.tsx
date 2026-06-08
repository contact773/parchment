import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import {
  Type,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Palette,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ChevronRight,
  MessageSquarePlus,
  StickyNote,
  Sparkles,
  Wand2,
  Languages,
  SpellCheck2,
  BookPlus,
  EyeOff,
  User,
  MapPin,
  UserPlus,
  Scissors,
  CaseSensitive,
  Baseline,
  Pilcrow,
} from 'lucide-react'
import {
  TEXT_TYPES,
  TEXT_COLORS,
  HIGHLIGHT_COLORS,
  FONT_OPTIONS,
  FONT_SIZES,
  LINE_HEIGHTS,
  PARAGRAPH_SPACINGS,
  setTextType,
  activeTextType,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrike,
  setColor,
  setHighlight,
  setFontFamily,
  setFontSize,
  setAlign,
  setLineHeight,
  setSpacing,
  insertSceneBreak,
  setScriptElement,
} from './editorActions'
import { spellService } from '../spellcheck/spellService'
import type { LanguageCode } from '@/types'
import { SCRIPT_ELEMENTS, SCRIPT_ELEMENT_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'

export interface CtxTarget {
  x: number
  y: number
  hasSelection: boolean
  selectionText: string
  spell: { word: string; from: number; to: number } | null
  nameMatch: { kind: 'character' | 'location'; id: string; name: string } | null
  unknownName: string | null
  docType: string
  language: LanguageCode
}

interface Props {
  editor: Editor
  target: CtxTarget
  onClose: () => void
  onTransform: (kind: string, label: string) => void
  onComment: () => void
  onNote: () => void
  onReplaceWord: (from: number, to: number, word: string) => void
  onAddWord: (word: string) => void
  onIgnoreWord: (word: string) => void
  onOpenProfile: (kind: 'character' | 'location', id: string) => void
  onCreateEntry: (kind: 'character' | 'location', name: string) => void
  onSplitScene: () => void
}

const LANGS: { code: string; label: string }[] = [
  { code: 'English', label: 'English' },
  { code: 'Dutch', label: 'Nederlands' },
  { code: 'French', label: 'Français' },
  { code: 'German', label: 'Deutsch' },
  { code: 'Spanish', label: 'Español' },
]

export function EditorContextMenu({
  editor,
  target,
  onClose,
  onTransform,
  onComment,
  onNote,
  onReplaceWord,
  onAddWord,
  onIgnoreWord,
  onOpenProfile,
  onCreateEntry,
  onSplitScene,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: target.y, left: target.x })
  const [open, setOpen] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[] | null>(null)
  const close = (fn?: () => void) => {
    onClose()
    fn?.()
  }

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const left = Math.min(target.x, window.innerWidth - r.width - 8)
    const top = Math.min(target.y, window.innerHeight - r.height - 8)
    setPos({ top: Math.max(8, top), left: Math.max(8, left) })
  }, [target.x, target.y])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    if (open === 'spell' && target.spell && suggestions === null) {
      spellService.suggest(target.language, target.spell.word).then(setSuggestions)
    }
  }, [open, target.spell, target.language, suggestions])

  const active = activeTextType(editor)
  const isScript = target.docType === 'script'

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[60] max-h-[80vh] w-64 overflow-y-auto overflow-x-hidden rounded-xl border border-border bg-surface p-1 shadow-panel animate-scale-in"
      style={{ top: pos.top, left: pos.left }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Spelling (only when right-clicking a misspelled word) */}
      {target.spell && (
        <Section>
          <Expand icon={<SpellCheck2 size={15} />} label={`Spelling: ${target.spell.word}`} open={open === 'spell'} onToggle={() => setOpen(open === 'spell' ? null : 'spell')}>
            {suggestions === null ? (
              <Hint>Finding suggestions…</Hint>
            ) : suggestions.length === 0 ? (
              <Hint>No suggestions</Hint>
            ) : (
              suggestions.map((s) => (
                <Row key={s} onClick={() => close(() => onReplaceWord(target.spell!.from, target.spell!.to, s))}>
                  {s}
                </Row>
              ))
            )}
          </Expand>
          <Row icon={<BookPlus size={15} />} onClick={() => close(() => onAddWord(target.spell!.word))}>
            Add to dictionary
          </Row>
          <Row icon={<EyeOff size={15} />} onClick={() => close(() => onIgnoreWord(target.spell!.word))}>
            Ignore word
          </Row>
          <Row icon={<SpellCheck2 size={15} />} onClick={() => close(() => onTransform('grammar', 'Grammar check'))}>
            Check grammar of selection
          </Row>
        </Section>
      )}

      {/* Name actions */}
      {target.nameMatch && (
        <Section>
          <Row
            icon={target.nameMatch.kind === 'character' ? <User size={15} /> : <MapPin size={15} />}
            onClick={() => close(() => onOpenProfile(target.nameMatch!.kind, target.nameMatch!.id))}
          >
            Open {target.nameMatch.name} profile
          </Row>
        </Section>
      )}
      {!target.nameMatch && target.unknownName && (
        <Section>
          <Row icon={<UserPlus size={15} />} onClick={() => close(() => onCreateEntry('character', target.unknownName!))}>
            New character “{target.unknownName}”
          </Row>
          <Row icon={<MapPin size={15} />} onClick={() => close(() => onCreateEntry('location', target.unknownName!))}>
            New location “{target.unknownName}”
          </Row>
        </Section>
      )}

      {/* Text type */}
      <Section>
        <Expand icon={<Pilcrow size={15} />} label="Text type" hint={TEXT_TYPES.find((t) => t.id === active)?.label} open={open === 'type'} onToggle={() => setOpen(open === 'type' ? null : 'type')}>
          <div className="grid grid-cols-2 gap-0.5">
            {TEXT_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => close(() => setTextType(editor, t.id))}
                className={cn('flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface-2', active === t.id && 'bg-accent/15 text-accent')}
              >
                <span className="w-5 text-center text-[10px] text-muted">{t.hint}</span>
                {t.label}
              </button>
            ))}
          </div>
        </Expand>

        {isScript && (
          <Expand icon={<Type size={15} />} label="Script element" open={open === 'script'} onToggle={() => setOpen(open === 'script' ? null : 'script')}>
            <Row onClick={() => close(() => setScriptElement(editor, null))}>Action / Plain</Row>
            {SCRIPT_ELEMENTS.map((el) => (
              <Row key={el} onClick={() => close(() => setScriptElement(editor, el))}>
                {SCRIPT_ELEMENT_LABELS[el]}
              </Row>
            ))}
          </Expand>
        )}
      </Section>

      {/* Quick formatting */}
      <Section>
        <div className="flex items-center gap-0.5 px-1 py-0.5">
          <IconBtn label="Bold" active={editor.isActive('bold')} onClick={() => toggleBold(editor)}>
            <Bold size={15} />
          </IconBtn>
          <IconBtn label="Italic" active={editor.isActive('italic')} onClick={() => toggleItalic(editor)}>
            <Italic size={15} />
          </IconBtn>
          <IconBtn label="Underline" active={editor.isActive('underline')} onClick={() => toggleUnderline(editor)}>
            <Underline size={15} />
          </IconBtn>
          <IconBtn label="Strikethrough" active={editor.isActive('strike')} onClick={() => toggleStrike(editor)}>
            <Strikethrough size={15} />
          </IconBtn>
          <div className="mx-0.5 h-5 w-px bg-border" />
          <IconBtn label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => setAlign(editor, 'left')}>
            <AlignLeft size={15} />
          </IconBtn>
          <IconBtn label="Center" active={editor.isActive({ textAlign: 'center' })} onClick={() => setAlign(editor, 'center')}>
            <AlignCenter size={15} />
          </IconBtn>
          <IconBtn label="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => setAlign(editor, 'right')}>
            <AlignRight size={15} />
          </IconBtn>
          <IconBtn label="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => setAlign(editor, 'justify')}>
            <AlignJustify size={15} />
          </IconBtn>
        </div>

        <Expand icon={<Palette size={15} />} label="Text colour" open={open === 'color'} onToggle={() => setOpen(open === 'color' ? null : 'color')}>
          <Swatches colors={TEXT_COLORS} onPick={(v) => setColor(editor, v)} />
        </Expand>
        <Expand icon={<Highlighter size={15} />} label="Highlight" open={open === 'hl'} onToggle={() => setOpen(open === 'hl' ? null : 'hl')}>
          <Swatches colors={HIGHLIGHT_COLORS} onPick={(v) => setHighlight(editor, v)} />
        </Expand>
        <Expand icon={<CaseSensitive size={15} />} label="Font" open={open === 'font'} onToggle={() => setOpen(open === 'font' ? null : 'font')}>
          {FONT_OPTIONS.map((f) => (
            <Row key={f.value} onClick={() => setFontFamily(editor, f.value)} style={{ fontFamily: f.value }}>
              {f.label}
            </Row>
          ))}
          <Row onClick={() => setFontFamily(editor, '')}>Reset font</Row>
        </Expand>
        <Expand icon={<Baseline size={15} />} label="Size & spacing" open={open === 'size'} onToggle={() => setOpen(open === 'size' ? null : 'size')}>
          <Label>Font size</Label>
          <div className="flex flex-wrap gap-1 px-1.5 pb-1">
            {FONT_SIZES.map((s) => (
              <Chip key={s} onClick={() => setFontSize(editor, s)}>
                {s.replace('px', '')}
              </Chip>
            ))}
            <Chip onClick={() => setFontSize(editor, '')}>reset</Chip>
          </div>
          <Label>Line spacing</Label>
          <div className="flex flex-wrap gap-1 px-1.5 pb-1">
            {LINE_HEIGHTS.map((l) => (
              <Chip key={l.value} onClick={() => setLineHeight(editor, l.value)}>
                {l.label}
              </Chip>
            ))}
          </div>
          <Label>Paragraph spacing</Label>
          <div className="flex flex-wrap gap-1 px-1.5 pb-1">
            {PARAGRAPH_SPACINGS.map((p) => (
              <Chip key={p.value} onClick={() => setSpacing(editor, p.value)}>
                {p.label}
              </Chip>
            ))}
          </div>
        </Expand>
      </Section>

      {/* Convert / insert */}
      <Section>
        <Row icon={<Sparkles size={15} />} onClick={() => close(() => insertSceneBreak(editor))}>
          Insert scene break
        </Row>
        {isScript ? (
          <>
            <Row onClick={() => close(() => setScriptElement(editor, 'character'))}>Make character cue</Row>
            <Row onClick={() => close(() => setScriptElement(editor, 'dialogue'))}>Make dialogue block</Row>
            <Row onClick={() => close(() => setScriptElement(editor, 'action'))}>Make action</Row>
          </>
        ) : (
          <>
            <Row onClick={() => close(() => setTextType(editor, 'dialogue'))}>Convert to dialogue</Row>
            <Row onClick={() => close(() => setTextType(editor, 'note'))}>Convert to note</Row>
          </>
        )}
        <Row icon={<Scissors size={15} />} onClick={() => close(onSplitScene)}>
          Split scene here
        </Row>
      </Section>

      {/* Comments / notes */}
      {target.hasSelection && (
        <Section>
          <Row icon={<MessageSquarePlus size={15} />} onClick={() => close(onComment)}>
            Add comment
          </Row>
          <Row icon={<StickyNote size={15} />} onClick={() => close(onNote)}>
            Add private note
          </Row>
        </Section>
      )}

      {/* Assistant */}
      {target.hasSelection && (
        <Section last>
          <Row icon={<Sparkles size={15} />} onClick={() => close(() => onTransform('ask', 'Ask assistant'))}>
            Ask assistant about this
          </Row>
          <Expand icon={<Wand2 size={15} />} label="Rewrite / improve" open={open === 'ai'} onToggle={() => setOpen(open === 'ai' ? null : 'ai')}>
            {[
              ['rewrite', 'Rewrite'],
              ['improve', 'Improve'],
              ['literary', 'More literary'],
              ['simpler', 'Simpler'],
              ['dramatic', 'More dramatic'],
              ['emotional', 'More emotional'],
              ['natural', 'More natural'],
            ].map(([k, label]) => (
              <Row key={k} onClick={() => close(() => onTransform(k, label))}>
                {label}
              </Row>
            ))}
          </Expand>
          <Expand icon={<Type size={15} />} label="Words & tone" open={open === 'words'} onToggle={() => setOpen(open === 'words' ? null : 'words')}>
            <Row onClick={() => close(() => onTransform('synonyms', 'Synonyms'))}>Synonym suggestions</Row>
            <Row onClick={() => close(() => onTransform('stronger', 'Stronger words'))}>Stronger alternatives</Row>
            <Row onClick={() => close(() => onTransform('tone', 'Tone'))}>Tone alternatives</Row>
            <Row onClick={() => close(() => onTransform('grammar', 'Grammar'))}>Check grammar</Row>
          </Expand>
          <Expand icon={<Languages size={15} />} label="Translate" open={open === 'tr'} onToggle={() => setOpen(open === 'tr' ? null : 'tr')}>
            {LANGS.map((l) => (
              <Row key={l.code} onClick={() => close(() => onTransform(`translate:${l.code}`, `Translate · ${l.label}`))}>
                {l.label}
              </Row>
            ))}
          </Expand>
        </Section>
      )}
    </div>,
    document.body,
  )
}

// ── Primitives ───────────────────────────────────────────────────────────────

function Section({ children, last }: { children: ReactNode; last?: boolean }) {
  return <div className={cn(!last && 'border-b border-border pb-1 mb-1')}>{children}</div>
}

function Row({ children, icon, onClick, style }: { children: ReactNode; icon?: ReactNode; onClick?: () => void; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick} style={style} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-text hover:bg-surface-2">
      {icon && <span className="shrink-0 text-muted">{icon}</span>}
      <span className="truncate">{children}</span>
    </button>
  )
}

function Expand({ icon, label, hint, open, onToggle, children }: { icon: ReactNode; label: string; hint?: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div>
      <button onClick={onToggle} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-surface-2">
        <span className="shrink-0 text-muted">{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        {hint && <span className="truncate text-[11px] text-muted">{hint}</span>}
        <ChevronRight size={13} className={cn('shrink-0 text-muted transition-transform', open && 'rotate-90')} />
      </button>
      {open && <div className="ml-2 border-l border-border pl-1.5 py-0.5">{children}</div>}
    </div>
  )
}

function IconBtn({ children, active, label, onClick }: { children: ReactNode; active?: boolean; label: string; onClick: () => void }) {
  return (
    <button title={label} onClick={onClick} className={cn('flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text', active && 'bg-accent/15 text-accent')}>
      {children}
    </button>
  )
}

function Swatches({ colors, onPick }: { colors: { name: string; value: string }[]; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 px-1.5 py-1.5">
      {colors.map((c) => (
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
  )
}

function Chip({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-muted hover:border-accent/50 hover:text-text">
      {children}
    </button>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <div className="px-1.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted/70">{children}</div>
}

function Hint({ children }: { children: ReactNode }) {
  return <div className="px-2 py-1.5 text-xs text-muted">{children}</div>
}
