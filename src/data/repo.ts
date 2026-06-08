import { db } from './db'
import { uid } from '@/lib/id'
import { docToText, countWords } from '@/lib/text'
import type {
  Character,
  CharacterRole,
  DocContent,
  DocType,
  Location,
  NodeStatus,
  NodeType,
  PlotThread,
  Project,
  ProjectStatus,
  ProjectType,
  Snapshot,
  TreeNode,
  WorldElement,
} from '@/types'
import { PROJECT_TYPES } from '@/lib/constants'

const now = () => Date.now()

export const emptyDoc = (): DocContent => ({ type: 'doc', content: [{ type: 'paragraph' }] })

const CONTAINER_TYPES: NodeType[] = ['folder', 'part']

export function isContainer(type: NodeType): boolean {
  return CONTAINER_TYPES.includes(type)
}

export function isDocument(node: Pick<TreeNode, 'type'>): boolean {
  return !isContainer(node.type)
}

// ──────────────────────────────────────────────────────────────────────────
// Projects
// ──────────────────────────────────────────────────────────────────────────

export interface NewProjectInput {
  title: string
  type: ProjectType
  author?: string
  language: Project['language']
  genre?: string
  logline?: string
  targetWords?: number
  color?: string
  status?: ProjectStatus
  deadline?: string
}

export async function createProject(input: NewProjectInput): Promise<Project> {
  const ts = now()
  const defaultDocType = PROJECT_TYPES[input.type].defaultDocType
  const project: Project = {
    id: uid(),
    title: input.title.trim() || 'Untitled Project',
    author: input.author,
    type: input.type,
    status: input.status ?? 'planning',
    language: input.language,
    genre: input.genre,
    logline: input.logline,
    targetWords: input.targetWords ?? defaultTarget(input.type),
    color: input.color,
    deadline: input.deadline,
    defaultDocType,
    createdAt: ts,
    updatedAt: ts,
    lastOpenedAt: ts,
  }
  await db.projects.add(project)
  await createDefaultStructure(project)
  return project
}

function defaultTarget(type: ProjectType): number {
  switch (type) {
    case 'novel':
      return 80000
    case 'short-story':
      return 5000
    case 'poetry':
      return 0
    case 'screenplay':
      return 22000
    case 'stage-play':
      return 18000
    case 'tv-episode':
      return 9000
    case 'series':
      return 240000
    case 'essay-collection':
      return 40000
    case 'worldbuilding':
      return 0
    default:
      return 50000
  }
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<void> {
  await db.projects.update(id, { ...patch, updatedAt: now() })
}

export async function touchProject(id: string): Promise<void> {
  await db.projects.update(id, { lastOpenedAt: now() })
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', [db.projects, db.nodes, db.characters, db.locations, db.threads, db.snapshots, db.worldElements], async () => {
    await db.nodes.where('projectId').equals(id).delete()
    await db.characters.where('projectId').equals(id).delete()
    await db.locations.where('projectId').equals(id).delete()
    await db.threads.where('projectId').equals(id).delete()
    await db.snapshots.where('projectId').equals(id).delete()
    await db.worldElements.where('projectId').equals(id).delete()
    await db.projects.delete(id)
  })
}

export async function archiveProject(id: string, archived: boolean): Promise<void> {
  await updateProject(id, { status: archived ? 'archived' : 'drafting' })
}

