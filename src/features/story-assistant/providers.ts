import type { AIConfig, Character, Project, StoryAnalysis, TreeNode } from '@/types'
import { analyzeText } from '@/lib/text'
import { checkGrammar, strongerWords, synonymsFor, simplify } from './language'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export type TransformKind =
  | 'rewrite'
  | 'improve'
  | 'literary'
  | 'simpler'
  | 'dramatic'
  | 'emotional'
  | 'natural'
  | 'translate'
  | 'synonyms'
  | 'stronger'
  | 'tone'
  | 'grammar'
  | 'ask'

export interface TransformResult {
  kind: TransformKind
  /** Replacement prose (for rewrite-style transforms). */
  replacement?: string
  /** Free-text feedback / explanation. */
  message?: string
  /** Pickable alternatives (e.g. synonyms) that replace the selection. */
  options?: string[]
}

export interface TransformOpts {
  targetLang?: string
}

const REWRITE_KINDS: TransformKind[] = ['rewrite', 'improve', 'literary', 'simpler', 'dramatic', 'emotional', 'natural', 'translate']

const KIND_INSTRUCTION: Record<TransformKind, string> = {
  rewrite: 'Rewrite the passage, preserving meaning and the author’s voice, but improving flow and clarity.',
  improve: 'Improve the passage: tighten the prose, strengthen verbs, and cut filler — keep the voice.',
  literary: 'Rewrite the passage in a more literary, evocative register without becoming purple.',
  simpler: 'Rewrite the passage in clearer, simpler language with shorter sentences.',
  dramatic: 'Rewrite the passage to heighten tension and drama while staying true to the content.',
  emotional: 'Rewrite the passage to deepen the emotional resonance and interiority.',
  natural: 'Rewrite the passage so dialogue and narration sound more natural and human.',
  translate: 'Translate the passage faithfully, preserving tone and register.',
  synonyms: 'List stronger synonyms for the notable words in the passage.',
  stronger: 'Suggest stronger word choices for weak or repeated words in the passage.',
  tone: 'Offer three alternative tones for the passage and describe each.',
  grammar: 'Proofread the passage and list grammar, punctuation and style issues.',
  ask: 'Answer the user’s question about the passage as a story-development partner.',
}

export interface StoryContext {
  project: Project
  node?: TreeNode | null
  sceneText: string
  characters: Character[]
  analysis: StoryAnalysis
}

export interface StoryProvider {
  id: string
  label: string
  /** True if the provider is configured and usable. */
  ready: boolean
  generate: (messages: ChatMessage[], context: StoryContext) => Promise<string>
  transform: (kind: TransformKind, text: string, context: StoryContext, opts?: TransformOpts) => Promise<TransformResult>
}

// ── Context helpers ───────────────────────────────────────────────────────

function insight(ctx: StoryContext, label: string): string {
  return ctx.analysis.insights.find((i) => i.label.toLowerCase().startsWith(label.toLowerCase()))?.value ?? '—'
}

function lastSnippet(text: string, words = 40): string {
  const w = text.trim().split(/\s+/)
  return w.slice(-words).join(' ')
}

function systemPrompt(): string {
  return [
    'You are a thoughtful story-development partner inside Parchment, a writing studio for serious authors and screenwriters.',
    'Principles:',
    '- ALWAYS offer multiple distinct creative options (usually three), never a single mandated direction.',
    '- For EACH option, explain the narrative effect it would have (pacing, tension, character, theme).',
    '- Be specific to the material provided; reference the characters and situation by name.',
    '- Respect the author’s voice. Suggest, never overwrite. Keep it concise and use light markdown.',
  ].join('\n')
}

