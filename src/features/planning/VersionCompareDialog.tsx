import { useMemo } from 'react'
import { diffWords } from 'diff'
import { RotateCcw } from 'lucide-react'
import type { Snapshot } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { timeAgo } from '@/lib/format'

export function VersionCompareDialog({
  open,
  snapshot,
  currentText,
  onClose,
  onRestore,
}: {
  open: boolean
  snapshot: Snapshot | null
  currentText: string
  onClose: () => void
  onRestore: () => void
}) {
  const parts = useMemo(() => (snapshot ? diffWords(snapshot.text || '', currentText || '') : []), [snapshot, currentText])
  const added = parts.filter((p) => p.added).reduce((n, p) => n + p.value.trim().split(/\s+/).filter(Boolean).length, 0)
  const removed = parts.filter((p) => p.removed).reduce((n, p) => n + p.value.trim().split(/\s+/).filter(Boolean).length, 0)

  return (
    <Modal
      open={open && !!snapshot}
      onClose={onClose}
      title="Compare versions"
      description={snapshot ? `Snapshot from ${timeAgo(snapshot.createdAt)} → current draft` : undefined}
      size="xl"
      footer={
        <>
          <div className="mr-auto flex items-center gap-3 text-xs">
            <span className="text-success">+{added} added</span>
            <span className="text-danger">−{removed} removed</span>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" onClick={onRestore}>
            <RotateCcw size={15} /> Restore this version
          </Button>
        </>
      }
    >
      <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-surface-2/30 p-4 font-serif text-[15px] leading-relaxed">
        {parts.map((p, i) =>
          p.added ? (
            <span key={i} className="rounded bg-success/20 text-ink">
              {p.value}
            </span>
          ) : p.removed ? (
            <span key={i} className="rounded bg-danger/15 text-danger line-through">
              {p.value}
            </span>
          ) : (
            <span key={i} className="text-ink/80">
              {p.value}
            </span>
          ),
        )}
      </div>
    </Modal>
  )
}