export async function duplicateProject(id: string): Promise<Project | null> {
  const src = await db.projects.get(id)
  if (!src) return null
  const ts = now()
  const newId = uid()
  const copy: Project = { ...src, id: newId, title: `${src.title} (Copy)`, createdAt: ts, updatedAt: ts, lastOpenedAt: ts }
  const nodes = await db.nodes.where('projectId').equals(id).toArray()
  const chars = await db.characters.where('projectId').equals(id).toArray()
  const locs = await db.locations.where('projectId').equals(id).toArray()
  const threads = await db.threads.where('projectId').equals(id).toArray()
  const snaps = await db.snapshots.where('projectId').equals(id).toArray()
  const elems = await db.worldElements.where('projectId').equals(id).toArray()

  // Remap node ids while preserving parent relationships.
  const idMap = new Map<string, string>()
  nodes.forEach((n) => idMap.set(n.id, uid()))
  const newNodes: TreeNode[] = nodes.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    projectId: newId,
    parentId: n.parentId ? (idMap.get(n.parentId) ?? null) : null,
  }))

  await db.transaction(
    'rw',
    [db.projects, db.nodes, db.characters, db.locations, db.threads, db.snapshots, db.worldElements],
    async () => {
      await db.projects.add(copy)
      await db.nodes.bulkAdd(newNodes)
      if (chars.length) await db.characters.bulkAdd(chars.map((c) => ({ ...c, id: uid(), projectId: newId })))
      if (locs.length) await db.locations.bulkAdd(locs.map((l) => ({ ...l, id: uid(), projectId: newId })))
      if (threads.length)
        await db.threads.bulkAdd(
          threads.map((t) => ({ ...t, id: uid(), projectId: newId, sceneIds: (t.sceneIds ?? []).map((s) => idMap.get(s)).filter(Boolean) as string[] })),
        )
      if (snaps.length)
        await db.snapshots.bulkAdd(snaps.map((s) => ({ ...s, id: uid(), projectId: newId, nodeId: idMap.get(s.nodeId) ?? s.nodeId })))
      if (elems.length) await db.worldElements.bulkAdd(elems.map((e) => ({ ...e, id: uid(), projectId: newId })))
    },
  )
  return copy
}

export async function projectWordCount(projectId: string): Promise<number> {
  const nodes = await db.nodes.where('projectId').equals(projectId).toArray()
  return nodes
    .filter((n) => isDocument(n) && !n.deletedAt && n.meta.includeInCompile !== false)
    .reduce((sum, n) => sum + (n.wordCount || 0), 0)
}

// ──────────────────────────────────────────────────────────────────────────
// Nodes (binder)
// ──────────────────────────────────────────────────────────────────────────

export interface NewNodeInput {
  projectId: string
  parentId: string | null
  type: NodeType
  title?: string
  docType?: DocType
  synopsis?: string
  status?: NodeStatus
  content?: DocContent | null
  order?: number
}

export async function nextOrder(projectId: string, parentId: string | null): Promise<number> {
  // Note: IndexedDB does not index null keys, so we filter siblings in JS
  // rather than querying the [projectId+parentId] index (root nodes use null).
  const all = await db.nodes.where('projectId').equals(projectId).toArray()
  const siblings = all.filter((n) => n.parentId === parentId)
  return siblings.length ? Math.max(...siblings.map((s) => s.order)) + 1 : 0
}

export async function createNode(input: NewNodeInput): Promise<TreeNode> {
  const ts = now()
  const order = input.order ?? (await nextOrder(input.projectId, input.parentId))
  const document = !isContainer(input.type)
  const node: TreeNode = {
    id: uid(),
    projectId: input.projectId,
    parentId: input.parentId,
    type: input.type,
    title: input.title ?? defaultTitle(input.type),
    order,
    collapsed: false,
    synopsis: input.synopsis ?? '',
    status: input.status ?? 'idea',
    meta: { includeInCompile: true },
    content: document ? (input.content ?? emptyDoc()) : null,
    text: '',
    wordCount: 0,
    docType: input.docType ?? 'prose',
    createdAt: ts,
    updatedAt: ts,
  }
  if (node.content) {
    node.text = docToText(node.content)
    node.wordCount = countWords(node.text)
  }
  await db.nodes.add(node)
  await updateProject(input.projectId, {})
  return node
}

function defaultTitle(type: NodeType): string {
  switch (type) {
    case 'part':
      return 'New Part'
    case 'chapter':
      return 'New Chapter'
    case 'scene':
      return 'New Scene'
    case 'section':
      return 'New Section'
    case 'note':
      return 'New Note'
    case 'research':
      return 'Research'
    default:
      return 'New Folder'
  }
}

export async function updateNode(id: string, patch: Partial<TreeNode>): Promise<void> {
  await db.nodes.update(id, { ...patch, updatedAt: now() })
}

export async function saveNodeContent(id: string, content: DocContent): Promise<number> {
  const text = docToText(content)
  const wordCount = countWords(text)
  await db.nodes.update(id, { content, text, wordCount, updatedAt: now() })
  const node = await db.nodes.get(id)
  if (node) await db.projects.update(node.projectId, { updatedAt: now() })
  return wordCount
}

