import { ClipboardList } from 'lucide-react'
import type { Character, LanguageCode, Location, TreeNode } from '@/types'
import { renameNode, updateNode, togglePinNode, setNodeTags, patchNodeMeta } from '@/data/repo'
import { AutoInput, AutoSelect, AutoTextarea } from '@/components/ui/Auto'
import { Switch, EmptyState } from '@/components/ui/misc'
import { NODE_STATUS_ORDER, NODE_STATUSES, LANGUAGES, LANGUAGE_ORDER } from '@/lib/constants'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

export function InspectorPanel({
  node,
  characters = [],
  locations = [],
}: {
  node: TreeNode | null
  characters?: Character[]
  locations?: Location[]
}) {
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
    const value = key === 'targetWords' ? Number(v) || 0 : v
    patchNodeMeta(node.id, { [key]: value })
  }
  const sceneCharacters = node.meta.characterIds ?? []
  const toggleCharacter = (id: string) => {
    const next = sceneCharacters.includes(id) ? sceneCharacters.filter((x) => x !== id) : [...sceneCharacters, id]
    patchNodeMeta(node.id, { characterIds: next })
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

        <div className="grid grid-cols-2 gap-3">
          <AutoSelect
            label="Language"
            depKey={node.id}
            value={node.meta.language ?? ''}
            save={(v) => patchNodeMeta(node.id, { language: (v || undefined) as LanguageCode | undefined })}
          >
            <option value="">Project default</option>
            {LANGUAGE_ORDER.map((l) => (
              <option key={l} value={l}>
                {LANGUAGES[l].flag} {LANGUAGES[l].native}
              </option>
            ))}
          </AutoSelect>
          <AutoInput
            label="Tags"
            depKey={node.id}
            value={(node.tags ?? []).join(', ')}
            placeholder="comma, separated"
            save={(v) => setNodeTags(node.id, v.split(',').map((t) => t.trim()).filter(Boolean))}
          />
        </div>

        <label className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-3 py-2.5">
          <span className="text-sm">Pin to top of binder</span>
          <Switch checked={!!node.pinned} onChange={(v) => togglePinNode(node.id, v)} />
        </label>

        <div className="space-y-1">
          <span className="label-text">Scene work</span>
          <div className="space-y-3 rounded-lg border border-border bg-surface-2/40 p-3">
            <AutoInput label="POV" depKey={node.id} value={node.meta.pov ?? ''} placeholder="Whose eyes?" save={patchMeta('pov')} />
            <AutoTextarea label="Goal" depKey={node.id} rows={2} value={node.meta.goal ?? ''} placeholder="What do they want?" save={patchMeta('goal')} />
            <AutoTextarea label="Conflict" depKey={node.id} rows={2} value={node.meta.conflict ?? ''} placeholder="What's in the way?" save={patchMeta('conflict')} />
            <AutoTextarea label="Outcome" depKey={node.id} rows={2} value={node.meta.outcome ?? ''} placeholder="How does it change things?" save={patchMeta('outcome')} />
            <AutoInput label="Label / Beat" depKey={node.id} value={node.meta.label ?? ''} placeholder="e.g. Inciting incident" save={patchMeta('label')} />
            <AutoInput label="In-world date / time" depKey={node.id} value={node.meta.date ?? ''} placeholder="e.g. Day 3 · dusk" save={patchMeta('date')} />
            {locations.length > 0 && (
              <AutoSelect
                label="Location"
                depKey={node.id}
                value={node.meta.locationId ?? ''}
                save={(v) => patchNodeMeta(node.id, { locationId: v || undefined })}
              >
                <option value="">—</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </AutoSelect>
            )}
            <div>
              <span className="label-text mb-1.5 block">Characters in this scene</span>
              {characters.length === 0 ? (
                <p className="text-xs text-muted">Add characters in the Characters view to link them here.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {characters.map((c) => {
                    const on = sceneCharacters.includes(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleCharacter(c.id)}
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                          on ? 'border-accent bg-accent/15 text-accent' : 'border-border text-muted hover:bg-surface-2',
                        )}
                      >
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <label className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-3 py-2.5">
          <span className="text-sm">Include in compile / export</span>
          <Switch
            checked={node.meta.includeInCompile !== false}
            onChange={(v) => patchNodeMeta(node.id, { includeInCompile: v })}
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
