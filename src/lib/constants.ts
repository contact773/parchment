import type {
  CharacterRole,
  DocType,
  LanguageCode,
  NodeStatus,
  PlotThreadStatus,
  ProjectStatus,
  ProjectType,
} from '@/types'

export interface ProjectTypeInfo {
  label: string
  short: string
  description: string
  icon: string // lucide icon name, resolved in components/Icon.tsx
  defaultDocType: DocType
  /** Hint shown when creating, and used by sample/structure templates. */
  structure: string
}

export const PROJECT_TYPES: Record<ProjectType, ProjectTypeInfo> = {
  novel: {
    label: 'Novel',
    short: 'Novel',
    description: 'A long-form work of fiction organized into parts, chapters and scenes.',
    icon: 'BookOpen',
    defaultDocType: 'prose',
    structure: 'Parts → Chapters → Scenes',
  },
  'short-story': {
    label: 'Short Story',
    short: 'Story',
    description: 'A single, focused narrative — one sitting, one arc.',
    icon: 'BookText',
    defaultDocType: 'prose',
    structure: 'Scenes',
  },
  poetry: {
    label: 'Poetry Collection',
    short: 'Poetry',
    description: 'A collection of poems grouped into sections.',
    icon: 'Feather',
    defaultDocType: 'poetry',
    structure: 'Sections → Poems',
  },
  screenplay: {
    label: 'Screenplay',
    short: 'Screenplay',
    description: 'A feature film script with industry-style scene formatting.',
    icon: 'Clapperboard',
    defaultDocType: 'script',
    structure: 'Acts → Scenes',
  },
  'stage-play': {
    label: 'Stage Play',
    short: 'Play',
    description: 'A script for the theatre, organized in acts and scenes.',
    icon: 'Drama',
    defaultDocType: 'script',
    structure: 'Acts → Scenes',
  },
  'tv-episode': {
    label: 'TV Episode',
    short: 'Episode',
    description: 'A television script structured in acts and beats.',
    icon: 'Tv',
    defaultDocType: 'script',
    structure: 'Teaser → Acts',
  },
  series: {
    label: 'Book Series',
    short: 'Series',
    description: 'A multi-book saga sharing a world, cast and continuity.',
    icon: 'Library',
    defaultDocType: 'prose',
    structure: 'Books → Chapters → Scenes',
  },
  'essay-collection': {
    label: 'Essay Collection',
    short: 'Essays',
    description: 'A set of essays or non-fiction pieces.',
    icon: 'FileText',
    defaultDocType: 'prose',
    structure: 'Sections → Essays',
  },
  worldbuilding: {
    label: 'Worldbuilding Bible',
    short: 'World',
    description: 'A reference compendium of lore, cultures, maps and history.',
    icon: 'Globe2',
    defaultDocType: 'prose',
    structure: 'Categories → Entries',
  },
  manuscript: {
    label: 'General Manuscript',
    short: 'Manuscript',
    description: 'A flexible document for any writing project.',
    icon: 'ScrollText',
    defaultDocType: 'prose',
    structure: 'Folders → Documents',
  },
}

export const PROJECT_TYPE_ORDER: ProjectType[] = [
  'novel',
  'short-story',
  'poetry',
  'screenplay',
  'stage-play',
  'tv-episode',
  'series',
  'essay-collection',
  'worldbuilding',
  'manuscript',
]

export const PROJECT_STATUSES: Record<ProjectStatus, { label: string; color: string }> = {
  planning: { label: 'Planning', color: '#8b8b8b' },
  drafting: { label: 'Drafting', color: '#c9883a' },
  revising: { label: 'Revising', color: '#6f8fc7' },
  final: { label: 'Final', color: '#5aa06f' },
  archived: { label: 'Archived', color: '#9a9a9a' },
}

export const NODE_STATUSES: Record<NodeStatus, { label: string; color: string }> = {
  idea: { label: 'Idea', color: '#a0a0a0' },
  outline: { label: 'Outline', color: '#b58dd0' },
  draft: { label: 'Draft', color: '#d49a4a' },
  revised: { label: 'Revised', color: '#5b8fd0' },
  final: { label: 'Final', color: '#5aa06f' },
}

export const NODE_STATUS_ORDER: NodeStatus[] = ['idea', 'outline', 'draft', 'revised', 'final']

export const LANGUAGES: Record<LanguageCode, { label: string; native: string; flag: string }> = {
  en: { label: 'English', native: 'English', flag: '🇬🇧' },
  nl: { label: 'Dutch', native: 'Nederlands', flag: '🇳🇱' },
  fr: { label: 'French', native: 'Français', flag: '🇫🇷' },
  de: { label: 'German', native: 'Deutsch', flag: '🇩🇪' },
  es: { label: 'Spanish', native: 'Español', flag: '🇪🇸' },
}

export const LANGUAGE_ORDER: LanguageCode[] = ['en', 'nl', 'fr', 'de', 'es']

export const CHARACTER_ROLES: Record<CharacterRole, { label: string; color: string }> = {
  protagonist: { label: 'Protagonist', color: '#c9883a' },
  antagonist: { label: 'Antagonist', color: '#c45b5b' },
  'love-interest': { label: 'Love Interest', color: '#c47fa6' },
  mentor: { label: 'Mentor', color: '#6f8fc7' },
  supporting: { label: 'Supporting', color: '#5aa06f' },
  minor: { label: 'Minor', color: '#9a9a9a' },
}

export const PLOT_THREAD_STATUSES: Record<PlotThreadStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: '#c45b5b' },
  developing: { label: 'Developing', color: '#d49a4a' },
  resolved: { label: 'Resolved', color: '#5aa06f' },
}

/** Accent palette for project covers, characters, locations, threads. */
export const ACCENT_PALETTE = [
  '#b3704a', // terracotta
  '#9a7b4f', // bronze
  '#5f7d6e', // sage
  '#5b7aa6', // dusk blue
  '#8a6fa6', // plum
  '#a85d6e', // rose
  '#6a8c5f', // moss
  '#c2924a', // amber
  '#557a8a', // teal
  '#9a5d5d', // brick
]

/** Editor font choices exposed in the theme builder. */
export const EDITOR_FONTS: { label: string; value: string }[] = [
  { label: 'Lora (serif)', value: '"Lora", Georgia, serif' },
  { label: 'Source Serif', value: '"Source Serif 4", Georgia, serif' },
  { label: 'Iowan Old Style', value: '"Iowan Old Style", "Palatino Linotype", Palatino, serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Inter (sans)', value: '"Inter", system-ui, sans-serif' },
  { label: 'System Sans', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", ui-monospace, monospace' },
]

/** Screenplay element types. */
export const SCRIPT_ELEMENTS = [
  'scene-heading',
  'action',
  'character',
  'dialogue',
  'parenthetical',
  'transition',
  'shot',
] as const

export type ScriptElement = (typeof SCRIPT_ELEMENTS)[number]

export const SCRIPT_ELEMENT_LABELS: Record<ScriptElement, string> = {
  'scene-heading': 'Scene Heading',
  action: 'Action',
  character: 'Character',
  dialogue: 'Dialogue',
  parenthetical: 'Parenthetical',
  transition: 'Transition',
  shot: 'Shot',
}
