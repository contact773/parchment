import type { Character, PlotThread, Project, StoryAnalysis, StoryInsight, StorySuggestion, TreeNode } from '@/types'
import { uid } from '@/lib/id'
import { analyzeText } from '@/lib/text'

const POSITIVE = ['love', 'hope', 'joy', 'smile', 'warm', 'light', 'bright', 'peace', 'gentle', 'happy', 'beautiful', 'calm', 'tender']
const NEGATIVE = ['fear', 'dark', 'death', 'blood', 'pain', 'cold', 'scream', 'hate', 'cruel', 'lost', 'broken', 'grief', 'rage', 'shadow', 'dread']
const TENSION = ['suddenly', 'gun', 'knife', 'run', 'scream', 'blood', 'fight', 'danger', 'die', 'kill', 'explode', 'chase', 'fall', 'edge']
const ADVERB_RE = /\b\w+ly\b/gi
const DIALOGUE_RE = /["“”«»].+?["“”«»]|—\s?\w/g

const STOPWORDS = new Set([
  'the', 'and', 'a', 'an', 'of', 'to', 'in', 'it', 'is', 'was', 'he', 'she', 'they', 'i', 'you', 'we',
  'his', 'her', 'their', 'but', 'for', 'on', 'with', 'as', 'at', 'by', 'from', 'or', 'that', 'this',
  'had', 'have', 'has', 'be', 'were', 'are', 'not', 'no', 'so', 'if', 'then', 'than', 'there', 'here',
  'chapter', 'scene', 'one', 'two', 'mr', 'mrs', 'dr',
])

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

