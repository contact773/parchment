import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import type { DocType, LanguageCode, Project, TreeNode } from '@/types'
import { analyzeStory } from '../analyzeLocal'

// ── Corpus loading ──────────────────────────────────────────────────────────
interface Case {
  id: string
  lang: LanguageCode
  text: string
  label: string
  specLabel?: string
  expectMatch: 'agree' | 'known-divergence'
  convention?: string
  tags?: string[]
}

// Eager-glob every fixture so a still-being-written corpus doesn't break import.
const files = import.meta.glob('./corpus/*.cases.json', { eager: true, import: 'default' }) as Record<string, Case[]>
const CORPUS: Record<string, Case[]> = {}
for (const [path, cases] of Object.entries(files)) {
  const param = path.replace(/.*\/(.+)\.cases\.json$/, '$1')
  CORPUS[param] = Array.isArray(cases) ? cases : []
}

// ── Drive the real integrated pipeline ──────────────────────────────────────
function run(text: string, lang: LanguageCode, docType: DocType = 'prose') {
  const project = {
    id: 'p', title: 'T', type: 'novel', status: 'drafting', language: lang,
    targetWords: 0, defaultDocType: 'prose', createdAt: 0, updatedAt: 0,
  } as Project
  const node = {
    id: 'n', projectId: 'p', parentId: null, type: 'scene', title: '', order: 0,
    status: 'draft', meta: {}, text, wordCount: 0, docType, createdAt: 0, updatedAt: 0,
  } as TreeNode
  return analyzeStory({ project, nodes: [node], characters: [], threads: [], scope: 'node', nodeId: 'n' })
}

const insight = (a: ReturnType<typeof run>, label: string) =>
  a.insights.find((i) => i.label === label)?.value ?? ''
const tag = (c: Case, prefix: string) => (c.tags ?? []).find((t) => t.startsWith(prefix))?.slice(prefix.length)
const docOf = (c: Case): DocType => {
  const d = tag(c, 'doc:')
  return d === 'script' || d === 'poetry' ? d : 'prose'
}

const normPov = (s: string) => {
  const t = s.toLowerCase()
  if (t.startsWith('first')) return 'First person'
  if (t.startsWith('second')) return 'Second person'
  if (t.startsWith('third')) return 'Third person'
  return 'Undetermined'
}
const mapPacing = (s: string) => (/brisk/i.test(s) ? 'Brisk' : /languid/i.test(s) ? 'Languid' : 'Measured')
const nameSet = (s: string) =>
  new Set(s.split(/[,;]/).map((x) => x.trim().toLowerCase()).filter((x) => x && x !== '—'))

