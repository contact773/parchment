/**
 * Desktop (Tauri) integration helpers.
 *
 * When Parchment runs inside the Tauri desktop shell we use real native
 * Save/Open dialogs and write files straight to the chosen path (via the
 * `write_file_bytes` / `read_file_bytes` Rust commands). In a plain browser we
 * fall back to the existing file-saver download / <input type="file"> flow, so
 * the same codebase keeps working on the web.
 */
import { isTauri as isTauriRuntime, invoke } from '@tauri-apps/api/core'
import { save, open } from '@tauri-apps/plugin-dialog'
import { saveAs } from 'file-saver'

export interface FileFilter {
  name: string
  extensions: string[]
}

/** True when running inside the Tauri desktop shell (false in a normal browser). */
export function isDesktop(): boolean {
  try {
    return isTauriRuntime()
  } catch {
    return false
  }
}

/**
 * Persist a Blob to disk.
 * - Desktop: opens a native Save dialog, then writes the bytes to the chosen path.
 * - Browser: triggers a file-saver download.
 *
 * Returns the saved path (desktop), an empty string (browser download started),
 * or `null` if the user cancelled the native dialog.
 */
export async function saveBlob(blob: Blob, defaultName: string, filters?: FileFilter[]): Promise<string | null> {
  if (isDesktop()) {
    const path = await save({ defaultPath: defaultName, filters })
    if (!path) return null
    const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()))
    await invoke('write_file_bytes', { path, contents: bytes })
    return path
  }
  saveAs(blob, defaultName)
  return ''
}

/**
 * Pick a file with the native Open dialog and return it as a `File`, so existing
 * File-based import code (importBackup / importDocumentFile) works unchanged.
 * Returns `null` if cancelled, or if not running on desktop (caller should fall
 * back to a hidden <input type="file">).
 */
export async function openFileNative(filters?: FileFilter[]): Promise<File | null> {
  if (!isDesktop()) return null
  const selected = await open({ multiple: false, directory: false, filters })
  if (!selected || Array.isArray(selected)) return null
  const path = selected as string
  const bytes: number[] = await invoke('read_file_bytes', { path })
  const name = path.split(/[\\/]/).pop() || 'import'
  return new File([new Uint8Array(bytes)], name)
}
