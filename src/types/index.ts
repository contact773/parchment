import type { JSONContent } from '@tiptap/core'

/** Rich-text document content (ProseMirror / TipTap JSON). */
export type DocContent = JSONContent

// ──────────────────────────────────────────────────────────────────────────
// Projects
// ──────────────────────────────────────────────────────────────────────────

export type ProjectType =
  | 'novel'
  | 'short-story'
  | 'poetry'
  | 'screenplay'
  | 'stage-play'
  | 'tv-episode'
  | 'series'
  | 'essay-collection'
  | 'worldbuilding'
  | 'manuscript'

export type ProjectStatus = 'planning' | 'drafting' | 'revising' | 'final' | 'archived'

/** Supported document languages (drives spellcheck + assistant). */
export type LanguageCode = 'en' | 'nl' | 'fr' | 'de' | 'es'

export interface Project {
  id: string
  title: string
  subtitle?: string
  author?: string
  type: ProjectType
  status: ProjectStatus
  language: LanguageCode
  /** Free-text genre, used as a hint by the story assistant. */
  genre?: string
  /** Logline / one-sentence pitch. */
  logline?: string
  description?: string
  /** Target word count for the whole project (0 = no target). */
  targetWords: number
  /** Accent/cover color for the dashboard card. */
  color?: string
  /** Default mode for newly created documents. */
  defaultDocType: DocType
  /** Target completion date (ISO YYYY-MM-DD). */
  deadline?: string
  /** Pinned to the top of the dashboard. */
  pinned?: boolean
  tags?: string[]
  /** Soft-delete timestamp (in Trash). */
  deletedAt?: number | null
  createdAt: number
  updatedAt: number
  /** ISO date of last opened, for "recent" sorting. */
  lastOpenedAt?: number
}

// ──────────────────────────────────────────────────────────────────────────
// Binder tree (parts / chapters / scenes / notes / research)
// ──────────────────────────────────────────────────────────────────────────

export type NodeType =
  | 'folder' // generic container
  | 'part' // a book part / act
  | 'chapter' // chapter container
  | 'scene' // a writable scene (leaf document)
  | 'section' // a writable section (leaf document)
  | 'note' // freeform note document
  | 'research' // research document

export type DocType = 'prose' | 'script' | 'poetry'

/** Drafting stage of a document — drives status dots & corkboard filters. */
export type NodeStatus = 'idea' | 'outline' | 'draft' | 'revised' | 'final'

export interface SceneMeta {
  /** POV character (free text or a Character name). */
  pov?: string
  /** What the POV character wants in this scene. */
  goal?: string
  /** The obstacle / opposition. */
  conflict?: string
  /** How the scene resolves / changes the situation. */
  outcome?: string
  /** Story beat / arbitrary label. */
  label?: string
  /** Per-scene word target (0 = none). */
  targetWords?: number
  /** Whether this node is included when compiling/exporting the manuscript. */
  includeInCompile?: boolean
  /** In-world date/time for the timeline. */
  date?: string
  /** Linked location (Location id). */
  locationId?: string
  /** Linked characters present in the scene (Character ids). */
  characterIds?: string[]
  /** Per-document spellcheck language override (falls back to the project's). */
  language?: LanguageCode
}

export interface TreeNode {
  id: string
  projectId: string
  parentId: string | null
  type: NodeType
  title: string
  /** Sort order among siblings. */
  order: number
  /** Whether a container is collapsed in the binder. */
  collapsed?: boolean
  /** Corkboard card text / one-line summary. */
  synopsis?: string
  status: NodeStatus
  meta: SceneMeta
  /** Document body — only present on leaf document nodes. */
  content?: DocContent | null
  /** Plain-text mirror of `content`, kept for counts/search/analysis. */
  text?: string
  wordCount: number
  /** Prose vs screenplay formatting for this document. */
  docType: DocType
  /** Freeform tags/labels. */
  tags?: string[]
  /** Pinned/favorited to the top of the binder. */
  pinned?: boolean
  /** Soft-delete timestamp (in Trash) — null/undefined means live. */
  deletedAt?: number | null
  createdAt: number
  updatedAt: number
}

