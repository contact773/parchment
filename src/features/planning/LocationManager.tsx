import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, MapPin } from 'lucide-react'
import type { Location } from '@/types'
import { db } from '@/data/db'
import { createLocation, deleteLocation, updateLocation } from '@/data/repo'
import { ACCENT_PALETTE } from '@/lib/constants'
import { AutoInput, AutoTextarea } from '@/components/ui/Auto'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { EmptyState } from '@/components/ui/misc'
import { cn } from '@/lib/utils'

export function LocationManager({ projectId, selectId }: { projectId: string; selectId?: string }) {
  const locations = useLiveQuery(() => db.locations.where('projectId').equals(projectId).sortBy('order'), [projectId]) ?? []
  const [selId, setSelId] = useState<string | null>(null)
  useEffect(() => {
    if (selectId) setSelId(selectId)
  }, [selectId])
  const selected = locations.find((l) => l.id === selId) ?? locations[0] ?? null

  const add = async () => {
    const l = await createLocation(projectId, { name: 'New Location' })
    setSelId(l.id)
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
            <MapPin size={17} /> Locations
          </span>
          <IconButton size="sm" label="Add location" onClick={add}>
            <Plus size={16} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {locations.map((l) => (
            <button
              key={l.id}
              onClick={() => setSelId(l.id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors',
                selected?.id === l.id ? 'bg-accent/15' : 'hover:bg-surface-2',
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: l.color ?? ACCENT_PALETTE[2] }}>
                <MapPin size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{l.name}</span>
                {l.kind && <span className="block truncate text-[11px] text-muted">{l.kind}</span>}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <EmptyState
            className="h-full"
            icon={<MapPin size={40} />}
            title="Map your world"
            description="Track the places your story unfolds — cities, rooms, realms."
            action={
              <Button variant="primary" onClick={add}>
                <Plus size={16} /> Add location
              </Button>
            }
          />
        ) : (
          <LocationDetail key={selected.id} location={selected} onDelete={() => { deleteLocation(selected.id); setSelId(null) }} />
        )}
      </div>
    </div>
  )
}

function LocationDetail({ location: l, onDelete }: { location: Location; onDelete: () => void }) {
  const save = (patch: Partial<Location>) => updateLocation(l.id, patch)
  return (
    <div className="mx-auto max-w-2xl px-8 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex gap-1.5">
          {ACCENT_PALETTE.slice(0, 7).map((col) => (
            <button
              key={col}
              onClick={() => save({ color: col })}
              className="h-4 w-4 rounded-full transition-transform hover:scale-110"
              style={{ backgroundColor: col, boxShadow: l.color === col ? `0 0 0 2px ${col}` : undefined }}
            />
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger">
          <Trash2 size={14} /> Delete
        </Button>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <AutoInput label="Name" depKey={l.id} value={l.name} save={(v) => save({ name: v || 'Unnamed' })} />
          <AutoInput label="Type" depKey={l.id} value={l.kind ?? ''} placeholder="City, ship, realm…" save={(v) => save({ kind: v })} />
        </div>
        <AutoTextarea label="Description" depKey={l.id} rows={3} value={l.description ?? ''} save={(v) => save({ description: v })} />
        <AutoTextarea label="Atmosphere / mood" depKey={l.id} rows={2} value={l.atmosphere ?? ''} save={(v) => save({ atmosphere: v })} />
        <AutoTextarea label="Significance to the story" depKey={l.id} rows={2} value={l.significance ?? ''} save={(v) => save({ significance: v })} />
        <AutoTextarea label="Notes" depKey={l.id} rows={3} value={l.notes ?? ''} save={(v) => save({ notes: v })} />
      </div>
    </div>
  )
}
