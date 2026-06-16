import { useState } from 'react'
import type { Project, TreeNode } from '@/types'
import { orderedDocuments } from '@/lib/tree'
import { NODE_STATUSES } from '@/lib/constants'
import { formatCompact } from '@/lib/format'
import { Clock } from 'lucide-react'
import { EmptyState, Segmented } from '@/components/ui/misc'

export function TimelineView({
  project,
  nodes,
  onOpen,
}: {
  project: Project
  nodes: TreeNode[]
  onOpen: (node: TreeNode) => void
}) {
  const [sort, setSort] = useState<'reading' | 'date'>('reading')
  const reading = orderedDocuments(nodes, false)
  // "By date" keeps reading order as the tiebreaker and pushes undated scenes last.
  const docs =
    sort === 'date'
      ? [...reading].sort((a, b) => {
          const da = a.node.meta.date?.trim() ?? ''
          const db_ = b.node.meta.date?.trim() ?? ''
          if (!da && !db_) return 0
          if (!da) return 1
          if (!db_) return -1
          return da.localeCompare(db_, undefined, { numeric: true, sensitivity: 'base' })
        })
      : reading

  return (
    <div className="mx-auto h-full w-full max-w-3xl overflow-y-auto px-6 py-6">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold text-ink">
            <Clock size={20} /> Timeline
          </h2>
          <p className="text-sm text-muted">{project.title} · {sort === 'date' ? 'by in-world date' : 'scenes in reading order'}</p>
        </div>
        <Segmented
          size="sm"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'reading', label: 'Reading order' },
            { value: 'date', label: 'By date' },
          ]}
        />
      </div>

      {docs.length === 0 ? (
        <EmptyState icon={<Clock size={36} />} title="No scenes yet" description="Add scenes to see them on the timeline." />
      ) : (
        <ol className="relative ml-3 border-l-2 border-border">
          {docs.map(({ node }) => {
            const status = NODE_STATUSES[node.status] ?? NODE_STATUSES.idea
            return (
              <li key={node.id} className="relative mb-5 pl-6">
                <span
                  className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-bg"
                  style={{ backgroundColor: status.color }}
                />
                <button onClick={() => onOpen(node)} className="text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-text hover:text-accent">{node.title}</span>
                    {node.meta.date && (
                      <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">{node.meta.date}</span>
                    )}
                    {node.meta.label && (
                      <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">{node.meta.label}</span>
                    )}
                  </div>
                  {node.synopsis && <p className="mt-0.5 max-w-xl text-xs text-muted">{node.synopsis}</p>}
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-muted/80">
                    <span style={{ color: status.color }}>{status.label}</span>
                    {node.meta.pov && <span>POV: {node.meta.pov}</span>}
                    {node.wordCount > 0 && <span>{formatCompact(node.wordCount)} words</span>}
                  </div>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
