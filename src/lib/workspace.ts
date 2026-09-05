import { open } from '@tauri-apps/plugin-dialog'
import {
  exists,
  mkdir,
  readTextFile,
  remove,
  rename,
  stat,
  writeTextFile,
} from '@tauri-apps/plugin-fs'
import { load } from '@tauri-apps/plugin-store'
import { appDataDir, join } from '@tauri-apps/api/path'
import { SEED_FILES, type NestFileId, seedMap } from '../fixtures'
import type { FilesState } from './storage'

const SETTINGS_STORE = 'nest-settings.json'
const WORKSPACE_KEY = 'workspacePath'
const DEFAULT_DIR_NAME = 'org'

async function settingsStore() {
  return load(SETTINGS_STORE, { autoSave: true })
}

export async function getSavedWorkspacePath(): Promise<string | null> {
  const store = await settingsStore()
  const value = await store.get<string>(WORKSPACE_KEY)
  return typeof value === 'string' && value.trim() ? value : null
}

export async function setSavedWorkspacePath(path: string): Promise<void> {
  const store = await settingsStore()
  await store.set(WORKSPACE_KEY, path)
  await store.save()
}

export async function pickWorkspaceFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Choose Nest folder',
  })
  if (selected === null) return null
  const path = Array.isArray(selected) ? selected[0] : selected
  if (!path) return null
  await setSavedWorkspacePath(path)
  return path
}

export async function defaultWorkspacePath(): Promise<string> {
  const base = await appDataDir()
  return join(base, DEFAULT_DIR_NAME)
}

export async function ensureDefaultWorkspace(): Promise<string> {
  const path = await defaultWorkspacePath()
  const already = await exists(path)
  if (!already) {
    await mkdir(path, { recursive: true })
  }
  await setSavedWorkspacePath(path)
  return path
}

function fileNameFor(id: NestFileId): string {
  return SEED_FILES.find((f) => f.id === id)!.name
}

async function pathFor(folder: string, id: NestFileId): Promise<string> {
  return join(folder, fileNameFor(id))
}

/** Migrate sample-inbox.org -> inbox.org when inbox is missing. */
async function migrateSampleInbox(folder: string): Promise<void> {
  const inboxPath = await join(folder, 'inbox.org')
  if (await exists(inboxPath)) return
  const samplePath = await join(folder, 'sample-inbox.org')
  if (!(await exists(samplePath))) return
  try {
    await rename(samplePath, inboxPath)
  } catch {
    const text = await readTextFile(samplePath)
    await writeTextFile(inboxPath, text)
  }
}

async function seedMissing(folder: string): Promise<void> {
  await migrateSampleInbox(folder)
  const seeds = seedMap()
  for (const id of Object.keys(seeds) as NestFileId[]) {
    const filePath = await pathFor(folder, id)
    if (!(await exists(filePath))) {
      await writeTextFile(filePath, seeds[id])
    }
  }
}

export interface FileStamp {
  mtimeMs: number
  sha256: string
}

/** Identity of a file's contents as Nest last saw it on disk. */
const stamps = new Map<string, FileStamp>()

export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function stampFor(path: string, text: string): Promise<FileStamp> {
  const info = await stat(path)
  return { mtimeMs: info.mtime?.getTime() ?? 0, sha256: await sha256(text) }
}

async function readStamped(path: string): Promise<string> {
  const text = await readTextFile(path)
  stamps.set(path, await stampFor(path, text))
  return text
}

export async function readWorkspaceFiles(folder: string): Promise<FilesState> {
  await seedMissing(folder)
  const inbox = await readStamped(await pathFor(folder, 'inbox'))
  const projects = await readStamped(await pathFor(folder, 'projects'))
  return { inbox, projects }
}

export class StaleFileError extends Error {}

/**
 * Atomic write: temp file in the same directory, fsync-by-rename onto the
 * target. Refuses if the file changed on disk since Nest last read it.
 */
export async function writeWorkspaceFile(
  folder: string,
  id: NestFileId,
  source: string,
): Promise<void> {
  const target = await pathFor(folder, id)
  const known = stamps.get(target)
  if (known) {
    const onDisk = await stampFor(target, await readTextFile(target))
    if (onDisk.sha256 !== known.sha256) {
      throw new StaleFileError(`${fileNameFor(id)} changed on disk since Nest read it`)
    }
  }
  const tmp = `${target}.nest-tmp`
  await writeTextFile(tmp, source)
  try {
    await rename(tmp, target)
  } catch (err) {
    await remove(tmp).catch(() => {})
    throw err
  }
  stamps.set(target, await stampFor(target, source))
}

export async function writeWorkspaceFiles(
  folder: string,
  files: FilesState,
): Promise<void> {
  await writeWorkspaceFile(folder, 'inbox', files.inbox)
  await writeWorkspaceFile(folder, 'projects', files.projects)
}

export async function resetWorkspaceFiles(folder: string): Promise<FilesState> {
  const seeds = seedMap()
  await writeWorkspaceFiles(folder, seeds)
  return seeds
}

/**
 * Resolve workspace on launch:
 * - use saved path if still present
 * - otherwise prompt; if cancelled, create default under app data
 */
export async function resolveWorkspace(): Promise<{
  path: string
  files: FilesState
  createdDefault: boolean
}> {
  const saved = await getSavedWorkspacePath()
  if (saved && (await exists(saved))) {
    const files = await readWorkspaceFiles(saved)
    return { path: saved, files, createdDefault: false }
  }

  const picked = await pickWorkspaceFolder()
  if (picked) {
    const files = await readWorkspaceFiles(picked)
    return { path: picked, files, createdDefault: false }
  }

  const path = await ensureDefaultWorkspace()
  const files = await readWorkspaceFiles(path)
  return { path, files, createdDefault: true }
}

let resolveOnce: Promise<{
  path: string
  files: FilesState
  createdDefault: boolean
}> | null = null

/** Deduplicates first-launch folder resolution (React StrictMode). */
export function resolveWorkspaceOnce() {
  if (!resolveOnce) resolveOnce = resolveWorkspace()
  return resolveOnce
}
