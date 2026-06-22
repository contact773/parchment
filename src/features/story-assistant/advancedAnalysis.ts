// Advanced (LLM-powered) story analysis — the comprehension-dependent parameters
// that local heuristics cannot measure accurately (subtext, theme, show-vs-tell,
// POV consistency, dialogue distinctiveness, on-the-nose lines, scene engine,
// continuity, and the craft dimensions specific to novels / scripts / poetry).
//
// All three doc kinds return ONE uniform JSON envelope so the UI renders them
// consistently; the doc-kind intelligence lives in the prompt (which dimensions
// to score and what to look for), not in divergent output shapes. The provider's
// `complete()` injects the codex + manuscript excerpt via contextBlock().
import type { Project, TreeNode } from '@/types'
import type { ChatMessage, StoryContext, StoryProvider } from './providers'

export type AdvancedDocKind = 'novel' | 'script' | 'poetry'

export interface AdvScore {
  key: string
  label: string
  score: number | null // 0..100, higher = stronger craft; null = not assessable
  note?: string
}
export interface AdvFinding {
  group?: string
  quote?: string
  issue: string
  suggestion?: string
  severity?: 'minor' | 'notable' | 'major'
}
export interface AdvPriority {
  priority: string
  why?: string
  where?: string
}
export interface AdvancedAnalysisResult {
  overall?: string
  scores?: AdvScore[]
  findings?: AdvFinding[]
  priorities?: AdvPriority[]
}

// ── Doc-kind resolution ─────────────────────────────────────────────────────
export function resolveDocKind(node: TreeNode | null, project: Project): AdvancedDocKind {
  const dt = node?.docType
  if (dt === 'script') return 'script'
  if (dt === 'poetry') return 'poetry'
  if (dt === 'prose') return 'novel'
  const pt = project.type
  if (pt === 'screenplay' || pt === 'stage-play' || pt === 'tv-episode' || pt === 'series') return 'script'
  if (pt === 'poetry') return 'poetry'
  return 'novel'
}

export const DOC_KIND_LABEL: Record<AdvancedDocKind, string> = {
  novel: 'novel / prose',
  script: 'screenplay',
  poetry: 'poetry',
}

// ── System prompt (editor role; replaces the partner prompt for this call) ───
export const ADVANCED_SYSTEM = [
  'You are a senior developmental and line editor working inside Parchment, a writing studio.',
  'You analyze a manuscript excerpt with the rigor of a professional editorial letter: specific, craft-aware, actionable, honest. You diagnose; you never rewrite the author’s book or impose a single "correct" direction. You respect the author’s voice and the conventions of the genre.',
  'You are given (above this message) the CODEX CONTEXT (the author’s own notes on characters, locations, plot threads, world rules, and the scene’s intended goal/conflict/outcome) and the CURRENT TEXT to analyze. Treat the codex as the author’s intent and measure the prose against it; reference characters/threads/locations BY NAME.',
  'Principles: every claim points to evidence (quote a short verbatim span ≤120 chars in the "quote" field). Be proportionate — surface the highest-leverage issues, not every nitpick. Distinguish a flaw from deliberate craft; when unsure, lower the score rather than assert. Scores are 0–100 calibrated against published professional work (50 = competent unpublished draft, 75 = solid professional, 90+ = exceptional) — do not grade-inflate. If the text is too short/fragmentary to assess a dimension, set its score to null and say so.',
  'You ALWAYS reply with a SINGLE valid JSON object and nothing else — no markdown, no code fences, no commentary before or after. Use straight quotes inside strings.',
].join('\n\n')

// ── Uniform output schema (described once, reused by every kind) ─────────────
const SCHEMA_BLOCK = `Return ONLY this JSON object:
{
  "overall": string,                       // 2-4 sentence editorial read of the excerpt as a whole
  "scores": [                              // one entry per dimension listed below, in that order
    { "key": string, "label": string, "score": number|null, "note": string }   // note: 1-2 sentences of specific evidence
  ],
  "findings": [                            // up to 12, highest-leverage first; each tied to a verbatim quote
    { "group": string, "quote": string, "issue": string, "suggestion": string, "severity": "minor"|"notable"|"major" }
  ],
  "priorities": [                          // exactly the 3 most important fixes, ranked
    { "priority": string, "why": string, "where": string }
  ]
}
Rules: valid JSON only; "quote" values are verbatim substrings of the text, ≤120 chars; scores 0-100 or null; cap findings at 12; no preamble or trailing text.`

const PROSE_DIMS = `Score these dimensions (use exactly these key/label pairs, in order):
- showVsTell ("Show vs. tell") — balance of dramatized scene vs. summary/telling; telling that correctly bridges is fine.
- povConsistency ("POV consistency") — head-hopping, filter words ("she saw/felt"), distance breaks, person slips vs. the declared POV.
- subtext ("Subtext & on-the-nose") — do characters say their feelings outright, or is there a layer beneath?
- dialogueDistinctiveness ("Dialogue distinctiveness") — can you tell who's speaking without tags; does voice match the codex.
- sceneEngine ("Scene engine") — is there a clear goal, conflict, and a value-shift/outcome; does it match the intended scene goal in the codex.
- tensionPacing ("Tension & pacing") — momentum, slack stretches, where it sags or rushes.
- proseEconomy ("Prose economy") — filter words, weak verb+adverb, redundancy, overwriting.
- openingHook ("Opening & closing") — strength of the first and last lines / propulsion into the next beat.
- themeResonance ("Thematic resonance") — what themes surface and whether they're earned vs. stated.
For "findings", prioritize: on-the-nose lines, filter words / weak verbs (with a tighter rewrite), telling-after-showing, POV violations, continuity errors vs. the codex (physical state, timeline, knowledge, object), and any character action that contradicts their codex motivation/voice. Set "group" to the dimension it relates to.`