function contextBlock(ctx: StoryContext): string {
  const p = ctx.project
  return [
    `PROJECT: "${p.title}" — type: ${p.type}, genre: ${p.genre || insight(ctx, 'genre')}, language: ${p.language}.`,
    p.logline ? `LOGLINE: ${p.logline}` : '',
    `DETECTED — tone: ${insight(ctx, 'tone')}; POV: ${insight(ctx, 'point of view')}; pacing: ${insight(ctx, 'pacing')}; tension: ${insight(ctx, 'tension')}.`,
    `PROTAGONIST: ${insight(ctx, 'protagonist')}. ANTAGONIST: ${insight(ctx, 'antagonist')}.`,
    ctx.characters.length
      ? `CHARACTERS: ${ctx.characters.map((c) => `${c.name} (${c.role}${c.goal ? `, wants: ${c.goal}` : ''})`).join('; ')}.`
      : '',
    ctx.node ? `CURRENT DOCUMENT: "${ctx.node.title}" (${ctx.node.docType}).` : '',
    ctx.sceneText ? `CURRENT TEXT (excerpt):\n"""${ctx.sceneText.slice(0, 4000)}"""` : 'No text written yet.',
  ]
    .filter(Boolean)
    .join('\n')
}

// ── Local, rule-based provider (zero-config default) ───────────────────────

type Option = { title: string; body: string; effect: string }

function block(intro: string, options: Option[]): string {
  return [
    intro,
    '',
    ...options.map(
      (o, i) => `**${i + 1}. ${o.title}**\n${o.body}\n_Effect:_ ${o.effect}`,
    ),
    '',
    '_Pick one, blend them, or push back — these are doors, not directions._',
  ].join('\n')
}

