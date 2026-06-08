import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  AIConfig,
  LanguageCode,
  Settings,
  Theme,
  UserDictionary,
  WritingStats,
} from '@/types'
import { BUILTIN_THEMES, DEFAULT_THEME_ID, findBuiltin } from '@/features/themes/themes'
import { todayKey } from '@/lib/format'

const defaultAI: AIConfig = {
  provider: 'local',
  apiKey: '',
  model: '',
  baseUrl: 'http://localhost:11434',
}

const defaultSettings: Settings = {
  id: 'app',
  activeThemeId: DEFAULT_THEME_ID,
  interfaceScale: 1,
  sidebarDensity: 'cozy',
  defaultLanguage: 'en',
  spellcheckEnabled: true,
  focusMode: 'off',
  typewriterMode: false,
  autosave: true,
  ai: defaultAI,
  onboardingDone: false,
}

const emptyByLang = (): Record<LanguageCode, string[]> => ({ en: [], nl: [], fr: [], de: [], es: [] })

const defaultDictionary: UserDictionary = { added: emptyByLang(), ignored: emptyByLang() }

const defaultStats: WritingStats = { dailyGoal: 500, history: {}, lastSnapshotCounts: {} }

interface SettingsState {
  settings: Settings
  customThemes: Theme[]
  dictionary: UserDictionary
  stats: WritingStats
  lastProjectId?: string
  lastNodeByProject: Record<string, string>

  // settings
  setSettings: (patch: Partial<Settings>) => void
  setAI: (patch: Partial<AIConfig>) => void
  setActiveTheme: (id: string) => void

  // themes
  allThemes: () => Theme[]
  activeTheme: () => Theme
  saveCustomTheme: (theme: Theme) => void
  deleteCustomTheme: (id: string) => void

  // dictionary
  addDictWord: (lang: LanguageCode, word: string) => void
  ignoreWord: (lang: LanguageCode, word: string) => void
  removeDictWord: (lang: LanguageCode, word: string) => void
  removeIgnoredWord: (lang: LanguageCode, word: string) => void

  // goals / stats
  setDailyGoal: (n: number) => void
  recordWordCount: (nodeId: string, words: number) => number
  todayWords: () => number
  streak: () => number

  // navigation memory
  setLastLocation: (projectId: string, nodeId?: string) => void

  // backup
  importBackupState: (data: Partial<Pick<SettingsState, 'settings' | 'customThemes' | 'dictionary' | 'stats'>>) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      customThemes: [],
      dictionary: defaultDictionary,
      stats: defaultStats,
      lastNodeByProject: {},

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setAI: (patch) => set((s) => ({ settings: { ...s.settings, ai: { ...s.settings.ai, ...patch } } })),
      setActiveTheme: (id) => set((s) => ({ settings: { ...s.settings, activeThemeId: id } })),

      allThemes: () => [...BUILTIN_THEMES, ...get().customThemes],
      activeTheme: () => {
        const id = get().settings.activeThemeId
        return get().customThemes.find((t) => t.id === id) ?? findBuiltin(id) ?? BUILTIN_THEMES[0]
      },
      saveCustomTheme: (theme) =>
        set((s) => {
          const exists = s.customThemes.some((t) => t.id === theme.id)
          return {
            customThemes: exists
              ? s.customThemes.map((t) => (t.id === theme.id ? theme : t))
              : [...s.customThemes, theme],
          }
        }),
      deleteCustomTheme: (id) =>
        set((s) => ({
          customThemes: s.customThemes.filter((t) => t.id !== id),
          settings:
            s.settings.activeThemeId === id ? { ...s.settings, activeThemeId: DEFAULT_THEME_ID } : s.settings,
        })),

      addDictWord: (lang, word) =>
        set((s) => {
          const w = word.trim()
          if (!w || s.dictionary.added[lang].includes(w)) return s
          return { dictionary: { ...s.dictionary, added: { ...s.dictionary.added, [lang]: [...s.dictionary.added[lang], w] } } }
        }),
      ignoreWord: (lang, word) =>
        set((s) => {
          const w = word.trim()
          if (!w || s.dictionary.ignored[lang].includes(w)) return s
          return { dictionary: { ...s.dictionary, ignored: { ...s.dictionary.ignored, [lang]: [...s.dictionary.ignored[lang], w] } } }
        }),
      removeDictWord: (lang, word) =>
        set((s) => ({
          dictionary: { ...s.dictionary, added: { ...s.dictionary.added, [lang]: s.dictionary.added[lang].filter((x) => x !== word) } },
        })),
      removeIgnoredWord: (lang, word) =>
        set((s) => ({
          dictionary: { ...s.dictionary, ignored: { ...s.dictionary.ignored, [lang]: s.dictionary.ignored[lang].filter((x) => x !== word) } },
        })),

      setDailyGoal: (n) => set((s) => ({ stats: { ...s.stats, dailyGoal: Math.max(0, Math.round(n)) } })),
      recordWordCount: (nodeId, words) => {
        const s = get()
        const baseline = s.stats.lastSnapshotCounts[nodeId] ?? words
        const delta = words - baseline
        const key = todayKey()
        const prior = s.stats.history[key] ?? { date: key, words: 0, minutes: 0 }
        const newDay = { ...prior, words: Math.max(0, prior.words + delta) }
        set({
          stats: {
            ...s.stats,
            history: { ...s.stats.history, [key]: newDay },
            lastSnapshotCounts: { ...s.stats.lastSnapshotCounts, [nodeId]: words },
          },
        })
        return delta
      },
      todayWords: () => get().stats.history[todayKey()]?.words ?? 0,
      streak: () => {
        const { history } = get().stats
        let count = 0
        const d = new Date()
        // Count consecutive days (ending today or yesterday) meeting >0 words.
        for (let i = 0; i < 3650; i++) {
          const key = todayKey(d)
          const rec = history[key]
          if (rec && rec.words > 0) count++
          else if (i === 0) {
            // allow today to be empty without breaking yesterday's streak
          } else break
          d.setDate(d.getDate() - 1)
        }
        return count
      },

      setLastLocation: (projectId, nodeId) =>
        set((s) => ({
          lastProjectId: projectId,
          lastNodeByProject: nodeId ? { ...s.lastNodeByProject, [projectId]: nodeId } : s.lastNodeByProject,
        })),

      importBackupState: (data) =>
        set((s) => ({
          settings: data.settings ? { ...s.settings, ...data.settings } : s.settings,
          customThemes: data.customThemes ?? s.customThemes,
          dictionary: data.dictionary ?? s.dictionary,
          stats: data.stats ?? s.stats,
        })),
    }),
    {
      name: 'parchment-settings',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
)
