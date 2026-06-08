import { useLiveQuery } from 'dexie-react-hooks'
import { History, Camera, RotateCcw, Trash2 } from 'lucide-react'
import type { Snapshot, TreeNode } from '@/types'
import { db } from '@/data/db'
import { createSnapshot, deleteSnapshot, restoreSnapshot } from '@/data/repo'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { EmptyState } from '@/components/ui/misc'
import { timeAgo, formatNumber } from '@/lib/format'
import { useUI } from '@/store/useUI'

export function SnapshotsPanel({ node }: { node: TreeNode | null }) {
  const toast = useUI((s) => s.toast)
  const snapshots =
    useLiveQuery(
      () => (node ? db.snapshots.where('nodeId').equals(node.id).reverse().sortBy('createdAt') : Promise.resolve<Snapshot[]>([])),
      [node?.id],
    ) ?? []

  if (!node) {
    return (
      <EmptyState
        className="h-full"
        icon={<History size={32} />}
        title="No document selected"
        description="Snapshots capture a version of a document you can restore later."
      />
    )
  }

  const take = async () => {
    await createSnapshot(node.id, 'Manual snapshot', false)
    toast('Snapshot saved', 'success')
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-sm font-semibold">Version history</span>
        <Button size="sm" variant="secondary" onClick={take}>
          <Camera size={14} /> Snapshot
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {snapshots.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted">
            No snapshots yet. Take one before a big revision — Parchment also snapshots automatically before a restore.
          </p>
        ) : (
          <div className="space-y-1.5">
            {snapshots.map((s) => (
              <div key={s.id} className="group rounded-lg border border-border bg-surface px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{s.label}</span>
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <IconButton
                      size="sm"
                      label="Restore this version"
                      onClick={async () => {
                        await restoreSnapshot(s.id)
                        toast('Version restored', 'success')
                      }}
                    >
                      <RotateCcw size={14} />
                    </IconButton>
                    <IconButton size="sm" label="Delete snapshot" onClick={() => deleteSnapshot(s.id)}>
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                  <span>{timeAgo(s.createdAt)}</span>
                  <span>·</span>
                  <span>{formatNumber(s.wordCount)} words</span>
                  {s.auto && <span className="rounded-full bg-surface-2 px-1.5 py-0.5">auto</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
