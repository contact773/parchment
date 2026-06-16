import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Palette,
  PenLine,
  Sparkles,
  BookMarked,
  Database,
  Trash2,
  Download,
  Upload,
  Feather,
} from 'lucide-react'
import { useSettings } from '@/store/useSettings'
import { useUI } from '@/store/useUI'
import { db } from '@/data/db'
import type { AIProviderId, LanguageCode } from '@/types'
import { LANGUAGES, LANGUAGE_ORDER } from '@/lib/constants'
import { ThemePanel } from '@/features/themes/ThemePanel'
import { exportFullBackup, importBackup } from '@/features/export/backup'
import { isDesktop, openFileNative } from '@/lib/desktop'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Switch } from '@/components/ui/misc'
import { cn } from '@/lib/utils'

type Section = 'appearance' | 'writing' | 'assistant' | 'dictionary' | 'data' | 'about'

const NAV: { id: Section; label: string; icon: typeof Palette }[] = [
  { id: 'appearance', label: 'Appearance & Themes', icon: Palette },
  { id: 'writing', label: 'Writing', icon: PenLine },
  { id: 'assistant', label: 'Story Assistant', icon: Sparkles },
  { id: 'dictionary', label: 'Dictionaries', icon: BookMarked },
  { id: 'data', label: 'Data & Backup', icon: Database },
  { id: 'about', label: 'About', icon: Feather },
]

export function SettingsPage() {
  const navigate = useNavigate()
  const [section, setSection] = useState<Section>('appearance')

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </Button>
        <h1 className="font-serif text-lg font-semibold text-ink">Settings</h1>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="w-60 shrink-0 space-y-0.5 border-r border-border bg-surface p-3">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                section === n.id ? 'bg-accent/15 font-medium text-accent' : 'text-text hover:bg-surface-2',
              )}
            >
              <n.icon size={16} />
              {n.label}
            </button>
          ))}
        </nav>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-8 py-8">
            {section === 'appearance' && <ThemePanel />}
            {section === 'writing' && <WritingSettings />}
            {section === 'assistant' && <AssistantSettings />}
            {section === 'dictionary' && <DictionarySettings />}
            {section === 'data' && <DataSettings />}
            {section === 'about' && <AboutSection />}
          </div>
        </main>
      </div>
    </div>
  )
}