// ──────────────────────────────────────────────────────────────────────────
// Codex — characters, locations, plot threads
// ──────────────────────────────────────────────────────────────────────────

export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting' | 'minor' | 'mentor' | 'love-interest'

export interface CharacterRelationship {
  targetId: string
  label: string
}

export interface Character {
  id: string
  projectId: string
  name: string
  aliases?: string
  role: CharacterRole
  summary?: string
  goal?: string
  motivation?: string
  conflict?: string
  arc?: string
  appearance?: string
  backstory?: string
  /** Voice notes — speech patterns, vocabulary, verbal tics. */
  voice?: string
  notes?: string
  color?: string
  relationships?: CharacterRelationship[]
  order: number
  createdAt: number
  updatedAt: number
}

/** Worldbuilding database entry (lore bible). */
export type WorldCategory = 'culture' | 'history' | 'geography' | 'magic' | 'technology' | 'religion' | 'politics' | 'language' | 'creature' | 'item' | 'other'

export interface WorldElement {
  id: string
  projectId: string
  category: WorldCategory
  name: string
  summary?: string
  details?: string
  rules?: string
  color?: string
  order: number
  createdAt: number
  updatedAt: number
}

export interface Location {
  id: string
  projectId: string
  name: string
  kind?: string // city, building, planet, realm…
  description?: string
  atmosphere?: string
  significance?: string
  notes?: string
  color?: string
  order: number
  createdAt: number
  updatedAt: number
}

// ──────────────────────────────────────────────────────────────────────────
// World map (visual world-builder)
// ──────────────────────────────────────────────────────────────────────────

export interface MapPoint {
  x: number
  y: number
}

/** continent = a landmass; country = a subdivision of one (e.g. created by a cut). */
export type RegionKind = 'continent' | 'country'
/** city = a settlement; place = a mountain range / point of interest. */
export type MarkerKind = 'city' | 'place'

/** A landmass / region drawn on the world map. */
export interface MapRegion {
  id: string
  name: string
  color: string
  kind?: RegionKind
  /** Polygon vertices in map coordinate space; rendered as a smooth closed blob. */
  points: MapPoint[]
}

/** A labelled marker (city / place) on the world map. */
export interface MapMarker {
  id: string
  name: string
  x: number
  y: number
  color: string
  kind?: MarkerKind
  /** Optional link to a Location codex entry. */
  locationId?: string
}

export interface WorldMap {
  id: string
  projectId: string
  name: string
  /** Map coordinate space; the SVG viewBox is "0 0 width height". */
  width: number
  height: number
  /** Ocean / background fill color. */
  background: string
  regions: MapRegion[]
  markers: MapMarker[]
  order: number
  createdAt: number
  updatedAt: number
}

export type PlotThreadStatus = 'open' | 'developing' | 'resolved'

export interface PlotThread {
  id: string
  projectId: string
  name: string
  description?: string
  status: PlotThreadStatus
  color?: string
  /** TreeNode ids where this thread appears. */
  sceneIds: string[]
  order: number
  createdAt: number
  updatedAt: number
}

// ──────────────────────────────────────────────────────────────────────────
// Versioning / snapshots
// ──────────────────────────────────────────────────────────────────────────

export interface Snapshot {
  id: string
  projectId: string
  nodeId: string
  nodeTitle: string
  label: string
  /** True when taken automatically (e.g. before a large edit). */
  auto: boolean
  content: DocContent | null
  text: string
  wordCount: number
  createdAt: number
}

// ──────────────────────────────────────────────────────────────────────────
// Story analysis
// ──────────────────────────────────────────────────────────────────────────

export interface StoryInsight {
  id: string
  label: string
  value: string
  /** 0..1 confidence for heuristic results. */
  confidence?: number
  tone?: 'neutral' | 'good' | 'warn'
}

