import { db } from './db'
import { createProject, createCharacter, createThread, createNode, saveNodeContent } from './repo'
import type { DocContent } from '@/types'

const p = (text: string): DocContent => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })
const em = (text: string): DocContent => ({ type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'italic' }], text }] })
const hr = (): DocContent => ({ type: 'horizontalRule' })
const sp = (script: string, text: string): DocContent => ({ type: 'paragraph', attrs: { script }, content: [{ type: 'text', text }] })
const doc = (...nodes: DocContent[]): DocContent => ({ type: 'doc', content: nodes })

const NOVEL_OPENING = doc(
  p('The lighthouse had not burned in forty years, and yet Mara Vance could have sworn she saw it lit as the ferry rounded the headland — a single amber eye, blinking once across the water before the fog swallowed it whole.'),
  p('She told herself it was the cold. The kind of cold that got behind your ribs and rearranged things. She had come back to Vesper Bay to bury her grandmother and to sell the house, in that order, and to feel nothing in particular about either.'),
  p('"You\'re the Vance girl," the ferryman said. It was not a question. Nobody here asked questions; they simply arrived at conclusions and waited for you to catch up.'),
  p('"I was," Mara said.'),
  hr(),
  p('The house smelled of salt and old paper and something underneath that she did not want to name. On the kitchen table, weighted by a stone, lay an envelope with her name on it in handwriting she had spent twenty years trying to forget.'),
  p('Inside was a single line, and she read it twice before she let herself believe it:'),
  em('The light still works. You only have to climb.'),
)

const NOVEL_CH2 = doc(
  p('Morning came grey and certain. Mara had slept in her coat on the sofa, and woke to gulls arguing over something on the roof, and to the realization that she had dreamed of stairs.'),
  p('Forty years was a long time for a light to stay dead. It was also, she thought, exactly long enough for someone to make sure it stayed that way.'),
)

const SCRIPT_SCENE = doc(
  sp('scene-heading', 'INT. NIGHT TRAIN — SLEEPER CAR — NIGHT'),
  sp('action', 'Rain streaks the window. The carriage sways. ELENA (30s, sharp coat, sharper eyes) watches the dark country slide by. Across from her, a man pretends to sleep.'),
  sp('character', 'ELENA'),
  sp('dialogue', 'You\'ve been pretending for three stations.'),
  sp('action', 'The MAN opens one eye.'),
  sp('character', 'THE MAN'),
  sp('parenthetical', '(not moving)'),
  sp('dialogue', 'And you\'ve been counting them. So we\'re both bad at this.'),
  sp('action', 'Elena almost smiles. Almost.'),
  sp('character', 'ELENA'),
  sp('dialogue', 'Whatever you took, I want it back before Vienna.'),
  sp('transition', 'SMASH CUT TO:'),
)

/** Seed two sample projects (a novel and a screenplay) on first run. */
export async function seedSamples(): Promise<void> {
  // ── Novel ────────────────────────────────────────────────────────────
  const novel = await createProject({
    title: 'The Lighthouse at Vesper Bay',
    type: 'novel',
    author: 'A. N. Other',
    language: 'en',
    genre: 'Literary Mystery',
    logline: 'A grieving woman returns to her childhood town to sell a dead lighthouse — and discovers it was never truly dark.',
  })
  const novelNodes = await db.nodes.where('projectId').equals(novel.id).toArray()
  const opening = novelNodes.find((n) => n.type === 'scene')
  const ch1 = novelNodes.find((n) => n.type === 'chapter')
  if (opening) {
    await saveNodeContent(opening.id, NOVEL_OPENING)
    await db.nodes.update(opening.id, {
      synopsis: 'Mara returns to Vesper Bay and sees the dead lighthouse lit.',
      status: 'draft',
      meta: { pov: 'Mara', goal: 'Get in, sell the house, feel nothing', conflict: 'The light she shouldn\'t be able to see', outcome: 'A note: “The light still works.”', includeInCompile: true },
    })
  }
  if (ch1) {
    const ch2 = await createNode({ projectId: novel.id, parentId: null, type: 'chapter', title: 'Chapter Two', docType: 'prose', order: 0.5 })
    const s2 = await createNode({ projectId: novel.id, parentId: ch2.id, type: 'scene', title: 'Stairs', docType: 'prose' })
    await saveNodeContent(s2.id, NOVEL_CH2)
    await db.nodes.update(s2.id, { synopsis: 'Mara wakes having dreamed of the climb.', status: 'outline' })
  }

  await createCharacter(novel.id, {
    name: 'Mara Vance',
    role: 'protagonist',
    summary: 'A restoration architect who left Vesper Bay at eighteen and swore never to return.',
    goal: 'Sell the house and leave',
    motivation: 'To stop being haunted by the place that made her',
    conflict: 'The town — and the light — refuse to let her go',
    arc: 'From numb avoidance to chosen belonging',
    color: '#b3704a',
  })
  await createCharacter(novel.id, {
    name: 'Elias Crane',
    role: 'antagonist',
    summary: 'The harbormaster who has kept the lighthouse dark for reasons of his own.',
    goal: 'Keep the light off',
    motivation: 'Guilt he has never confessed',
    color: '#9a5d5d',
  })
  await createThread(novel.id, { name: 'Who relit the light?', description: 'The central mystery — and who wants it dark.', status: 'open', color: '#b3704a' })
  await createThread(novel.id, { name: 'Mara & the house', description: 'Whether she sells or stays.', status: 'developing', color: '#5f7d6e' })

  // ── Screenplay ───────────────────────────────────────────────────────
  const script = await createProject({
    title: 'Last Train to Nowhere',
    type: 'screenplay',
    author: 'A. N. Other',
    language: 'en',
    genre: 'Thriller',
    logline: 'Two strangers on a night train discover they are running from the same people — and toward each other.',
  })
  const scriptNodes = await db.nodes.where('projectId').equals(script.id).toArray()
  const scriptScene = scriptNodes.find((n) => n.type === 'scene')
  if (scriptScene) {
    await saveNodeContent(scriptScene.id, SCRIPT_SCENE)
    await db.nodes.update(scriptScene.id, {
      title: 'INT. NIGHT TRAIN — NIGHT',
      synopsis: 'Elena confronts the man who has been tailing her.',
      status: 'draft',
      meta: { pov: 'Elena', goal: 'Recover what was stolen', conflict: 'He is better at this than he admits', includeInCompile: true },
    })
  }
  await createCharacter(script.id, { name: 'Elena', role: 'protagonist', summary: 'A courier who no longer trusts her own side.', color: '#5b7aa6' })
  await createCharacter(script.id, { name: 'The Man', role: 'love-interest', summary: 'A thief with a conscience he keeps losing.', color: '#8a6fa6' })
}
