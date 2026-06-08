import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Keyboard, MousePointerClick, Sparkles, Feather } from 'lucide-react'

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl'

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: `${mod} + K`, desc: 'Open the command palette' },
  { keys: `${mod} + F`, desc: 'Find & replace in the document' },
  { keys: `${mod} + B / I / U`, desc: 'Bold / Italic / Underline' },
  { keys: `${mod} + Z`, desc: 'Undo' },
  { keys: `${mod} + Shift + Z`, desc: 'Redo' },
  { keys: '/', desc: 'Slash commands (at the start of a line)' },
  { keys: 'Right-click', desc: 'Context menu: types, colours, conversions, assistant' },
  { keys: 'Tab / Shift+Tab', desc: 'Cycle screenplay element (script docs)' },
  { keys: 'Enter', desc: 'Flow to the next screenplay element' },
  { keys: 'Esc', desc: 'Exit distraction-free / close menus' },
]

const TIPS: { icon: typeof Sparkles; title: string; body: string }[] = [
  { icon: MousePointerClick, title: 'Select, then act', body: 'Select any text to reveal the floating mini-toolbar, or right-click for the full menu — including rewrite, improve, translate and tone.' },
  { icon: Sparkles, title: 'The assistant offers options', body: 'It never forces one direction — every suggestion comes with the narrative effect it would have. Works offline; connect a model in Settings for full rewriting.' },
  { icon: Keyboard, title: 'Stay on the keyboard', body: 'Type “/” for structure and formatting, ⌘K to jump anywhere, ⌘F to find. The binder supports drag-and-drop reordering.' },
  { icon: Feather, title: 'Your work is safe', body: 'Everything saves automatically to this device. Take snapshots before big revisions, compare versions, and export a backup any time.' },
]

export function HelpPage() {
  const navigate = useNavigate()
  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-text">
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="font-serif text-lg font-semibold text-ink">Help & Shortcuts</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-8 px-8 py-8">
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-serif text-xl font-semibold text-ink">
              <Keyboard size={18} /> Keyboard shortcuts
            </h2>
            <div className="overflow-hidden rounded-xl border border-border">
              {SHORTCUTS.map((s, i) => (
                <div key={s.keys} className={`flex items-center justify-between px-4 py-2.5 ${i % 2 ? 'bg-surface-2/30' : 'bg-surface'}`}>
                  <span className="text-sm text-text">{s.desc}</span>
                  <kbd className="rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-xs text-muted">{s.keys}</kbd>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-serif text-xl font-semibold text-ink">Getting the most from Parchment</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TIPS.map((t) => (
                <div key={t.title} className="rounded-xl border border-border bg-surface p-4">
                  <div className="mb-2 flex items-center gap-2 text-accent">
                    <t.icon size={17} />
                    <span className="text-sm font-semibold text-text">{t.title}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted">{t.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
