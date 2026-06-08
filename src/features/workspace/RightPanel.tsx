import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardList, Sparkles, MessageSquare, History } from 'lucide-react'
import type { Project, TreeNode } from '@/types'
import { db } from '@/data/db'
import { isDocument } from '@/data/repo'
import { InspectorPanel } from '@/features/planning/InspectorPanel'
import { NotesPanel } from '@/features/planning/NotesPanel'
import { SnapshotsPanel } from '@/features/planning/SnapshotsPanel'
import { AssistantPanel } from '@/features/story-assistant/AssistantPanel'
import { useUI, type RightTab } from '@/store/useUI'
import { cn } from '@/lib/utils'

const TABS: { id: RightTab; label: string; icon: typeof ClipboardList }[] = [
  { id: 'inspector', label: 'Inspector', icon: ClipboardList },
  { id: 'assistant', label: 'Assistant', icon: Sparkles },
  { id: 'notes', label: 'Notes', icon: MessageSquare },
  { id: 'snapshots', label: 'History', icon: History },
]

export function RightPanel({
  project,
  node,
  allNodes,
  onOpen,
}: {
  project: Project
  node: TreeNode | null
  allNodes: TreeNode[]
  onOpen: (node: TreeNode) => void
}) {
  const tab = useUI((s) => s.rightTab)
  const setTab = useUI((s) => s.setRightTab)
  const characters = useLiveQuery(() => db.characters.where('projectId').equals(project.id).sortBy('order'), [project.id]) ?? []
  const threads = useLiveQuery(() => db.threads.where('projectId').equals(project.id).sortBy('order'), [project.id]) ?? []

  const docNodes = useMemo(() => allNodes.filter((n) => isDocument(n)), [allNodes])
  const noteNodes = useMemo(() => allNodes.filter((n) => n.type === 'note' || n.type === 'research'), [allNodes])

  return (
    <div className="flex h-full w-full flex-col bg-surface">
      <div className="flex shrink-0 items-center gap-0.5 border-b border-border px-2 py-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              tab === t.id ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface-2 hover:text-text',
            )}
            title={t.label}
          >
            <t.icon size={14} />
            <span className="hidden lg:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {tab === 'inspector' && <InspectorPanel node={node} />}
        {tab === 'assistant' && (
          <AssistantPanel project={project} node={node} docNodes={docNodes} characters={characters} threads={threads} />
        )}
        {tab === 'notes' && <NotesPanel node={node} noteNodes={noteNodes} onOpen={onOpen} />}
        {tab === 'snapshots' && <SnapshotsPanel node={node} />}
      </div>
    </div>
  )
}