const SCRIPT_DIMS = `Score these dimensions (use exactly these key/label pairs, in order):
- formatCraft ("Format & craft") — slugline/action/dialogue discipline; redundant parentheticals, over-direction, novelistic action, camera-usurping.
- visualStorytelling ("Visual storytelling") — is the story told in images and action, or leaning on dialogue to carry what should be seen.
- sceneEconomy ("Scene economy") — do scenes enter late and leave early; any that overstay, start too early, or are redundant.
- dialogueDistinctiveness ("Dialogue distinctiveness") — distinct, castable voices vs. interchangeable lines; on-the-nose vs. subtext.
- exposition ("Exposition handling") — "as you know" / unmotivated backstory / information dumps vs. motivated reveals.
- characterAgency ("Causality & agency") — does the scene run on "therefore/but" causality or "and then" episodic drift; protagonist driving vs. passive.
- dramaticTension ("Dramatic tension") — the charge of the scene start to end; is there a turn; the dramatic question.
For "findings", prioritize: on-the-nose / as-you-know-bob lines, unfilmable action ("he remembers..."), scenes that should be cut or entered later, and format violations. Set "group" to the dimension it relates to.`

const POETRY_DIMS = `Score these dimensions (use exactly these key/label pairs, in order):
- prosodyMeter ("Prosody & rhythm") — metrical control or free-verse cadence; where the music falters.
- lineBreaks ("Line breaks") — do breaks do work (tension, enjambment, surprise) or fall on inert words.
- soundTexture ("Sound texture") — alliteration, assonance, consonance, rhyme (if any) and whether it's earned vs. forced.
- figurativeFreshness ("Figurative freshness") — originality of metaphor/simile; dead metaphors and clichés.
- imageConcreteness ("Image & concreteness") — specific sensory images vs. abstraction/telling-emotion.
- dictionRegister ("Diction & register") — word choice consistency and precision; archaisms/poeticisms that don't earn their place.
- voltaTurn ("Turn / volta") — is there a turn or development of thought, or does it stay static.
- endingResonance ("Ending resonance") — does the close land and resonate, or trail off / over-explain.
For "findings", prioritize: clichés and on-the-nose abstraction (quote the line), inert line breaks, forced rhyme/meter, and the single strongest moment to build on. Set "group" to the dimension it relates to. Quote whole lines where possible.`

const DIMS: Record<AdvancedDocKind, string> = { novel: PROSE_DIMS, script: SCRIPT_DIMS, poetry: POETRY_DIMS }
const ROLE: Record<AdvancedDocKind, string> = {
  novel: 'Analyze the prose excerpt above as a developmental + line editor for long-form fiction.',
  script: 'Analyze the script pages above as a script editor / story analyst (coverage-grade).',
  poetry: 'Analyze the poem(s) above as a poetry editor.',
}

export function buildAdvancedMessages(kind: AdvancedDocKind): ChatMessage[] {
  const content = `${ROLE[kind]}\n\n${DIMS[kind]}\n\n${SCHEMA_BLOCK}`
  return [{ role: 'user', content }]
}

/** Lenient parse: strips code fences and any pre/post-amble, slices to the
 *  outermost braces, and shape-checks. Returns null on irrecoverable output. */
export function parseAdvanced(raw: string): AdvancedAnalysisResult | null {
  let s = (raw ?? '').trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  if (a < 0 || b <= a) return null
  try {
    const obj = JSON.parse(s.slice(a, b + 1)) as unknown
    if (!obj || typeof obj !== 'object') return null
    const o = obj as AdvancedAnalysisResult
    const result: AdvancedAnalysisResult = {
      overall: typeof o.overall === 'string' ? o.overall : undefined,
      scores: Array.isArray(o.scores) ? o.scores.filter((x) => x && typeof x.label === 'string') : [],
      findings: Array.isArray(o.findings) ? o.findings.filter((x) => x && typeof x.issue === 'string') : [],
      priorities: Array.isArray(o.priorities) ? o.priorities.filter((x) => x && typeof x.priority === 'string') : [],
    }
    // No displayable content → let the caller fall back to raw text.
    if (!result.overall && !result.scores!.length && !result.findings!.length && !result.priorities!.length) return null
    return result
  } catch {
    return null
  }
}

/** Run the advanced analysis through a (real) provider. Returns the raw model text. */
export function runAdvancedAnalysis(provider: StoryProvider, kind: AdvancedDocKind, ctx: StoryContext): Promise<string> {
  return provider.complete(buildAdvancedMessages(kind), ctx, ADVANCED_SYSTEM)
}
