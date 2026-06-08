import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import type { EditorView } from '@tiptap/pm/view'
import { Check, Loader2 } from 'lucide-react'
import type { Character, DocContent, Location, Project, TreeNode } from '@/types'
import { buildExtensions } from './extensions'
import { EditorToolbar } from './EditorToolbar'
import { Ribbon } from './Ribbon'
import { CommentDialog } from './CommentDialog'
import { EditorContextMenu, type CtxTarget } from './EditorContextMenu'
import { BubbleToolbar } from './BubbleToolbar'
import { SlashMenu } from './SlashMenu'
import { SelectionResultDialog } from './SelectionResultDialog'
import { SpellPopover } from '../spellcheck/SpellPopover'
import { spellcheckKey, misspellingAt, type Misspelling } from '../spellcheck/SpellcheckExtension'
import { spellService } from '../spellcheck/spellService'
import { setActiveEditor } from './activeEditor'
import { analyzeStory } from '../story-assistant/analyzeLocal'
import { getProvider, localProvider, type StoryContext, type TransformKind, type TransformResult } from '../story-assistant/providers'
import { saveNodeContent, renameNode, emptyDoc } from '@/data/repo'
import { useSettings } from '@/store/useSettings'
import { useUI } from '@/store/useUI'
import { debounce, cn } from '@/lib/utils'
import { formatReadingTime, readingMinutes, pageEstimate } from '@/lib/text'
import { formatNumber } from '@/lib/format'
import { BUILTIN_THEMES, findBuiltin } from '@/features/themes/themes'

interface SpellTarget extends Misspelling {
  x: number
  y: number
}
interface CommentView {
  text: string
  kind: string
  x: number
  y: number
}

export interface DocumentEditorProps {
  node: TreeNode
  project: Project
  characters?: Character[]
  locations?: Location[]
  onAskAssistant?: (text: string) => void
  onOpenProfile?: (kind: 'character' | 'location', id: string) => void
  onCreateEntry?: (kind: 'character' | 'location', name: string) => void
  onSplitScene?: (after: DocContent) => void
  onStructure?: (kind: 'scene' | 'chapter' | 'note') => void
}

/** Find the word at a document position, mapping string offsets back to true
 *  document positions (so non-text inline nodes like hard breaks don't desync). */
