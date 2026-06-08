import { saveAs } from 'file-saver'
import { db } from '@/data/db'
import { uid } from '@/lib/id'
import { useSettings } from '@/store/useSettings'
import type { Character, Location, PlotThread, Project, Snapshot, TreeNode } from '@/types'

const todayStamp = () => new Date().toISOString().slice(0, 10)

/** Export everything — all projects + app settings — as one restorable file. */
export async function exportFullBackup(): Promise<void> {
  const [projects, nodes, characters, locations, threads, snapshots] = await Promise.all([
    db.projects.toArray(),
    db.nodes.toArray(),
    db.characters.toArray(),
    db.locations.toArray(),
    db.threads.toArray(),
    db.snapshots.toArray(),
  ])
  const s = useSettings.getState()
  const data = {
    format: 'parchment-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    projects,
    nodes,
    characters,
    locations,
    threads,
    snapshots,
    app: { settings: s.settings, customThemes: s.customThemes, dictionary: s.dictionary, stats: s.stats },
  }
  saveAs(new Blob([JSON.stringify(data)], { type: 'application/json;charset=utf-8' }), `parchment-backup-${todayStamp()}.json`)
}

export interface ImportResult {
  projects: number
  kind: 'full' | 'project'
}

/** Import a full backup or a single project export. Returns import summary. */
export async function importBackup(file: File): Promise<ImportResult> {
  const text = await file.text()
  const data = JSON.parse(text)

  if (data.format === 'parchment-backup') {
    await db.transaction('rw', [db.projects, db.nodes, db.characters, db.locations, db.threads, db.snapshots], async () => {
      if (data.projects?.length) await db.projects.bulkPut(data.projects as Project[])
      if (data.nodes?.length) await db.nodes.bulkPut(data.nodes as TreeNode[])
      if (data.characters?.length) await db.characters.bulkPut(data.characters as Character[])
      if (data.locations?.length) await db.locations.bulkPut(data.locations as Location[])
      if (data.threads?.length) await db.threads.bulkPut(data.threads as PlotThread[])
      if (data.snapshots?.length) await db.snapshots.bulkPut(data.snapshots as Snapshot[])
    })
    if (data.app) useSettings.getState().importBackupState(data.app)
    return { projects: data.projects?.length ?? 0, kind: 'full' }
  }

  if (data.format === 'parchment-project') {
    const newProjectId = uid()
    const idMap = new Map<string, string>()
    const nodes = (data.nodes ?? []) as TreeNode[]
    nodes.forEach((n) => idMap.set(n.id, uid()))
    const project: Project = { ...(data.project as Project), id: newProjectId, title: `${data.project.title} (Imported)` }
    const newNodes: TreeNode[] = nodes.map((n) => ({
      ...n,
      id: idMap.get(n.id)!,
      projectId: newProjectId,
      parentId: n.parentId ? (idMap.get(n.parentId) ?? null) : null,
    }))
    await db.transaction('rw', [db.projects, db.nodes, db.characters, db.locations, db.threads], async () => {
      await db.projects.add(project)
      if (newNodes.length) await db.nodes.bulkAdd(newNodes)
      const chars = (data.characters ?? []) as Character[]
      const locs = (data.locations ?? []) as Location[]
      const threads = (data.threads ?? []) as PlotThread[]
      if (chars.length) await db.characters.bulkAdd(chars.map((c) => ({ ...c, id: uid(), projectId: newProjectId })))
      if (locs.length) await db.locations.bulkAdd(locs.map((l) => ({ ...l, id: uid(), projectId: newProjectId })))
      if (threads.length) await db.threads.bulkAdd(threads.map((t) => ({ ...t, id: uid(), projectId: newProjectId, sceneIds: [] })))
    })
    return { projects: 1, kind: 'project' }
  }

  throw new Error('Unrecognized file format')
}
