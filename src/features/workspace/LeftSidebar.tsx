import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ListTree, LayoutGrid, Users, MapPin, GitBranch, Clock, Globe2, Trash2 } from 'lucide-react'
import type { Project, TreeNode } from '@/types'
import { Binder } from '@/features/projects/Binder'
import { GoalsWidget } from './GoalsWidget'
import type { WorkspaceView } from './types'
import { cn } from '@/lib/utils'

const NAV: { view: WorkspaceView; label: string; icon: typeof ListTree }[] = [
  { view: 'outline', label: 'Outline', icon: ListTree },
  { view: 'corkboard', label: 'Corkboard', icon: LayoutGrid },
  { view: 'characters', label: 'Characters', icon: Users },
  { view: 'locations', label: 'Locations', icon: MapPin },
  { view: 'threads', label: 'Plot Threads', icon: GitBranch },
  { view: 'timeline', label: 'Timeline', icon: Clock },
  { view: 'worldbuilding', label: 'World', icon: Globe2 },
  { view: 'trash', label: 'Trash', icon: Trash2 },
]

export function LeftSidebar({
  project,
  selectedId,
  onSelect,
  view,
  onView,
}: {
  project: Project
  selectedId: string | null
  onSelect: (node: TreeNode) => void
  view: WorkspaceView
  onView: (v: WorkspaceView) => void
}) {
  const navigate = useNavigate()

  return (
    <div className="flex h-full w-full flex-col bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <button onClick={() => navigate('/')} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-text" title="All projects">
          <ArrowLeft size={17} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-serif text-sm font-semibold text-ink" title={project.title}>
            {project.title}
          </div>
          <div className="truncate text-[11px] text-muted">{project.genre || project.type}</div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <Binder project={project} selectedId={selectedId} onSelect={onSelect} />
      </div>

      <div className="border-t border-border px-2 py-2">
        <div className="grid grid-cols-2 gap-1">
          {NAV.map((n) => (
            <button
              key={n.view}
              onClick={() => onView(n.view)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors',
                view === n.view ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface-2 hover:text-text',
              )}
            >
              <n.icon size={14} className="shrink-0" />
              <span className="truncate">{n.label}</span>
            </button>
          ))}
        </div>
      </div>

      <GoalsWidget />
    </div>
  )
}