function localGenerate(messages: ChatMessage[], ctx: StoryContext): string {
  const q = (messages.filter((m) => m.role === 'user').pop()?.content ?? '').toLowerCase()
  const hero = insight(ctx, 'protagonist').includes('Not yet') ? 'your protagonist' : insight(ctx, 'protagonist')
  const foe = insight(ctx, 'antagonist').includes('Not yet') ? 'the opposing force' : insight(ctx, 'antagonist')
  const tone = insight(ctx, 'tone').toLowerCase()
  const has = (...k: string[]) => k.some((x) => q.includes(x))
  const snippet = ctx.sceneText ? lastSnippet(ctx.sceneText, 24) : ''

  if (has('next', 'where', 'go from here', 'continue', 'happen')) {
    return block(`A few directions ${hero} could move from here:`, [
      { title: 'Raise the cost', body: `Force ${hero} to act before they’re ready — remove the safe option.`, effect: 'Converts hesitation into momentum and tests resolve under pressure.' },
      { title: 'Turn the screw with ${foe}'.replace('${foe}', foe), body: `Let ${foe} make a move that reframes what’s really at stake.`, effect: 'Externalizes conflict and clarifies the antagonist’s agency.' },
      { title: 'A quiet reversal', body: `An ally reveals a secret, or a small kindness lands at the worst moment.`, effect: 'Buys emotional contrast before the next escalation — earns the reader’s trust.' },
    ])
  }
  if (has('conflict', 'stakes', 'tension', 'raise')) {
    return block(`Ways to deepen the conflict around ${hero}:`, [
      { title: 'Make the goal and fear collide', body: `Set up a choice where getting what they want costs what they’re most afraid to lose.`, effect: 'Internal + external conflict fuse, which reads as real stakes.' },
      { title: 'Give the opposition a point', body: `Let ${foe} be partly right. Argue their side convincingly.`, effect: 'A credible antagonist makes victory feel uncertain and earned.' },
      { title: 'Add a ticking clock', body: 'Attach a deadline or dwindling resource to the scene’s objective.', effect: 'Time pressure compresses decisions and accelerates pace.' },
    ])
  }
  if (has('dialogue', 'speech', 'talk', 'conversation')) {
    return block('Make the dialogue feel more natural:', [
      { title: 'Let them talk past each other', body: 'Characters rarely answer the question asked — give each their own agenda.', effect: 'Subtext and friction replace on-the-nose exposition.' },
      { title: 'Cut the greetings', body: 'Enter late, leave early. Trim hellos, confirmations and logistics.', effect: 'Sharper rhythm; every line carries weight.' },
      { title: 'Anchor lines in action', body: 'Break speech with small physical beats specific to the setting.', effect: 'Grounds the talk in the body and the room — less floating dialogue.' },
    ])
  }
  if (has('improve', 'better', 'fix', 'scene', 'rewrite')) {
    return block(`Three lenses for strengthening this ${ctx.node?.docType === 'script' ? 'scene' : 'passage'}:`, [
      { title: 'Sharpen the scene goal', body: `Name what ${hero} wants in the first lines, then put it in jeopardy.`, effect: 'A clear want gives the scene a spine and a reason to exist.' },
      { title: 'Cut to the change', body: 'Find the moment something shifts and start closer to it.', effect: 'Removes throat-clearing; the scene begins where it matters.' },
      { title: 'Promise, then complicate', body: snippet ? `You end near: “…${snippet}”. Let the next beat undercut that expectation.` : 'Set an expectation, then deny or twist it.', effect: 'Reversal keeps the reader leaning forward.' },
    ])
  }
  if (has('character', 'arc', 'develop', 'motivation', 'backstory')) {
    return block(`Character development moves for ${hero}:`, [
      { title: 'Contradiction', body: 'Give them a belief and an action that betrays it.', effect: 'Contradiction reads as depth and sets up an arc to resolve.' },
      { title: 'A want vs. a need', body: 'Let them chase the wrong thing for understandable reasons.', effect: 'Creates dramatic irony and a satisfying eventual turn.' },
      { title: 'Pressure reveals', body: 'Drop them into a choice with no clean option.', effect: 'Decisions under pressure define character more than description.' },
    ])
  }
  if (has('end', 'ending', 'chapter end', 'cliff', 'close')) {
    return block('Ways to end this chapter:', [
      { title: 'Button on a question', body: 'Close on a line that opens a new doubt rather than resolving one.', effect: 'Pulls the reader into the next chapter.' },
      { title: 'Reversal of fortune', body: 'Flip the apparent win or loss in the final beat.', effect: 'Momentum spike; resets expectations.' },
      { title: 'Quiet resonance', body: 'End on a small, telling image that echoes the theme.', effect: 'Lets emotion settle — good before a time jump.' },
    ])
  }
  if (has('twist', 'surprise', 'reveal', 'reversal')) {
    return block('Possible twists seeded by what you have:', [
      { title: 'The ally’s agenda', body: `Someone close to ${hero} has been steering events.`, effect: 'Recontextualizes prior scenes; rewards re-reading.' },
      { title: 'The goal was a trap', body: 'What they’ve chased turns out to serve ${foe}.'.replace('${foe}', foe), effect: 'Raises stakes and questions ${hero}’s judgment.'.replace('${hero}', hero) },
      { title: 'Mistaken cause', body: 'The thing they blamed wasn’t the real cause of the wound.', effect: 'Opens a deeper emotional truth to resolve.' },
    ])
  }
  if (has('world', 'setting', 'lore', 'place')) {
    return block('Worldbuilding you can expand through this scene:', [
      { title: 'Rules with teeth', body: 'Show one cost or limit of how your world works, in action.', effect: 'Concrete rules make the world feel lived-in and fair.' },
      { title: 'Texture over lecture', body: 'Reveal culture through a detail a local would never explain.', effect: 'Immersion without exposition dumps.' },
      { title: 'A telling contrast', body: 'Put two cultures/places side by side in one beat.', effect: 'Contrast communicates values fast.' },
    ])
  }
  if (has('theme', 'meaning', 'message')) {
    return block('Reinforce theme without preaching:', [
      { title: 'Echo in objects', body: 'Let a recurring image carry the theme quietly.', effect: 'Motif rewards attentive readers; never on-the-nose.' },
      { title: 'Test the thesis', body: 'Have a sympathetic character argue the opposite.', effect: 'Theme earned through debate, not assertion.' },
      { title: 'Cost of the value', body: 'Make a character pay to live by the theme.', effect: 'Sacrifice proves the idea matters.' },
    ])
  }
  if (has('emotion', 'feel', 'consequence', 'aftermath')) {
    return block('Emotional consequences to explore next:', [
      { title: 'Delayed reaction', body: `Let the impact hit ${hero} a scene later, at an inconvenient time.`, effect: 'Realistic emotional lag; deepens interiority.' },
      { title: 'Misplaced feeling', body: 'They take the feeling out on the wrong person.', effect: 'Generates new interpersonal conflict.' },
      { title: 'A changed habit', body: 'Show the aftermath through behavior, not statement.', effect: 'Demonstrates change instead of declaring it.' },
    ])
  }
  if (has('goal', 'objective', 'want')) {
    return block(`Scene-goal options for ${hero}:`, [
      { title: 'Concrete & external', body: 'Get the object / reach the place / win the argument.', effect: 'Gives the scene a measurable spine.' },
      { title: 'Relational', body: 'Earn trust, hide a truth, or test a bond.', effect: 'Foregrounds character dynamics.' },
      { title: 'Self-deceiving', body: 'A goal they pursue to avoid the real problem.', effect: 'Sets up irony and a later reckoning.' },
    ])
  }

  // Default
  return block(
    `Here’s how I read it — ${tone} tone, pacing ${insight(ctx, 'pacing').toLowerCase()}. A few ways forward:`,
    [
      { title: 'Escalate', body: `Put ${hero} under a sharper, more immediate pressure.`, effect: 'Drives momentum and forces revealing choices.' },
      { title: 'Complicate', body: 'Introduce a competing want or an inconvenient ally.', effect: 'Adds texture and delays easy resolution.' },
      { title: 'Deepen', body: 'Slow down for one specific, sensory beat of interiority.', effect: 'Earns the reader’s investment before the next turn.' },
    ],
  )
}

