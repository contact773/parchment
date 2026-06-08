import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Plus, MoreHorizontal, CircleDot } from 'lucide-react'
import { db } from '@/data/db'
import {
  createNode,
  deleteNode,
  duplicateNode,
  renameNode,
  toggleCollapse,
  updateNode,
  moveNode,
  isContainer,
} from '@/data/repo'
import { buildForest, type TreeItem, subtreeWordCount } from '@/lib/tree'
import { NODE_STATUSES, NODE_STATUS_ORDER } from '@/lib/constants'
import type { DocType, NodeStatus, NodeType, Project, TreeNode } from '@/types'
import { NodeIcon } from './nodeIcons'
import { IconButton } from '@/components/ui/IconButton'
import { Menu, type MenuItem } from '@/components/ui/Menu'
import { cn } from '@/lib/utils'
import { formatCompact } from '@/lib/format'
import { useUI } from '@/store/useUI'

type DropPos = 'before' | 'after' | 'inside'

export function Binder({
  project,
  selectedId,
  onSelect,
}: {
  project: Project
  selectedId: string | null
  onSelect: (node: TreeNode) => void
}) {
  const nodes = useLiveQuery(() => db.nodes.where('projectId').equals(project.id).toArray(), [project.id]) ?? []
  const forest = buildForest(nodes)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [drag, setDrag] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; pos: DropPos } | null>(null)
  const toast = useUI((s) => s.toast)

  const addAtRoot = async (type: NodeType) => {
    const node = await createNode({ projectId: project.id, parentId: null, type, docType: project.defaultDocType })
    onSelect(node)
    setRenaming(node.id)
  }

  const addChild = async (parent: TreeNode, type: NodeType) => {
    if (parent.collapsed) await toggleCollapse(parent.id, false)
    const docType: DocType = parent.docType ?? project.defaultDocType
    const node = await createNode({ projectId: project.id, parentId: parent.id, type, docType })
    onSelect(node)
    setRenaming(node.id)
  }

  const handleDrop = async (targetId: string, pos: DropPos) => {
    if (!drag || drag === targetId) return
    const target = nodes.find((n) => n.id === targetId)
    if (!target) return
    let parentId: string | null
    let siblings: TreeNode[]
    if (pos === 'inside') {
      parentId = target.id
      siblings = nodes.filter((n) => n.parentId === target.id && n.id !== drag).sort((a, b) => a.order - b.order)
      await moveNode(drag, parentId, siblings.length)
    } else {
      parentId = target.parentId
      siblings = nodes.filter((n) => n.parentId === parentId && n.id !== drag).sort((a, b) => a.order - b.order)
      const idx = siblings.findIndex((s) => s.id === targetId)
      await moveNode(drag, parentId, pos === 'before' ? idx : idx + 1)
    }
    setDrag(null)
    setDropTarget(null)
  }

  const addMenu = (parent: TreeNode | null): MenuItem[] => {
    const fn = parent ? (t: NodeType) => addChild(parent, t) : addAtRoot
    return [
      { label: 'Chapter', icon: <NodeIcon type="chapter" size={15} />, onClick: () => fn('chapter') },
      { label: 'Scene', icon: <NodeIcon type="scene" size={15} />, onClick: () => fn('scene') },
      { label: 'Part / Act', icon: <NodeIcon type="part" size={15} />, onClick: () => fn('part') },
      { label: 'Folder', icon: <NodeIcon type="folder" size={15} />, onClick: () => fn('folder') },
      { separator: true, label: '' },
      { label: 'Note', icon: <NodeIcon type="note" size={15} />, onClick: () => fn('note') },
      { label: 'Research', icon: <NodeIcon type="research" size={15} />, onClick: () => fn('research') },
    ]
  }

  const rowMenu = (node: TreeNode): MenuItem[] => [
    { label: 'Rename', onClick: () => setRenaming(node.id) },
    { label: 'Add inside', onClick: () => addChild(node, isContainer(node.type) ? 'scene' : 'scene') },
    { label: 'Duplicate', onClick: () => duplicateNode(node.id) },
    { separator: true, label: '' },
    ...NODE_STATUS_ORDER.map((st) => ({
      label: `Status: ${NODE_STATUSES[st].label}`,
      icon: <CircleDot size={14} style={{ color: NODE_STATUSES[st].color }} />,
      onClick: () => updateNode(node.id, { status: st }),
    })),
    { separator: true, label: '' },
    {
      label: node.meta.includeInCompile === false ? 'Include in compile' : 'Exclude from compile',
      onClick: () => updateNode(node.id, { meta: { ...node.meta, includeInCompile: node.meta.includeInCompile === false } }),
    },
    { separator: true, label: '' },
    {
      label: 'Delete',
      danger: true,
      onClick: async () => {
        await deleteNode(node.id)
        toast('Deleted', 'info')
      },
    },
  ]

  const renderRow = (item: TreeItem, depth: number) => {
    const isSel = item.id === selectedId
    const container = isContainer(item.type) || item.children.length > 0
    const status = NODE_STATUSES[item.status as NodeStatus] ?? NODE_STATUSES.idea
    const wc = isContainer(item.type) ? subtreeWordCount(nodes, item.id) : item.wordCount
    const isDropTarget = dropTarget?.id === item.id

    return (
      <div key={item.id}>
        <div
          draggable={renaming !== item.id}
          onDragStart={(e) => {
            setDrag(item.id)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={(e) => {
            e.preventDefault()
            const r = e.currentTarget.getBoundingClientRect()
            const y = e.clientY - r.top
            const canInside = isContainer(item.type) || item.children.length > 0
            let pos: DropPos = 'after'
            if (y < r.height * 0.3) pos = 'before'
            else if (canInside && y < r.height * 0.7) pos = 'inside'
            else pos = y < r.height * 0.5 ? 'before' : 'after'
            setDropTarget({ id: item.id, pos })
          }}
          onDragLeave={() => setDropTarget((d) => (d?.id === item.id ? null : d))}
          onDrop={() => handleDrop(item.id, dropTarget?.pos ?? 'after')}
          onClick={() => onSelect(item)}
          className={cn(
            'group relative flex cursor-pointer items-center gap-1 rounded-md py-1 pr-1 text-sm transition-colors',
            isSel ? 'bg-accent/15 text-text' : 'text-text/85 hover:bg-surface-2',
            isDropTarget && dropTarget?.pos === 'inside' && 'ring-1 ring-inset ring-accent/60',
          )}
          style={{ paddingLeft: depth * 12 + 4 }}
        >
          {isDropTarget && dropTarget?.pos === 'before' && <DropLine />}
          {isDropTarget && dropTarget?.pos === 'after' && <DropLine bottom />}

          {container ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleCollapse(item.id, !item.collapsed)
              }}
              className="flex h-4 w-4 shrink-0 items-center justify-center text-muted"
            >
              <ChevronRight size={13} className={cn('transition-transform', !item.collapsed && 'rotate-90')} />
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}

          <NodeIcon type={item.type} open={!item.collapsed} size={14} className="shrink-0 text-muted" />

          {renaming === item.id ? (
            <input
              autoFocus
              defaultValue={item.title}
              onBlur={(e) => {
                renameNode(item.id, e.target.value.trim() || 'Untitled')
                setRenaming(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') setRenaming(null)
              }}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 rounded border border-accent/50 bg-surface px-1 py-0 text-sm outline-none"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate" onDoubleClick={() => setRenaming(item.id)} title={item.title}>
              {item.title}
            </span>
          )}

          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full opacity-80"
            style={{ backgroundColor: status.color }}
            title={status.label}
          />
          {wc > 0 && <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-muted/70">{formatCompact(wc)}</span>}

          <Menu
            align="end"
            items={rowMenu(item)}
            width={210}
            trigger={({ toggle, ref }) => (
              <button
                ref={ref}
                onClick={(e) => {
                  e.stopPropagation()
                  toggle()
                }}
                className="shrink-0 rounded p-0.5 text-muted opacity-0 transition-opacity hover:bg-border/50 group-hover:opacity-100"
              >
                <MoreHorizontal size={15} />
              </button>
            )}
          />
        </div>
        {!item.collapsed && item.children.map((c) => renderRow(c, depth + 1))}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="label-text">Manuscript</span>
        <Menu
          items={addMenu(null)}
          trigger={({ toggle, ref }) => (
            <IconButton ref={ref} size="sm" label="Add to manuscript" onClick={toggle}>
              <Plus size={16} />
            </IconButton>
          )}
        />
      </div>
      <div
        className="flex-1 overflow-y-auto px-1.5 pb-3"
        onDragOver={(e) => e.preventDefault()}
      >
        {forest.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted">Empty. Use + to add a chapter.</p>
        ) : (
          forest.map((item) => renderRow(item, 0))
        )}
      </div>
    </div>
  )
}

function DropLine({ bottom }: { bottom?: boolean }) {
  return (
    <span
      className={cn('pointer-events-none absolute left-2 right-2 h-0.5 rounded-full bg-accent', bottom ? 'bottom-0' : 'top-0')}
    />
  )
}
