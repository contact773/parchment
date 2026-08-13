import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useSettings } from '@/store/useSettings'
import { shouldNotify, skipVersion, useUpdates } from './updateService'

/**
 * The only thing an available update is allowed to do uninvited: a small card
 * in the corner, after the writer has already been working for a while.
 *
 * It appears once per session per version, sits outside the editor's writing
 * column, and offers three honest choices — read about it, not now, or never
 * for this version. It never covers the caret, never steals focus, and never
 * starts a download by itself.
 */
export function UpdateNotice() {
  const navigate = useNavigate()
  const state = useUpdates()
  const skipped = useSettings((s) => s.settings.updates.skippedVersion)
  const [dismissed, setDismissed] = useState<string | null>(null)

  const version = state.update?.version ?? null
  const visible = shouldNotify(state, skipped) && version !== null && dismissed !== version

  // A newer version than the one dismissed earlier this session is worth
  // showing again; the same one is not.
  useEffect(() => {
    if (version && dismissed && version !== dismissed) setDismissed(null)
  }, [version, dismissed])

  if (!visible) return null

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-[55] w-[19rem] animate-fade-up rounded-xl border border-border bg-surface p-4 shadow-panel"
    >
      <div className="flex items-start gap-2.5">
        <ArrowUpCircle size={18} className="mt-0.5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink">Parchment {version} is available</div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {state.status === 'ready'
              ? 'Downloaded and verified. Install it whenever you reach a good stopping point.'
              : 'Install it whenever you like — your work stays exactly where it is.'}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setDismissed(version)
                navigate('/settings?section=updates')
              }}
            >
              View update
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDismissed(version)}>
              Later
            </Button>
            <button
              onClick={() => skipVersion(version)}
              className="ml-auto text-[11px] text-muted underline underline-offset-2 hover:text-text"
            >
              Skip
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(version)}
          aria-label="Dismiss update notification"
          className="shrink-0 text-muted hover:text-text"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