export async function renameNode(id: string, title: string): Promise<void> {
  await db.nodes.update(id, { title, updatedAt: now() })
}

/** Collect a node and all its descendants. */
async function collectSubtree(rootId: string, all: TreeNode[]): Promise<TreeNode[]> {
  const result: TreeNode[] = []
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    const node = all.find((n) => n.id === id)
    if (!node) continue
    result.push(node)
    all.filter((n) => n.parentId === id).forEach((c) => stack.push(c.id))
  }
  return result
}

/** Soft-delete (move to Trash) a node and its descendants. */
export async function deleteNode(id: string): Promise<void> {
  const node = await db.nodes.get(id)
  if (!node) return
  const all = await db.nodes.where('projectId').equals(node.projectId).toArray()
  const subtree = await collectSubtree(id, all)
  const ts = now()
  await db.transaction('rw', db.nodes, async () => {
    for (const n of subtree) await db.nodes.update(n.id, { deletedAt: ts })
  })
}

/** Restore a trashed node (and descendants) from Trash. Also un-trashes any
 *  still-trashed ancestors so the restored node never becomes orphaned. */
export async function restoreNode(id: string): Promise<void> {
  const node = await db.nodes.get(id)
  if (!node) return
  const all = await db.nodes.where('projectId').equals(node.projectId).toArray()
  const subtree = await collectSubtree(id, all)
  const ids = new Set(subtree.map((n) => n.id))
  // Walk up the ancestor chain, restoring any trashed ancestors too.
  let parentId = node.parentId
  const byId = new Map(all.map((n) => [n.id, n]))
  while (parentId) {
    const parent = byId.get(parentId)
    if (!parent) break
    if (parent.deletedAt) ids.add(parent.id)
    parentId = parent.parentId
  }
  await db.transaction('rw', db.nodes, async () => {
    for (const nid of ids) await db.nodes.update(nid, { deletedAt: null })
  })
}

/** Permanently delete a node and its descendants. */
export async function hardDeleteNode(id: string): Promise<void> {
  const node = await db.nodes.get(id)
  if (!node) return
  const all = await db.nodes.where('projectId').equals(node.projectId).toArray()
  const subtree = await collectSubtree(id, all)
  const ids = subtree.map((n) => n.id)
  await db.transaction('rw', [db.nodes, db.snapshots], async () => {
    await db.nodes.bulkDelete(ids)
    await db.snapshots.where('nodeId').anyOf(ids).delete()
  })
}

export async function togglePinNode(id: string, pinned: boolean): Promise<void> {
  await db.nodes.update(id, { pinned, updatedAt: now() })
}

export async function setNodeTags(id: string, tags: string[]): Promise<void> {
  await db.nodes.update(id, { tags, updatedAt: now() })
}

/** Create a sibling immediately after `nodeId`. */
export async function createSiblingAfter(
  nodeId: string,
  opts: { title?: string; content?: DocContent | null; type?: NodeType; docType?: DocType },
): Promise<TreeNode | null> {
  const node = await db.nodes.get(nodeId)
  if (!node) return null
  const created = await createNode({
    projectId: node.projectId,
    parentId: node.parentId,
    type: opts.type ?? node.type,
    title: opts.title ?? 'New Scene',
    docType: opts.docType ?? node.docType,
    content: opts.content ?? emptyDoc(),
    order: node.order + 0.5,
  })
  await normalizeOrders(node.projectId, node.parentId)
  return created
}

/** Merge `sourceId`'s content into `targetId`, reparent the source's children
 *  onto the target (so nothing is lost), then remove the now-childless source.
 *  Runs atomically. */
