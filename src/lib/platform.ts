import { isTauri } from '@tauri-apps/api/core'

/** True when running inside the Nest desktop shell. */
export function isDesktop(): boolean {
  try {
    return isTauri()
  } catch {
    return false
  }
}