export interface StorySuggestion {
  id: string
  title: string
  detail: string
  /** The narrative effect of taking this direction. */
  effect: string
  category: string
}

export interface StoryAnalysis {
  projectId: string
  scope: 'project' | 'node'
  nodeId?: string
  generatedAt: number
  provider: string
  insights: StoryInsight[]
  suggestions: StorySuggestion[]
  /** Metric summary for charts/meters. */
  metrics: {
    words: number
    sentences: number
    paragraphs: number
    dialogueRatio: number // 0..1
    avgSentenceLength: number
    readingMinutes: number
    adverbRatio: number
    uniqueWordRatio: number
    longestParagraphWords: number
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Themes & personalization
// ──────────────────────────────────────────────────────────────────────────

/** Each value is an "R G B" triplet string, e.g. "245 244 240". */
export interface ThemeColors {
  bg: string
  surface: string
  'surface-2': string
  border: string
  text: string
  muted: string
  accent: string
  'accent-fg': string
  paper: string
  ink: string
  danger: string
  success: string
}

export interface ThemeTypography {
  fontFamily: string
  fontSize: number // px
  lineHeight: number // unitless
  pageWidth: number // px, editor measure
  paragraphSpacing: number // em
  paragraphIndent: boolean
  justify: boolean
}

export interface Theme {
  id: string
  name: string
  dark: boolean
  builtin: boolean
  colors: ThemeColors
  typography: ThemeTypography
  /** Editor radius in px. */
  radius: number
  createdAt?: number
}

// ──────────────────────────────────────────────────────────────────────────
// Spellcheck
// ──────────────────────────────────────────────────────────────────────────

export interface UserDictionary {
  /** Words the user added permanently (per language). */
  added: Record<LanguageCode, string[]>
  /** Words ignored for the current device (per language). */
  ignored: Record<LanguageCode, string[]>
}

// ──────────────────────────────────────────────────────────────────────────
// Writing goals & sessions
// ──────────────────────────────────────────────────────────────────────────

export interface DailyRecord {
  /** ISO date (YYYY-MM-DD). */
  date: string
  words: number
  minutes: number
}

export interface WritingStats {
  dailyGoal: number
  /** Map of ISO date -> record. */
  history: Record<string, DailyRecord>
  /** Best word count baseline per node, used to compute session deltas. */
  lastSnapshotCounts: Record<string, number>
}

// ──────────────────────────────────────────────────────────────────────────
// AI provider configuration
// ──────────────────────────────────────────────────────────────────────────

export type AIProviderId = 'local' | 'openai' | 'anthropic' | 'gemini' | 'ollama'

export interface AIConfig {
  provider: AIProviderId
  apiKey: string
  model: string
  /** Base URL override (e.g. Ollama at http://localhost:11434). */
  baseUrl?: string
}

// ──────────────────────────────────────────────────────────────────────────
// App settings (single row)
// ──────────────────────────────────────────────────────────────────────────

export type SidebarDensity = 'comfortable' | 'cozy' | 'compact'

export interface Settings {
  id: 'app'
  activeThemeId: string
  /** UI zoom, 0.85 – 1.25. */
  interfaceScale: number
  sidebarDensity: SidebarDensity
  defaultLanguage: LanguageCode
  spellcheckEnabled: boolean
  /** Focus mode dimming style. */
  focusMode: 'off' | 'paragraph' | 'sentence' | 'typewriter'
  typewriterMode: boolean
  autosave: boolean
  ai: AIConfig
  onboardingDone: boolean
  updates: UpdatePreferences
}

/** Desktop auto-update behaviour. Ignored by the browser build, which has no installer. */
export interface UpdatePreferences {
  /** Check the release endpoint shortly after launch. Never blocks startup. */
  checkOnStartup: boolean
  /** Epoch ms of the last completed check, successful or not. */
  lastCheckedAt: number | null
  /** A version the writer chose to skip; never offered again unless something newer appears. */
  skippedVersion: string | null
}