export async function mergeNodes(targetId: string, sourceId: string): Promise<void> {
  await db.transaction('rw', [db.nodes, db.snapshots, db.projects], async () => {
    const [target, source] = await Promise.all([db.nodes.get(targetId), db.nodes.get(sourceId)])
    if (!target || !source) return

    const targetBlocks = ((target.content as { content?: DocContent[] } | null)?.content ?? []) as DocContent[]
    const sourceBlocks = ((source.content as { content?: DocContent[] } | null)?.content ?? []) as DocContent[]
    const merged: DocContent = { type: 'doc', content: [...targetBlocks, ...sourceBlocks] }
    const text = docToText(merged)
    await db.nodes.update(targetId, { content: merged, text, wordCount: countWords(text), updatedAt: now() })

    // Reparent the source's direct children onto the target so their content survives.
    const projNodes = await db.nodes.where('projectId').equals(target.projectId).toArray()
    const targetChildren = projNodes.filter((n) => n.parentId === targetId && n.id !== sourceId)
    let order = targetChildren.length ? Math.max(...targetChildren.map((s) => s.order)) + 1 : 0
    const sourceChildren = projNodes.filter((n) => n.parentId === sourceId).sort((a, b) => a.order - b.order)
    for (const c of sourceChildren) await db.nodes.update(c.id, { parentId: targetId, order: order++ })

    await db.nodes.delete(sourceId)
    await db.snapshots.where('nodeId').equals(sourceId).delete()
    await db.projects.update(target.projectId, { updatedAt: now() })
  })
}

/** Atomic per-field merge of a node's `meta` (avoids last-write-wins clobbering). */
export async function patchNodeMeta(id: string, partial: Partial<TreeNode['meta']>): Promise<void> {
  await db.nodes
    .where(':id')
    .equals(id)
    .modify((n) => {
      n.meta = { ...n.meta, ...partial }
      n.updatedAt = now()
    })
}

export async function duplicateNode(id: string): Promise<TreeNode | null> {
  const node = await db.nodes.get(id)
  if (!node) return null
  const all = await db.nodes.where('projectId').equals(node.projectId).toArray()
  const subtree = await collectSubtree(id, all)
  const idMap = new Map<string, string>()
  subtree.forEach((n) => idMap.set(n.id, uid()))
  const ts = now()
  const copies: TreeNode[] = subtree.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    parentId: n.id === id ? node.parentId : (idMap.get(n.parentId ?? '') ?? node.parentId),
    title: n.id === id ? `${n.title} (Copy)` : n.title,
    order: n.id === id ? n.order + 0.5 : n.order,
    createdAt: ts,
    updatedAt: ts,
  }))
  await db.nodes.bulkAdd(copies)
  await normalizeOrders(node.projectId, node.parentId)
  return copies.find((c) => c.id === idMap.get(id)) ?? null
}

/** Re-index sibling `order` values to clean integers. */
export async function normalizeOrders(projectId: string, parentId: string | null): Promise<void> {
  const all = await db.nodes.where('projectId').equals(projectId).toArray()
  const siblings = all.filter((n) => n.parentId === parentId).sort((a, b) => a.order - b.order)
  await db.transaction('rw', db.nodes, async () => {
    for (let i = 0; i < siblings.length; i++) {
      if (siblings[i].order !== i) await db.nodes.update(siblings[i].id, { order: i })
    }
  })
}

/** Move a node to a new parent at a given index among the target siblings. */
export async function moveNode(id: string, newParentId: string | null, targetIndex: number): Promise<void> {
  const node = await db.nodes.get(id)
  if (!node) return
  // Prevent moving a node into its own descendant.
  const all = await db.nodes.where('projectId').equals(node.projectId).toArray()
  const subtreeIds = new Set((await collectSubtree(id, all)).map((n) => n.id))
  if (newParentId && subtreeIds.has(newParentId)) return

  const siblings = all
    .filter((n) => n.parentId === newParentId && n.id !== id)
    .sort((a, b) => a.order - b.order)
  siblings.splice(Math.max(0, Math.min(targetIndex, siblings.length)), 0, { ...node, parentId: newParentId })

  await db.transaction('rw', db.nodes, async () => {
    for (let i = 0; i < siblings.length; i++) {
      await db.nodes.update(siblings[i].id, { order: i, parentId: newParentId, updatedAt: now() })
    }
  })
}

export async function toggleCollapse(id: string, collapsed: boolean): Promise<void> {
  await db.nodes.update(id, { collapsed })
}

// ──────────────────────────────────────────────────────────────────────────
// Default structures by project type
// ──────────────────────────────────────────────────────────────────────────

