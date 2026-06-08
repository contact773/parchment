import { useRef } from 'react'
import { ClipboardList } from 'lucide-react'
import type { TreeNode } from '@/types'
import { renameNode, updateNode } from '@/data/repo'
import { AutoInput, AutoSelect, AutoTextarea } from '@/components/ui/Auto'
import { Switch, EmptyState } from '@/components/ui/misc'
import { NODE_STATUS_ORDER, NODE_STATUSES } from '@/lib/constants'
import { formatNumber } from '@/lib/format'

export function InspectorPanel({ node }: { node: TreeNode | null }) {
  const nodeRef = useRef<TreeNode | null>(node)
  nodeRef.current = node

  if (!node) {
    return (
      <EmptyState
        className="h-full"
        icon={<ClipboardList size={32} />}
        title="No document selected"
        description="Select a scene or chapter to edit its details, goal and status."
      />
    )
  }

  const patchMeta = (key: keyof TreeNode['meta']) => (v: string) => {
    const cur = nodeRef.current
    if (!cur) return
    const value = key === 'targetWords' ? Number(v) || 0 : v
    updateNode(cur.id, { meta: { ...cur.meta, [key]: value } })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2.5">
        <span className="text-sm font-semibold">Inspector</span>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <AutoInput label="Title" depKey={node.id} value={node.title} save={(v) => renameNode(node.id, v || 'Untitled')} />

        <div className="grid grid-cols-2 gap-3">
          <AutoSelect label="Status" depKey={node.id} value={node.status} save={(v) => updateNode(node.id, { status: v as TreeNode['status'] })}>
            {NODE_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {NODE_STATUSES[s].label}
              </option>
            ))}
          </AutoSelect>
          <AutoInput
            label="Target words"
            depKey={node.id}
            type="number"
            value={String(node.meta.targetWords ?? '')}
            save={patchMeta('targetWords')}
          />
        </div>

        <AutoTextarea
          label="Synopsis"
          depKey={node.id}
          rows={3}
          value={node.synopsis ?? ''}
          placeholder="One-line card summary…"
          save={(v) => updateNode(node.id, { synopsis: v })}
        />

        <div className="space-y-1">
          <span className="label-text">Scene work</span>
          <div className="space-y-3 rounded-lg border border-border bg-surface-2/40 p-3">
            <AutoInput label="POV" depKey={node.id} value={node.meta.pov ?? ''} placeholder="Whose eyes?" save={patchMeta('pov')} />
            <AutoTextarea label="Goal" depKey={node.id} rows={2} value={node.meta.goal ?? ''} placeholder="What do they want?" save={patchMeta('goal')} />
            <AutoTextarea label="Conflict" depKey={node.id} rows={2} value={node.meta.conflict ?? ''} placeholder="What's in the way?" save={patchMeta('conflict')} />
            <AutoTextarea label="Outcome" depKey={node.id} rows={2} value={node.meta.outcome ?? ''} placeholder="How does it change things?" save={patchMeta('outcome')} />
            <AutoInput label="Label / Beat" depKey={node.id} value={node.meta.label ?? ''} placeholder="e.g. Inciting incident" save={patchMeta('label')} />
          </div>
        </div>

        <label className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-3 py-2.5">
          <span className="text-sm">Include in compile / export</span>
          <Switch
            checked={node.meta.includeInCompile !== false}
            onChange={(v) => updateNode(node.id, { meta: { ...node.meta, includeInCompile: v } })}
          />
        </label>

        <div className="flex items-center justify-between px-1 text-xs text-muted">
          <span>{formatNumber(node.wordCount)} words</span>
          <span className="capitalize">{node.docType} · {node.type}</span>
        </div>
      </div>
    </div>
  )
}
