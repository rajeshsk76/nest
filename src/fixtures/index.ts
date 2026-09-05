import inbox from './inbox.org?raw'
import projects from './projects.org?raw'

export type NestFileId = 'inbox' | 'projects'

export interface NestFile {
  id: NestFileId
  name: string
  title: string
  source: string
}

export const SEED_FILES: NestFile[] = [
  {
    id: 'inbox',
    name: 'inbox.org',
    title: 'Inbox',
    source: inbox,
  },
  {
    id: 'projects',
    name: 'projects.org',
    title: 'Projects',
    source: projects,
  },
]

export function seedMap(): Record<NestFileId, string> {
  return {
    inbox: SEED_FILES[0].source,
    projects: SEED_FILES[1].source,
  }
}
