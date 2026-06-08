import Dexie, { type Table } from 'dexie'
import type {
  Character,
  Location,
  PlotThread,
  Project,
  Snapshot,
  TreeNode,
  WorldElement,
} from '@/types'

/**
 * Parchment's local database. Large, frequently-mutated writing content lives
 * here in IndexedDB. Small UI/settings/theme state is persisted separately to
 * localStorage via the Zustand store.
 */
export class ParchmentDB extends Dexie {
  projects!: Table<Project, string>
  nodes!: Table<TreeNode, string>
  characters!: Table<Character, string>
  locations!: Table<Location, string>
  threads!: Table<PlotThread, string>
  snapshots!: Table<Snapshot, string>
  worldElements!: Table<WorldElement, string>

  constructor() {
    super('parchment')
    this.version(1).stores({
      projects: 'id, updatedAt, lastOpenedAt, status, type',
      nodes: 'id, projectId, parentId, [projectId+parentId], order',
      characters: 'id, projectId, order',
      locations: 'id, projectId, order',
      threads: 'id, projectId, order',
      snapshots: 'id, projectId, nodeId, createdAt',
    })
    this.version(2).stores({
      worldElements: 'id, projectId, category, order',
    })
  }
}

export const db = new ParchmentDB()