interface StructSpec {
  type: NodeType
  title: string
  docType?: DocType
  synopsis?: string
  children?: StructSpec[]
}

function structureFor(type: ProjectType, docType: DocType): StructSpec[] {
  switch (type) {
    case 'novel':
    case 'series':
    case 'manuscript':
      return [
        {
          type: 'chapter',
          title: 'Chapter One',
          children: [{ type: 'scene', title: 'Opening Scene', docType, synopsis: 'Establish the world and the hook.' }],
        },
        { type: 'folder', title: 'Notes', children: [{ type: 'note', title: 'Premise & Themes' }] },
      ]
    case 'short-story':
      return [{ type: 'scene', title: 'The Story', docType, synopsis: 'One sitting, one arc.' }]
    case 'poetry':
      return [
        {
          type: 'folder',
          title: 'Poems',
          children: [{ type: 'section', title: 'Untitled Poem', docType: 'poetry' }],
        },
      ]
    case 'screenplay':
    case 'stage-play':
      return [
        {
          type: 'part',
          title: 'Act One',
          children: [{ type: 'scene', title: 'INT. — SCENE 1', docType: 'script', synopsis: 'Open on the world.' }],
        },
      ]
    case 'tv-episode':
      return [
        { type: 'part', title: 'Teaser', children: [{ type: 'scene', title: 'Cold Open', docType: 'script' }] },
        { type: 'part', title: 'Act One', children: [{ type: 'scene', title: 'INT. — SCENE 1', docType: 'script' }] },
      ]
    case 'essay-collection':
      return [
        { type: 'folder', title: 'Essays', children: [{ type: 'section', title: 'Untitled Essay', docType }] },
      ]
    case 'worldbuilding':
      return [
        { type: 'note', title: 'Overview', synopsis: 'The shape of your world.' },
        { type: 'folder', title: 'Geography', children: [] },
        { type: 'folder', title: 'History & Timeline', children: [] },
        { type: 'folder', title: 'Cultures & Factions', children: [] },
        { type: 'folder', title: 'Magic / Technology', children: [] },
      ]
    default:
      return [{ type: 'scene', title: 'Untitled', docType }]
  }
}

async function createDefaultStructure(project: Project): Promise<void> {
  const specs = structureFor(project.type, project.defaultDocType)
  const create = async (spec: StructSpec, parentId: string | null, order: number) => {
    const node = await createNode({
      projectId: project.id,
      parentId,
      type: spec.type,
      title: spec.title,
      docType: spec.docType ?? project.defaultDocType,
      synopsis: spec.synopsis,
      order,
    })
    if (spec.children) {
      for (let i = 0; i < spec.children.length; i++) await create(spec.children[i], node.id, i)
    }
  }
  for (let i = 0; i < specs.length; i++) await create(specs[i], null, i)
}

// ──────────────────────────────────────────────────────────────────────────
// Codex: characters, locations, threads
// ──────────────────────────────────────────────────────────────────────────

export async function createCharacter(projectId: string, patch: Partial<Character> = {}): Promise<Character> {
  const ts = now()
  const count = await db.characters.where('projectId').equals(projectId).count()
  const character: Character = {
    id: uid(),
    projectId,
    name: patch.name ?? 'New Character',
    role: (patch.role as CharacterRole) ?? 'supporting',
    order: count,
    createdAt: ts,
    updatedAt: ts,
    ...patch,
  }
  await db.characters.add(character)
  return character
}

export async function updateCharacter(id: string, patch: Partial<Character>): Promise<void> {
  await db.characters.update(id, { ...patch, updatedAt: now() })
}

/** Atomic read-modify-write for a character (use for array fields like relationships). */
export async function modifyCharacter(id: string, recipe: (c: Character) => void): Promise<void> {
  await db.characters
    .where(':id')
    .equals(id)
    .modify((c) => {
      recipe(c)
      c.updatedAt = now()
    })
}

export async function deleteCharacter(id: string): Promise<void> {
  await db.characters.delete(id)
}

export async function createLocation(projectId: string, patch: Partial<Location> = {}): Promise<Location> {
  const ts = now()
  const count = await db.locations.where('projectId').equals(projectId).count()
  const location: Location = {
    id: uid(),
    projectId,
    name: patch.name ?? 'New Location',
    order: count,
    createdAt: ts,
    updatedAt: ts,
    ...patch,
  }
  await db.locations.add(location)
  return location
}

