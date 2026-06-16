import { useRef, useState } from 'react'
import type { Project, TreeNode } from '@/types'
import { buildForest, flattenForest } from '@/lib/tree'
import { NODE_STATUSES } from '@/lib/constants'
import { NodeIcon } from '@/features/projects/nodeIcons'
import { formatCompact } from '@/lib/format'
import { isContainer, moveNode, renameNode, updateNode } from '@/data/repo'
import { ListTree, GripVertical } from 'lucide-react'
import { AutoTextarea } from '@/components/ui/Auto'
import { EmptyState } from '@/components/ui/misc'
import { cn } from '@/lib/utils'

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
  const [drag, setDrag] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; before: boolean } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const cancelRename = useRef(false)

  const handleDrop = async (targetId: string) => {
    const dt = dropTarget
    const dragId = drag
    setDrag(null)
    setDropTarget(null)
    if (!dragId || !dt || dragId === targetId) return
    const target = nodes.find((n) => n.id === targetId)
    if (!target) return
    // Reorder as a sibling of the drop target (moveNode guards against cycles).
    const siblings = nodes.filter((n) => n.parentId === target.parentId && n.id !== dragId).sort((a, b) => a.order - b.order)
    const idx = siblings.findIndex((s) => s.id === targetId)
    if (idx === -1) return
    await moveNode(dragId, target.parentId, dt.before ? idx : idx + 1)
  }

  return (
    <div className="mx-auto h-full w-full max-w-4xl overflow-y-auto px-6 py-6">
      <div className="mb-5">
        <h2 className="font-serif text-2xl font-semibold text-ink">Outline</h2>
        <p className="text-sm text-muted">{project.title} · drag to restructure · double-click a title to rename</p>
      </div>

      {flat.length === 0 ? (
        <EmptyState icon={<ListTree size={36} />} title="Nothing to outline yet" description="Add chapters and scenes to your manuscript." />
      ) : (
        <div className="space-y-0.5">
          {flat.map(({ node, depth }) => {
            const status = NODE_STATUSES[node.status] ?? NODE_STATUSES.idea
            const container = isContainer(node.type)
            const isDrop = dropTarget?.id === node.id
            return (
              <div
                key={node.id}
                onDragOver={(e) => {
                  if (!drag || drag === node.id) return
                  e.preventDefault()
                  const r = e.currentTarget.getBoundingClientRect()
                  setDropTarget({ id: node.id, before: e.clientY < r.top + r.height / 2 })
                }}
                onDragLeave={() => setDropTarget((d) => (d?.id === node.id ? null : d))}
                onDrop={() => handleDrop(node.id)}
                className={cn(
                  'group relative flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2',
                  drag === node.id && 'opacity-40',
                )}
                style={{ paddingLeft: depth * 18 + 8 }}
              >
                {isDrop && (
                  <span
                    className={cn('pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-accent', dropTarget?.before ? 'top-0' : 'bottom-0')}
                  />
                )}
                <span
                  draggable
                  onDragStart={(e) => {
                    setDrag(node.id)
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', node.id)
                  }}
                  onDragEnd={() => {
                    setDrag(null)
                    setDropTarget(null)
                  }}
                  className="mt-0.5 cursor-grab text-muted/40 opacity-0 transition-opacity hover:text-muted group-hover:opacity-100 active:cursor-grabbing"
                  title="Drag to reorder"
                >
                  <GripVertical size={15} />
                </span>
                <NodeIcon type={node.type} size={15} className="mt-1 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {renaming === node.id ? (
                      <input
                        autoFocus
                        defaultValue={node.title}
                        onBlur={(e) => {
                          if (cancelRename.current) {
                            cancelRename.current = false
                            setRenaming(null)
                            return
                          }
                          renameNode(node.id, e.target.value.trim() || 'Untitled')
                          setRenaming(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                          if (e.key === 'Escape') {
                            cancelRename.current = true
                            ;(e.target as HTMLInputElement).blur()
                          }
                        }}
                        className="min-w-0 flex-1 rounded border border-accent/50 bg-surface px-1 py-0 text-sm outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => onOpen(node)}
                        onDoubleClick={() => setRenaming(node.id)}
                        className={cn(
                          'truncate text-left hover:text-accent',
                          container ? 'font-serif text-base font-semibold text-ink' : 'text-sm font-medium text-text',
                        )}
                        title="Click to open · double-click to rename"
                      >
                        {node.title}
                      </button>
                    )}
                    {node.meta.label && (
                      <span className="shrink-0 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">{node.meta.label}</span>
                    )}
                  </div>
                  <AutoTextarea
                    depKey={node.id}
                    rows={1}
                    value={node.synopsis ?? ''}
                    placeholder="Add a one-line synopsis…"
                    save={(v) => updateNode(node.id, { synopsis: v })}
                  />
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-1">
                  {!container && node.wordCount > 0 && (
                    <span className="text-[11px] tabular-nums text-muted">{formatCompact(node.wordCount)}</span>
                  )}
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} title={status.label} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
