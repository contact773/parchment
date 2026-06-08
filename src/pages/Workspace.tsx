import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Minimize, Loader2 } from 'lucide-react'
import { db } from '@/data/db'
import { isContainer, isDocument, touchProject } from '@/data/repo'
import type { TreeNode } from '@/types'
import { Topbar } from '@/features/workspace/Topbar'
import { LeftSidebar } from '@/features/workspace/LeftSidebar'
import { RightPanel } from '@/features/workspace/RightPanel'
import type { WorkspaceView } from '@/features/workspace/types'
import { DocumentEditor } from '@/features/editor/DocumentEditor'
import { Corkboard } from '@/features/planning/Corkboard'
import { OutlineView } from '@/features/planning/OutlineView'
import { TimelineView } from '@/features/planning/TimelineView'
import { CharacterManager } from '@/features/planning/CharacterManager'
import { LocationManager } from '@/features/planning/LocationManager'
import { ThreadManager } from '@/features/planning/ThreadManager'
import { ExportDialog } from '@/features/export/ExportDialog'
import { EmptyState } from '@/components/ui/misc'
import { IconButton } from '@/components/ui/IconButton'
import { orderedDocuments } from '@/lib/tree'
import { useUI } from '@/store/useUI'
import { useSettings } from '@/store/useSettings'
import { FileText } from 'lucide-react'

export function Workspace() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId])
  const nodes = useLiveQuery(() => db.nodes.where('projectId').equals(projectId).toArray(), [projectId]) ?? []

  const leftOpen = useUI((s) => s.leftOpen)
  const rightOpen = useUI((s) => s.rightOpen)
  const distractionFree = useUI((s) => s.distractionFree)
  const setDistractionFree = useUI((s) => s.setDistractionFree)
  const startSession = useUI((s) => s.startSession)
  const lastNodeByProject = useSettings((s) => s.lastNodeByProject)
  const setLastLocation = useSettings((s) => s.setLastLocation)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<WorkspaceView>('editor')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    startSession()
    if (projectId) touchProject(projectId)
  }, [projectId, startSession])

  // Pick an initial document when nodes load.
  useEffect(() => {
    if (selectedId && nodes.some((n) => n.id === selectedId)) return
    if (nodes.length === 0) return
    const remembered = lastNodeByProject[projectId]
    const initial =
      (remembered && nodes.find((n) => n.id === remembered)) ??
      orderedDocuments(nodes, false)[0]?.node ??
      nodes[0]
    if (initial) {
      setSelectedId(initial.id)
      setView(isContainer(initial.type) ? 'corkboard' : 'editor')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, projectId])

  // Esc exits distraction-free.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && distractionFree) setDistractionFree(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [distractionFree, setDistractionFree])

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId])

  const onSelect = (node: TreeNode) => {
    setSelectedId(node.id)
    setView(isContainer(node.type) ? 'corkboard' : 'editor')
    setLastLocation(projectId, node.id)
  }

  if (project === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-bg text-muted">
        <Loader2 className="animate-spin" />
      </div>
    )
  }
  if (project === null) {
    navigate('/')
    return null
  }

  // ── Center view ─────────────────────────────────────────────────────────
  const corkRoot =
    selectedNode && isContainer(selectedNode.type)
      ? { id: selectedNode.id, title: selectedNode.title }
      : selectedNode
        ? { id: selectedNode.parentId, title: nodes.find((n) => n.id === selectedNode.parentId)?.title ?? project.title }
        : { id: null, title: project.title }

  const center = (() => {
    switch (view) {
      case 'outline':
        return <OutlineView project={project} nodes={nodes} onOpen={onSelect} />
      case 'corkboard':
        return <Corkboard project={project} nodes={nodes} rootId={corkRoot.id} rootTitle={corkRoot.title} onOpen={onSelect} />
      case 'characters':
        return <CharacterManager projectId={project.id} />
      case 'locations':
        return <LocationManager projectId={project.id} />
      case 'threads':
        return <ThreadManager projectId={project.id} />
      case 'timeline':
        return <TimelineView project={project} nodes={nodes} onOpen={onSelect} />
      case 'editor':
      default:
        if (selectedNode && isDocument(selectedNode)) return <DocumentEditor node={selectedNode} project={project} />
        if (selectedNode && isContainer(selectedNode.type))
          return <Corkboard project={project} nodes={nodes} rootId={selectedNode.id} rootTitle={selectedNode.title} onOpen={onSelect} />
        return (
          <EmptyState
            className="h-full"
            icon={<FileText size={40} />}
            title="Select a document"
            description="Choose a scene or chapter from the manuscript to start writing."
          />
        )
    }
  })()

  // ── Distraction-free ──────────────────────────────────────────────────
  if (distractionFree && selectedNode && isDocument(selectedNode)) {
    return (
      <div className="relative h-full bg-bg">
        <DocumentEditor node={selectedNode} project={project} />
        <IconButton
          label="Exit distraction-free (Esc)"
          onClick={() => setDistractionFree(false)}
          className="fixed right-4 top-4 z-20 bg-surface/80 backdrop-blur"
        >
          <Minimize size={18} />
        </IconButton>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <Topbar project={project} node={selectedNode} view={view} onView={setView} onExport={() => setExporting(true)} />
      <div className="flex min-h-0 flex-1">
        {leftOpen && (
          <aside className="w-[280px] shrink-0 border-r border-border">
            <LeftSidebar project={project} selectedId={selectedId} onSelect={onSelect} view={view} onView={setView} />
          </aside>
        )}
        <main className="min-w-0 flex-1 overflow-hidden bg-bg">{center}</main>
        {rightOpen && (
          <aside className="w-[360px] shrink-0 border-l border-border">
            <RightPanel project={project} node={selectedNode} allNodes={nodes} onOpen={onSelect} />
          </aside>
        )}
      </div>
      {exporting && <ExportDialog open onClose={() => setExporting(false)} project={project} />}
    </div>
  )
}
