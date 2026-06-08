import type { Project, TreeNode } from '@/types'
import { buildForest, flattenForest } from '@/lib/tree'
import { NODE_STATUSES } from '@/lib/constants'
import { NodeIcon } from '@/features/projects/nodeIcons'
import { formatCompact } from '@/lib/format'
import { isContainer } from '@/data/repo'
import { ListTree } from 'lucide-react'
import { EmptyState } from '@/components/ui/misc'

export function OutlineView({
  project,
  nodes,
  onOpen,
}: {
  project: Project
  nodes: TreeNode[]
  onOpen: (node: TreeNode) => void
}) {
  const flat = flattenForest(buildForest(nodes))

  return (
    <div className="mx-auto h-full w-full max-w-4xl overflow-y-auto px-6 py-6">
      <div className="mb-5">
        <h2 className="font-serif text-2xl font-semibold text-ink">Outline</h2>
        <p className="text-sm text-muted">{project.title} · birds-eye view</p>
      </div>

      {flat.length === 0 ? (
        <EmptyState icon={<ListTree size={36} />} title="Nothing to outline yet" description="Add chapters and scenes to your manuscript." />
      ) : (
        <div className="space-y-0.5">
          {flat.map(({ node, depth }) => {
            const status = NODE_STATUSES[node.status] ?? NODE_STATUSES.idea
            const container = isContainer(node.type)
            return (
              <button
                key={node.id}
                onClick={() => onOpen(node)}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-2"
                style={{ paddingLeft: depth * 18 + 12 }}
              >
                <NodeIcon type={node.type} size={15} className="mt-0.5 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={container ? 'font-serif text-base font-semibold text-ink' : 'text-sm font-medium text-text'}>
                      {node.title}
                    </span>
                    {node.meta.label && (
                      <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">{node.meta.label}</span>
                    )}
                  </div>
                  {node.synopsis && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{node.synopsis}</p>}
                  {(node.meta.pov || node.meta.goal) && (
                    <p className="mt-0.5 text-[11px] text-muted/80">
                      {node.meta.pov && <span className="mr-2">POV: {node.meta.pov}</span>}
                      {node.meta.goal && <span>Goal: {node.meta.goal}</span>}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  {!container && node.wordCount > 0 && (
                    <span className="text-[11px] tabular-nums text-muted">{formatCompact(node.wordCount)}</span>
                  )}
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} title={status.label} />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
