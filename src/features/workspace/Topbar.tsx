import { useNavigate } from 'react-router-dom'
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Maximize,
  Download,
  Settings,
  Focus,
  Check,
  Minus,
  Plus,
  Type,
  Search,
  TextSearch,
  LayoutPanelTop,
} from 'lucide-react'
import type { Project, TreeNode } from '@/types'
import { IconButton } from '@/components/ui/IconButton'
import { Menu } from '@/components/ui/Menu'
import { Segmented } from '@/components/ui/misc'
import { useUI } from '@/store/useUI'
import { useSettings } from '@/store/useSettings'
import { LANGUAGES } from '@/lib/constants'
import type { WorkspaceView } from './types'
import { timeAgo } from '@/lib/format'

export function Topbar({
  project,
  node,
  view,
  onView,
  onExport,
}: {
  project: Project
  node: TreeNode | null
  view: WorkspaceView
  onView: (v: WorkspaceView) => void
  onExport: () => void
}) {
  const navigate = useNavigate()
  const { leftOpen, rightOpen, toggleLeft, toggleRight, editorZoom, setEditorZoom, setDistractionFree, setCommandOpen, setFindOpen, setWorkspaceMode, workspaceMode, ribbon, setRibbon } = useUI()
  const saving = useUI((s) => s.saving)
  const lastSavedAt = useUI((s) => s.lastSavedAt)
  const settings = useSettings((s) => s.settings)
  const setSettings = useSettings((s) => s.setSettings)

  const modeItems = [
    { label: 'Minimal mode', icon: workspaceMode === 'minimal' ? <Check size={14} /> : <span className="w-3.5" />, onClick: () => setWorkspaceMode('minimal') },
    { label: 'Standard mode', icon: workspaceMode === 'standard' ? <Check size={14} /> : <span className="w-3.5" />, onClick: () => setWorkspaceMode('standard') },
    { label: 'Advanced mode', icon: workspaceMode === 'advanced' ? <Check size={14} /> : <span className="w-3.5" />, onClick: () => setWorkspaceMode('advanced') },
    { separator: true, label: '' },
    { label: ribbon ? 'Hide formatting ribbon' : 'Show formatting ribbon', onClick: () => setRibbon(!ribbon) },
  ]

  const focusItems = [
    { label: 'Focus off', icon: settings.focusMode === 'off' ? <Check size={14} /> : <span className="w-3.5" />, onClick: () => setSettings({ focusMode: 'off' }) },
    { label: 'Focus paragraph', icon: settings.focusMode === 'paragraph' ? <Check size={14} /> : <span className="w-3.5" />, onClick: () => setSettings({ focusMode: 'paragraph' }) },
    { label: 'Typewriter mode', icon: settings.focusMode === 'typewriter' ? <Check size={14} /> : <span className="w-3.5" />, onClick: () => setSettings({ focusMode: 'typewriter' }) },
    { separator: true, label: '' },
    { label: settings.spellcheckEnabled ? 'Disable spellcheck' : 'Enable spellcheck', onClick: () => setSettings({ spellcheckEnabled: !settings.spellcheckEnabled }) },
  ]

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-2.5">
      <div className="flex min-w-0 items-center gap-1">
        <IconButton label="Toggle sidebar" active={leftOpen} onClick={toggleLeft}>
          {leftOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </IconButton>
        <div className="ml-1 min-w-0 truncate text-sm">
          <span className="text-muted">{project.title}</span>
          {node && <span className="text-muted"> / </span>}
          {node && <span className="font-medium text-text">{node.title}</span>}
        </div>
      </div>

      <div className="hidden md:block">
        <Segmented
          size="sm"
          value={view === 'editor' || view === 'corkboard' || view === 'outline' ? view : ('editor' as WorkspaceView)}
          onChange={(v) => onView(v)}
          options={[
            { value: 'editor', label: 'Write' },
            { value: 'corkboard', label: 'Board' },
            { value: 'outline', label: 'Outline' },
          ]}
        />
      </div>

      <div className="flex items-center gap-0.5">
        <span className="mr-1 hidden items-center gap-1 text-[11px] text-muted lg:flex" title="Document language">
          {LANGUAGES[project.language].flag} {project.language.toUpperCase()}
        </span>

        {view === 'editor' && (
          <div className="mr-1 hidden items-center rounded-md border border-border sm:flex">
            <button onClick={() => setEditorZoom(editorZoom - 0.1)} className="px-1.5 py-1 text-muted hover:text-text"><Minus size={13} /></button>
            <span className="flex items-center gap-1 px-1 text-[11px] tabular-nums text-muted"><Type size={11} />{Math.round(editorZoom * 100)}%</span>
            <button onClick={() => setEditorZoom(editorZoom + 0.1)} className="px-1.5 py-1 text-muted hover:text-text"><Plus size={13} /></button>
          </div>
        )}

        <span className="mr-1 hidden text-[11px] text-muted xl:inline">
          {saving ? 'Saving…' : lastSavedAt ? `Saved ${timeAgo(lastSavedAt)}` : 'All changes saved'}
        </span>

        <IconButton label="Command palette (Ctrl/⌘+K)" onClick={() => setCommandOpen(true)}>
          <Search size={18} />
        </IconButton>
        <IconButton label="Find & replace (Ctrl/⌘+F)" onClick={() => setFindOpen(true)}>
          <TextSearch size={18} />
        </IconButton>
        <Menu
          align="end"
          width={210}
          items={modeItems}
          trigger={({ toggle, ref }) => (
            <IconButton ref={ref} label="View mode" onClick={toggle} active={workspaceMode !== 'standard' || ribbon}>
              <LayoutPanelTop size={18} />
            </IconButton>
          )}
        />
        <Menu
          align="end"
          width={200}
          items={focusItems}
          trigger={({ toggle, ref }) => (
            <IconButton ref={ref} label="Focus & writing modes" onClick={toggle} active={settings.focusMode !== 'off'}>
              <Focus size={18} />
            </IconButton>
          )}
        />
        <IconButton label="Distraction-free (Esc to exit)" onClick={() => setDistractionFree(true)}>
          <Maximize size={18} />
        </IconButton>
        <IconButton label="Export & backup" onClick={onExport}>
          <Download size={18} />
        </IconButton>
        <IconButton label="Settings" onClick={() => navigate('/settings')}>
          <Settings size={18} />
        </IconButton>
        <IconButton label="Toggle inspector" active={rightOpen} onClick={toggleRight}>
          {rightOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </IconButton>
      </div>
    </div>
  )
}
