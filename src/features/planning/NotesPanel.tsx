import { MessageSquare, StickyNote, ChevronRight } from 'lucide-react'
import type { DocContent, TreeNode } from '@/types'
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
  onOpen,
}: {
  node: TreeNode | null
  noteNodes: TreeNode[]
  onOpen: (node: TreeNode) => void
}) {
  const comments = extractComments(node?.content)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2.5">
        <span className="text-sm font-semibold">Notes & comments</span>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
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

        <section>
          <div className="mb-2 flex items-center gap-1.5 label-text">
            <StickyNote size={13} /> Project notes & research
          </div>
          {noteNodes.length === 0 ? (
            <p className="text-xs text-muted">Add Note or Research items in the manuscript to collect ideas here.</p>
          ) : (
            <div className="space-y-1">
              {noteNodes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onOpen(n)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                >
                  <span className="truncate">{n.title}</span>
                  <ChevronRight size={14} className="text-muted" />
                </button>
              ))}
            </div>
          )}
        </section>

        {!node && (
          <EmptyState icon={<MessageSquare size={28} />} title="Open a document" description="Comments appear here." />
        )}
      </div>
    </div>
  )
}
