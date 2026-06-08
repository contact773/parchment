import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookPlus, EyeOff, Loader2 } from 'lucide-react'
import type { LanguageCode } from '@/types'
import { spellService } from './spellService'

export function SpellPopover({
  target,
  language,
  onReplace,
  onAdd,
  onIgnore,
  onClose,
}: {
  target: { word: string; x: number; y: number }
  language: LanguageCode
  onReplace: (s: string) => void
  onAdd: () => void
  onIgnore: () => void
  onClose: () => void
}) {
  const [suggestions, setSuggestions] = useState<string[] | null>(null)

  useEffect(() => {
    let active = true
    setSuggestions(null)
    spellService.suggest(language, target.word).then((s) => active && setSuggestions(s))
    return () => {
      active = false
    }
  }, [target.word, language])

  const left = Math.max(8, Math.min(target.x, window.innerWidth - 248))
  const top = Math.min(target.y + 6, window.innerHeight - 220)

  return createPortal(
    <div
      className="fixed z-50 w-60 animate-scale-in overflow-hidden rounded-lg border border-border bg-surface shadow-panel"
      style={{ top, left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="border-b border-border px-3 py-2">
        <div className="text-[11px] uppercase tracking-wide text-muted">Spelling</div>
        <div className="truncate text-sm font-medium text-danger">{target.word}</div>
      </div>
      <div className="max-h-44 overflow-y-auto py-1">
        {suggestions === null ? (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" /> Finding suggestions…
          </div>
        ) : suggestions.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted">No suggestions</div>
        ) : (
          suggestions.map((s) => (
            <button key={s} className="menu-item font-medium" onClick={() => onReplace(s)}>
              {s}
            </button>
          ))
        )}
      </div>
      <div className="border-t border-border p-1">
        <button className="menu-item" onClick={onAdd}>
          <BookPlus size={15} /> Add to dictionary
        </button>
        <button className="menu-item" onClick={onIgnore}>
          <EyeOff size={15} /> Ignore word
        </button>
      </div>
      <button className="sr-only" onClick={onClose}>
        close
      </button>
    </div>,
    document.body,
  )
}
