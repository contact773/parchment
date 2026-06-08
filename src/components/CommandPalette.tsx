import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Search, CornerDownLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Command {
  id: string
  label: string
  hint?: string
  group: string
  icon?: ReactNode
  keywords?: string
  run: () => void
}

export function CommandPalette({ open, commands, onClose }: { open: boolean; commands: Command[]; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return commands
    return commands
      .map((c) => {
        const hay = `${c.label} ${c.group} ${c.keywords ?? ''}`.toLowerCase()
        const score = hay.includes(q) ? (c.label.toLowerCase().startsWith(q) ? 0 : 1) : 2
        return { c, score }
      })
      .filter((x) => x.score < 2)
      .sort((a, b) => a.score - b.score)
      .map((x) => x.c)
  }, [query, commands])

  if (!open) return null

  const run = (c?: Command) => {
    if (!c) return
    onClose()
    c.run()
  }

  // Group in first-appearance order; `ordered` is the flat render order so the
  // visual highlight and keyboard selection always reference the same command.
  const groups: { name: string; items: Command[] }[] = []
  for (const c of filtered) {
    let g = groups.find((x) => x.name === c.group)
    if (!g) {
      g = { name: c.group, items: [] }
      groups.push(g)
    }
    g.items.push(c)
  }
  const ordered = groups.flatMap((g) => g.items)
  const activeIndex = Math.min(index, Math.max(0, ordered.length - 1))
  let flatIdx = -1

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]" onMouseDown={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in" />
      <div
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-panel animate-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search size={17} className="text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIndex(0)
            }}
            placeholder="Search actions, documents…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIndex((i) => Math.min(ordered.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIndex((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                run(ordered[activeIndex])
              } else if (e.key === 'Escape') {
                onClose()
              }
            }}
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted">No matches</div>
          ) : (
            groups.map((g) => (
              <div key={g.name} className="mb-1.5">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted/60">{g.name}</div>
                {g.items.map((c) => {
                  flatIdx++
                  const active = flatIdx === activeIndex
                  const myIdx = flatIdx
                  return (
                    <button
                      key={c.id}
                      onMouseMove={() => setIndex(myIdx)}
                      onClick={() => run(c)}
                      className={cn('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm', active ? 'bg-accent/15 text-accent' : 'hover:bg-surface-2')}
                    >
                      {c.icon && <span className={cn('shrink-0', active ? 'text-accent' : 'text-muted')}>{c.icon}</span>}
                      <span className="flex-1 truncate">{c.label}</span>
                      {c.hint && <span className="truncate text-[11px] text-muted">{c.hint}</span>}
                      {active && <CornerDownLeft size={13} className="text-accent" />}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
