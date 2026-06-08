import { Loader2, Replace, CornerDownLeft, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Markdownish } from '../story-assistant/Markdownish'
import type { TransformResult } from '../story-assistant/providers'

export function SelectionResultDialog({
  open,
  label,
  loading,
  result,
  providerLabel,
  onReplace,
  onInsert,
  onClose,
}: {
  open: boolean
  label: string
  loading: boolean
  result: TransformResult | null
  providerLabel: string
  onReplace: (text: string) => void
  onInsert: (text: string) => void
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const replacement = result?.replacement
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={label}
      description={loading ? `${providerLabel} is working…` : undefined}
      size="lg"
      footer={
        replacement ? (
          <>
            <Button variant="ghost" onClick={() => copy(replacement)}>
              {copied ? <Check size={15} /> : <Copy size={15} />} Copy
            </Button>
            <Button variant="secondary" onClick={() => onInsert(replacement)}>
              <CornerDownLeft size={15} /> Insert below
            </Button>
            <Button variant="primary" onClick={() => onReplace(replacement)}>
              <Replace size={15} /> Replace selection
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-muted">
          <Loader2 size={16} className="animate-spin" /> Thinking…
        </div>
      ) : result ? (
        <div className="space-y-3">
          {result.message && <Markdownish text={result.message} />}
          {replacement && (
            <div className="rounded-lg border border-border bg-surface-2/40 p-4 font-serif text-[15px] leading-relaxed text-ink">
              {replacement}
            </div>
          )}
          {result.options && result.options.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.options.map((o) => (
                <button
                  key={o}
                  onClick={() => onReplace(o)}
                  className="rounded-full border border-border bg-surface px-3 py-1 text-sm hover:border-accent/60 hover:text-accent"
                >
                  {o}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  )
}
