import { SEED_FILES, type NestFileId, seedMap } from '../fixtures'

const STORAGE_KEY = 'nest.files.v1'

export type FilesState = Record<NestFileId, string>

function mergeWithSeeds(parsed: Partial<FilesState>): FilesState {
  const seeds = seedMap()
  return {
    inbox: typeof parsed.inbox === 'string' ? parsed.inbox : seeds.inbox,
    projects: typeof parsed.projects === 'string' ? parsed.projects : seeds.projects,
  }
}

export function hasStoredFiles(): boolean {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY))
  } catch {
    return false
  }
}

export function loadFiles(): FilesState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedMap()
    const parsed = JSON.parse(raw) as Partial<FilesState>
    return mergeWithSeeds(parsed)
  } catch {
    return seedMap()
  }
}

/** When localStorage is empty, try public sample .org files, then embedded fixtures. */
export async function loadFilesWithRemoteSeed(): Promise<FilesState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FilesState>
      return mergeWithSeeds(parsed)
    }
  } catch {
    // fall through to remote / embedded seed
  }

  try {
    const [inboxRes, projectsRes] = await Promise.all([
      fetch('/sample-inbox.org'),
      fetch('/projects.org'),
    ])
    if (inboxRes.ok && projectsRes.ok) {
      const inbox = await inboxRes.text()
      const projects = await projectsRes.text()
      if (inbox.trim() && projects.trim()) {
        const files: FilesState = { inbox, projects }
        saveFiles(files)
        return files
      }
    }
  } catch {
    // fall back to embedded fixtures
  }

  const seeds = seedMap()
  saveFiles(seeds)
  return seeds
}

export function saveFiles(files: FilesState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files))
}

export function resetFiles(): FilesState {
  const seeds = seedMap()
  saveFiles(seeds)
  return seeds
}

export function fileMeta(id: NestFileId) {
  return SEED_FILES.find((f) => f.id === id)!
}
