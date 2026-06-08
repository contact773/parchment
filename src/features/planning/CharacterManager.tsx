import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, Users, User } from 'lucide-react'
import type { Character, CharacterRole } from '@/types'
import { db } from '@/data/db'
import { createCharacter, deleteCharacter, updateCharacter } from '@/data/repo'
import { CHARACTER_ROLES, ACCENT_PALETTE } from '@/lib/constants'
import { AutoInput, AutoSelect, AutoTextarea } from '@/components/ui/Auto'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { EmptyState } from '@/components/ui/misc'
import { cn } from '@/lib/utils'

export function CharacterManager({ projectId }: { projectId: string }) {
  const characters = useLiveQuery(() => db.characters.where('projectId').equals(projectId).sortBy('order'), [projectId]) ?? []
  const [selId, setSelId] = useState<string | null>(null)
  const selected = characters.find((c) => c.id === selId) ?? characters[0] ?? null

  const add = async () => {
    const c = await createCharacter(projectId, { name: 'New Character' })
    setSelId(c.id)
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
            <Users size={17} /> Characters
          </span>
          <IconButton size="sm" label="Add character" onClick={add}>
            <Plus size={16} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {characters.map((c) => {
            const role = CHARACTER_ROLES[c.role]
            return (
              <button
                key={c.id}
                onClick={() => setSelId(c.id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors',
                  selected?.id === c.id ? 'bg-accent/15' : 'hover:bg-surface-2',
                )}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: c.color ?? role.color }}
                >
                  {c.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{c.name}</span>
                  <span className="block truncate text-[11px]" style={{ color: role.color }}>
                    {role.label}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <EmptyState
            className="h-full"
            icon={<User size={40} />}
            title="Build your cast"
            description="Add characters with goals, motivations and arcs. The story assistant uses them as context."
            action={
              <Button variant="primary" onClick={add}>
                <Plus size={16} /> Add character
              </Button>
            }
          />
        ) : (
          <CharacterDetail key={selected.id} character={selected} onDelete={() => { deleteCharacter(selected.id); setSelId(null) }} />
        )}
      </div>
    </div>
  )
}

function CharacterDetail({ character: c, onDelete }: { character: Character; onDelete: () => void }) {
  const save = (patch: Partial<Character>) => updateCharacter(c.id, patch)
  return (
    <div className="mx-auto max-w-2xl px-8 py-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ backgroundColor: c.color ?? CHARACTER_ROLES[c.role].color }}
          >
            {c.name.slice(0, 1).toUpperCase()}
          </span>
          <div className="flex gap-1.5">
            {ACCENT_PALETTE.slice(0, 7).map((col) => (
              <button
                key={col}
                onClick={() => save({ color: col })}
                className="h-4 w-4 rounded-full ring-offset-2 ring-offset-bg transition-transform hover:scale-110"
                style={{ backgroundColor: col, boxShadow: c.color === col ? `0 0 0 2px ${col}` : undefined }}
              />
            ))}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger">
          <Trash2 size={14} /> Delete
        </Button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <AutoInput label="Name" depKey={c.id} value={c.name} save={(v) => save({ name: v || 'Unnamed' })} />
          <AutoSelect label="Role" depKey={c.id} value={c.role} save={(v) => save({ role: v as CharacterRole })}>
            {Object.entries(CHARACTER_ROLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </AutoSelect>
        </div>
        <AutoInput label="Aliases" depKey={c.id} value={c.aliases ?? ''} placeholder="Nicknames, titles…" save={(v) => save({ aliases: v })} />
        <AutoTextarea label="Summary" depKey={c.id} rows={2} value={c.summary ?? ''} save={(v) => save({ summary: v })} />
        <div className="grid grid-cols-2 gap-3">
          <AutoTextarea label="Goal" depKey={c.id} rows={2} value={c.goal ?? ''} save={(v) => save({ goal: v })} />
          <AutoTextarea label="Motivation" depKey={c.id} rows={2} value={c.motivation ?? ''} save={(v) => save({ motivation: v })} />
        </div>
        <AutoTextarea label="Internal / external conflict" depKey={c.id} rows={2} value={c.conflict ?? ''} save={(v) => save({ conflict: v })} />
        <AutoTextarea label="Character arc" depKey={c.id} rows={2} value={c.arc ?? ''} save={(v) => save({ arc: v })} />
        <AutoTextarea label="Appearance" depKey={c.id} rows={2} value={c.appearance ?? ''} save={(v) => save({ appearance: v })} />
        <AutoTextarea label="Backstory" depKey={c.id} rows={3} value={c.backstory ?? ''} save={(v) => save({ backstory: v })} />
        <AutoTextarea label="Notes" depKey={c.id} rows={3} value={c.notes ?? ''} save={(v) => save({ notes: v })} />
      </div>
    </div>
  )
}
