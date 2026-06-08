import { Folder, FolderOpen, Layers, FileText, AlignLeft, StickyNote, Paperclip, type LucideProps } from 'lucide-react'
import type { NodeType } from '@/types'

export function NodeIcon({ type, open, ...props }: { type: NodeType; open?: boolean } & LucideProps) {
  switch (type) {
    case 'folder':
      return open ? <FolderOpen {...props} /> : <Folder {...props} />
    case 'part':
      return <Layers {...props} />
    case 'chapter':
      return <FileText {...props} />
    case 'scene':
      return <AlignLeft {...props} />
    case 'section':
      return <AlignLeft {...props} />
    case 'note':
      return <StickyNote {...props} />
    case 'research':
      return <Paperclip {...props} />
    default:
      return <FileText {...props} />
  }
}
