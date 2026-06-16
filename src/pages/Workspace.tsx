import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Minimize,
  Loader2,
  FileText,
  ListTree,
  LayoutGrid,
  Users,
  MapPin,
  GitBranch,
  Clock,
  Globe2,
  Trash2,
  Plus,
  BookText,
  StickyNote,
  Search as SearchIcon,
  Maximize,
  Focus,
  PanelLeftClose,
  PanelRightClose,
  Download,
  Settings,
  Bold,
  Italic,
  Heading1,
  Sparkles,
} from 'lucide-react'
import { db } from '@/data/db'
import {
  isContainer,
  isDocument,
  touchProject,
  createNode,
  createSiblingAfter,
  createCharacter,
  createLocation,
} from '@/data/repo'
import type { DocContent, TreeNode } from '@/types'
import { Topbar } from '@/features/workspace/Topbar'
import { LeftSidebar } from '@/features/workspace/LeftSidebar'
import { RightPanel } from '@/features/workspace/RightPanel'
import type { WorkspaceView, CodexSelect } from '@/features/workspace/types'
import { DocumentEditor } from '@/features/editor/DocumentEditor'
import { FindReplace } from '@/features/editor/FindReplace'
import { getActiveEditor, subscribeActiveEditor } from '@/features/editor/activeEditor'
import type { Editor } from '@tiptap/react'
import { setTextType, toggleBold, toggleItalic, insertSceneBreak } from '@/features/editor/editorActions'
import { Corkboard } from '@/features/planning/Corkboard'
import { OutlineView } from '@/features/planning/OutlineView'
import { TimelineView } from '@/features/planning/TimelineView'
import { CharacterManager } from '@/features/planning/CharacterManager'
import { LocationManager } from '@/features/planning/LocationManager'
import { ThreadManager } from '@/features/planning/ThreadManager'
import { WorldbuildingManager } from '@/features/planning/WorldbuildingManager'
import { NodeBoard } from '@/features/planning/NodeBoard'
import { TrashView } from '@/features/planning/TrashView'
import { ExportDialog } from '@/features/export/ExportDialog'
import { NewProjectModal } from '@/features/projects/NewProjectModal'
import { CommandPalette, type Command } from '@/components/CommandPalette'
import { EmptyState } from '@/components/ui/misc'
import { IconButton } from '@/components/ui/IconButton'
import { orderedDocuments } from '@/lib/tree'
import { useUI } from '@/store/useUI'
import { useSettings } from '@/store/useSettings'

