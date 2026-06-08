import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, Globe2 } from 'lucide-react'
import type { WorldCategory, WorldElement } from '@/types'
import { db } from '@/data/db'
import { createWorldElement, deleteWorldElement, updateWorldElement } from '@/data/repo'
import { WORLD_CATEGORIES, WORLD_CATEGORY_ORDER } from '@/lib/constants'
import { AutoInput, AutoSelect, AutoTextarea } from '@/components/ui/Auto'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { EmptyState } from '@/components/ui/misc'
import { cn } from '@/lib/utils'

export function WorldbuildingManager({ projectId }: { projectId: string }) {
  const elements = useLiveQuery(() => db.worldElements.where('projectId').equals(projectId).sortBy('order'), [projectId]) ?? []
  const [selId, setSelId] = useState<string | null>(null)
  const selected = elements.find((e) => e.id === selId) ?? elements[0] ?? null

  const add = async (category: WorldCategory) => {
    const el = await createWorldElement(projectId, { category, name: 'New Element' })
    setSelId(el.id)
  }

  const byCat = WORLD_CATEGORY_ORDER.map((cat) => ({ cat, items: elements.filter((e) => e.category === cat) })).filter((g) => g.items.length)

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
            <Globe2 size={17} /> World
          </span>
          <IconButton size="sm" label="Add element" onClick={() => add('other')}>
            <Plus size={16} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {byCat.length === 0 && <p className="px-2 py-4 text-xs text-muted">No entries yet.</p>}
          {byCat.map((g) => (
            <div key={g.cat} className="mb-2">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted/70">{WORLD_CATEGORIES[g.cat].label}</span>
                <button onClick={() => add(g.cat)} className="text-muted hover:text-text">
                  <Plus size={13} />
                </button>
              </div>
              {g.items.map((el) => (
                <button
                  key={el.id}
                  onClick={() => setSelId(el.id)}
                  className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm', selected?.id === el.id ? 'bg-accent/15' : 'hover:bg-surface-2')}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: el.color ?? WORLD_CATEGORIES[el.category].color }} />
                  <span className="truncate">{el.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <EmptyState
            className="h-full"
            icon={<Globe2 size={40} />}
            title="Build your world"
            description="Cultures, history, magic systems, technology, factions — your lore bible lives here."
            action={
              <Button variant="primary" onClick={() => add('culture')}>
                <Plus size={16} /> Add element
              </Button>
            }
          />
        ) : (
          <WorldDetail key={selected.id} element={selected} onDelete={() => { deleteWorldElement(selected.id); setSelId(null) }} />
        )}
      </div>
    </div>
  )
}

function WorldDetail({ element: el, onDelete }: { element: WorldElement; onDelete: () => void }) {
  const save = (patch: Partial<WorldElement>) => updateWorldElement(el.id, patch)
  return (
    <div className="mx-auto max-w-2xl px-8 py-6">
      <div className="mb-5 flex items-center justify-between">
        <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: `${WORLD_CATEGORIES[el.category].color}22`, color: WORLD_CATEGORIES[el.category].color }}>
          {WORLD_CATEGORIES[el.category].label}
        </span>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger">
          <Trash2 size={14} /> Delete
        </Button>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <AutoInput label="Name" depKey={el.id} value={el.name} save={(v) => save({ name: v || 'Unnamed' })} />
          <AutoSelect label="Category" depKey={el.id} value={el.category} save={(v) => save({ category: v as WorldCategory })}>
            {WORLD_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {WORLD_CATEGORIES[c].label}
              </option>
            ))}
          </AutoSelect>
        </div>
        <AutoTextarea label="Summary" depKey={el.id} rows={2} value={el.summary ?? ''} save={(v) => save({ summary: v })} />
        <AutoTextarea label="Details" depKey={el.id} rows={5} value={el.details ?? ''} save={(v) => save({ details: v })} />
        <AutoTextarea label="Rules / constraints" depKey={el.id} rows={3} value={el.rules ?? ''} placeholder="How it works, costs, limits — for the lore consistency checker." save={(v) => save({ rules: v })} />
      </div>
    </div>
  )
}