// Reference MATTR(100) — deterministic ground truth for the vocab metric (the
// corpus's hand-computed vocab labels mix scales, so we recompute it here).
function refMattr(text: string): number {
  const toks = text.toLowerCase().match(/[\p{L}’'-]+/gu) ?? []
  const n = toks.length
  if (n === 0) return 0
  const W = 100
  if (n < W) return new Set(toks).size / n
  const freq = new Map<string, number>()
  let distinct = 0, sum = 0, count = 0
  for (let i = 0; i < n; i++) {
    const t = toks[i]; const f = freq.get(t) ?? 0; freq.set(t, f + 1); if (f === 0) distinct++
    if (i >= W) { const old = toks[i - W]; const of = freq.get(old)! - 1; freq.set(old, of); if (of === 0) distinct-- }
    if (i >= W - 1) { sum += distinct / W; count++ }
  }
  return count ? sum / count : new Set(toks).size / n
}

// ── Per-parameter comparator: returns predicted label/value as a string ──────
function predict(param: string, c: Case): string {
  const a = run(c.text, c.lang, docOf(c))
  switch (param) {
    case 'words': return String(a.metrics.words)
    case 'sentences': return String(a.metrics.sentences)
    case 'paragraphs': return String(a.metrics.paragraphs)
    case 'pov': return normPov(insight(a, 'Point of view'))
    case 'dialogue': return a.metrics.dialogueRatio > 0.02 ? 'yes' : 'no'
    case 'names': return [...nameSet(insight(a, 'Key figures'))].sort().join(',')
    case 'adverbs': return a.metrics.adverbRatio.toFixed(4)
    case 'vocab': return a.metrics.uniqueWordRatio.toFixed(4)
    case 'pacing': return mapPacing(insight(a, 'Pacing'))
    case 'tone': return insight(a, 'Tone')
    case 'tension': return insight(a, 'Tension level')
    case 'genre': { const g = insight(a, 'Genre'); return !g || /unspecified/i.test(g) ? 'none' : g }
    default: return ''
  }
}

function correct(param: string, c: Case, got: string): boolean {
  switch (param) {
    case 'words':
    case 'sentences':
    case 'paragraphs':
      return Number(got) === Number(c.label)
    case 'pov':
      return got === normPov(c.label)
    case 'dialogue':
      return got === c.label.trim().toLowerCase()
    case 'names': {
      const want = [...nameSet(c.label)].sort().join(',')
      return got === want
    }
    case 'adverbs': {
      const m = `${(c.tags ?? []).join(' ')} ${c.label}`.match(/ratio:\s*([\d.]+)/)
      const want = m ? Number(m[1]) : Number(c.label)
      return Number.isFinite(want) ? Math.abs(Number(got) - want) <= 0.015 : false
    }
    case 'vocab':
      return Math.abs(Number(got) - refMattr(c.text)) <= 0.02
    case 'pacing':
      return got === c.label.trim()
    case 'tone':
    case 'tension':
      return got.trim().toLowerCase() === c.label.trim().toLowerCase()
    case 'genre':
      return got.trim().toLowerCase() === c.label.trim().toLowerCase()
    default:
      return false
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
const PARAMS = ['words', 'sentences', 'paragraphs', 'pov', 'dialogue', 'names', 'adverbs', 'vocab', 'pacing', 'tone', 'tension', 'genre']

interface Bucket { ok: number; n: number }
function accuracyFor(param: string) {
  const all = CORPUS[param] ?? []
  const overall: Bucket = { ok: 0, n: 0 }
  const agree: Bucket = { ok: 0, n: 0 }
  const div: Bucket = { ok: 0, n: 0 }
  const misses: string[] = []
  for (const c of all) {
    const got = predict(param, c)
    const hit = correct(param, c, got)
    overall.n++; if (hit) overall.ok++
    const b = c.expectMatch === 'agree' ? agree : div
    b.n++; if (hit) b.ok++
    if (!hit) misses.push(`${c.id}[${c.lang}|${c.expectMatch[0]}] got=${JSON.stringify(got)} want=${JSON.stringify(c.label)}`)
  }
  const pct = (b: Bucket) => (b.n ? (100 * b.ok) / b.n : NaN)
  return { param, total: all.length, misses, overall, agree, div, oPct: pct(overall), aPct: pct(agree), dPct: pct(div) }
}

// Targets: objective/structural params should clear 95%; subjective params
// (tone/tension/genre) are expected to plateau low — evidence for removal.
const TARGET: Record<string, number> = {
  words: 95, sentences: 95, paragraphs: 95, pov: 90, dialogue: 90, names: 88,
  adverbs: 90, vocab: 88, pacing: 80,
}
// Removed from the LOCAL analysis (migrated to the advanced LLM panel). Their
// corpora are retained only as evidence that local heuristics can't hit ~95%.
const REMOVED = new Set(['tone', 'tension', 'genre'])

describe('story-analysis accuracy', () => {
  it('reports per-parameter accuracy (vs human label, all cases)', () => {
    const rows = PARAMS.map(accuracyFor)
    const cell = (p: number) => (isNaN(p) ? ' n/a ' : `${p.toFixed(1).padStart(5)}`)
    const lines: string[] = []
    lines.push('──── STORY-ANALYSIS ACCURACY (predicted vs human label) ────')
    lines.push(`${'param'.padEnd(11)}  overall │  agree │ diverg │ corpus`)
    rows.forEach((r) =>
      lines.push(REMOVED.has(r.param)
        ? `${r.param.padEnd(11)}  removed → advanced LLM panel   (corpus ${r.total}, kept as removal evidence)`
        : `${r.param.padEnd(11)}  ${cell(r.oPct)}% │ ${cell(r.aPct)}% │ ${cell(r.dPct)}% │ ${String(r.total).padStart(3)} (${r.overall.ok}/${r.overall.n})`),
    )
    const obj = rows.filter((r) => r.param in TARGET && r.overall.n > 0)
    const macro = obj.reduce((s, r) => s + r.oPct, 0) / (obj.length || 1)
    lines.push(`\nMACRO (objective params only): ${macro.toFixed(1)}%  over ${obj.length} params`)
    lines.push('\n──── MISSES ────')
    rows.forEach((r) => {
      if (r.misses.length) lines.push(`\n[${r.param}] ${r.misses.length}/${r.total} miss:\n  ${r.misses.slice(0, 16).join('\n  ')}`)
    })
    const out = lines.join('\n')
    console.log('\n' + out)
    try { writeFileSync(process.env.ACC_OUT || 'C:/Users/verca/AppData/Local/Temp/acc-report.txt', out) } catch { /* ignore */ }
    expect(rows.length).toBe(PARAMS.length)
    // Regression gate: every kept (objective) parameter must hold its target.
    for (const r of rows) {
      const t = TARGET[r.param]
      if (t != null) {
        expect(r.oPct, `${r.param} accuracy ${r.oPct.toFixed(1)}% < target ${t}%`).toBeGreaterThanOrEqual(t)
      }
    }
  })
})
