import type { DocContent, TreeNode } from '@/types'
import { buildForest, flattenForest } from '@/lib/tree'

export interface Run {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  code?: boolean
}

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; runs: Run[] }
  | { kind: 'paragraph'; runs: Run[]; script?: string; align?: string }
  | { kind: 'blockquote'; runs: Run[] }
  | { kind: 'hr' }
  | { kind: 'list'; ordered: boolean; items: Run[][] }
  | { kind: 'code'; text: string }

function runsFromInline(node: DocContent | undefined): Run[] {
  if (!node?.content) return []
  const runs: Run[] = []
  for (const child of node.content) {
    if (child.type === 'hardBreak') {
      runs.push({ text: '\n' })
      continue
    }
    if (child.type === 'text' && typeof child.text === 'string') {
      const marks = (child.marks ?? []).map((m) => m.type)
      runs.push({
        text: child.text,
        bold: marks.includes('bold'),
        italic: marks.includes('italic'),
        underline: marks.includes('underline'),
        strike: marks.includes('strike'),
        code: marks.includes('code'),
      })
    }
  }
  return runs
}

/** Convert a single document's TipTap JSON into a flat block list. */
export function contentToBlocks(content: DocContent | null | undefined): Block[] {
  if (!content?.content) return []
  const blocks: Block[] = []
  for (const node of content.content) {
    switch (node.type) {
      case 'heading': {
        const level = Math.min(3, Math.max(1, (node.attrs?.level as number) ?? 1)) as 1 | 2 | 3
        blocks.push({ kind: 'heading', level, runs: runsFromInline(node) })
        break
      }
      case 'paragraph':
        blocks.push({
          kind: 'paragraph',
          runs: runsFromInline(node),
          script: (node.attrs?.script as string) || undefined,
          align: (node.attrs?.textAlign as string) || undefined,
        })
        break
      case 'blockquote': {
        const inner = (node.content ?? []).flatMap((p) => runsFromInline(p))
        blocks.push({ kind: 'blockquote', runs: inner })
        break
      }
      case 'bulletList':
      case 'orderedList': {
        const items = (node.content ?? []).map((li) => {
          const para = li.content?.find((c) => c.type === 'paragraph')
          return runsFromInline(para)
        })
        blocks.push({ kind: 'list', ordered: node.type === 'orderedList', items })
        break
      }
      case 'horizontalRule':
        blocks.push({ kind: 'hr' })
        break
      case 'codeBlock':
        blocks.push({ kind: 'code', text: (node.content ?? []).map((t) => t.text ?? '').join('') })
        break
      default:
        break
    }
  }
  return blocks
}

export interface ManuscriptItem {
  node: TreeNode
  depth: number
  heading?: { level: 1 | 2 | 3; title: string }
  blocks: Block[]
  sceneBreakBefore: boolean
}

export type CompileScope = 'manuscript' | 'notes' | 'all'

const CONTAINER_NODE_TYPES = new Set(['folder', 'part', 'chapter'])
const NOTE_NODE_TYPES = new Set(['note', 'research'])

/**
 * Walk the project tree into an ordered list of export items.
 *
 * `scope` controls which documents are compiled:
 *  - 'manuscript' (default): the story — everything except notes/research.
 *  - 'notes': only note/research documents (exported separately).
 *  - 'all': everything.
 *
 * Containers (folders/parts/chapters) are only emitted when they actually hold
 * an in-scope document, so excluding notes never leaves an empty "Notes" heading.
 */
export function buildManuscript(nodes: TreeNode[], scope: CompileScope = 'manuscript', compileOnly = true): ManuscriptItem[] {
  const flat = flattenForest(buildForest(nodes))
  const byId = new Map(nodes.map((n) => [n.id, n]))

  const live = (n: TreeNode) => !n.deletedAt && !(compileOnly && n.meta?.includeInCompile === false)
  const inScope = (n: TreeNode) => {
    const isNote = NOTE_NODE_TYPES.has(n.type)
    return scope === 'all' ? true : scope === 'notes' ? isNote : !isNote
  }
  const hasOwnContent = (n: TreeNode) => (n.text ?? '').trim().length > 0

  // Keep in-scope content (leaf documents, or containers with their own text),
  // plus the container ancestors needed to hold them.
  const keep = new Set<string>()
  for (const { node } of flat) {
    if (!live(node) || !inScope(node)) continue
    const isLeaf = !CONTAINER_NODE_TYPES.has(node.type)
    if (!isLeaf && !hasOwnContent(node)) continue
    keep.add(node.id)
    let pid = node.parentId
    while (pid && byId.has(pid) && !keep.has(pid)) {
      const parent = byId.get(pid)!
      if (!live(parent)) break
      keep.add(parent.id)
      pid = parent.parentId
    }
  }

  const items: ManuscriptItem[] = []
  let prev: TreeNode | null = null
  for (const { node, depth } of flat) {
    if (!keep.has(node.id)) continue
    const isScene = node.type === 'scene'
    const level = Math.min(3, depth + 1) as 1 | 2 | 3
    const sceneBreakBefore = isScene && prev?.type === 'scene' && prev.parentId === node.parentId
    items.push({
      node,
      depth,
      heading: !isScene ? { level, title: node.title } : undefined,
      blocks: contentToBlocks(node.content),
      sceneBreakBefore,
    })
    prev = node
  }
  return items
}