/** Frequency of likely character names (capitalized non-sentence-start words). */
function detectNames(text: string): { name: string; count: number }[] {
  const counts = new Map<string, number>()
  const sentences = text.split(/(?<=[.!?])\s+/)
  for (const s of sentences) {
    const words = s.split(/\s+/)
    words.forEach((w, i) => {
      const clean = w.replace(/[^\p{L}'’-]/gu, '')
      if (!clean || clean.length < 2) return
      const isCap = /^[A-ZÀ-Þ]/.test(clean)
      if (isCap && i > 0 && !STOPWORDS.has(clean.toLowerCase())) {
        counts.set(clean, (counts.get(clean) ?? 0) + 1)
      }
    })
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .filter((e) => e.count >= 2)
    .sort((a, b) => b.count - a.count)
}

function detectPOV(text: string): string {
  const lower = ` ${text.toLowerCase()} `
  const count = (re: RegExp) => (lower.match(re) ?? []).length
  const first = count(/\b(i|me|my|we|us|our)\b/g)
  const second = count(/\b(you|your)\b/g)
  const third = count(/\b(he|she|they|him|her|them|his|hers)\b/g)
  const max = Math.max(first, second, third)
  if (max === 0) return 'Undetermined'
  if (max === first) return 'First person'
  if (max === second) return 'Second person'
  return 'Third person'
}

function detectTone(text: string, words: number): { tone: string; emotion: number } {
  const lower = text.toLowerCase()
  const pos = POSITIVE.reduce((n, w) => n + (lower.split(w).length - 1), 0)
  const neg = NEGATIVE.reduce((n, w) => n + (lower.split(w).length - 1), 0)
  const ratio = (pos - neg) / Math.max(1, words / 200)
  let tone = 'Balanced'
  if (ratio > 1.5) tone = 'Light / hopeful'
  else if (ratio > 0.4) tone = 'Warm'
  else if (ratio < -1.5) tone = 'Dark / ominous'
  else if (ratio < -0.4) tone = 'Tense / somber'
  return { tone, emotion: ratio }
}

export interface AnalyzeInput {
  project: Project
  nodes: TreeNode[] // documents to analyze
  characters: Character[]
  threads: PlotThread[]
  scope: 'project' | 'node'
  nodeId?: string
}

export function analyzeStory(input: AnalyzeInput): StoryAnalysis {
  const { project, nodes, characters, threads, scope, nodeId } = input
  const text = nodes
    .map((n) => n.text ?? '')
    .filter(Boolean)
    .join('\n\n')
  const stats = analyzeText(text)
  const words = stats.words

  const dialogueMatches = (text.match(DIALOGUE_RE) ?? []).length
  const dialogueRatio = stats.sentences ? Math.min(1, dialogueMatches / stats.sentences) : 0
  const adverbs = (text.match(ADVERB_RE) ?? []).length
  const adverbRatio = words ? adverbs / words : 0
  const tokens = (text.toLowerCase().match(/[\p{L}'’-]+/gu) ?? [])
  const uniqueWordRatio = tokens.length ? new Set(tokens).size / tokens.length : 0
  const longestParagraphWords = text
    .split(/\n+/)
    .reduce((max, p) => Math.max(max, p.trim().split(/\s+/).filter(Boolean).length), 0)
  const avgSentenceLength = stats.sentences ? words / stats.sentences : 0

  const names = detectNames(text)
  const pov = detectPOV(text)
  const { tone, emotion } = detectTone(text, words)
  const tensionHits = TENSION.reduce((n, w) => n + (text.toLowerCase().split(w).length - 1), 0)
  const tensionLevel = Math.min(1, tensionHits / Math.max(1, words / 250) / 3 + (avgSentenceLength < 12 ? 0.2 : 0))

  // ── Insights ──────────────────────────────────────────────────────────
  const protagonist =
    characters.find((c) => c.role === 'protagonist')?.name ?? names[0]?.name ?? 'Not yet established'
  const antagonist =
    characters.find((c) => c.role === 'antagonist')?.name ?? (names[1]?.name ?? 'Not yet established')

  const insights: StoryInsight[] = [
    { id: uid(6), label: 'Genre', value: project.genre || guessGenre(text) || 'Unspecified', tone: 'neutral' },
    { id: uid(6), label: 'Tone', value: tone, tone: 'neutral' },
    { id: uid(6), label: 'Point of view', value: pov, tone: pov === 'Undetermined' ? 'warn' : 'neutral' },
    { id: uid(6), label: 'Protagonist', value: protagonist, tone: protagonist.includes('Not yet') ? 'warn' : 'good' },
    { id: uid(6), label: 'Antagonist / opposition', value: antagonist, tone: antagonist.includes('Not yet') ? 'warn' : 'neutral' },
    {
      id: uid(6),
      label: 'Pacing',
      value: pacingLabel(avgSentenceLength, dialogueRatio),
      tone: 'neutral',
    },
    {
      id: uid(6),
      label: 'Dialogue balance',
      value: dialogueRatio < 0.1 ? `Sparse (${pct(dialogueRatio)})` : `${pct(dialogueRatio)} of lines`,
      tone: dialogueRatio < 0.08 && words > 400 ? 'warn' : 'good',
    },
    {
      id: uid(6),
      label: 'Emotional lean',
      value: emotion > 0.4 ? 'Rising / positive' : emotion < -0.4 ? 'Falling / heavy' : 'Even',
      tone: 'neutral',
    },
    {
      id: uid(6),
      label: 'Tension level',
      value: tensionLevel > 0.6 ? 'High' : tensionLevel > 0.3 ? 'Moderate' : 'Low',
      tone: tensionLevel < 0.2 && words > 500 ? 'warn' : 'neutral',
    },
    {
      id: uid(6),
      label: 'Key figures',
      value: names.slice(0, 5).map((n) => n.name).join(', ') || '—',
      tone: 'neutral',
    },
  ]

  const openThreads = threads.filter((t) => t.status !== 'resolved')
  if (openThreads.length) {
    insights.push({
      id: uid(6),
      label: 'Unresolved threads',
      value: `${openThreads.length}: ${openThreads.slice(0, 3).map((t) => t.name).join(', ')}`,
      tone: 'warn',
    })
  }

  // ── Suggestions (read-only craft notes) ────────────────────────────────
  const suggestions: StorySuggestion[] = []
  const add = (s: Omit<StorySuggestion, 'id'>) => suggestions.push({ id: uid(6), ...s })

  if (words < 300 && scope === 'node') {
    add({
      title: 'Develop the scene',
      detail: 'This scene is quite short. Consider grounding it with sensory detail or a clear turn.',
      effect: 'Gives readers room to inhabit the moment before the next beat.',
      category: 'Pacing',
    })
  }
  if (dialogueRatio < 0.08 && words > 400) {
    add({
      title: 'Bring in dialogue',
      detail: 'Long stretches of narration without dialogue. A line of conflict-laden dialogue could lift the page.',
      effect: 'Dialogue accelerates pace and reveals character through voice.',
      category: 'Dialogue',
    })
  }
  if (longestParagraphWords > 180) {
    add({
      title: 'Break up a dense paragraph',
      detail: `Your longest paragraph runs ~${longestParagraphWords} words. Splitting it can sharpen rhythm.`,
      effect: 'Shorter paragraphs increase white space and perceived momentum.',
      category: 'Rhythm',
    })
  }
  if (adverbRatio > 0.05) {
    add({
      title: 'Trim adverbs',
      detail: `Adverbs make up ~${pct(adverbRatio)} of the prose. Stronger verbs often carry the same weight.`,
      effect: 'Tighter prose reads as more confident and vivid.',
      category: 'Style',
    })
  }
  if (uniqueWordRatio < 0.35 && words > 600) {
    add({
      title: 'Vary your vocabulary',
      detail: 'Word variety is on the low side — watch for repeated verbs and crutch words.',
      effect: 'Fresher word choice keeps the reader’s ear engaged.',
      category: 'Style',
    })
  }
  if (tensionLevel < 0.2 && words > 600) {
    add({
      title: 'Raise the stakes',
      detail: 'Tension reads low. What does the POV character stand to lose right now?',
      effect: 'Clear stakes pull the reader toward the next page.',
      category: 'Conflict',
    })
  }
  if (protagonist.includes('Not yet')) {
    add({
      title: 'Define your protagonist',
      detail: 'No protagonist is set in the codex and none dominates the text yet.',
      effect: 'A clear POV anchor orients the reader’s empathy.',
      category: 'Character',
    })
  }
  if (openThreads.length > 2) {
    add({
      title: 'Mind your open threads',
      detail: `${openThreads.length} plot threads are still open. Track which scenes will pay them off.`,
      effect: 'Deliberate payoff prevents loose ends and reader frustration.',
      category: 'Plot',
    })
  }
  if (!suggestions.length) {
    add({
      title: 'Solid foundation',
      detail: 'No structural red flags detected. Push on voice, subtext and escalating stakes.',
      effect: 'Refinement at this stage compounds into a confident draft.',
      category: 'General',
    })
  }

  return {
    projectId: project.id,
    scope,
    nodeId,
    generatedAt: Date.now(),
    provider: 'local',
    insights,
    suggestions,
    metrics: {
      words,
      sentences: stats.sentences,
      paragraphs: stats.paragraphs,
      dialogueRatio,
      avgSentenceLength,
      readingMinutes: stats.readingMinutes,
      adverbRatio,
      uniqueWordRatio,
      longestParagraphWords,
    },
  }
}

function pacingLabel(avgSentenceLength: number, dialogueRatio: number): string {
  if (avgSentenceLength < 11 || dialogueRatio > 0.4) return 'Brisk'
  if (avgSentenceLength > 24) return 'Languid / descriptive'
  return 'Measured'
}

function guessGenre(text: string): string | null {
  const lower = text.toLowerCase()
  const buckets: Record<string, string[]> = {
    Fantasy: ['magic', 'sword', 'dragon', 'kingdom', 'spell', 'elf', 'wizard', 'realm'],
    'Sci-Fi': ['ship', 'planet', 'android', 'space', 'laser', 'engine', 'galaxy', 'station'],
    Mystery: ['murder', 'detective', 'clue', 'body', 'suspect', 'case', 'evidence'],
    Romance: ['kiss', 'heart', 'love', 'blush', 'embrace', 'longing'],
    Thriller: ['gun', 'agent', 'target', 'bomb', 'chase', 'hostage'],
    Horror: ['blood', 'scream', 'dark', 'creature', 'corpse', 'haunt'],
  }
  let best: { genre: string; score: number } | null = null
  for (const [genre, kws] of Object.entries(buckets)) {
    const score = kws.reduce((n, k) => n + (lower.split(k).length - 1), 0)
    if (score > 0 && (!best || score > best.score)) best = { genre, score }
  }
  return best?.genre ?? null
}
