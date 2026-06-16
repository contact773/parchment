import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { uid } from '@/lib/id'

export type RightTab = 'inspector' | 'assistant' | 'notes' | 'snapshots'
export type CenterView = 'document' | 'corkboard' | 'outline'
export type WorkspaceMode = 'minimal' | 'standard' | 'advanced'

export interface Toast {
  id: string
  message: string
  kind: 'info' | 'success' | 'error'
}

interface UIState {
  leftOpen: boolean
  rightOpen: boolean
  rightTab: RightTab
  centerView: CenterView
  distractionFree: boolean
  editorZoom: number
  commandOpen: boolean
  workspaceMode: WorkspaceMode
  ribbon: boolean
  findOpen: boolean

  // session
  sessionStartedAt: number | null
  sessionWords: number
  sessionElapsedMs: number

  // save status
  saving: boolean
  lastSavedAt: number | null

  // editor reload signal — bumped to force the open editor to re-read its node
  // from the DB (e.g. after a snapshot restore overwrites it underneath).
  editorReloadToken: number
  editorReloadNodeId: string | null
  reloadEditor: (nodeId: string) => void

  toasts: Toast[]

  toggleLeft: () => void
  toggleRight: () => void
  setRightTab: (t: RightTab) => void
  openRight: (t: RightTab) => void
  setCenterView: (v: CenterView) => void
  setDistractionFree: (v: boolean) => void
  setEditorZoom: (z: number) => void
  setCommandOpen: (v: boolean) => void
  setWorkspaceMode: (m: WorkspaceMode) => void
  setRibbon: (v: boolean) => void
  setFindOpen: (v: boolean) => void

  startSession: () => void
  addSessionWords: (delta: number) => void
  tickSession: (ms: number) => void
  resetSession: () => void

  setSaving: (v: boolean) => void
  markSaved: () => void

  toast: (message: string, kind?: Toast['kind']) => void
  dismissToast: (id: string) => void
}

export const useUI = create<UIState>()(
  persist(
    (set, get) => ({
      leftOpen: true,
      rightOpen: true,
      rightTab: 'inspector',
      centerView: 'document',
      distractionFree: false,
      editorZoom: 1,
      commandOpen: false,
      workspaceMode: 'standard',
      ribbon: false,
      findOpen: false,

      sessionStartedAt: null,
      sessionWords: 0,
      sessionElapsedMs: 0,

      saving: false,
      lastSavedAt: null,

      editorReloadToken: 0,
      editorReloadNodeId: null,
      reloadEditor: (nodeId) =>
        set((s) => ({ editorReloadToken: s.editorReloadToken + 1, editorReloadNodeId: nodeId })),

      toasts: [],

      toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
      toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
      setRightTab: (t) => set({ rightTab: t }),
      openRight: (t) => set({ rightOpen: true, rightTab: t }),
      setCenterView: (v) => set({ centerView: v }),
      setDistractionFree: (v) => set({ distractionFree: v }),
      setEditorZoom: (z) => set({ editorZoom: Math.min(1.8, Math.max(0.7, z)) }),
      setCommandOpen: (v) => set({ commandOpen: v }),
      setWorkspaceMode: (m) =>
        set(
          m === 'minimal'
            ? { workspaceMode: m, leftOpen: false, rightOpen: false, ribbon: false }
            : m === 'advanced'
              ? { workspaceMode: m, leftOpen: true, rightOpen: true, ribbon: true }
              : { workspaceMode: m, leftOpen: true, rightOpen: true, ribbon: false },
        ),
      setRibbon: (v) => set({ ribbon: v }),
      setFindOpen: (v) => set({ findOpen: v }),

      startSession: () => {
        const started = get().sessionStartedAt
        // Start a fresh session on first open or when the persisted one is from an
        // earlier calendar day (so "this session" survives reloads but resets daily).
        const staleDay = started !== null && new Date(started).toDateString() !== new Date().toDateString()
        if (started === null || staleDay) set({ sessionStartedAt: Date.now(), sessionWords: 0, sessionElapsedMs: 0 })
      },
      addSessionWords: (delta) => set((s) => ({ sessionWords: Math.max(0, s.sessionWords + Math.max(0, delta)) })),
      tickSession: (ms) => set((s) => ({ sessionElapsedMs: s.sessionElapsedMs + ms })),
      resetSession: () => set({ sessionStartedAt: Date.now(), sessionWords: 0, sessionElapsedMs: 0 }),

      setSaving: (v) => set({ saving: v }),
      markSaved: () => set({ saving: false, lastSavedAt: Date.now() }),

      toast: (message, kind = 'info') => {
        const id = uid(6)
        set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }))
        setTimeout(() => get().dismissToast(id), 3200)
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'parchment-ui',
      storage: createJSONStorage(() => localStorage),
      // Persist only durable layout/session preferences — never transient UI
      // (command palette, find bar, save status, toasts, distraction-free).
      partialize: (s) => ({
        leftOpen: s.leftOpen,
        rightOpen: s.rightOpen,
        rightTab: s.rightTab,
        workspaceMode: s.workspaceMode,
        ribbon: s.ribbon,
        editorZoom: s.editorZoom,
        sessionStartedAt: s.sessionStartedAt,
        sessionWords: s.sessionWords,
      }),
    },
  ),
)
