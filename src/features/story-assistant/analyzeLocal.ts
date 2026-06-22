import type {
  Character, DocType, LanguageCode, PlotThread, Project, StoryAnalysis, StoryInsight, StorySuggestion, TreeNode,
} from '@/types'
import { uid } from '@/lib/id'
import { analyzeText, splitSentences, countWords } from '@/lib/text'
import {
  PRONOUNS, FIRST_PERSON_VERBS, FIRST_PLURAL_ENDINGS, HONORIFICS, SAID_VERBS, PARTICLES, NAME_STOPWORDS,
  CALENDAR, PLACES, ADVERB_RE, ADVERB_LOW_CONFIDENCE, EN_ADVERB_STOPLIST, FR_ADVERB_STOPLIST, forLang,
} from './lexicons'

const WORD_TOKEN = /[\p{L}'’-]+/gu
const tokenize = (s: string): string[] => (s.toLowerCase().match(WORD_TOKEN) ?? [])

// Remove quoted/dialogue spans so narrative POV is measured on NARRATION only.
function stripDialogue(text: string): string {
  return text
    .replace(/[“„][^”“]*[”“]/gu, ' ') // directional / German „…"
    .replace(/«[^»]*»/gu, ' ') // guillemets
    .replace(/"([^"\n]{0,400})"/g, (m, inner: string) => (/\s/.test(inner) && inner.trim().length > 2 ? ' ' : m))
    .replace(/^\s*[—–][^\n]*/gmu, ' ') // em/en-dash dialogue lines
}