function wordAt(view: EditorView, pos: number): { word: string; from: number; to: number } | null {
  const $pos = view.state.doc.resolve(pos)
  if (!$pos.parent.isTextblock) return null
  const blockStart = $pos.start()
  const chars: { ch: string; pos: number }[] = []
  $pos.parent.forEach((child, offset) => {
    if (child.isText && child.text) {
      for (let i = 0; i < child.text.length; i++) chars.push({ ch: child.text[i], pos: blockStart + offset + i })
    } else {
      chars.push({ ch: '\n', pos: blockStart + offset }) // boundary for inline atoms (e.g. hardBreak)
    }
  })
  const s = chars.map((c) => c.ch).join('')
  let clickIdx = chars.findIndex((c) => c.pos >= pos)
  if (clickIdx === -1) clickIdx = chars.length
  const isW = (ch: string) => !!ch && /[\p{L}\p{N}'’-]/u.test(ch)
  let start = clickIdx
  let end = clickIdx
  while (start > 0 && isW(s[start - 1])) start--
  while (end < s.length && isW(s[end])) end++
  if (end <= start || start >= chars.length) return null
  return { word: s.slice(start, end), from: chars[start].pos, to: chars[end - 1].pos + 1 }
}

export function DocumentEditor({
  node,
  project,
  characters = [],
  locations = [],
  onAskAssistant,
  onOpenProfile,
  onCreateEntry,
  onSplitScene,
  onStructure,
}: DocumentEditorProps) {
  const settings = useSettings((s) => s.settings)
  const dictionary = useSettings((s) => s.dictionary)
  const addDictWord = useSettings((s) => s.addDictWord)
  const ignoreWordStore = useSettings((s) => s.ignoreWord)
  const recordWordCount = useSettings((s) => s.recordWordCount)
  const indent = useSettings((s) => {
    const t =
      s.customThemes.find((x) => x.id === s.settings.activeThemeId) ?? findBuiltin(s.settings.activeThemeId) ?? BUILTIN_THEMES[0]
    return t.typography.paragraphIndent
  })

  const { addSessionWords, setSaving, markSaved, editorZoom } = useUI()
  const distractionFree = useUI((s) => s.distractionFree)
  const ribbon = useUI((s) => s.ribbon)
  const minimal = useUI((s) => s.workspaceMode === 'minimal')
  const toast = useUI((s) => s.toast)
  const showChrome = !distractionFree && !minimal

  const language = node.meta.language ?? project.language
  const focusActive = settings.focusMode !== 'off'
  const typewriter = settings.typewriterMode || settings.focusMode === 'typewriter'

  const scrollRef = useRef<HTMLDivElement>(null)
  const [spell, setSpell] = useState<SpellTarget | null>(null)
  const [commentView, setCommentView] = useState<CommentView | null>(null)
  const [commentOpen, setCommentOpen] = useState(false)
  const [commentKind, setCommentKind] = useState<'comment' | 'note'>('comment')
  const [title, setTitle] = useState(node.title)
  const [ctxMenu, setCtxMenu] = useState<CtxTarget | null>(null)
  const transformRange = useRef<{ from: number; to: number } | null>(null)
  const [transform, setTransform] = useState<{ label: string; loading: boolean; result: TransformResult | null } | null>(null)

  useEffect(() => setTitle(node.title), [node.id, node.title])
  useEffect(() => {
    spellService.syncUserWords(dictionary)
  }, [dictionary])

  // ── Autosave ──────────────────────────────────────────────────────────
  const save = useMemo(
    () =>
      debounce((json: object) => {
        void saveNodeContent(node.id, json).then((words) => {
          const delta = recordWordCount(node.id, words)
          if (delta > 0) addSessionWords(delta)
          markSaved()
        })
      }, 700),
    [node.id, recordWordCount, addSessionWords, markSaved],
  )
  useEffect(() => () => save.flush(), [save])

  const editor = useEditor(
    {
      extensions: buildExtensions({
        docType: node.docType,
        language,
        spellcheckEnabled: settings.spellcheckEnabled,
        focus: focusActive,
        placeholder:
          node.docType === 'script'
            ? 'INT. SOMEWHERE — DAY\n\nStart your scene…'
            : node.docType === 'poetry'
              ? 'A line, and then another…'
              : 'Begin writing…  (type “/” for commands)',
      }),
      content: node.content ?? emptyDoc(),
      autofocus: 'end',
      editorProps: {
        attributes: { class: 'min-h-[60vh] focus:outline-none', spellcheck: 'false' },
        handleClick: (view, pos) => {
          const st = spellcheckKey.getState(view.state)
          const miss = misspellingAt(st, pos)
          if (miss && settings.spellcheckEnabled) {
            const coords = view.coordsAtPos(miss.from)
            setSpell({ ...miss, x: coords.left, y: coords.bottom })
            setCommentView(null)
            return false
          }
          setSpell(null)
          const $pos = view.state.doc.resolve(Math.min(pos, view.state.doc.content.size))
          const mark = $pos.marks().find((m) => m.type.name === 'comment')
          if (mark) {
            const coords = view.coordsAtPos(pos)
            setCommentView({ text: String(mark.attrs.text || ''), kind: String(mark.attrs.kind || 'comment'), x: coords.left, y: coords.bottom })
          } else {
            setCommentView(null)
          }
          return false
        },
      },
      onUpdate: ({ editor: e }) => {
        setSaving(true)
        save(e.getJSON())
      },
    },
    [node.id, language, settings.spellcheckEnabled, focusActive, node.docType],
  )

  useEffect(() => {
    if (editor) setActiveEditor(editor)
    return () => setActiveEditor(null)
  }, [editor])

  // ── Title ────────────────────────────────────────────────────────────
  const saveTitle = useMemo(() => debounce((t: string) => void renameNode(node.id, t || 'Untitled'), 500), [node.id])
  const onTitleChange = (v: string) => {
    setTitle(v)
    saveTitle(v)
  }

  // ── Typewriter scrolling ──────────────────────────────────────────────
  useEffect(() => {
    if (!editor || !typewriter) return
    const center = () => {
      const container = scrollRef.current
      if (!container) return
      const { from } = editor.state.selection
      try {
        const coords = editor.view.coordsAtPos(from)
        const cRect = container.getBoundingClientRect()
        const target = coords.top - cRect.top + container.scrollTop - container.clientHeight / 2
        container.scrollTo({ top: target, behavior: 'smooth' })
      } catch {
        /* not in view yet */
      }
    }
    editor.on('selectionUpdate', center)
    return () => {
      editor.off('selectionUpdate', center)
    }
  }, [editor, typewriter])

  // ── Spellcheck actions ────────────────────────────────────────────────
  const refreshSpell = useCallback(() => {
    if (editor) editor.view.dispatch(editor.state.tr.setMeta(spellcheckKey, true))
  }, [editor])

  const replaceWordAt = (from: number, to: number, suggestion: string) => {
    editor?.chain().focus().insertContentAt({ from, to }, suggestion).run()
    setSpell(null)
  }
  const addWordToDict = (word: string) => {
    addDictWord(language, word)
    spellService.addWord(language, word)
    refreshSpell()
    setSpell(null)
  }
  const ignoreWord = (word: string) => {
    ignoreWordStore(language, word)
    spellService.ignore(language, word)
    refreshSpell()
    setSpell(null)
  }

  // ── Comments / notes ───────────────────────────────────────────────────
  const openCommentDialog = (kind: 'comment' | 'note') => {
    if (!editor) return
    if (editor.state.selection.empty) {
      toast('Select some text first', 'info')
      return
    }
    setCommentKind(kind)
    setCommentOpen(true)
  }
  const addComment = (text: string) => {
    if (commentKind === 'note') editor?.chain().focus().setNote(text).run()
    else editor?.chain().focus().setComment(text).run()
    setCommentOpen(false)
  }

  // ── Assistant transforms ────────────────────────────────────────────────
  const buildContext = (): StoryContext => {
    const liveText = editor?.getText() ?? node.text ?? ''
    const analysis = analyzeStory({ project, nodes: [node], characters, threads: [], scope: 'node', nodeId: node.id })
    return { project, node, sceneText: liveText, characters, analysis }
  }

  const runTransform = async (rawKind: string, label: string) => {
    if (!editor) return
    const { from, to, empty } = editor.state.selection
    const text = empty ? editor.getText() : editor.state.doc.textBetween(from, to, ' ')
    if (!text.trim()) {
      toast('Nothing to work with — select some text', 'info')
      return
    }
    let kind = rawKind as TransformKind
    let targetLang: string | undefined
    if (rawKind.startsWith('translate:')) {
      kind = 'translate'
      targetLang = rawKind.split(':')[1]
    }
    if (kind === 'ask') {
      onAskAssistant?.(text)
      return
    }
    transformRange.current = empty ? null : { from, to }
    const provider = getProvider(settings.ai)
    const active = provider.ready ? provider : localProvider
    setTransform({ label, loading: true, result: null })
    try {
      const result = await active.transform(kind, text, buildContext(), { targetLang })
      setTransform({ label, loading: false, result })
    } catch {
      toast(`${active.label} failed — using local assistant`, 'error')
      const result = await localProvider.transform(kind, text, buildContext(), { targetLang })
      setTransform({ label, loading: false, result })
    }
  }

  const applyReplacement = (text: string, insert: boolean) => {
    if (!editor) return
    const size = editor.state.doc.content.size
    const blocks = text.split(/\n{2,}/).map((p) => p.trim())
    // Single paragraph → inline string (keeps inline replacements clean);
    // multi-paragraph → paragraph nodes (preserves structure).
    const asBlocks = blocks.map((p) => ({ type: 'paragraph', content: p ? [{ type: 'text', text: p }] : [] }))
    const inlineContent = text.trim()
    const range = transformRange.current
    if (range && !insert) {
      const from = Math.min(range.from, size)
      const to = Math.min(range.to, size)
      editor.chain().focus().insertContentAt({ from, to }, blocks.length > 1 ? asBlocks : inlineContent).run()
    } else if (range && insert) {
      editor.chain().focus().insertContentAt(Math.min(range.to, size), asBlocks).run()
    } else {
      editor.chain().focus().insertContent(asBlocks).run()
    }
    setTransform(null)
  }

  // ── Split scene ─────────────────────────────────────────────────────────
  const splitHere = () => {
    if (!editor) return
    const idx = editor.state.selection.$from.index(0)
    const blocks = (editor.getJSON().content ?? []) as DocContent[]
    if (idx <= 0 || idx >= blocks.length) {
      toast('Put the cursor at the start of a later block to split there', 'info')
      return
    }
    const before = blocks.slice(0, idx)
    const after = blocks.slice(idx)
    editor.commands.setContent({ type: 'doc', content: before })
    onSplitScene?.({ type: 'doc', content: after })
    toast('Scene split', 'success')
  }

  // ── Right-click ─────────────────────────────────────────────────────────
  const onContextMenu = (e: React.MouseEvent) => {
    if (!editor) return
    e.preventDefault()
    const view = editor.view
    const coords = view.posAtCoords({ left: e.clientX, top: e.clientY })
    if (!coords) return
    const pos = coords.pos
    const sel = editor.state.selection
    const insideSelection = !sel.empty && pos >= sel.from && pos <= sel.to
    if (!insideSelection && sel.empty) {
      editor.commands.setTextSelection(pos)
    }
    const w = wordAt(view, pos)
    const st = spellcheckKey.getState(editor.state)
    const miss = w ? misspellingAt(st, w.from) : null
    const nameMatch = w ? findNameMatch(w.word, characters, locations) : null
    const unknownName = w && !nameMatch && /^[A-ZÀ-Þ]/.test(w.word) && w.word.length > 1 && /^[\p{L}'’-]+$/u.test(w.word) ? w.word : null
    const sel2 = editor.state.selection
    setCtxMenu({
      x: e.clientX,
      y: e.clientY,
      hasSelection: !sel2.empty,
      selectionText: sel2.empty ? '' : editor.state.doc.textBetween(sel2.from, sel2.to, ' '),
      spell: miss && settings.spellcheckEnabled ? { word: miss.word, from: miss.from, to: miss.to } : null,
      nameMatch,
      unknownName,
      docType: node.docType,
      language,
    })
    setSpell(null)
    setCommentView(null)
  }

  const closeAll = () => {
    setSpell(null)
    setCommentView(null)
  }

  return (
    <div className="flex h-full flex-col">
      {showChrome && editor && (
        <div className="shrink-0 px-4 pb-2 pt-3">
          {ribbon ? (
            <Ribbon editor={editor} docType={node.docType} onComment={() => openCommentDialog('comment')} />
          ) : (
            <EditorToolbar editor={editor} docType={node.docType} onComment={() => openCommentDialog('comment')} />
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        className={cn('relative flex-1 overflow-y-auto px-4 pb-32', distractionFree && 'pt-[12vh]')}
        onMouseDown={closeAll}
        onContextMenu={onContextMenu}
      >
        <div
          className={cn(
            'pm-editor mx-auto w-full',
            indent && node.docType !== 'script' && 'indent',
            focusActive && 'focus-active',
            showChrome && 'paper-sheet',
          )}
          style={{
            maxWidth: showChrome ? 'calc(var(--editor-width) + 7rem)' : 'var(--editor-width)',
            ['--editor-zoom' as string]: editorZoom,
            paddingTop: typewriter ? '30vh' : undefined,
            paddingBottom: typewriter ? '40vh' : undefined,
          }}
        >
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Untitled"
            spellCheck={false}
            className="mb-4 w-full bg-transparent font-serif text-3xl font-semibold text-ink outline-none placeholder:text-muted/40"
          />
          <EditorContent editor={editor} />
        </div>

        {spell && editor && (
          <SpellPopover
            target={spell}
            language={language}
            onReplace={(s) => replaceWordAt(spell.from, spell.to, s)}
            onAdd={() => addWordToDict(spell.word)}
            onIgnore={() => ignoreWord(spell.word)}
            onClose={() => setSpell(null)}
          />
        )}
        {commentView && (
          <div
            className="fixed z-50 max-w-xs animate-scale-in rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-panel"
            style={{ top: commentView.y + 6, left: Math.max(8, commentView.x) }}
            onMouseDown={(ev) => ev.stopPropagation()}
          >
            <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
              {commentView.kind === 'note' ? 'Private note' : 'Comment'}
            </div>
            {commentView.text || <span className="text-muted">No note</span>}
          </div>
        )}
      </div>

      {editor && (
        <BubbleToolbar
          editor={editor}
          suppressed={!!ctxMenu || !!transform || commentOpen || !!spell}
          onComment={() => openCommentDialog('comment')}
          onAsk={() => runTransform('ask', 'Ask assistant')}
          onImprove={() => runTransform('improve', 'Improve')}
        />
      )}
      {editor && <SlashMenu editor={editor} docType={node.docType} onStructure={(k) => onStructure?.(k)} />}
      {editor && ctxMenu && (
        <EditorContextMenu
          editor={editor}
          target={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onTransform={runTransform}
          onComment={() => openCommentDialog('comment')}
          onNote={() => openCommentDialog('note')}
          onReplaceWord={replaceWordAt}
          onAddWord={addWordToDict}
          onIgnoreWord={ignoreWord}
          onOpenProfile={(k, id) => onOpenProfile?.(k, id)}
          onCreateEntry={(k, name) => onCreateEntry?.(k, name)}
          onSplitScene={splitHere}
        />
      )}

      {editor && <EditorStatusBar editor={editor} />}

      <CommentDialog
        open={commentOpen}
        kind={commentKind}
        onClose={() => setCommentOpen(false)}
        onSubmit={addComment}
      />
      <SelectionResultDialog
        open={!!transform}
        label={transform?.label ?? ''}
        loading={transform?.loading ?? false}
        result={transform?.result ?? null}
        providerLabel={getProvider(settings.ai).label}
        onReplace={(t) => applyReplacement(t, false)}
        onInsert={(t) => applyReplacement(t, true)}
        onClose={() => setTransform(null)}
      />
    </div>
  )
}

function findNameMatch(word: string, characters: Character[], locations: Location[]): CtxTarget['nameMatch'] {
  const w = word.toLowerCase()
  for (const c of characters) {
    const aliases = (c.aliases ?? '').toLowerCase().split(/[,;]/).map((s) => s.trim())
    if (c.name.toLowerCase() === w || aliases.includes(w)) return { kind: 'character', id: c.id, name: c.name }
  }
  for (const l of locations) {
    if (l.name.toLowerCase() === w) return { kind: 'location', id: l.id, name: l.name }
  }
  return null
}

function EditorStatusBar({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const saving = useUI((s) => s.saving)
  const distractionFree = useUI((s) => s.distractionFree)
  const counts = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      words: e.isDestroyed ? 0 : (e.storage.characterCount?.words?.() ?? 0),
      characters: e.isDestroyed ? 0 : (e.storage.characterCount?.characters?.() ?? 0),
    }),
  }) ?? { words: 0, characters: 0 }

  if (distractionFree) return null

  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-surface/60 px-5 py-1.5 text-xs text-muted">
      <div className="flex items-center gap-4">
        <span>{formatNumber(counts.words)} words</span>
        <span className="hidden sm:inline">{formatNumber(counts.characters)} chars</span>
        <span className="hidden sm:inline">{formatReadingTime(readingMinutes(counts.words))} read</span>
        <span className="hidden md:inline">{pageEstimate(counts.words).toFixed(1)} pages</span>
      </div>
      <div className="flex items-center gap-1.5">
        {saving ? (
          <>
            <Loader2 size={13} className="animate-spin" /> Saving…
          </>
        ) : (
          <>
            <Check size={13} className="text-success" /> Saved
          </>
        )}
      </div>
    </div>
  )
}
