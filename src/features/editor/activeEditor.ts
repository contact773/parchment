import type { Editor } from '@tiptap/react'

/** Module-level reference to the currently mounted document editor, so global
 *  UI (command palette, find & replace) can drive it without prop-drilling. */
let current: Editor | null = null
const subscribers = new Set<() => void>()

export function setActiveEditor(editor: Editor | null): void {
  current = editor
  subscribers.forEach((fn) => fn())
}

export function getActiveEditor(): Editor | null {
  return current && !current.isDestroyed ? current : null
}

export function subscribeActiveEditor(fn: () => void): () => void {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}
