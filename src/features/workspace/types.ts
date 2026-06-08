export type WorkspaceView =
  | 'editor'
  | 'corkboard'
  | 'outline'
  | 'characters'
  | 'locations'
  | 'threads'
  | 'timeline'
  | 'worldbuilding'
  | 'research'
  | 'notes'
  | 'trash'

export interface CodexSelect {
  kind: 'character' | 'location'
  id: string
}