function localTransform(kind: TransformKind, text: string): TransformResult {
  const stats = analyzeText(text)
  const tips = () => {
    const t: string[] = []
    if (stats.sentences && stats.words / stats.sentences > 22) t.push('Some long sentences — consider splitting for rhythm.')
    const adverbs = (text.match(/\b\w+ly\b/gi) ?? []).length
    if (adverbs > 1) t.push(`${adverbs} adverbs — stronger verbs often do the work.`)
    const filters = (text.match(/\b(very|really|just|felt|saw|heard|seemed|suddenly)\b/gi) ?? []).length
    if (filters) t.push(`${filters} filter words to consider cutting.`)
    return t
  }
  switch (kind) {
    case 'grammar': {
      const issues = checkGrammar(text)
      return {
        kind,
        message: issues.length
          ? issues.map((i) => `• ${i.message}${i.excerpt ? ` — “${i.excerpt}”` : ''}`).join('\n')
          : 'No grammar or style issues found in the selection. ✓',
      }
    }
    case 'synonyms': {
      const word = text.trim()
      if (/^[a-z'-]+$/i.test(word)) {
        const syns = synonymsFor(word)
        return syns.length ? { kind, options: syns, message: `Synonyms for “${word}”:` } : { kind, message: `No built-in synonyms for “${word}”. Connect an AI model for a full thesaurus.` }
      }
      const strong = strongerWords(text)
      return { kind, message: strong.length ? strong.map((s) => `• ${s.word} → ${s.alternatives.join(', ')}`).join('\n') : 'No obvious words to swap. Connect an AI model for deeper suggestions.' }
    }
    case 'stronger': {
      const strong = strongerWords(text)
      return { kind, message: strong.length ? `Stronger choices:\n${strong.map((s) => `• ${s.word} → ${s.alternatives.slice(0, 3).join(', ')}`).join('\n')}` : 'Vocabulary already varied. Connect an AI model for nuanced upgrades.' }
    }
    case 'simpler':
      return { kind, replacement: simplify(text), message: 'A simpler pass (offline heuristic). Connect an AI model for a fuller rewrite.' }
    case 'tone':
      return {
        kind,
        message: [
          'Three tonal directions for this passage:',
          '• Restrained — strip adjectives; let plain facts carry the weight (colder, more ominous).',
          '• Lyrical — lean into imagery and rhythm (warmer, more immersive).',
          '• Urgent — shorten sentences, cut subordinate clauses (faster, tenser).',
          'Connect an AI model in Settings to apply one in a click.',
        ].join('\n'),
      }
    case 'ask':
      return { kind, message: [`This selection runs ${stats.words} words across ${stats.sentences} sentence(s).`, ...tips(), 'Ask me anything specific in the Assistant panel — and connect a model for richer answers.'].join('\n') }
    case 'translate':
      return { kind, message: 'Translation needs a connected AI model. Add one in Settings → Story Assistant.' }
    default:
      return { kind, message: ['I can fully rewrite once you connect an AI model (Settings → Story Assistant). Targeted notes for this selection:', ...(tips().length ? tips() : ['Reads clean — push on specificity and subtext.'])].join('\n') }
  }
}

export const localProvider: StoryProvider = {
  id: 'local',
  label: 'Parchment (local)',
  ready: true,
  generate: async (messages, ctx) => localGenerate(messages, ctx),
  transform: async (kind, text) => localTransform(kind, text),
}

// ── Cloud providers (best-effort direct browser calls) ─────────────────────

async function callOpenAI(cfg: AIConfig, messages: ChatMessage[], ctx: StoryContext): Promise<string> {
  const res = await fetch(`${(cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model || 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt() }, { role: 'system', content: contextBlock(ctx) }, ...messages],
      temperature: 0.9,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? '(no response)'
}

async function callAnthropic(cfg: AIConfig, messages: ChatMessage[], ctx: StoryContext): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: cfg.model || 'claude-opus-4-8',
      max_tokens: 1200,
      system: `${systemPrompt()}\n\n${contextBlock(ctx)}`,
      messages: messages.map((m) => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
    }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.content?.[0]?.text ?? '(no response)'
}

async function callGemini(cfg: AIConfig, messages: ChatMessage[], ctx: StoryContext): Promise<string> {
  const model = cfg.model || 'gemini-1.5-flash'
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${systemPrompt()}\n\n${contextBlock(ctx)}` }] },
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      }),
    },
  )
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '(no response)'
}

