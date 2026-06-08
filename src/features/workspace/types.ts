export type WorkspaceView =
  | 'editor'
  | 'corkboard'
  | 'outline'
  | 'characters'
  | 'locations'
  | 'threads'
  | 'timeline'
  | 'worldbuilding'
  | 'trash'

export interface CodexSelect {
  kind: 'character' | 'location'
  id: string
}
