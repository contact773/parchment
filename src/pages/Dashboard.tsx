import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus,
  Settings,
  Search,
  MoreHorizontal,
  PenLine,
  Copy,
  Archive,
  Trash2,
  Download,
  Upload,
  Feather,
  Flame,
  Target,
  Star,
  RotateCcw,
  CalendarClock,
  HelpCircle,
} from 'lucide-react'
import { db } from '@/data/db'
import { archiveProject, deleteProject, duplicateProject, touchProject, trashProject, restoreProject, togglePinProject } from '@/data/repo'
import { seedSamples } from '@/data/seed'
import { isDocument } from '@/data/repo'
import { PROJECT_TYPES, PROJECT_STATUSES, LANGUAGES } from '@/lib/constants'
import type { Project } from '@/types'
import { ProjectIcon } from '@/components/ProjectIcon'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Menu } from '@/components/ui/Menu'
import { Progress, EmptyState, Badge, Segmented } from '@/components/ui/misc'
import { confirmDialog } from '@/components/ui/confirm'
import { ExportDialog } from '@/features/export/ExportDialog'
import { NewProjectModal } from '@/features/projects/NewProjectModal'
import { importBackup } from '@/features/export/backup'
import { importDocumentFile } from '@/features/export/importDoc'
import { isDesktop, openFileNative } from '@/lib/desktop'
import { useSettings } from '@/store/useSettings'
import { useUI } from '@/store/useUI'
import { timeAgo, formatNumber, formatCompact } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Dashboard() {
  const navigate = useNavigate()
  const projectsRaw = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray())
  const projects = projectsRaw ?? []
  const allNodes = useLiveQuery(() => db.nodes.toArray()) ?? []
  const onboardingDone = useSettings((s) => s.settings.onboardingDone)
  const setSettings = useSettings((s) => s.setSettings)
  const defaultLanguage = useSettings((s) => s.settings.defaultLanguage)
  const dailyGoal = useSettings((s) => s.stats.dailyGoal)
  const todayWords = useSettings((s) => s.todayWords())
  const streak = useSettings((s) => s.streak())
  const toast = useUI((s) => s.toast)

  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'active' | 'archived' | 'trash'>('active')
  const [creating, setCreating] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [exportFor, setExportFor] = useState<Project | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [seeding, setSeeding] = useState(false)
  const seededRef = useRef(false)

  // First-run sample seed. Guarded by a ref so React StrictMode's double-invoke
  // (and the initial liveQuery undefined→[] transition) can't seed twice.
  useEffect(() => {
    if (seededRef.current || projectsRaw === undefined) return
    if (!onboardingDone && projectsRaw.length === 0) {
      seededRef.current = true
      setSeeding(true)
      seedSamples()
        .then(() => setSettings({ onboardingDone: true }))
        .finally(() => setSeeding(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingDone, projectsRaw])

  const wordsByProject = useMemo(() => {
    const map = new Map<string, number>()
    for (const n of allNodes) {
      if (isDocument(n) && !n.deletedAt && n.meta?.includeInCompile !== false) {
        map.set(n.projectId, (map.get(n.projectId) ?? 0) + (n.wordCount || 0))
      }
    }
    return map
  }, [allNodes])

  const filtered = projects
    .filter((p) => {
      const inTab =
        tab === 'trash' ? !!p.deletedAt : tab === 'archived' ? !p.deletedAt && p.status === 'archived' : !p.deletedAt && p.status !== 'archived'
      const matchQuery = !query || p.title.toLowerCase().includes(query.toLowerCase()) || (p.genre ?? '').toLowerCase().includes(query.toLowerCase())
      return inTab && matchQuery
    })
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned))

  const open = async (p: Project) => {
    await touchProject(p.id)
    navigate(`/project/${p.id}`)
  }

  const onImport = async (file: File) => {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase()
    try {
      if (ext === 'json') {
        const res = await importBackup(file)
        toast(res.kind === 'full' ? `Restored ${res.projects} project(s)` : 'Project imported', 'success')
      } else {
        const p = await importDocumentFile(file, defaultLanguage)
        toast(`Imported “${p.title}”`, 'success')
        navigate(`/project/${p.id}`)
      }
    } catch (e) {
      toast(`Import failed: ${(e as Error).message}`, 'error')
    }
  }

  const goalPct = dailyGoal ? (todayWords / dailyGoal) * 100 : 0

  return (
    <div className="h-full overflow-y-auto bg-bg">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
              <Feather size={18} />
            </span>
            <span className="font-serif text-xl font-semibold tracking-tight">Parchment</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".json,.txt,.md,.markdown,.docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onImport(f)
                e.target.value = ''
              }}
            />
            <IconButton
              label="Import (.json backup, .txt, .md, .docx)"
              onClick={async () => {
                if (isDesktop()) {
                  const f = await openFileNative([{ name: 'Parchment files', extensions: ['json', 'txt', 'md', 'markdown', 'docx'] }])
                  if (f) onImport(f)
                } else {
                  fileRef.current?.click()
                }
              }}
            >
              <Upload size={18} />
            </IconButton>
            <IconButton label="Help & shortcuts" onClick={() => navigate('/help')}>
              <HelpCircle size={18} />
            </IconButton>
            <IconButton label="Settings" onClick={() => navigate('/settings')}>
              <Settings size={18} />
            </IconButton>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={16} /> New project
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Greeting + goal */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-ink">Your writing</h1>
            <p className="mt-1 text-sm text-muted">
              {(() => {
                const n = projects.filter((p) => !p.deletedAt && p.status !== 'archived').length
                return `${n} active project${n === 1 ? '' : 's'}.`
              })()}
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-soft">
            <Target size={18} className="text-accent" />
            <div className="w-40">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted">Today</span>
                <span className="font-medium text-text">{formatNumber(todayWords)} / {formatNumber(dailyGoal)}</span>
              </div>
              <Progress value={goalPct} />
            </div>
            <div className="flex items-center gap-1 border-l border-border pl-3 text-sm">
              <Flame size={16} className={streak > 0 ? 'text-accent' : 'text-muted'} />
              <span className="font-medium tabular-nums">{streak}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-5 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="input-base pl-9"
            />
          </div>
          <Segmented
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
              { value: 'trash', label: 'Trash' },
            ]}
          />
        </div>

        {/* Grid */}
        {seeding ? (
          <p className="py-16 text-center text-sm text-muted">Preparing sample projects…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            className="rounded-xl border border-dashed border-border py-20"
            icon={<Feather size={40} />}
            title={tab === 'archived' ? 'No archived projects' : tab === 'trash' ? 'Trash is empty' : 'Begin something'}
            description={
              tab === 'archived'
                ? 'Projects you archive will appear here.'
                : tab === 'trash'
                  ? 'Deleted projects can be restored from here.'
                  : 'Create your first project — a novel, a screenplay, a collection of poems.'
            }
            action={tab === 'active' && <Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} /> New project</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                words={wordsByProject.get(p.id) ?? 0}
                trashed={tab === 'trash'}
                onOpen={() => open(p)}
                onEdit={() => setEditProject(p)}
                onPin={() => togglePinProject(p.id, !p.pinned)}
                onDuplicate={async () => { await duplicateProject(p.id); toast('Project duplicated', 'success') }}
                onArchive={() => archiveProject(p.id, p.status !== 'archived')}
                onExport={() => setExportFor(p)}
                onTrash={async () => { await trashProject(p.id); toast('Moved to Trash', 'info') }}
                onRestore={async () => { await restoreProject(p.id); toast('Restored', 'success') }}
                onDeleteForever={async () => {
                  if (await confirmDialog({ title: 'Delete project forever?', message: `Permanently delete “${p.title}” and everything in it? This cannot be undone.`, confirmLabel: 'Delete forever', danger: true })) {
                    await deleteProject(p.id)
                    toast('Project deleted', 'info')
                  }
                }}
              />
            ))}
          </div>
        )}
      </main>

      <NewProjectModal open={creating} onClose={() => setCreating(false)} onCreated={(p) => { setCreating(false); navigate(`/project/${p.id}`) }} />
      <NewProjectModal open={!!editProject} project={editProject ?? undefined} onClose={() => setEditProject(null)} />
      {exportFor && <ExportDialog open onClose={() => setExportFor(null)} project={exportFor} />}
    </div>
  )
}