function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-serif text-xl font-semibold text-ink">{title}</h2>
      {desc && <p className="mt-1 text-sm text-muted">{desc}</p>}
    </div>
  )
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-text">{label}</div>
        {desc && <div className="text-xs text-muted">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function WritingSettings() {
  const settings = useSettings((s) => s.settings)
  const setSettings = useSettings((s) => s.setSettings)
  const dailyGoal = useSettings((s) => s.stats.dailyGoal)
  const setDailyGoal = useSettings((s) => s.setDailyGoal)

  return (
    <div className="space-y-3">
      <SectionTitle title="Writing" desc="Defaults for new documents and the editing experience." />
      <Row label="Default language" desc="Used for spellcheck on new projects.">
        <Select
          value={settings.defaultLanguage}
          onChange={(e) => setSettings({ defaultLanguage: e.target.value as LanguageCode })}
          className="w-44"
        >
          {LANGUAGE_ORDER.map((l) => (
            <option key={l} value={l}>
              {LANGUAGES[l].flag} {LANGUAGES[l].native}
            </option>
          ))}
        </Select>
      </Row>
      <Row label="Spellcheck" desc="Underline misspellings as you write.">
        <Switch checked={settings.spellcheckEnabled} onChange={(v) => setSettings({ spellcheckEnabled: v })} />
      </Row>
      <Row label="Autosave" desc="Your work saves automatically as you type. Press ⌘/Ctrl+S to save right now.">
        <span className="text-xs font-medium text-success">Always on</span>
      </Row>
      <Row label="Default focus mode">
        <Select value={settings.focusMode} onChange={(e) => setSettings({ focusMode: e.target.value as typeof settings.focusMode })} className="w-44">
          <option value="off">Off</option>
          <option value="paragraph">Focus paragraph</option>
          <option value="typewriter">Typewriter</option>
        </Select>
      </Row>
      <Row label="Daily word goal" desc="Your target words per day.">
        <Input type="number" min={0} step={50} value={dailyGoal} onChange={(e) => setDailyGoal(Number(e.target.value))} className="w-28" />
      </Row>
    </div>
  )
}

const PROVIDERS: { id: AIProviderId; label: string; needsKey: boolean; modelHint: string; note?: string }[] = [
  { id: 'local', label: 'Parchment (local, no setup)', needsKey: false, modelHint: '' },
  { id: 'openai', label: 'OpenAI', needsKey: true, modelHint: 'gpt-4o-mini' },
  { id: 'anthropic', label: 'Anthropic (Claude)', needsKey: true, modelHint: 'claude-opus-4-8' },
  { id: 'gemini', label: 'Google Gemini', needsKey: true, modelHint: 'gemini-1.5-flash' },
  { id: 'ollama', label: 'Ollama (local, recommended)', needsKey: false, modelHint: 'llama3.1:8b', note: 'Runs fully offline against your local Ollama server. Install Ollama from ollama.com, then run:  ollama pull llama3.1:8b' },
]

function AssistantSettings() {
  const ai = useSettings((s) => s.settings.ai)
  const setAI = useSettings((s) => s.setAI)
  const current = PROVIDERS.find((p) => p.id === ai.provider) ?? PROVIDERS[0]

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Story Assistant"
        desc="Defaults to a local Ollama model (llama3.1:8b) — private, offline and free. Install Ollama to use it, or switch to OpenAI, Anthropic or Gemini. If no model is reachable, Parchment falls back to its built-in offline assistant. Keys are stored only on this device."
      />
      <Field label="Provider">
        <Select value={ai.provider} onChange={(e) => setAI({ provider: e.target.value as AIProviderId })}>
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>

      {ai.provider !== 'local' && (
        <>
          <Field label="Model" hint={`e.g. ${current.modelHint}`}>
            <Input value={ai.model} onChange={(e) => setAI({ model: e.target.value })} placeholder={current.modelHint} />
          </Field>
          {current.needsKey && (
            <Field label="API key" hint="Stored locally in your browser. Never uploaded anywhere by Parchment.">
              <Input type="password" value={ai.apiKey} onChange={(e) => setAI({ apiKey: e.target.value })} placeholder="sk-…" />
            </Field>
          )}
          {(ai.provider === 'ollama' || ai.provider === 'openai') && (
            <Field label="Base URL" hint={ai.provider === 'ollama' ? 'Default http://localhost:11434' : 'Optional override'}>
              <Input value={ai.baseUrl ?? ''} onChange={(e) => setAI({ baseUrl: e.target.value })} placeholder="http://localhost:11434" />
            </Field>
          )}
          <p className="rounded-lg border border-border bg-surface-2/50 px-4 py-3 text-xs text-muted">
            Note: browser-based API calls may be blocked by provider CORS policies. If a request fails, Parchment falls back to
            the built-in local assistant automatically. {current.note}
          </p>
        </>
      )}
    </div>
  )
}

function DictionarySettings() {
  const dictionary = useSettings((s) => s.dictionary)
  const addDictWord = useSettings((s) => s.addDictWord)
  const removeDictWord = useSettings((s) => s.removeDictWord)
  const removeIgnoredWord = useSettings((s) => s.removeIgnoredWord)
  const [lang, setLang] = useState<LanguageCode>('en')
  const [word, setWord] = useState('')

  return (
    <div className="space-y-4">
      <SectionTitle title="Personal dictionaries" desc="Words you add are accepted across all documents of that language." />
      <div className="flex items-end gap-2">
        <Field label="Language" className="w-40">
          <Select value={lang} onChange={(e) => setLang(e.target.value as LanguageCode)}>
            {LANGUAGE_ORDER.map((l) => (
              <option key={l} value={l}>
                {LANGUAGES[l].flag} {LANGUAGES[l].native}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Add a word" className="flex-1">
          <Input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && word.trim()) {
                addDictWord(lang, word.trim())
                setWord('')
              }
            }}
            placeholder="e.g. a character or place name"
          />
        </Field>
        <Button
          variant="primary"
          onClick={() => {
            if (word.trim()) {
              addDictWord(lang, word.trim())
              setWord('')
            }
          }}
        >
          Add
        </Button>
      </div>

      <WordList title="Added words" words={dictionary.added[lang]} onRemove={(w) => removeDictWord(lang, w)} />
      <WordList title="Ignored this session" words={dictionary.ignored[lang]} onRemove={(w) => removeIgnoredWord(lang, w)} />
    </div>
  )
}

