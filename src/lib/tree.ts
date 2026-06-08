import type { TreeNode } from '@/types'

export interface TreeItem extends TreeNode {
  children: TreeItem[]
}

/** Build a nested forest from a flat node list, sorted by `order`. */
export function buildForest(nodes: TreeNode[]): TreeItem[] {
  const map = new Map<string, TreeItem>()
  nodes.forEach((n) => map.set(n.id, { ...n, children: [] }))
  const roots: TreeItem[] = []
  for (const item of map.values()) {
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children.push(item)
    } else {
      roots.push(item)
    }
  }
  const sort = (items: TreeItem[]) => {
    items.sort((a, b) => a.order - b.order)
    items.forEach((i) => sort(i.children))
  }
  sort(roots)
  return roots
}

export interface FlatItem {
  node: TreeNode
  depth: number
}

/** Depth-first flatten in reading order. */
export function flattenForest(forest: TreeItem[], depth = 0): FlatItem[] {
  const out: FlatItem[] = []
  for (const item of forest) {
    out.push({ node: item, depth })
    if (item.children.length) out.push(...flattenForest(item.children, depth + 1))
  }
  return out
}

/** Ordered document nodes (excludes pure containers), optionally compile-only. */
export function orderedDocuments(nodes: TreeNode[], compileOnly = true): FlatItem[] {
  const flat = flattenForest(buildForest(nodes))
  return flat.filter(
    (f) =>
      f.node.type !== 'folder' &&
      f.node.type !== 'part' &&
      (!compileOnly || f.node.meta.includeInCompile !== false),
  )
}

/** Count direct + nested document words under a node id. */
export function subtreeWordCount(nodes: TreeNode[], rootId: string): number {
  const byParent = new Map<string | null, TreeNode[]>()
  nodes.forEach((n) => {
    const arr = byParent.get(n.parentId) ?? []
    arr.push(n)
    byParent.set(n.parentId, arr)
  })
  let total = 0
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    const node = nodes.find((n) => n.id === id)
    if (node) total += node.wordCount || 0
    ;(byParent.get(id) ?? []).forEach((c) => stack.push(c.id))
  }
  return total
}