export async function updateLocation(id: string, patch: Partial<Location>): Promise<void> {
  await db.locations.update(id, { ...patch, updatedAt: now() })
}

export async function deleteLocation(id: string): Promise<void> {
  await db.locations.delete(id)
}

export async function createThread(projectId: string, patch: Partial<PlotThread> = {}): Promise<PlotThread> {
  const ts = now()
  const count = await db.threads.where('projectId').equals(projectId).count()
  const thread: PlotThread = {
    id: uid(),
    projectId,
    name: patch.name ?? 'New Plot Thread',
    status: patch.status ?? 'open',
    sceneIds: patch.sceneIds ?? [],
    order: count,
    createdAt: ts,
    updatedAt: ts,
    ...patch,
  }
  await db.threads.add(thread)
  return thread
}

export async function updateThread(id: string, patch: Partial<PlotThread>): Promise<void> {
  await db.threads.update(id, { ...patch, updatedAt: now() })
}

export async function deleteThread(id: string): Promise<void> {
  await db.threads.delete(id)
}

// ──────────────────────────────────────────────────────────────────────────
// Snapshots / version history
// ──────────────────────────────────────────────────────────────────────────

export async function createSnapshot(nodeId: string, label: string, auto = false): Promise<Snapshot | null> {
  const node = await db.nodes.get(nodeId)
  if (!node) return null
  const snapshot: Snapshot = {
    id: uid(),
    projectId: node.projectId,
    nodeId,
    nodeTitle: node.title,
    label,
    auto,
    content: node.content ?? null,
    text: node.text ?? '',
    wordCount: node.wordCount,
    createdAt: now(),
  }
  await db.snapshots.add(snapshot)
  // Keep automatic snapshots bounded (latest 30 per node).
  if (auto) {
    const autos = await db.snapshots.where('nodeId').equals(nodeId).filter((s) => s.auto).sortBy('createdAt')
    if (autos.length > 30) {
      await db.snapshots.bulkDelete(autos.slice(0, autos.length - 30).map((s) => s.id))
    }
  }
  return snapshot
}

export async function restoreSnapshot(snapshotId: string): Promise<void> {
  const snap = await db.snapshots.get(snapshotId)
  if (!snap) return
  // Safety snapshot of current state before overwriting.
  await createSnapshot(snap.nodeId, 'Before restore', true)
  await db.nodes.update(snap.nodeId, {
    content: snap.content,
    text: snap.text,
    wordCount: snap.wordCount,
    updatedAt: now(),
  })
}

export async function deleteSnapshot(id: string): Promise<void> {
  await db.snapshots.delete(id)
}

// ──────────────────────────────────────────────────────────────────────────
// Project trash & pinning
// ──────────────────────────────────────────────────────────────────────────

export async function trashProject(id: string): Promise<void> {
  await db.projects.update(id, { deletedAt: now() })
}

export async function restoreProject(id: string): Promise<void> {
  await db.projects.update(id, { deletedAt: null })
}

export async function togglePinProject(id: string, pinned: boolean): Promise<void> {
  await db.projects.update(id, { pinned })
}

// ──────────────────────────────────────────────────────────────────────────
// Worldbuilding database
// ──────────────────────────────────────────────────────────────────────────

export async function createWorldElement(
  projectId: string,
  patch: Partial<WorldElement> = {},
): Promise<WorldElement> {
  const ts = now()
  const count = await db.worldElements.where('projectId').equals(projectId).count()
  const el: WorldElement = {
    id: uid(),
    projectId,
    category: patch.category ?? 'other',
    name: patch.name ?? 'New Element',
    order: count,
    createdAt: ts,
    updatedAt: ts,
    ...patch,
  }
  await db.worldElements.add(el)
  return el
}

export async function updateWorldElement(id: string, patch: Partial<WorldElement>): Promise<void> {
  await db.worldElements.update(id, { ...patch, updatedAt: now() })
}

export async function deleteWorldElement(id: string): Promise<void> {
  await db.worldElements.delete(id)
}
