import { useEffect, useMemo, useRef, useState } from 'react'
import { Sparkles, Send, Loader2, Gauge, Lightbulb, ChevronDown } from 'lucide-react'
import type { Character, Location, PlotThread, Project, StoryAnalysis, TreeNode, WorldElement } from '@/types'
import { analyzeStory } from './analyzeLocal'
import { getProvider, localProvider, type ChatMessage, type StoryContext } from './providers'
import { Markdownish } from './Markdownish'
import { Segmented } from '@/components/ui/misc'
import { IconButton } from '@/components/ui/IconButton'
import { useSettings } from '@/store/useSettings'
import { useUI } from '@/store/useUI'
import { cn } from '@/lib/utils'

const QUICK = [
  { label: 'What next?', prompt: 'Where could this story go next?' },
  { label: 'Stronger conflict', prompt: 'How can I strengthen the conflict and stakes here?' },
  { label: 'Improve scene', prompt: 'How can I improve this scene?' },
  { label: 'Natural dialogue', prompt: 'How do I make the dialogue more natural?' },
  { label: 'Character ideas', prompt: 'Give me character development ideas.' },
  { label: 'Chapter ending', prompt: 'Suggest ways to end this chapter.' },
  { label: 'Possible twist', prompt: 'What twists could work from here?' },
  { label: 'Pacing', prompt: 'How is the pacing, and how could I improve it?' },
]

export function AssistantPanel({
  project,
  node,
  docNodes,
  characters,
  locations = [],
  threads,
  worldElements = [],
  seed,
  onSeedConsumed,
}: {
  project: Project
  node: TreeNode | null
  docNodes: TreeNode[]
  characters: Character[]
  locations?: Location[]
  threads: PlotThread[]
  worldElements?: WorldElement[]
  seed?: string
  onSeedConsumed?: () => void
}) {
  const ai = useSettings((s) => s.settings.ai)
  const toast = useUI((s) => s.toast)
  const [scope, setScope] = useState<'node' | 'project'>('node')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const analysis: StoryAnalysis = useMemo(() => {
    const nodes = scope === 'node' && node ? [node] : docNodes
    return analyzeStory({ project, nodes, characters, threads, scope, nodeId: node?.id })
  }, [project, node, docNodes, characters, threads, scope])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const lastSeed = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (seed && seed !== lastSeed.current) {
      lastSeed.current = seed
      void send(`About this passage: “${seed.slice(0, 600)}” — what works, and how could it be stronger? Give me options.`)
      onSeedConsumed?.()
    } else if (!seed) {
      // Reset once consumed so the same passage can be asked about again.
      lastSeed.current = undefined
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  const provider = useMemo(() => {
    const p = getProvider(ai)
    return p.ready ? p : localProvider
  }, [ai])

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    const next: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setBusy(true)
    const ctx: StoryContext = {
      project,
      node,
      sceneText: scope === 'node' && node ? node.text ?? '' : docNodes.map((n) => n.text ?? '').join('\n\n'),
      characters,
      locations,
      threads,
      worldElements,
      analysis,
    }
    try {
      const reply = await provider.generate(next, ctx)
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch {
      toast(`${provider.label} failed — using local assistant`, 'error')
      const reply = await localProvider.generate(next, ctx)
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-accent" />
          <span className="text-sm font-semibold">Story Assistant</span>
        </div>
        <Segmented
          size="sm"
          value={scope}
          onChange={(v) => setScope(v)}
          options={[
            { value: 'node', label: 'Scene' },
            { value: 'project', label: 'Project' },
          ]}
        />
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {/* Analysis */}
        <div className="overflow-hidden rounded-lg border border-border bg-surface-2/40">
          <button
            onClick={() => setShowAnalysis((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Gauge size={14} className="text-accent" /> Story analysis
            </span>
            <ChevronDown size={15} className={cn('text-muted transition-transform', !showAnalysis && '-rotate-90')} />
          </button>
          {showAnalysis && (
            <div className="space-y-3 border-t border-border px-3 py-3">
              <Meters analysis={analysis} />
              <div className="grid grid-cols-1 gap-1.5">
                {analysis.insights.map((i) => (
                  <div key={i.id} className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="shrink-0 text-muted">{i.label}</span>
                    <span
                      className={cn(
                        'truncate text-right font-medium',
                        i.tone === 'warn' ? 'text-danger' : i.tone === 'good' ? 'text-success' : 'text-text',
                      )}
                    >
                      {i.value}
                    </span>
                  </div>
                ))}
              </div>
              {analysis.suggestions.length > 0 && (
                <div className="space-y-2 border-t border-border pt-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                    <Lightbulb size={13} /> Craft notes
                  </div>
                  {analysis.suggestions.map((s) => (
                    <div key={s.id} className="rounded-md bg-surface px-2.5 py-2">
                      <div className="text-xs font-semibold text-text">{s.title}</div>
                      <div className="mt-0.5 text-xs text-muted">{s.detail}</div>
                      <div className="mt-1 text-[11px] italic text-accent/90">{s.effect}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Conversation */}
        {messages.length === 0 && (
          <p className="px-1 text-xs leading-relaxed text-muted">
            Ask for directions, conflict, dialogue help and more. The assistant always offers several options and
            explains the narrative effect of each — it never forces one path.
          </p>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="ml-6 rounded-lg rounded-br-sm bg-accent/15 px-3 py-2 text-sm text-text">
              {m.content}
            </div>
          ) : (
            <div key={i} className="mr-2 rounded-lg rounded-bl-sm border border-border bg-surface px-3 py-2.5">
              <Markdownish text={m.content} />
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 px-1 text-sm text-muted">
            <Loader2 size={14} className="animate-spin" /> Thinking…
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-1.5 border-t border-border px-3 pb-1 pt-2">
        {QUICK.map((q) => (
          <button
            key={q.label}
            disabled={busy}
            onClick={() => send(q.prompt)}
            className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-accent/50 hover:text-text disabled:opacity-50"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(input)
            }
          }}
          rows={1}
          placeholder={`Ask ${provider.label}…`}
          className="input-base max-h-32 min-h-[38px] flex-1 resize-none py-2"
        />
        <IconButton label="Send" onClick={() => send(input)} disabled={busy || !input.trim()} className="mb-0.5">
          <Send size={16} />
        </IconButton>
      </div>
    </div>
  )
}

function Meter({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[11px] text-muted">
        <span>{label}</span>
        {hint && <span>{hint}</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.max(2, value * 100))}%` }} />
      </div>
    </div>
  )
}

function Meters({ analysis }: { analysis: StoryAnalysis }) {
  const m = analysis.metrics
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
      <Meter label="Dialogue" value={m.dialogueRatio} hint={`${Math.round(m.dialogueRatio * 100)}%`} />
      <Meter label="Variety" value={m.uniqueWordRatio} hint={`${Math.round(m.uniqueWordRatio * 100)}%`} />
      <Meter label="Avg sentence" value={Math.min(1, m.avgSentenceLength / 30)} hint={`${m.avgSentenceLength.toFixed(0)}w`} />
      <Meter label="Adverbs" value={Math.min(1, m.adverbRatio * 12)} hint={`${(m.adverbRatio * 100).toFixed(1)}%`} />
    </div>
  )
}
