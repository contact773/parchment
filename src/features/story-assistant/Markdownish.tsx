import { Fragment, type ReactNode } from 'react'

/** Minimal, safe markdown-ish renderer for assistant output (bold, italic,
 *  headings, lists). No raw HTML is ever injected. */
function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*|_([^_]+)_|`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[2]) nodes.push(<strong key={`${keyBase}-b-${i}`}>{m[2]}</strong>)
    else if (m[3]) nodes.push(<em key={`${keyBase}-i-${i}`} className="text-muted">{m[3]}</em>)
    else if (m[4]) nodes.push(<code key={`${keyBase}-c-${i}`} className="rounded bg-surface-2 px-1 py-0.5 text-[0.85em]">{m[4]}</code>)
    last = m.index + m[0].length
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function Markdownish({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-text">
      {lines.map((line, idx) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={idx} className="h-1.5" />
        if (/^#{1,3}\s/.test(trimmed)) {
          return (
            <h4 key={idx} className="pt-1 font-serif text-base font-semibold text-ink">
              {inline(trimmed.replace(/^#{1,3}\s/, ''), `h${idx}`)}
            </h4>
          )
        }
        if (/^[-*]\s/.test(trimmed)) {
          return (
            <div key={idx} className="flex gap-2 pl-1">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
              <span>{inline(trimmed.replace(/^[-*]\s/, ''), `li${idx}`)}</span>
            </div>
          )
        }
        return (
          <p key={idx}>
            <Fragment>{inline(trimmed, `p${idx}`)}</Fragment>
          </p>
        )
      })}
    </div>
  )
}
