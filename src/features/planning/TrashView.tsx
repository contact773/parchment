import { useLiveQuery } from 'dexie-react-hooks'
import { Trash2, RotateCcw, X } from 'lucide-react'
import { db } from '@/data/db'
import { restoreNode, hardDeleteNode } from '@/data/repo'
import { NodeIcon } from '@/features/projects/nodeIcons'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { EmptyState } from '@/components/ui/misc'
import { timeAgo } from '@/lib/format'
import { useUI } from '@/store/useUI'

export function TrashView({ projectId }: { projectId: string }) {
  const toast = useUI((s) => s.toast)
  const trashed =
    useLiveQuery(
      () => db.nodes.where('projectId').equals(projectId).filter((n) => !!n.deletedAt).toArray(),
      [projectId],
    ) ?? []

  const emptyTrash = async () => {
    if (!trashed.length) return
    if (!confirm(`Permanently delete ${trashed.length} item(s)? This cannot be undone.`)) return
    for (const n of trashed) await hardDeleteNode(n.id)
    toast('Trash emptied', 'info')
  }

  return (
    <div className="mx-auto h-full w-full max-w-3xl overflow-y-auto px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold text-ink">
            <Trash2 size={20} /> Trash
          </h2>
          <p className="text-sm text-muted">Deleted documents are kept here until you remove them for good.</p>
        </div>
        {trashed.length > 0 && (
          <Button variant="danger" onClick={emptyTrash}>
            <X size={15} /> Empty trash
          </Button>
        )}
      </div>

      {trashed.length === 0 ? (
        <EmptyState icon={<Trash2 size={36} />} title="Trash is empty" description="Deleted scenes and chapters will appear here, ready to restore." />
      ) : (
        <div className="space-y-1.5">
          {trashed.map((n) => (
            <div key={n.id} className="group flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
              <NodeIcon type={n.type} size={15} className="shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{n.title}</div>
                <div className="text-[11px] text-muted">Deleted {n.deletedAt ? timeAgo(n.deletedAt) : ''}</div>
              </div>
              <IconButton size="sm" label="Restore" onClick={async () => { await restoreNode(n.id); toast('Restored', 'success') }}>
                <RotateCcw size={15} />
              </IconButton>
              <IconButton size="sm" label="Delete forever" className="text-danger" onClick={() => hardDeleteNode(n.id)}>
                <Trash2 size={15} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
