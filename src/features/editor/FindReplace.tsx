import { useEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown, X, Replace, CaseSensitive } from 'lucide-react'
import { getActiveEditor, subscribeActiveEditor } from './activeEditor'
import { searchKey } from './SearchExtension'
import { useUI } from '@/store/useUI'
import { cn } from '@/lib/utils'

export function FindReplace() {
  const open = useUI((s) => s.findOpen)
  const setOpen = useUI((s) => s.setFindOpen)
  const [term, setTerm] = useState('')
  const [replacement, setReplacement] = useState('')
  const [showReplace, setShowReplace] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [, force] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Re-render when the active editor or its transactions change.
  useEffect(() => {
    let off = () => {}
    const attach = () => {
      const e = getActiveEditor()
      if (!e) return
      const handler = () => force((n) => n + 1)
      e.on('transaction', handler)
      off = () => e.off('transaction', handler)
    }
    attach()
    const unsub = subscribeActiveEditor(() => {
      off()
      attach()
      force((n) => n + 1)
    })
    return () => {
      off()
      unsub()
    }
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30)
    else {
      getActiveEditor()?.commands.setSearchTerm('')
    }
  }, [open])

  useEffect(() => {
    getActiveEditor()?.commands.setSearchTerm(term, caseSensitive)
  }, [term, caseSensitive])

  const editor = getActiveEditor()
  const state = editor ? searchKey.getState(editor.state) : null
  const total = state?.matches.length ?? 0
  const current = total ? (state?.active ?? 0) + 1 : 0

  const scrollToActive = () =>
    requestAnimationFrame(() => document.querySelector('.search-active')?.scrollIntoView({ block: 'center', behavior: 'smooth' }))

  const next = () => {
    editor?.commands.searchNext()
    scrollToActive()
  }
  const prev = () => {
    editor?.commands.searchPrev()
    scrollToActive()
  }

  if (!open) return null

  return (
    <div className="absolute right-5 top-3 z-30 flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-2 shadow-panel animate-fade-in">
      <div className="flex items-center gap-1.5">
        <button onClick={() => setShowReplace((v) => !v)} className="text-muted hover:text-text" title="Toggle replace">
          <ChevronDown size={14} className={cn('transition-transform', showReplace && 'rotate-180')} />
        </button>
        <input
          ref={inputRef}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.shiftKey ? prev() : next())
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="Find"
          className="h-8 w-44 rounded-md border border-border bg-surface-2 px-2 text-sm outline-none focus:border-accent/50"
        />
        <span className="w-14 text-center text-[11px] tabular-nums text-muted">{total ? `${current}/${total}` : 'none'}</span>
        <button onClick={() => setCaseSensitive((v) => !v)} title="Match case" className={cn('flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-surface-2', caseSensitive && 'bg-accent/15 text-accent')}>
          <CaseSensitive size={15} />
        </button>
        <button onClick={prev} disabled={!total} className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-surface-2 disabled:opacity-40">
          <ChevronUp size={15} />
        </button>
        <button onClick={next} disabled={!total} className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-surface-2 disabled:opacity-40">
          <ChevronDown size={15} />
        </button>
        <button onClick={() => setOpen(false)} className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-surface-2">
          <X size={15} />
        </button>
      </div>
      {showReplace && (
        <div className="flex items-center gap-1.5 pl-5">
          <input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            placeholder="Replace with"
            className="h-8 w-44 rounded-md border border-border bg-surface-2 px-2 text-sm outline-none focus:border-accent/50"
          />
          <button
            onClick={() => {
              editor?.commands.replaceCurrent(replacement)
              scrollToActive()
            }}
            disabled={!total}
            className="flex h-7 items-center gap-1 rounded border border-border px-2 text-xs text-muted hover:bg-surface-2 disabled:opacity-40"
          >
            <Replace size={13} /> One
          </button>
          <button
            onClick={() => editor?.commands.replaceAllMatches(replacement)}
            disabled={!total}
            className="flex h-7 items-center gap-1 rounded border border-border px-2 text-xs text-muted hover:bg-surface-2 disabled:opacity-40"
          >
            All
          </button>
        </div>
      )}
    </div>
  )
}
