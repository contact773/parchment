import { useState } from 'react'
import { Plus, GripVertical, MoreHorizontal, LayoutGrid } from 'lucide-react'
import type { Project, TreeNode } from '@/types'
import { createNode, updateNode, moveNode, duplicateNode, deleteNode, isContainer } from '@/data/repo'
import { NODE_STATUSES, NODE_STATUS_ORDER } from '@/lib/constants'
import { AutoTextarea } from '@/components/ui/Auto'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { EmptyState } from '@/components/ui/misc'
import { NodeIcon } from '@/features/projects/nodeIcons'
import { formatCompact } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useUI } from '@/store/useUI'

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
  const toast = useUI((s) => s.toast)
  const cards = nodes.filter((n) => n.parentId === rootId).sort((a, b) => a.order - b.order)
  const [drag, setDrag] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; before: boolean } | null>(null)

  const addCard = async () => {
    const node = await createNode({ projectId: project.id, parentId: rootId, type: 'scene', docType: project.defaultDocType })
    onOpen(node)
  }

  const handleDrop = async (targetId: string) => {
    const dt = dropTarget
    const dragId = drag
    setDrag(null)
    setDropTarget(null)
    if (!dragId || !dt || dragId === targetId) return
    // Index against the full ordered sibling list (minus the dragged card) so it
    // matches what moveNode/normalizeOrders reorder.
    const siblings = nodes.filter((n) => n.parentId === rootId && n.id !== dragId).sort((a, b) => a.order - b.order)
    const idx = siblings.findIndex((s) => s.id === targetId)
    if (idx === -1) return
    await moveNode(dragId, rootId, dt.before ? idx : idx + 1)
  }

  return (
    <div className="mx-auto h-full w-full max-w-6xl overflow-y-auto px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl font-semibold text-ink">{rootTitle}</h2>
          <p className="text-sm text-muted">
            {cards.length} card{cards.length === 1 ? '' : 's'} · drag the handle to reorder
          </p>
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
            const isDrop = dropTarget?.id === card.id
            return (
              <div
                key={card.id}
                onDragOver={(e) => {
                  if (!drag || drag === card.id) return
                  e.preventDefault()
                  const r = e.currentTarget.getBoundingClientRect()
                  setDropTarget({ id: card.id, before: e.clientX < r.left + r.width / 2 })
                }}
                onDragLeave={() => setDropTarget((d) => (d?.id === card.id ? null : d))}
                onDrop={() => handleDrop(card.id)}
                className={cn(
                  'group relative flex h-52 flex-col rounded-lg border border-border bg-surface shadow-soft transition-shadow hover:shadow-panel',
                  drag === card.id && 'opacity-40',
                )}
                style={{ borderTopColor: status.color, borderTopWidth: 3 }}
              >
                {isDrop && (
                  <span
                    className={cn(
                      'pointer-events-none absolute bottom-1 top-1 w-1 rounded-full bg-accent',
                      dropTarget?.before ? '-left-2.5' : '-right-2.5',
                    )}
                  />
                )}
                <div className="flex items-center gap-1.5 px-2 pt-2">
                  <span
                    draggable
                    onDragStart={(e) => {
                      setDrag(card.id)
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', card.id)
                    }}
                    onDragEnd={() => {
                      setDrag(null)
                      setDropTarget(null)
                    }}
                    className="cursor-grab text-muted/50 opacity-0 transition-opacity hover:text-muted group-hover:opacity-100 active:cursor-grabbing"
                    title="Drag to reorder"
                  >
                    <GripVertical size={15} />
                  </span>
                  <button onClick={() => onOpen(card)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <NodeIcon type={card.type} size={14} className="shrink-0 text-muted" />
                    <span className="truncate text-sm font-semibold text-text group-hover:text-accent">{card.title}</span>
                  </button>
                  <Menu
                    align="end"
                    width={170}
                    items={[
                      { label: 'Open', onClick: () => onOpen(card) },
                      { label: 'Duplicate', onClick: () => duplicateNode(card.id) },
                      { separator: true, label: '' },
                      {
                        label: 'Move to Trash',
                        danger: true,
                        onClick: async () => {
                          await deleteNode(card.id)
                          toast('Moved to Trash', 'info')
                        },
                      },
                    ]}
                    trigger={({ toggle, ref }) => (
                      <button
                        ref={ref}
                        onClick={toggle}
                        className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:bg-border/50 group-hover:opacity-100"
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    )}
                  />
                </div>
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
