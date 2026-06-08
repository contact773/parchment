import { Plus } from 'lucide-react'
import type { NodeType, Project, TreeNode } from '@/types'
import { createNode } from '@/data/repo'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { NodeIcon } from '@/features/projects/nodeIcons'
import { Paperclip, StickyNote } from 'lucide-react'

export function NodeBoard({
  project,
  nodes,
  types,
  title,
  description,
  onOpen,
}: {
  project: Project
  nodes: TreeNode[]
  types: NodeType[]
  title: string
  description: string
  onOpen: (node: TreeNode) => void
}) {
  const items = nodes.filter((n) => types.includes(n.type) && !n.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt)
  const isResearch = types.includes('research')

  const add = async () => {
    const node = await createNode({ projectId: project.id, parentId: null, type: types[0], docType: 'prose' })
    onOpen(node)
  }

  return (
    <div className="mx-auto h-full w-full max-w-5xl overflow-y-auto px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold text-ink">
            {isResearch ? <Paperclip size={20} /> : <StickyNote size={20} />} {title}
          </h2>
          <p className="text-sm text-muted">{description}</p>
        </div>
        <Button variant="primary" onClick={add}>
          <Plus size={16} /> New {isResearch ? 'research' : 'note'}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={isResearch ? <Paperclip size={36} /> : <StickyNote size={36} />}
          title={`No ${isResearch ? 'research' : 'notes'} yet`}
          description={`Collect ${isResearch ? 'reference material and research' : 'ideas, reminders and notes'} here.`}
          action={<Button variant="primary" onClick={add}><Plus size={16} /> New {isResearch ? 'research' : 'note'}</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => onOpen(n)}
              className="group flex h-40 flex-col rounded-lg border border-border bg-surface p-4 text-left shadow-soft transition-shadow hover:shadow-panel"
            >
              <div className="mb-2 flex items-center gap-2">
                <NodeIcon type={n.type} size={15} className="text-muted" />
                <span className="truncate text-sm font-semibold text-text group-hover:text-accent">{n.title}</span>
              </div>
              <p className="line-clamp-5 flex-1 text-xs leading-relaxed text-muted">{n.synopsis || n.text?.slice(0, 240) || 'Empty'}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
