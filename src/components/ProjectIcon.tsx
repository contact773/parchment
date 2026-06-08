import {
  BookOpen,
  BookText,
  Feather,
  Clapperboard,
  Drama,
  Tv,
  Library,
  FileText,
  Globe2,
  ScrollText,
  type LucideProps,
} from 'lucide-react'
import type { ProjectType } from '@/types'
import { PROJECT_TYPES } from '@/lib/constants'

const MAP = {
  BookOpen,
  BookText,
  Feather,
  Clapperboard,
  Drama,
  Tv,
  Library,
  FileText,
  Globe2,
  ScrollText,
} as const

export function ProjectIcon({ type, ...props }: { type: ProjectType } & LucideProps) {
  const name = PROJECT_TYPES[type].icon as keyof typeof MAP
  const Cmp = MAP[name] ?? ScrollText
  return <Cmp {...props} />
}