function WordList({ title, words, onRemove }: { title: string; words: string[]; onRemove: (w: string) => void }) {
  return (
    <div>
      <div className="label-text mb-2">{title} ({words.length})</div>
      {words.length === 0 ? (
        <p className="text-xs text-muted">None yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {words.map((w) => (
            <span key={w} className="flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs">
              {w}
              <button onClick={() => onRemove(w)} className="text-muted hover:text-danger">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function DataSettings() {
  const toast = useUI((s) => s.toast)
  const fileRef = useRef<HTMLInputElement>(null)

  const clearAll = async () => {
    if (!confirm('Delete ALL projects and content from this device? This cannot be undone. Export a backup first!')) return
    // Clear every table (including worldElements + maps, and any added later) so
    // nothing private is silently left behind in IndexedDB.
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map((t) => t.clear()))
    })
    toast('All projects deleted', 'info')
  }

  return (
    <div className="space-y-3">
      <SectionTitle title="Data & backup" desc="Your work lives locally in this browser. Back it up regularly." />
      <Row label="Full backup" desc="Download every project + settings as one file.">
        <Button variant="secondary" onClick={() => exportFullBackup().then(() => toast('Backup downloaded', 'success'))}>
          <Download size={15} /> Export all
        </Button>
      </Row>
      <Row label="Restore" desc="Import a full backup or a single project file.">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              const res = await importBackup(f)
              toast(res.kind === 'full' ? `Restored ${res.projects} project(s)` : 'Project imported', 'success')
            } catch (err) {
              toast(`Import failed: ${(err as Error).message}`, 'error')
            }
            e.target.value = ''
          }}
        />
        <Button
          variant="secondary"
          onClick={async () => {
            if (isDesktop()) {
              const f = await openFileNative([{ name: 'Parchment backup', extensions: ['json'] }])
              if (!f) return
              try {
                const res = await importBackup(f)
                toast(res.kind === 'full' ? `Restored ${res.projects} project(s)` : 'Project imported', 'success')
              } catch (err) {
                toast(`Import failed: ${(err as Error).message}`, 'error')
              }
            } else {
              fileRef.current?.click()
            }
          }}
        >
          <Upload size={15} /> Import
        </Button>
      </Row>
      <div className="mt-6 rounded-lg border border-danger/30 bg-danger/5 p-4">
        <div className="mb-2 text-sm font-semibold text-danger">Danger zone</div>
        <Row label="Delete everything" desc="Permanently remove all projects from this device.">
          <Button variant="danger" onClick={clearAll}>
            <Trash2 size={15} /> Delete all
          </Button>
        </Row>
      </div>
    </div>
  )
}

function AboutSection() {
  return (
    <div className="space-y-4">
      <SectionTitle title="About Parchment" />
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <Feather size={22} />
          </span>
          <div>
            <div className="font-serif text-xl font-semibold text-ink">Parchment</div>
            <div className="text-sm text-muted">A writing studio for serious work · v0.1.0</div>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Parchment is a local-first writing studio for novels, scripts, poetry and worldbuilding. Everything you write is
          stored privately in your browser. Combine the calm of a distraction-free editor, the structure of a manuscript
          binder, multilingual spellcheck, a story-development assistant, deep theming and reliable exports — built to be the
          place you spend hours writing.
        </p>
      </div>
    </div>
  )
}
