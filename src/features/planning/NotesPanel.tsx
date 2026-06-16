import { MessageSquare, StickyNote, Plus, Trash2 } from 'lucide-react'
import type { DocContent, TreeNode } from '@/types'
import { createNode, deleteNode } from '@/data/repo'
import { EmptyState } from '@/components/ui/misc'

interface CommentRef {
  id: string
  note: string
  excerpt: string
}

function extractComments(content: DocContent | null | undefined): CommentRef[] {
  if (!content) return []
  const map = new Map<string, CommentRef>()
  const walk = (node: DocContent) => {
    if (node.type === 'text' && typeof node.text === 'string') {
      const mark = (node.marks ?? []).find((m) => m.type === 'comment')
      if (mark) {
        const id = String(mark.attrs?.id ?? Math.random())
        const existing = map.get(id)
        if (existing) existing.excerpt += node.text
        else map.set(id, { id, note: String(mark.attrs?.text ?? ''), excerpt: node.text })
      }
    }
    node.content?.forEach(walk)
  }
  walk(content)
  return [...map.values()]
}

export function NotesPanel({
  node,
  noteNodes,
  projectId,
  onOpen,
}: {
  node: TreeNode | null
  noteNodes: TreeNode[]
  projectId: string
  onOpen: (node: TreeNode) => void
}) {
  const comments = extractComments(node?.content)

  const addNote = async (type: 'note' | 'research') => {
    const created = await createNode({ projectId, parentId: null, type, docType: 'prose' })
    onOpen(created)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2.5">
        <span className="text-sm font-semibold">Notes &amp; comments</span>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 label-text">
              <StickyNote size={13} /> Project notes &amp; research
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => addNote('note')}
                className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted hover:border-accent/50 hover:text-text"
                title="New note"
              >
                <Plus size={11} /> Note
              </button>
              <button
                onClick={() => addNote('research')}
                className="flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted hover:border-accent/50 hover:text-text"
                title="New research note"
              >
                <Plus size={11} /> Research
              </button>
            </div>
          </div>
          {noteNodes.length === 0 ? (
            <p className="text-xs text-muted">
              No notes yet. Create one to collect ideas, research and worldbuilding — kept out of your manuscript.
            </p>
          ) : (
            <div className="space-y-1">
              {noteNodes.map((n) => (
                <div key={n.id} className="group flex items-center gap-1 rounded-md hover:bg-surface-2">
                  <button onClick={() => onOpen(n)} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm">
                    <StickyNote size={13} className="shrink-0 text-muted" />
                    <span className="truncate">{n.title}</span>
                    {n.type === 'research' && <span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-[10px] text-muted">research</span>}
                  </button>
                  <button
                    onClick={() => deleteNode(n.id)}
                    className="px-1.5 text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                    title="Move to Trash"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center gap-1.5 label-text">
            <MessageSquare size={13} /> In this document
          </div>
          {comments.length === 0 ? (
            <p className="text-xs text-muted">
              No comments yet. Select text and use the comment button in the toolbar to annotate it.
            </p>
          ) : (
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-surface px-3 py-2">
                  <div className="text-sm text-text">{c.note || <span className="text-muted">No note</span>}</div>
                  {c.excerpt && <div className="mt-1 truncate text-[11px] italic text-muted">“{c.excerpt}”</div>}
                </div>
              ))}
            </div>
          )}
        </section>

        {!node && noteNodes.length === 0 && (
          <EmptyState icon={<MessageSquare size={28} />} title="Notes & comments" description="Create a note above, or comment on text while writing." />
        )}
      </div>
    </div>
  )
}
