import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Project } from '@/types'
import { db } from '@/data/db'
import { EXPORT_FORMATS, runExport, type ExportFormat, type ExportBundle } from './exporters'
import { Modal } from '@/components/ui/Modal'
import { Segmented, Switch } from '@/components/ui/misc'
import { useUI } from '@/store/useUI'
import { cn } from '@/lib/utils'

export function ExportDialog({ open, onClose, project }: { open: boolean; onClose: () => void; project: Project }) {
  const toast = useUI((s) => s.toast)
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const [scope, setScope] = useState<'manuscript' | 'notes'>('manuscript')
  const [includeCodex, setIncludeCodex] = useState(false)

  const doExport = async (format: ExportFormat) => {
    setBusy(format)
    try {
      const [nodes, characters, locations, threads, worldElements, maps] = await Promise.all([
        db.nodes.where('projectId').equals(project.id).toArray(),
        db.characters.where('projectId').equals(project.id).toArray(),
        db.locations.where('projectId').equals(project.id).toArray(),
        db.threads.where('projectId').equals(project.id).toArray(),
        db.worldElements.where('projectId').equals(project.id).toArray(),
        db.maps.where('projectId').equals(project.id).toArray(),
      ])
      const bundle: ExportBundle = { project, nodes, characters, locations, threads, worldElements, maps, includeCodex: includeCodex && format !== 'json' }
      const msg = await runExport(format, bundle, scope)
      toast(msg, format === 'pdf' ? 'info' : 'success')
      onClose()
    } catch (err) {
      toast(`Export failed: ${(err as Error).message}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Export & backup" description={`Export “${project.title}” in any format.`} size="lg">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm text-muted">
          {scope === 'manuscript'
            ? 'Exports the story — notes & research are left out.'
            : 'Exports only your notes & research documents.'}
        </span>
        <Segmented
          size="sm"
          value={scope}
          onChange={(v) => setScope(v)}
          options={[
            { value: 'manuscript', label: 'Manuscript' },
            { value: 'notes', label: 'Notes' },
          ]}
        />
      </div>
      <label className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3.5 py-2.5">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-text">Append a Story Bible</span>
          <span className="block text-xs text-muted">Adds characters, locations, plot threads &amp; world notes (not for .json).</span>
        </span>
        <Switch checked={includeCodex} onChange={setIncludeCodex} />
      </label>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {EXPORT_FORMATS.map((f) => (
          <button
            key={f.id}
            disabled={!!busy}
            onClick={() => doExport(f.id)}
            className={cn(
              'flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-3.5 text-left transition-all',
              'hover:border-accent/50 hover:bg-surface-2 disabled:opacity-50',
            )}
          >
            <div>
              <div className="text-sm font-semibold text-text">{f.label}</div>
              <div className="mt-0.5 text-xs text-muted">{f.desc}</div>
            </div>
            {busy === f.id && <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-accent" />}
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">
        Your writing never leaves this device on export. The <strong>Backup (.json)</strong> file can be re-imported from the
        dashboard to restore everything.
      </p>
    </Modal>
  )
}
