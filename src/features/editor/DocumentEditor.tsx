import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import { Check, Loader2 } from 'lucide-react'
import type { Project, TreeNode } from '@/types'
import { buildExtensions } from './extensions'
import { EditorToolbar } from './EditorToolbar'
import { CommentDialog } from './CommentDialog'
import { SpellPopover } from '../spellcheck/SpellPopover'
import { spellcheckKey, misspellingAt, type Misspelling } from '../spellcheck/SpellcheckExtension'
import { spellService } from '../spellcheck/spellService'
import { saveNodeContent, renameNode, emptyDoc } from '@/data/repo'
import { useSettings } from '@/store/useSettings'
import { useUI } from '@/store/useUI'
import { debounce } from '@/lib/utils'
import { formatReadingTime, readingMinutes, pageEstimate } from '@/lib/text'
import { formatNumber } from '@/lib/format'
import { BUILTIN_THEMES, findBuiltin } from '@/features/themes/themes'
import { cn } from '@/lib/utils'

interface SpellTarget extends Misspelling {
  x: number
  y: number
}
interface CommentView {
  text: string
  x: number
  y: number
}

export function DocumentEditor({ node, project }: { node: TreeNode; project: Project }) {
  const settings = useSettings((s) => s.settings)
  const dictionary = useSettings((s) => s.dictionary)
  const addDictWord = useSettings((s) => s.addDictWord)
  const ignoreWordStore = useSettings((s) => s.ignoreWord)
  const recordWordCount = useSettings((s) => s.recordWordCount)
  const indent = useSettings((s) => {
    const t =
      s.customThemes.find((x) => x.id === s.settings.activeThemeId) ??
      findBuiltin(s.settings.activeThemeId) ??
      BUILTIN_THEMES[0]
    return t.typography.paragraphIndent
  })

  const { addSessionWords, setSaving, markSaved, editorZoom } = useUI()
  const distractionFree = useUI((s) => s.distractionFree)

  const language = project.language
  const focusActive = settings.focusMode !== 'off'
  const typewriter = settings.typewriterMode || settings.focusMode === 'typewriter'

  const scrollRef = useRef<HTMLDivElement>(null)
  const [spell, setSpell] = useState<SpellTarget | null>(null)
  const [commentView, setCommentView] = useState<CommentView | null>(null)
  const [commentOpen, setCommentOpen] = useState(false)
  const [title, setTitle] = useState(node.title)

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
              : 'Begin writing…',
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
          // Detect a comment mark at the click position.
          const $pos = view.state.doc.resolve(Math.min(pos, view.state.doc.content.size))
          const mark = $pos.marks().find((m) => m.type.name === 'comment')
          if (mark) {
            const coords = view.coordsAtPos(pos)
            setCommentView({ text: String(mark.attrs.text || ''), x: coords.left, y: coords.bottom })
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
    // Rebuild when switching documents or toggling structural editor options.
    [node.id, language, settings.spellcheckEnabled, focusActive, node.docType],
  )

  // ── Title editing ─────────────────────────────────────────────────────
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
        /* position not in view yet */
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

  const replaceWord = (suggestion: string) => {
    if (!editor || !spell) return
    editor.chain().focus().insertContentAt({ from: spell.from, to: spell.to }, suggestion).run()
    setSpell(null)
  }
  const onAddWord = () => {
    if (!spell) return
    addDictWord(language, spell.word)
    spellService.addWord(language, spell.word)
    refreshSpell()
    setSpell(null)
  }
  const onIgnoreWord = () => {
    if (!spell) return
    ignoreWordStore(language, spell.word)
    spellService.ignore(language, spell.word)
    refreshSpell()
    setSpell(null)
  }

  // ── Comments ──────────────────────────────────────────────────────────
  const openComment = () => {
    if (!editor) return
    if (editor.state.selection.empty) {
      useUI.getState().toast('Select some text to comment on', 'info')
      return
    }
    setCommentOpen(true)
  }
  const addComment = (text: string) => {
    editor?.chain().focus().setComment(text).run()
    setCommentOpen(false)
  }

  return (
    <div className="flex h-full flex-col">
      {!distractionFree && editor && (
        <div className="shrink-0 px-4 pb-2 pt-3">
          <EditorToolbar editor={editor} docType={node.docType} onComment={openComment} />
        </div>
      )}

      <div
        ref={scrollRef}
        className={cn(
          'relative flex-1 overflow-y-auto px-4 pb-32',
          distractionFree && 'pt-[12vh]',
        )}
        onMouseDown={() => {
          setSpell(null)
          setCommentView(null)
        }}
      >
        <div
          className={cn('pm-editor mx-auto w-full', indent && node.docType !== 'script' && 'indent', focusActive && 'focus-active')}
          style={{
            maxWidth: 'var(--editor-width)',
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
            onReplace={replaceWord}
            onAdd={onAddWord}
            onIgnore={onIgnoreWord}
            onClose={() => setSpell(null)}
          />
        )}
        {commentView && (
          <div
            className="fixed z-50 max-w-xs animate-scale-in rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text shadow-panel"
            style={{ top: commentView.y + 6, left: Math.max(8, commentView.x) }}
          >
            <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">Comment</div>
            {commentView.text || <span className="text-muted">No note</span>}
          </div>
        )}
      </div>

      {editor && <EditorStatusBar editor={editor} />}

      <CommentDialog open={commentOpen} onClose={() => setCommentOpen(false)} onSubmit={addComment} />
    </div>
  )
}

function EditorStatusBar({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const saving = useUI((s) => s.saving)
  const distractionFree = useUI((s) => s.distractionFree)
  const counts = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      // Guard against a destroyed/initializing editor (StrictMode remount race)
      // where storage may briefly be unavailable.
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
