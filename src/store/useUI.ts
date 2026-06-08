import { create } from 'zustand'
import { uid } from '@/lib/id'

export type RightTab = 'inspector' | 'assistant' | 'notes' | 'snapshots'
export type CenterView = 'document' | 'corkboard' | 'outline'

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

  // session
  sessionStartedAt: number | null
  sessionWords: number
  sessionElapsedMs: number

  // save status
  saving: boolean
  lastSavedAt: number | null

  toasts: Toast[]

  toggleLeft: () => void
  toggleRight: () => void
  setRightTab: (t: RightTab) => void
  openRight: (t: RightTab) => void
  setCenterView: (v: CenterView) => void
  setDistractionFree: (v: boolean) => void
  setEditorZoom: (z: number) => void
  setCommandOpen: (v: boolean) => void

  startSession: () => void
  addSessionWords: (delta: number) => void
  tickSession: (ms: number) => void
  resetSession: () => void

  setSaving: (v: boolean) => void
  markSaved: () => void

  toast: (message: string, kind?: Toast['kind']) => void
  dismissToast: (id: string) => void
}

export const useUI = create<UIState>((set, get) => ({
  leftOpen: true,
  rightOpen: true,
  rightTab: 'inspector',
  centerView: 'document',
  distractionFree: false,
  editorZoom: 1,
  commandOpen: false,

  sessionStartedAt: null,
  sessionWords: 0,
  sessionElapsedMs: 0,

  saving: false,
  lastSavedAt: null,

  toasts: [],

  toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
  toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
  setRightTab: (t) => set({ rightTab: t }),
  openRight: (t) => set({ rightOpen: true, rightTab: t }),
  setCenterView: (v) => set({ centerView: v }),
  setDistractionFree: (v) => set({ distractionFree: v }),
  setEditorZoom: (z) => set({ editorZoom: Math.min(1.8, Math.max(0.7, z)) }),
  setCommandOpen: (v) => set({ commandOpen: v }),

  startSession: () => {
    if (get().sessionStartedAt === null) set({ sessionStartedAt: Date.now(), sessionWords: 0, sessionElapsedMs: 0 })
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
}))
