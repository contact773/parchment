import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Plus, MoreHorizontal, CircleDot, Pin, FileDown } from 'lucide-react'
import { db } from '@/data/db'
import {
  createNode,
  deleteNode,
  duplicateNode,
  renameNode,
  toggleCollapse,
  updateNode,
  moveNode,
  mergeNodes,
  togglePinNode,
  isContainer,
  isDocument,
} from '@/data/repo'
import { runExportNode } from '@/features/export/exporters'
import { buildForest, manuscriptNodes, type TreeItem, subtreeWordCount } from '@/lib/tree'
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
  const allNodes = useLiveQuery(() => db.nodes.where('projectId').equals(project.id).toArray(), [project.id]) ?? []
  const liveNodes = allNodes.filter((n) => !n.deletedAt)
  const nodes = manuscriptNodes(liveNodes)
  const forest = buildForest(nodes)
  const pinSort = (a: TreeItem, b: TreeItem) => Number(!!b.pinned) - Number(!!a.pinned)
  const [renaming, setRenaming] = useState<string | null>(null)
  const cancelRename = useRef(false)
  const [drag, setDrag] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: string; pos: DropPos } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [anchor, setAnchor] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  const toast = useUI((s) => s.toast)

  // Flattened list of currently-visible rows (respects collapse + pin sort) —
  // drives keyboard navigation and shift-range selection.
  const visible: { item: TreeItem; depth: number }[] = []
  const walkVisible = (items: TreeItem[], depth: number) => {
    for (const it of [...items].sort(pinSort)) {
      visible.push({ item: it, depth })
      if (!it.collapsed && it.children.length) walkVisible(it.children, depth + 1)
    }
  }
  walkVisible(forest, 0)

  const focusRow = (id: string | undefined) => {
    if (!id) return
    setFocusId(id)
    requestAnimationFrame(() => treeRef.current?.querySelector<HTMLElement>(`[data-node-id="${id}"]`)?.focus())
  }

  const bulkTrash = async (ids: string[]) => {
    for (const id of ids) await deleteNode(id)
    setSelectedIds(new Set())
    toast(ids.length > 1 ? `${ids.length} items moved to Trash` : 'Moved to Trash', 'info')
  }

  const onTreeKeyDown = (e: React.KeyboardEvent) => {
    if (renaming) return
    const ids = visible.map((v) => v.item.id)
    if (!ids.length) return
    const curId = focusId && ids.includes(focusId) ? focusId : selectedId && ids.includes(selectedId) ? selectedId : ids[0]
    const idx = ids.indexOf(curId)
    const cur = visible[idx]?.item
    const isCont = cur ? isContainer(cur.type) || cur.children.length > 0 : false
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        focusRow(ids[Math.min(ids.length - 1, idx + 1)])
        break
      case 'ArrowUp':
        e.preventDefault()
        focusRow(ids[Math.max(0, idx - 1)])
        break
      case 'ArrowRight':
        e.preventDefault()
        if (cur && isCont && cur.collapsed) toggleCollapse(cur.id, false)
        else focusRow(ids[Math.min(ids.length - 1, idx + 1)])
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (cur && isCont && !cur.collapsed) toggleCollapse(cur.id, true)
        else if (cur?.parentId && ids.includes(cur.parentId)) focusRow(cur.parentId)
        break
      case 'Enter':
        e.preventDefault()
        if (cur) {
          onSelect(cur)
          setSelectedIds(new Set([cur.id]))
          setAnchor(cur.id)
        }
        break
      case 'F2':
        e.preventDefault()
        if (cur) setRenaming(cur.id)
        break
      case ' ':
        e.preventDefault()
        if (cur) {
          setSelectedIds((prev) => {
            const n = new Set(prev)
            if (n.has(cur.id)) n.delete(cur.id)
            else n.add(cur.id)
            return n
          })
          setAnchor(cur.id)
        }
        break
      case 'Delete':
      case 'Backspace': {
        e.preventDefault()
        const sel = selectedIds.has(curId) && selectedIds.size > 1 ? [...selectedIds] : cur ? [cur.id] : []
        if (sel.length) {
          const neighbour = ids[idx + 1] && !sel.includes(ids[idx + 1]) ? ids[idx + 1] : ids[idx - 1]
          void bulkTrash(sel)
          if (neighbour) setFocusId(neighbour)
        }
        break
      }
    }
  }

  const clickSelect = (e: React.MouseEvent, id: string, openOnPlain = true) => {
    const ids = visible.map((v) => v.item.id)
    if (e.shiftKey && anchor && ids.includes(anchor)) {
      const a = ids.indexOf(anchor)
      const b = ids.indexOf(id)
      setSelectedIds(new Set(ids.slice(Math.min(a, b), Math.max(a, b) + 1)))
      setFocusId(id)
    } else if (e.metaKey || e.ctrlKey) {
      setSelectedIds((prev) => {
        const n = new Set(prev)
        if (n.has(id)) n.delete(id)
        else n.add(id)
        return n
      })
      setAnchor(id)
      setFocusId(id)
    } else {
      setSelectedIds(new Set([id]))
      setAnchor(id)
      setFocusId(id)
      const item = visible.find((v) => v.item.id === id)?.item
      if (openOnPlain && item) onSelect(item)
    }
  }

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
    if (!drag) return
    // Move the whole multi-selection if the dragged row is part of it, in visible order.
    const movers =
      selectedIds.has(drag) && selectedIds.size > 1
        ? visible.map((v) => v.item.id).filter((id) => selectedIds.has(id))
        : [drag]
    if (movers.includes(targetId)) {
      setDrag(null)
      setDropTarget(null)
      return
    }
    const target = nodes.find((n) => n.id === targetId)
    if (!target) return
    // Index against the FULL (unfiltered) sibling order so it matches what moveNode
    // reorders — otherwise a hidden notes-folder among the siblings shifts the drop.
    if (pos === 'inside') {
      const parentId = target.id
      let base = liveNodes.filter((n) => n.parentId === parentId && !movers.includes(n.id)).length
      for (const id of movers) await moveNode(id, parentId, base++)
      // Expand the container so the moved child is visible — otherwise it silently
      // "disappears" into a collapsed parent with no feedback.
      if (target.collapsed) await toggleCollapse(target.id, false)
    } else {
      const parentId = target.parentId
      const siblings = liveNodes.filter((n) => n.parentId === parentId && !movers.includes(n.id)).sort((a, b) => a.order - b.order)
      const at = siblings.findIndex((s) => s.id === targetId)
      let base = pos === 'before' ? at : at + 1
      for (const id of movers) await moveNode(id, parentId, base++)
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
    ]
  }

  const siblingDoc = (node: TreeNode, dir: -1 | 1): TreeNode | null => {
    const sibs = nodes.filter((n) => n.parentId === node.parentId).sort((a, b) => a.order - b.order)
    const i = sibs.findIndex((s) => s.id === node.id)
    const target = sibs[i + dir]
    return target && isDocument(target) && isDocument(node) ? target : null
  }

  const rowMenu = (node: TreeNode): MenuItem[] => {
    const prev = siblingDoc(node, -1)
    const next = siblingDoc(node, 1)
    return [
      { label: 'Rename', onClick: () => setRenaming(node.id) },
      { label: 'Add inside', onClick: () => addChild(node, 'scene') },
      { label: 'Duplicate', onClick: () => duplicateNode(node.id) },
      { label: node.pinned ? 'Unpin' : 'Pin to top', icon: <Pin size={14} />, onClick: () => togglePinNode(node.id, !node.pinned) },
      { separator: true, label: '' },
      ...(prev ? [{ label: 'Merge with previous', onClick: () => mergeNodes(prev.id, node.id) }] : []),
      ...(next ? [{ label: 'Merge with next', onClick: () => mergeNodes(node.id, next.id) }] : []),
      ...NODE_STATUS_ORDER.map((st) => ({
        label: `Mark ${NODE_STATUSES[st].label}`,
        icon: <CircleDot size={14} style={{ color: NODE_STATUSES[st].color }} />,
        onClick: () => updateNode(node.id, { status: st }),
      })),
      { separator: true, label: '' },
      { label: 'Export as Markdown', icon: <FileDown size={14} />, onClick: () => runExportNode('markdown', project, nodes, node.id).then((m) => toast(m, 'success')) },
      {
        label: node.meta.includeInCompile === false ? 'Include in compile' : 'Exclude from compile',
        onClick: () => updateNode(node.id, { meta: { ...node.meta, includeInCompile: node.meta.includeInCompile === false } }),
      },
      { separator: true, label: '' },
      {
        label: selectedIds.has(node.id) && selectedIds.size > 1 ? `Move ${selectedIds.size} to Trash` : 'Move to Trash',
        danger: true,
        onClick: () => {
          const ids = selectedIds.has(node.id) && selectedIds.size > 1 ? [...selectedIds] : [node.id]
          void bulkTrash(ids)
        },
      },
    ]
  }

  const renderRow = (item: TreeItem, depth: number) => {
    // Captured from this row's <Menu> trigger so a right-click can open the very same dropdown.
    let openRowMenu: (() => void) | null = null
    const isSel = item.id === selectedId
    const container = isContainer(item.type) || item.children.length > 0
    const status = NODE_STATUSES[item.status as NodeStatus] ?? NODE_STATUSES.idea
    const wc = isContainer(item.type) ? subtreeWordCount(nodes, item.id) : item.wordCount
    const isDropTarget = dropTarget?.id === item.id

    return (
      <div key={item.id} role="treeitem" aria-level={depth + 1} aria-selected={isSel || selectedIds.has(item.id)} aria-expanded={container ? !item.collapsed : undefined}>
        <div
          data-node-id={item.id}
          tabIndex={(focusId ?? selectedId) === item.id ? 0 : -1}
          onFocus={() => setFocusId(item.id)}
          draggable={renaming !== item.id}
          onDragStart={(e) => {
            // Dragging an unselected row drags just it; otherwise the whole selection.
            if (!selectedIds.has(item.id)) {
              setSelectedIds(new Set([item.id]))
              setAnchor(item.id)
            }
            setDrag(item.id)
            e.dataTransfer.effectAllowed = 'move'
            // Setting drag data makes some browsers / the WebView reliably start the drag.
            e.dataTransfer.setData('text/plain', item.id)
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
          onClick={(e) => clickSelect(e, item.id)}
          onContextMenu={(e) => {
            if (renaming === item.id) return // let the rename input keep its native text menu
            e.preventDefault()
            // Right-clicking a row outside the current selection selects just it.
            if (!selectedIds.has(item.id)) {
              setSelectedIds(new Set([item.id]))
              setAnchor(item.id)
            }
            openRowMenu?.()
          }}
          className={cn(
            'binder-row group relative flex cursor-pointer items-center gap-1 rounded-md py-1 pr-1 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/50',
            isSel || selectedIds.has(item.id) ? 'bg-accent/15 text-text' : 'text-text/85 hover:bg-surface-2',
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
                // Escape sets the cancel flag; unmounting fires this blur, so skip the save.
                if (cancelRename.current) {
                  cancelRename.current = false
                  setRenaming(null)
                  return
                }
                renameNode(item.id, e.target.value.trim() || 'Untitled')
                setRenaming(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') {
                  cancelRename.current = true
                  ;(e.target as HTMLInputElement).blur()
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 flex-1 rounded border border-accent/50 bg-surface px-1 py-0 text-sm outline-none"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate" onDoubleClick={() => setRenaming(item.id)} title={item.title}>
              {item.title}
            </span>
          )}

          {item.pinned && <Pin size={11} className="shrink-0 text-accent" />}
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
            trigger={({ toggle, ref }) => {
              openRowMenu = toggle
              return (
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
              )
            }}
          />
        </div>
        {!item.collapsed && [...item.children].sort(pinSort).map((c) => renderRow(c, depth + 1))}
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
        ref={treeRef}
        role="tree"
        aria-label="Manuscript"
        aria-multiselectable="true"
        className="flex-1 overflow-y-auto px-1.5 pb-3"
        onDragOver={(e) => e.preventDefault()}
        onKeyDown={onTreeKeyDown}
      >
        {forest.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted">Empty. Use + to add a chapter.</p>
        ) : (
          [...forest].sort(pinSort).map((item) => renderRow(item, 0))
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