async function callOllama(cfg: AIConfig, messages: ChatMessage[], ctx: StoryContext): Promise<string> {
  const res = await fetch(`${(cfg.baseUrl || 'http://localhost:11434').replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model || 'llama3.1',
      stream: false,
      messages: [{ role: 'system', content: `${systemPrompt()}\n\n${contextBlock(ctx)}` }, ...messages],
    }),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.message?.content ?? '(no response)'
}

type CallFn = (cfg: AIConfig, messages: ChatMessage[], ctx: StoryContext) => Promise<string>

async function cloudTransform(
  call: CallFn,
  cfg: AIConfig,
  kind: TransformKind,
  text: string,
  ctx: StoryContext,
  opts?: TransformOpts,
): Promise<TransformResult> {
  const instr = KIND_INSTRUCTION[kind] + (kind === 'translate' && opts?.targetLang ? ` Target language: ${opts.targetLang}.` : '')
  const want = REWRITE_KINDS.includes(kind) ? 'rewritten passage only' : 'requested feedback'
  const messages: ChatMessage[] = [
    { role: 'user', content: `${instr}\n\nPassage:\n"""${text}"""\n\nReturn the ${want}, with no preamble or quotation marks.` },
  ]
  const out = (await call(cfg, messages, ctx)).trim()
  return REWRITE_KINDS.includes(kind) ? { kind, replacement: out } : { kind, message: out }
}

export function getProvider(cfg: AIConfig): StoryProvider {
  const wrap = (id: string, label: string, ready: boolean, call: CallFn): StoryProvider => ({
    id,
    label,
    ready,
    generate: (m, c) => call(cfg, m, c),
    transform: (kind, text, ctx, opts) => cloudTransform(call, cfg, kind, text, ctx, opts),
  })
  switch (cfg.provider) {
    case 'openai':
      return wrap('openai', 'OpenAI', !!cfg.apiKey, callOpenAI)
    case 'anthropic':
      return wrap('anthropic', 'Anthropic', !!cfg.apiKey, callAnthropic)
    case 'gemini':
      return wrap('gemini', 'Gemini', !!cfg.apiKey, callGemini)
    case 'ollama':
      return wrap('ollama', 'Ollama', true, callOllama)
    default:
      return localProvider
  }
}
