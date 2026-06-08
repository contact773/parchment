import { Plus } from 'lucide-react'
import type { Project, TreeNode } from '@/types'
import { createNode, updateNode, isContainer } from '@/data/repo'
import { NODE_STATUSES, NODE_STATUS_ORDER } from '@/lib/constants'
import { AutoTextarea } from '@/components/ui/Auto'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { NodeIcon } from '@/features/projects/nodeIcons'
import { formatCompact } from '@/lib/format'
import { LayoutGrid } from 'lucide-react'

export function Corkboard({
  project,
  nodes,
  rootId,
  rootTitle,
  onOpen,
}: {
  project: Project
  nodes: TreeNode[]
  rootId: string | null
  rootTitle: string
  onOpen: (node: TreeNode) => void
}) {
  const cards = nodes.filter((n) => n.parentId === rootId).sort((a, b) => a.order - b.order)

  const addCard = async () => {
    const node = await createNode({ projectId: project.id, parentId: rootId, type: 'scene', docType: project.defaultDocType })
    onOpen(node)
  }

  return (
    <div className="mx-auto h-full w-full max-w-6xl overflow-y-auto px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-ink">{rootTitle}</h2>
          <p className="text-sm text-muted">{cards.length} card{cards.length === 1 ? '' : 's'} · corkboard</p>
        </div>
        <Button variant="primary" onClick={addCard}>
          <Plus size={16} /> Add card
        </Button>
      </div>

      {cards.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid size={36} />}
          title="No cards here yet"
          description="Cards are scenes and chapters. Add one to start outlining on the board."
          action={
            <Button variant="primary" onClick={addCard}>
              <Plus size={16} /> Add card
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const status = NODE_STATUSES[card.status] ?? NODE_STATUSES.idea
            return (
              <div
                key={card.id}
                className="group flex h-52 flex-col rounded-lg border border-border bg-surface shadow-soft transition-shadow hover:shadow-panel"
                style={{ borderTopColor: status.color, borderTopWidth: 3 }}
              >
                <button
                  onClick={() => onOpen(card)}
                  className="flex items-center gap-2 px-3 pt-2.5 text-left"
                >
                  <NodeIcon type={card.type} size={14} className="shrink-0 text-muted" />
                  <span className="truncate text-sm font-semibold text-text group-hover:text-accent">{card.title}</span>
                </button>
                <div className="flex-1 px-1 pb-1">
                  <AutoTextarea
                    depKey={card.id}
                    value={card.synopsis ?? ''}
                    placeholder="What happens in this card…"
                    rows={4}
                    save={(v) => updateNode(card.id, { synopsis: v })}
                  />
                </div>
                <div className="flex items-center justify-between border-t border-border px-3 py-1.5 text-[11px] text-muted">
                  <select
                    value={card.status}
                    onChange={(e) => updateNode(card.id, { status: e.target.value as TreeNode['status'] })}
                    className="cursor-pointer rounded bg-transparent py-0.5 text-[11px] outline-none"
                    style={{ color: status.color }}
                  >
                    {NODE_STATUS_ORDER.map((s) => (
                      <option key={s} value={s} className="text-text">
                        {NODE_STATUSES[s].label}
                      </option>
                    ))}
                  </select>
                  <span>{isContainer(card.type) ? 'container' : `${formatCompact(card.wordCount)} words`}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
