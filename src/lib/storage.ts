import { SEED_FILES, type NestFileId, seedMap } from '../fixtures'

const STORAGE_KEY = 'nest.files.v1'

export type FilesState = Record<NestFileId, string>

export function loadFiles(): FilesState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedMap()
    const parsed = JSON.parse(raw) as Partial<FilesState>
    const seeds = seedMap()
    return {
      inbox: typeof parsed.inbox === 'string' ? parsed.inbox : seeds.inbox,
      projects: typeof parsed.projects === 'string' ? parsed.projects : seeds.projects,
    }
  } catch {
    return seedMap()
  }
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
