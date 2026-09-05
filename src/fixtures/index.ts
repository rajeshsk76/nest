import inboxOrg from './inbox.org?raw'
import projectsOrg from './projects.org?raw'

export type NestFileId = 'inbox' | 'projects'

export interface NestFile {
  id: NestFileId
  name: string
  source: string
}

export const SEED_FILES: NestFile[] = [
  { id: 'inbox', name: 'inbox.org', source: inboxOrg },
  { id: 'projects', name: 'projects.org', source: projectsOrg },
]

export function seedMap(): Record<NestFileId, string> {
  return {
    inbox: inboxOrg,
    projects: projectsOrg,
  }
}