export function Workspace() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId])
  const allNodes = useLiveQuery(() => db.nodes.where('projectId').equals(projectId).toArray(), [projectId]) ?? []
  const characters = useLiveQuery(() => db.characters.where('projectId').equals(projectId).sortBy('order'), [projectId]) ?? []
  const locations = useLiveQuery(() => db.locations.where('projectId').equals(projectId).sortBy('order'), [projectId]) ?? []
  const nodes = useMemo(() => allNodes.filter((n) => !n.deletedAt), [allNodes])

  const ui = useUI()
  const { leftOpen, rightOpen, distractionFree, setDistractionFree, startSession, commandOpen, setCommandOpen, setFindOpen, setWorkspaceMode } = ui
  const lastNodeByProject = useSettings((s) => s.lastNodeByProject)
  const setLastLocation = useSettings((s) => s.setLastLocation)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<WorkspaceView>('editor')
  const [codexSelect, setCodexSelect] = useState<CodexSelect | null>(null)
  const [assistantSeed, setAssistantSeed] = useState<string | undefined>(undefined)
  const [exporting, setExporting] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [activeEd, setActiveEd] = useState<Editor | null>(() => getActiveEditor())
  useEffect(() => subscribeActiveEditor(() => setActiveEd(getActiveEditor())), [])

  useEffect(() => {
    startSession()
    if (projectId) touchProject(projectId)
  }, [projectId, startSession])

  // Redirect away from a missing project in an effect (never navigate during render).
  useEffect(() => {
    if (project === null) navigate('/')
  }, [project, navigate])

  // On a narrow/mobile viewport, start with both side panels collapsed so the
  // editor is usable (they open as overlay drawers — see layout below).
  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      const s = useUI.getState()
      if (s.leftOpen) s.toggleLeft()
      if (s.rightOpen) s.toggleRight()
    }
  }, [])

  useEffect(() => {
    if (selectedId && nodes.some((n) => n.id === selectedId)) return
    if (nodes.length === 0) return
    const remembered = lastNodeByProject[projectId]
    const initial = (remembered && nodes.find((n) => n.id === remembered)) ?? orderedDocuments(nodes, false)[0]?.node ?? nodes[0]
    if (initial) {
      setSelectedId(initial.id)
      setView(isContainer(initial.type) ? 'corkboard' : 'editor')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, projectId])

  // Keyboard: Esc (exit DF), Cmd/Ctrl+K (palette), Cmd/Ctrl+F (find).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && distractionFree) setDistractionFree(false)
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const t = e.target as HTMLElement | null
      const inEditor = !!t?.closest?.('.ProseMirror')
      const editable = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      // Fire from the writing surface or non-editable chrome, but never steal
      // keystrokes from a form field / the assistant textarea.
      if (editable && !inEditor) return
      const k = e.key.toLowerCase()
      if (k === 'k') {
        e.preventDefault()
        setCommandOpen(true)
      } else if (k === 'f') {
        e.preventDefault()
        setFindOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [distractionFree, setDistractionFree, setCommandOpen, setFindOpen])

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId])

  const selectNode = (node: TreeNode) => {
    setSelectedId(node.id)
    setView(isContainer(node.type) ? 'corkboard' : 'editor')
    setLastLocation(projectId, node.id)
  }

  // ── Structure operations ────────────────────────────────────────────────
  const addStructure = async (kind: 'scene' | 'chapter' | 'note') => {
    if (!project) return
    let created: TreeNode | null = null
    if (kind === 'chapter') {
      created = await createNode({ projectId, parentId: null, type: 'chapter', docType: project.defaultDocType })
    } else if (kind === 'note') {
      created = await createNode({ projectId, parentId: null, type: 'note', docType: 'prose' })
    } else {
      // scene
      if (selectedNode && isContainer(selectedNode.type)) {
        created = await createNode({ projectId, parentId: selectedNode.id, type: 'scene', docType: project.defaultDocType })
      } else if (selectedNode) {
        created = await createSiblingAfter(selectedNode.id, { type: 'scene', docType: project.defaultDocType })
      } else {
        created = await createNode({ projectId, parentId: null, type: 'scene', docType: project.defaultDocType })
      }
    }
    if (created) selectNode(created)
  }

  const splitScene = async (after: DocContent) => {
    if (!selectedNode) return
    const created = await createSiblingAfter(selectedNode.id, { type: 'scene', title: 'New Scene', content: after, docType: selectedNode.docType })
    if (created) selectNode(created)
  }

  const openProfile = (kind: 'character' | 'location', id: string) => {
    setCodexSelect({ kind, id })
    setView(kind === 'character' ? 'characters' : 'locations')
  }
  const createEntry = async (kind: 'character' | 'location', name: string) => {
    const entry = kind === 'character' ? await createCharacter(projectId, { name }) : await createLocation(projectId, { name })
    setCodexSelect({ kind, id: entry.id })
    setView(kind === 'character' ? 'characters' : 'locations')
  }
  const askAssistant = (text: string) => {
    setAssistantSeed(text)
    ui.openRight('assistant')
  }

  // ── Command palette ──────────────────────────────────────────────────────
  const commands: Command[] = useMemo(() => {
    const list: Command[] = []
    const viewCmd = (v: WorkspaceView, label: string, icon: React.ReactNode) =>
      list.push({ id: `view-${v}`, group: 'Go to view', label, icon, keywords: v, run: () => setView(v) })
    viewCmd('outline', 'Outline', <ListTree size={15} />)
    viewCmd('corkboard', 'Corkboard', <LayoutGrid size={15} />)
    viewCmd('characters', 'Characters', <Users size={15} />)
    viewCmd('locations', 'Locations', <MapPin size={15} />)
    viewCmd('threads', 'Plot threads', <GitBranch size={15} />)
    viewCmd('timeline', 'Timeline', <Clock size={15} />)
    viewCmd('worldbuilding', 'Worldbuilding', <Globe2 size={15} />)
    viewCmd('research', 'Research board', <StickyNote size={15} />)
    viewCmd('notes', 'Notes board', <StickyNote size={15} />)
    viewCmd('trash', 'Trash', <Trash2 size={15} />)

    list.push({ id: 'new-scene', group: 'Create', label: 'New scene', icon: <Plus size={15} />, keywords: 'add', run: () => addStructure('scene') })
    list.push({ id: 'new-chapter', group: 'Create', label: 'New chapter', icon: <BookText size={15} />, run: () => addStructure('chapter') })
    list.push({ id: 'new-note', group: 'Create', label: 'New note', icon: <StickyNote size={15} />, run: () => addStructure('note') })
    list.push({ id: 'new-character', group: 'Create', label: 'New character', icon: <Users size={15} />, run: () => createEntry('character', 'New Character') })
    list.push({ id: 'new-location', group: 'Create', label: 'New location', icon: <MapPin size={15} />, run: () => createEntry('location', 'New Location') })

    list.push({ id: 'mode-minimal', group: 'Mode', label: 'Minimal mode', icon: <Maximize size={15} />, keywords: 'focus zen', run: () => setWorkspaceMode('minimal') })
    list.push({ id: 'mode-standard', group: 'Mode', label: 'Standard mode', icon: <PanelLeftClose size={15} />, run: () => setWorkspaceMode('standard') })
    list.push({ id: 'mode-advanced', group: 'Mode', label: 'Advanced mode (ribbon)', icon: <PanelRightClose size={15} />, run: () => setWorkspaceMode('advanced') })
    list.push({ id: 'distraction', group: 'Mode', label: 'Distraction-free writing', icon: <Maximize size={15} />, run: () => setDistractionFree(true) })
    list.push({ id: 'focus-off', group: 'Mode', label: 'Focus: off', icon: <Focus size={15} />, run: () => useSettings.getState().setSettings({ focusMode: 'off' }) })
    list.push({ id: 'focus-para', group: 'Mode', label: 'Focus: paragraph', icon: <Focus size={15} />, run: () => useSettings.getState().setSettings({ focusMode: 'paragraph' }) })
    list.push({ id: 'focus-type', group: 'Mode', label: 'Typewriter mode', icon: <Focus size={15} />, run: () => useSettings.getState().setSettings({ focusMode: 'typewriter' }) })

    // Editor formatting (when a document is open). Resolve the editor at call
    // time so a swapped/destroyed instance is never used.
    if (activeEd) {
      const withEd = (fn: (e: Editor) => void) => () => {
        const e = getActiveEditor()
        if (e) fn(e)
      }
      list.push({ id: 'fmt-bold', group: 'Format', label: 'Bold', icon: <Bold size={15} />, run: withEd(toggleBold) })
      list.push({ id: 'fmt-italic', group: 'Format', label: 'Italic', icon: <Italic size={15} />, run: withEd(toggleItalic) })
      list.push({ id: 'fmt-h1', group: 'Format', label: 'Heading 1', icon: <Heading1 size={15} />, run: withEd((e) => setTextType(e, 'h1')) })
      list.push({ id: 'fmt-quote', group: 'Format', label: 'Quote', icon: <Sparkles size={15} />, run: withEd((e) => setTextType(e, 'quote')) })
      list.push({ id: 'fmt-scenebreak', group: 'Format', label: 'Insert scene break', icon: <Sparkles size={15} />, run: withEd(insertSceneBreak) })
    }

    list.push({ id: 'find', group: 'Project', label: 'Find & replace', icon: <SearchIcon size={15} />, keywords: 'search', run: () => setFindOpen(true) })
    list.push({ id: 'project-details', group: 'Project', label: 'Edit project details', icon: <BookText size={15} />, keywords: 'rename deadline target metadata', run: () => setEditingDetails(true) })
    list.push({ id: 'export', group: 'Project', label: 'Export & backup', icon: <Download size={15} />, run: () => setExporting(true) })
    list.push({ id: 'settings', group: 'Project', label: 'Settings', icon: <Settings size={15} />, run: () => navigate('/settings') })
    list.push({ id: 'help', group: 'Project', label: 'Help & shortcuts', icon: <Settings size={15} />, keywords: 'keyboard', run: () => navigate('/help') })

    // Jump to documents
    orderedDocuments(nodes, false).forEach(({ node }) =>
      list.push({ id: `goto-${node.id}`, group: 'Go to document', label: node.title, icon: <FileText size={15} />, keywords: node.text?.slice(0, 80) ?? '', run: () => selectNode(node) }),
    )
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, selectedNode, activeEd])

  if (project === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-bg text-muted">
        <Loader2 className="animate-spin" />
      </div>
    )
  }
  if (project === null) return null

  const corkRoot =
    selectedNode && isContainer(selectedNode.type)
      ? { id: selectedNode.id, title: selectedNode.title }
      : selectedNode
        ? { id: selectedNode.parentId, title: nodes.find((n) => n.id === selectedNode.parentId)?.title ?? project.title }
        : { id: null, title: project.title }

  const editorProps = {
    characters,
    locations,
    onAskAssistant: askAssistant,
    onOpenProfile: openProfile,
    onCreateEntry: createEntry,
    onSplitScene: splitScene,
    onStructure: addStructure,
  }

  const center = (() => {
    switch (view) {
      case 'outline':
        return <OutlineView project={project} nodes={nodes} onOpen={selectNode} />
      case 'corkboard':
        return <Corkboard project={project} nodes={nodes} rootId={corkRoot.id} rootTitle={corkRoot.title} onOpen={selectNode} />
      case 'characters':
        return <CharacterManager projectId={project.id} selectId={codexSelect?.kind === 'character' ? codexSelect.id : undefined} />
      case 'locations':
        return <LocationManager projectId={project.id} selectId={codexSelect?.kind === 'location' ? codexSelect.id : undefined} />
      case 'threads':
        return <ThreadManager projectId={project.id} />
      case 'timeline':
        return <TimelineView project={project} nodes={nodes} onOpen={selectNode} />
      case 'worldbuilding':
        return <WorldbuildingManager projectId={project.id} />
      case 'research':
        return <NodeBoard project={project} nodes={nodes} types={['research']} title="Research" description="Reference material and research notes." onOpen={selectNode} />
      case 'notes':
        return <NodeBoard project={project} nodes={nodes} types={['note']} title="Notes" description="Ideas, reminders and loose notes." onOpen={selectNode} />
      case 'trash':
        return <TrashView projectId={project.id} />
      case 'editor':
      default:
        if (selectedNode && isDocument(selectedNode)) return <DocumentEditor node={selectedNode} project={project} {...editorProps} />
        if (selectedNode && isContainer(selectedNode.type))
          return <Corkboard project={project} nodes={nodes} rootId={selectedNode.id} rootTitle={selectedNode.title} onOpen={selectNode} />
        return (
          <EmptyState className="h-full" icon={<FileText size={40} />} title="Select a document" description="Choose a scene or chapter from the manuscript to start writing." />
        )
    }
  })()

  if (distractionFree && selectedNode && isDocument(selectedNode)) {
    return (
      <div className="relative h-full bg-bg">
        <DocumentEditor node={selectedNode} project={project} {...editorProps} />
        <FindReplace />
        <IconButton label="Exit distraction-free (Esc)" onClick={() => setDistractionFree(false)} className="fixed right-4 top-4 z-20 bg-surface/80 backdrop-blur">
          <Minimize size={18} />
        </IconButton>
        <CommandPalette open={commandOpen} commands={commands} onClose={() => setCommandOpen(false)} />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <Topbar project={project} node={selectedNode} view={view} onView={setView} onExport={() => setExporting(true)} />
      <div className="relative flex min-h-0 flex-1">
        {leftOpen && (
          <>
            <button
              type="button"
              aria-label="Close sidebar"
              onClick={ui.toggleLeft}
              className="fixed inset-0 z-20 hidden bg-black/40 max-md:block"
            />
            <aside className="z-30 w-[280px] shrink-0 border-r border-border bg-surface max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:shadow-panel">
              <LeftSidebar project={project} selectedId={selectedId} onSelect={selectNode} view={view} onView={setView} />
            </aside>
          </>
        )}
        <main className="relative min-w-0 flex-1 overflow-hidden bg-bg">
          {center}
          <FindReplace />
        </main>
        {rightOpen && (
          <>
            <button
              type="button"
              aria-label="Close inspector"
              onClick={ui.toggleRight}
              className="fixed inset-0 z-20 hidden bg-black/40 max-md:block"
            />
            <aside className="z-30 w-[360px] shrink-0 border-l border-border bg-surface max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:w-[88vw] max-md:max-w-[360px] max-md:shadow-panel">
              <RightPanel project={project} node={selectedNode} allNodes={nodes} onOpen={selectNode} assistantSeed={assistantSeed} onSeedConsumed={() => setAssistantSeed(undefined)} />
            </aside>
          </>
        )}
      </div>
      {exporting && <ExportDialog open onClose={() => setExporting(false)} project={project} />}
      <NewProjectModal open={editingDetails} project={project} onClose={() => setEditingDetails(false)} />
      <CommandPalette open={commandOpen} commands={commands} onClose={() => setCommandOpen(false)} />
    </div>
  )
}