// ── Point of view (multilingual) ────────────────────────────────────────────
function detectPOV(text: string, lang: LanguageCode): { label: string; confidence: number } {
  const toks = tokenize(stripDialogue(text))
  if (toks.length < 8) return { label: 'Undetermined', confidence: 0 }
  const p = forLang(PRONOUNS, lang)
  const first = new Set(p.first.map((x) => x.replace(/['’]$/, '')))
  const second = new Set(p.second.map((x) => x.replace(/['’]$/, '')))
  const third = new Set(p.third)
  let s1 = 0, s2 = 0, s3 = 0
  for (const t of toks) {
    if (first.has(t)) s1++
    else if (second.has(t)) s2++
    else if (third.has(t)) s3++
  }
  // Pro-drop backstop for Spanish/French first-person narration.
  const fpv = FIRST_PERSON_VERBS[lang]
  if (fpv) {
    const fset = new Set(fpv)
    const ending = FIRST_PLURAL_ENDINGS[lang]
    for (const t of toks) {
      if (fset.has(t)) s1 += 2
      else if (ending && ending.test(t) && t.length > 4) s1 += 1
    }
  }
  const total = s1 + s2 + s3
  if (total < Math.max(2, toks.length / 90)) return { label: 'Undetermined', confidence: 0.2 }

  const ranked: Array<[string, number]> = [['First person', s1], ['Second person', s2], ['Third person', s3]]
  ranked.sort((a, b) => b[1] - a[1])
  let [label, top] = ranked[0]
  // Second-person narration is rare — only accept it if it clearly dominates.
  if (label === 'Second person' && !(s2 >= 2 * Math.max(s1, s3) && s2 >= 3)) {
    ;[label, top] = ranked[1]
  }
  return { label, confidence: total ? top / total : 0 }
}

// ── Name / key-figure detection (multilingual, evidence-scored) ──────────────
interface NameHit { name: string; count: number }
function detectNames(text: string, lang: LanguageCode): NameHit[] {
  const honor = forLang(HONORIFICS, lang)
  const said = forLang(SAID_VERBS, lang)
  const stop = forLang(NAME_STOPWORDS, lang)
  const cal = forLang(CALENDAR, lang)
  const particles = forLang(PARTICLES, lang)
  const sentences = splitSentences(text, lang)
  const isCand = (w: string) => /^\p{Lu}[\p{Ll}'’-]+$/u.test(w) || /^\p{Lu}{2,}$/u.test(w)
  const cleanTok = (w: string) =>
    w.replace(/^[^\p{L}]+/u, '').replace(/[^\p{L}'’]+$/u, '').replace(/[’']s$/u, '')

  interface Cand { count: number; nonInitial: number; evidence: number }
  const cands = new Map<string, Cand>()
  for (const sent of sentences) {
    const words = sent.split(/\s+/).filter(Boolean)
    for (let i = 0; i < words.length; i++) {
      const head = cleanTok(words[i])
      if (head.length < 2 || !isCand(head)) continue
      const lower = head.toLowerCase()
      if (stop.has(lower) || cal.has(lower) || PLACES.has(lower) || honor.has(lower)) continue
      // Merge preceding lowercase particles into one entity (van den Berg, de la Cruz).
      const parts = [head]
      let j = i - 1
      while (j >= 0 && particles.has(cleanTok(words[j]).toLowerCase())) {
        parts.unshift(cleanTok(words[j]))
        j--
      }
      const name = parts.join(' ')
      const before = (j >= 0 ? cleanTok(words[j]) : '').toLowerCase()
      const nextWord = i < words.length - 1 ? cleanTok(words[i + 1]).toLowerCase() : ''
      const c = cands.get(name) ?? { count: 0, nonInitial: 0, evidence: 0 }
      c.count++
      if (j + 1 > 0) c.nonInitial++ // the entity does not start the sentence
      if (honor.has(before)) c.evidence += 2
      if (said.has(nextWord) || said.has(before)) c.evidence += 2
      cands.set(name, c)
    }
  }

  const out: Array<{ name: string; score: number }> = []
  for (const [name, c] of cands) {
    // Sentence-initial-only words need corroboration (a non-initial use or evidence).
    if (c.nonInitial === 0 && c.evidence === 0 && c.count < 3) continue
    // German capitalizes every noun — demand evidence or a high count to avoid common nouns.
    if (lang === 'de' && c.evidence === 0 && c.count < 4) continue
    if (c.count >= 2 || c.evidence > 0) out.push({ name, score: c.count + c.evidence })
  }
  out.sort((a, b) => b.score - a.score)
  return out.map(({ name, score }) => ({ name, count: score }))
}

// ── Dialogue ratio (letter-coverage, doc-type aware) ─────────────────────────
function dialogueRatio(text: string, docType: DocType, lang: LanguageCode): number | undefined {
  if (docType === 'poetry') return undefined
  const totalLetters = (text.match(/\p{L}/gu) ?? []).length
  if (!totalLetters) return 0
  const said = forLang(SAID_VERBS, lang)
  const lettersIn = (s: string) => (s.match(/\p{L}/gu) ?? []).length

  if (docType === 'script') {
    // A CHARACTER cue (all-caps name line, or "NAME:") opens dialogue lines until
    // a blank line or a scene heading.
    let inDialogue = false, dialogueLetters = 0, cueSeen = false
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (!t) { inDialogue = false; continue }
      if (/^(int|ext|innen|au(ss|ß)en|szene|scene|fade|cut to|dissolve)/i.test(t)) { inDialogue = false; continue }
      if (/^[ \t]*[\p{Lu}][\p{L}.'’ -]{0,30}(?:\([^)]*\))?\s*:\s*\S/u.test(line)) {
        cueSeen = true; inDialogue = true; dialogueLetters += lettersIn(line); continue
      }
      if (/^[ \t]*[\p{Lu}][\p{Lu}'’ ]{0,24}(?:\([^)]*\))?$/u.test(line) && t.split(/\s+/).length <= 4) {
        cueSeen = true; inDialogue = true; continue
      }
      if (inDialogue) dialogueLetters += lettersIn(line)
    }
    if (cueSeen) return Math.min(1, dialogueLetters / totalLetters)
    // No cues — fall through to prose-style quote coverage.
  }

  const covered = new Array(text.length).fill(false)
  const markRange = (a: number, b: number) => { for (let i = a; i < b && i < text.length; i++) covered[i] = true }
  const near = (idx: number) => {
    const around = text.slice(Math.max(0, idx - 28), idx + 28).toLowerCase()
    return [...said].some((v) => around.includes(v))
  }
  const opensLine = (idx: number) => {
    const nl = text.lastIndexOf('\n', idx - 1)
    return idx === 0 || (nl !== -1 && text.slice(nl + 1, idx).trim() === '')
  }
  // A span reads as speech (vs. a scare-quote) if a speech verb is near, it opens
  // a line, it contains sentence punctuation, or it is a multi-word clause.
  const isSpeech = (inner: string, idx: number) =>
    near(idx) || opensLine(idx) || /[.!?…]/u.test(inner) || inner.trim().split(/\s+/).length >= 5

  // Directional “…” / German „…“ / guillemets «…» / single guillemets ‹…›.
  for (const re of [/[“„]([^”“]*)[”“]/gu, /«([^»]*)»/gu, /‹([^›]*)›/gu]) {
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      const inner = m[1] ?? ''
      if (inner.trim().length >= 2 && isSpeech(inner, m.index)) markRange(m.index, m.index + m[0].length)
    }
  }
  // Straight double quotes: speech-verb or line-opening only (no clause rule, so
  // a quoted citation-sentence isn't mistaken for dialogue).
  {
    const re = /"([^"\n]{0,400})"/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
      if (m[1].trim().length < 2) continue
      // verb before the open quote, a trailing tag after the close, or line-opening.
      if (near(m.index) || near(m.index + m[0].length) || opensLine(m.index)) markRange(m.index, m.index + m[0].length)
    }
  }
  // Em-dash dialogue is a continental convention — not English typographic dashes.
  if (lang !== 'en') {
    const re = /^\s*[—–]\s?\p{L}[^\n]*/gmu
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) markRange(m.index, m.index + m[0].length)
  }
  let inside = 0
  for (let i = 0; i < text.length; i++) if (covered[i] && /\p{L}/u.test(text[i])) inside++
  return Math.min(1, inside / totalLetters)
}

// ── Vocabulary variety: MATTR(100) (length-robust) ───────────────────────────
function mattr(toks: string[], window = 100): number {
  const n = toks.length
  if (n === 0) return 0
  if (n < window) return new Set(toks).size / n // TTR for short inputs
  const freq = new Map<string, number>()
  let distinct = 0, sum = 0, count = 0
  for (let i = 0; i < n; i++) {
    const t = toks[i]
    const f = freq.get(t) ?? 0
    freq.set(t, f + 1)
    if (f === 0) distinct++
    if (i >= window) {
      const old = toks[i - window]
      const of = freq.get(old)! - 1
      freq.set(old, of)
      if (of === 0) distinct--
    }
    if (i >= window - 1) {
      sum += distinct / window
      count++
    }
  }
  return count ? sum / count : new Set(toks).size / n
}

// ── Adverb ratio (per-language) ──────────────────────────────────────────────
function adverbInfo(text: string, lang: LanguageCode, words: number): { ratio: number; lowConf: boolean } {
  if (!words) return { ratio: 0, lowConf: false }
  const matches = text.match(forLang(ADVERB_RE, lang)) ?? []
  const stop = lang === 'en' ? EN_ADVERB_STOPLIST : lang === 'fr' ? FR_ADVERB_STOPLIST : null
  const count = stop ? matches.filter((w) => !stop.has(w.toLowerCase())).length : matches.length
  return { ratio: count / words, lowConf: forLang(ADVERB_LOW_CONFIDENCE, lang) }
}

// ── Pacing (distribution-aware) ──────────────────────────────────────────────
function pacingLabel(text: string, lang: LanguageCode): string {
  const sents = splitSentences(text, lang)
  if (!sents.length) return 'Measured'
  const lens = sents.map((s) => countWords(s)).sort((a, b) => a - b)
  const median = lens[Math.floor(lens.length / 2)]
  const shortFrac = lens.filter((l) => l <= 8).length / lens.length
  if (median <= 11 || shortFrac > 0.55) return 'Brisk'
  if (median >= 22) return 'Languid / descriptive'
  return 'Measured'
}

// ── Main ─────────────────────────────────────────────────────────────────────
export interface AnalyzeInput {
  project: Project
  nodes: TreeNode[]
  characters: Character[]
  threads: PlotThread[]
  scope: 'project' | 'node'
  nodeId?: string
}

const pct = (n: number): string => `${Math.round(n * 100)}%`

export function analyzeStory(input: AnalyzeInput): StoryAnalysis {
  const { project, nodes, characters, threads, scope, nodeId } = input
  const docNodes = nodes.filter((n) => (n.text ?? '').trim())
  const text = docNodes.map((n) => n.text ?? '').filter(Boolean).join('\n\n')
  const lang: LanguageCode =
    (scope === 'node' && docNodes[0]?.meta?.language) || project.language || 'en'
  // Dominant doc type across analysed nodes (script/poetry change dialogue handling).
  const docType: DocType = docNodes[0]?.docType ?? project.defaultDocType ?? 'prose'

  const stats = analyzeText(text, lang)
  const words = stats.words
  const toks = tokenize(text)

  // The interpretive detectors run on a bounded prefix so a whole-manuscript
  // project-scope pass can't stall the UI; the linear metrics use full text.
  const body = text.length > 200_000 ? text.slice(0, 200_000) : text

  const dialogue = dialogueRatio(body, docType, lang)
  const adverb = adverbInfo(text, lang, words)
  const uniqueWordRatio = mattr(toks)
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const longestParagraphWords = paragraphs.reduce((mx, p) => Math.max(mx, countWords(p)), 0)
  const avgSentenceLength = stats.sentences ? words / stats.sentences : 0

  const names = detectNames(body, lang)
  const pov = detectPOV(body, lang)

  // Protagonist: codex role first, else most-evidenced figure, with a
  // first-person cross-check for unnamed narrators.
  let protagonist = characters.find((c) => c.role === 'protagonist')?.name
  let protagonistConfidence = protagonist ? 1 : 0
  if (!protagonist) {
    const top = names[0]
    const second = names[1]
    if (pov.label.startsWith('First person') && (!top || (second && top.count < 1.5 * second.count))) {
      protagonist = 'First-person narrator'
      protagonistConfidence = 0.6
    } else if (top) {
      protagonist = top.name
      protagonistConfidence = second ? top.count / (top.count + second.count) : 0.7
    } else {
      protagonist = 'Not yet established'
    }
  }

  // ── Insights ───────────────────────────────────────────────────────────────
  const insights: StoryInsight[] = []
  const add = (i: Omit<StoryInsight, 'id'>) => insights.push({ id: uid(6), ...i })

  add({ label: 'Genre', value: project.genre || 'Unspecified', tone: 'neutral' })
  add({
    label: 'Point of view',
    value: pov.label,
    confidence: pov.confidence,
    tone: pov.label === 'Undetermined' || pov.confidence < 0.5 ? 'warn' : 'neutral',
  })
  add({
    label: 'Protagonist',
    value: protagonist,
    confidence: protagonistConfidence,
    tone: protagonist.includes('Not yet') ? 'warn' : 'good',
  })
  if (docType !== 'poetry') {
    add({ label: 'Pacing', value: pacingLabel(body, lang), tone: 'neutral' })
    const dr = dialogue ?? 0
    add({
      label: 'Dialogue balance',
      value: dr < 0.1 ? `Sparse (${pct(dr)})` : `${pct(dr)} of prose`,
      tone: dr < 0.08 && words > 400 ? 'warn' : 'good',
    })
  }
  add({ label: 'Key figures', value: names.slice(0, 5).map((n) => n.name).join(', ') || '—', tone: 'neutral' })

  const openThreads = threads.filter((t) => t.status !== 'resolved')
  if (openThreads.length) {
    add({
      label: 'Unresolved threads',
      value: `${openThreads.length}: ${openThreads.slice(0, 3).map((t) => t.name).join(', ')}`,
      tone: 'warn',
    })
  }

  // ── Suggestions (objective, metric-driven) ──────────────────────────────────
  const suggestions: StorySuggestion[] = []
  const sug = (s: Omit<StorySuggestion, 'id'>) => suggestions.push({ id: uid(6), ...s })
  const dr = dialogue ?? 0

  if (words < 300 && scope === 'node') {
    sug({ title: 'Develop the scene', detail: 'This scene is quite short. Consider grounding it with sensory detail or a clear turn.', effect: 'Gives readers room to inhabit the moment before the next beat.', category: 'Pacing' })
  }
  if (docType === 'prose' && dr < 0.08 && words > 400) {
    sug({ title: 'Bring in dialogue', detail: 'Long stretches of narration without dialogue. A line of conflict-laden dialogue could lift the page.', effect: 'Dialogue accelerates pace and reveals character through voice.', category: 'Dialogue' })
  }
  if (longestParagraphWords > 180) {
    sug({ title: 'Break up a dense paragraph', detail: `Your longest paragraph runs ~${longestParagraphWords} words. Splitting it can sharpen rhythm.`, effect: 'Shorter paragraphs increase white space and perceived momentum.', category: 'Rhythm' })
  }
  if (!adverb.lowConf && adverb.ratio > 0.05) {
    sug({ title: 'Trim adverbs', detail: `Adverbs make up ~${pct(adverb.ratio)} of the prose. Stronger verbs often carry the same weight.`, effect: 'Tighter prose reads as more confident and vivid.', category: 'Style' })
  }
  if (uniqueWordRatio < 0.65 && words > 150) {
    sug({ title: 'Vary your vocabulary', detail: 'Word variety is on the low side — watch for repeated verbs and crutch words.', effect: 'Fresher word choice keeps the reader’s ear engaged.', category: 'Style' })
  }
  if (protagonist.includes('Not yet')) {
    sug({ title: 'Define your protagonist', detail: 'No protagonist is set in the codex and none dominates the text yet.', effect: 'A clear POV anchor orients the reader’s empathy.', category: 'Character' })
  }
  if (openThreads.length > 2) {
    sug({ title: 'Mind your open threads', detail: `${openThreads.length} plot threads are still open. Track which scenes will pay them off.`, effect: 'Deliberate payoff prevents loose ends and reader frustration.', category: 'Plot' })
  }
  if (!suggestions.length) {
    sug({ title: 'Solid foundation', detail: 'No structural flags detected. Run an Advanced analysis for craft-level feedback on subtext, theme and voice.', effect: 'Refinement at this stage compounds into a confident draft.', category: 'General' })
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
      paragraphs: paragraphs.length,
      dialogueRatio: dialogue ?? 0,
      avgSentenceLength,
      readingMinutes: stats.readingMinutes,
      adverbRatio: adverb.ratio,
      uniqueWordRatio,
      longestParagraphWords,
    },
  }
}
