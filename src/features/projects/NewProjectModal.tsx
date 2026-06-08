import { useState } from 'react'
import type { LanguageCode, Project, ProjectType } from '@/types'
import { createProject } from '@/data/repo'
import { PROJECT_TYPES, PROJECT_TYPE_ORDER, LANGUAGES, LANGUAGE_ORDER, ACCENT_PALETTE } from '@/lib/constants'
import { ProjectIcon } from '@/components/ProjectIcon'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { cn } from '@/lib/utils'
import { useSettings } from '@/store/useSettings'

export function NewProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (p: Project) => void
}) {
  const defaultLanguage = useSettings((s) => s.settings.defaultLanguage)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ProjectType>('novel')
  const [author, setAuthor] = useState('')
  const [language, setLanguage] = useState<LanguageCode>(defaultLanguage)
  const [genre, setGenre] = useState('')
  const [logline, setLogline] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setTitle('')
    setType('novel')
    setAuthor('')
    setGenre('')
    setLogline('')
  }

  const submit = async () => {
    setBusy(true)
    const color = ACCENT_PALETTE[Math.floor(Math.random() * ACCENT_PALETTE.length)]
    const project = await createProject({ title: title || 'Untitled', type, author, language, genre, logline, color })
    setBusy(false)
    reset()
    onCreated(project)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New project"
      description="Pick a format — Parchment sets up a sensible structure you can reshape."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            Create project
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Title">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Name of Your Work" />
        </Field>

        <div>
          <span className="label-text mb-2 block">Format</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PROJECT_TYPE_ORDER.map((t) => {
              const info = PROJECT_TYPES[t]
              return (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    'flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all',
                    type === t ? 'border-accent bg-accent/10 ring-1 ring-accent/30' : 'border-border hover:border-accent/40 hover:bg-surface-2',
                  )}
                >
                  <ProjectIcon type={t} size={18} className={type === t ? 'text-accent' : 'text-muted'} />
                  <span className="text-sm font-medium">{info.label}</span>
                  <span className="text-[11px] leading-tight text-muted">{info.structure}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Author">
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" />
          </Field>
          <Field label="Language (spellcheck)">
            <Select value={language} onChange={(e) => setLanguage(e.target.value as LanguageCode)}>
              {LANGUAGE_ORDER.map((l) => (
                <option key={l} value={l}>
                  {LANGUAGES[l].flag} {LANGUAGES[l].native}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Genre" hint="Optional — helps the assistant">
            <Input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="e.g. Literary, Fantasy" />
          </Field>
          <Field label="Logline" hint="One-sentence pitch">
            <Input value={logline} onChange={(e) => setLogline(e.target.value)} placeholder="A …, who …, must …" />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
