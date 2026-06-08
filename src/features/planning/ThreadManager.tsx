import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Trash2, GitBranch } from 'lucide-react'
import type { PlotThreadStatus } from '@/types'
import { db } from '@/data/db'
import { createThread, deleteThread, updateThread } from '@/data/repo'
import { PLOT_THREAD_STATUSES, ACCENT_PALETTE } from '@/lib/constants'
import { AutoInput, AutoTextarea } from '@/components/ui/Auto'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { EmptyState } from '@/components/ui/misc'

export function ThreadManager({ projectId }: { projectId: string }) {
  const threads = useLiveQuery(() => db.threads.where('projectId').equals(projectId).sortBy('order'), [projectId]) ?? []

  const add = () => createThread(projectId, { name: 'New Plot Thread', color: ACCENT_PALETTE[Math.floor(Math.random() * 7)] })

  return (
    <div className="mx-auto h-full w-full max-w-3xl overflow-y-auto px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold text-ink">
            <GitBranch size={20} /> Plot Threads
          </h2>
          <p className="text-sm text-muted">Track storylines, mysteries and promises through to payoff.</p>
        </div>
        <Button variant="primary" onClick={add}>
          <Plus size={16} /> Add thread
        </Button>
      </div>

      {threads.length === 0 ? (
        <EmptyState
          icon={<GitBranch size={36} />}
          title="No threads yet"
          description="Open threads are promises to the reader. Track them here so none are left dangling."
          action={
            <Button variant="primary" onClick={add}>
              <Plus size={16} /> Add thread
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {threads.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-surface p-4" style={{ borderLeftColor: t.color ?? ACCENT_PALETTE[0], borderLeftWidth: 4 }}>
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-3">
                  <AutoInput depKey={t.id} value={t.name} save={(v) => updateThread(t.id, { name: v || 'Untitled thread' })} />
                  <AutoTextarea depKey={t.id} rows={2} value={t.description ?? ''} placeholder="What is this thread about?" save={(v) => updateThread(t.id, { description: v })} />
                  <div className="flex items-center gap-3">
                    <select
                      value={t.status}
                      onChange={(e) => updateThread(t.id, { status: e.target.value as PlotThreadStatus })}
                      className="input-base h-8 w-40 py-0 text-xs"
                    >
                      {Object.entries(PLOT_THREAD_STATUSES).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-1.5">
                      {ACCENT_PALETTE.slice(0, 7).map((col) => (
                        <button
                          key={col}
                          onClick={() => updateThread(t.id, { color: col })}
                          className="h-4 w-4 rounded-full transition-transform hover:scale-110"
                          style={{ backgroundColor: col, boxShadow: t.color === col ? `0 0 0 2px ${col}` : undefined }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <IconButton size="sm" label="Delete thread" onClick={() => deleteThread(t.id)} className="text-danger">
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
