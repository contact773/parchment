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

/** Walk the whole project tree into an ordered list of export items. */
export function buildManuscript(nodes: TreeNode[], compileOnly = true): ManuscriptItem[] {
  const flat = flattenForest(buildForest(nodes))
  const items: ManuscriptItem[] = []
  let prev: TreeNode | null = null
  for (const { node, depth } of flat) {
    if (compileOnly && node.meta.includeInCompile === false) continue
    const isScene = node.type === 'scene'
    const isContainer = node.type === 'folder' || node.type === 'part' || node.type === 'chapter'
    const level = Math.min(3, depth + 1) as 1 | 2 | 3
    const sceneBreakBefore = isScene && prev?.type === 'scene' && prev.parentId === node.parentId
    items.push({
      node,
      depth,
      heading: !isScene ? { level, title: node.title } : isContainer ? { level, title: node.title } : undefined,
      blocks: contentToBlocks(node.content),
      sceneBreakBefore,
    })
    prev = node
  }
  return items
}