function ProjectCard({
  project: p,
  words,
  trashed,
  onOpen,
  onEdit,
  onPin,
  onDuplicate,
  onArchive,
  onExport,
  onTrash,
  onRestore,
  onDeleteForever,
}: {
  project: Project
  words: number
  trashed: boolean
  onOpen: () => void
  onEdit: () => void
  onPin: () => void
  onDuplicate: () => void
  onArchive: () => void
  onExport: () => void
  onTrash: () => void
  onRestore: () => void
  onDeleteForever: () => void
}) {
  const info = PROJECT_TYPES[p.type]
  const status = PROJECT_STATUSES[p.status]
  const lang = LANGUAGES[p.language] ?? { flag: '🌐', native: p.language }
  const pct = p.targetWords ? Math.min(100, (words / p.targetWords) * 100) : 0
  const accent = p.color ?? '#9a7b4f'
  const daysLeft = p.deadline ? Math.ceil((new Date(p.deadline).getTime() - Date.now()) / 86400000) : null

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-panel">
      <button onClick={onOpen} className="flex flex-1 flex-col p-5 text-left">
        <div className="mb-3 flex items-start justify-between">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg text-white" style={{ backgroundColor: accent }}>
            <ProjectIcon type={p.type} size={22} />
          </span>
          <Badge color={status.color}>{status.label}</Badge>
        </div>
        <h3 className="font-serif text-lg font-semibold leading-snug text-ink group-hover:text-accent">{p.title}</h3>
        <p className="mt-0.5 text-xs text-muted">
          {info.label}
          {p.author ? ` · ${p.author}` : ''}
          {p.genre ? ` · ${p.genre}` : ''}
        </p>

        <div className="mt-auto pt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
            <span className="font-medium text-text">{formatNumber(words)} words</span>
            {p.targetWords > 0 && <span>{formatCompact(p.targetWords)} goal</span>}
          </div>
          {p.targetWords > 0 && <Progress value={pct} />}
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
            <span>{lang.flag} {lang.native}</span>
            {daysLeft !== null ? (
              <span className={cn('flex items-center gap-1', daysLeft < 7 ? 'text-danger' : daysLeft < 30 ? 'text-accent' : '')}>
                <CalendarClock size={11} /> {daysLeft < 0 ? 'overdue' : `${daysLeft}d left`}
              </span>
            ) : (
              <span>{timeAgo(p.updatedAt)}</span>
            )}
          </div>
        </div>
      </button>

      {p.pinned && !trashed && (
        <span className="absolute left-3 top-3 text-accent" title="Pinned">
          <Star size={14} fill="currentColor" />
        </span>
      )}

      <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
        <Menu
          align="end"
          items={
            trashed
              ? [
                  { label: 'Restore', icon: <RotateCcw size={14} />, onClick: onRestore },
                  { label: 'Delete forever', danger: true, icon: <Trash2 size={14} />, onClick: onDeleteForever },
                ]
              : [
                  { label: 'Open', onClick: onOpen },
                  { label: 'Edit details', icon: <PenLine size={14} />, onClick: onEdit },
                  { label: p.pinned ? 'Unpin' : 'Pin to top', icon: <Star size={14} />, onClick: onPin },
                  { label: 'Export / backup', icon: <Download size={14} />, onClick: onExport },
                  { label: 'Duplicate', icon: <Copy size={14} />, onClick: onDuplicate },
                  { label: p.status === 'archived' ? 'Unarchive' : 'Archive', icon: <Archive size={14} />, onClick: onArchive },
                  { separator: true, label: '' },
                  { label: 'Move to Trash', danger: true, icon: <Trash2 size={14} />, onClick: onTrash },
                ]
          }
          trigger={({ toggle, ref }) => (
            <button
              ref={ref}
              aria-label="Project actions"
              onClick={(e) => { e.stopPropagation(); toggle() }}
              className={cn('rounded-md bg-surface/80 p-1 text-muted backdrop-blur hover:bg-surface-2 hover:text-text')}
            >
              <MoreHorizontal size={18} />
            </button>
          )}
        />
      </div>
    </div>
  )
}
