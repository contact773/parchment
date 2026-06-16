import { useEffect, useState } from 'react'
import type { LanguageCode, Project, ProjectType } from '@/types'
import { createProject, updateProject } from '@/data/repo'
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
  project,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (p: Project) => void
  /** When provided, the modal edits this project's metadata instead of creating a new one. */
  project?: Project
}) {
  const editing = !!project
  const defaultLanguage = useSettings((s) => s.settings.defaultLanguage)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ProjectType>('novel')
  const [author, setAuthor] = useState('')
  const [language, setLanguage] = useState<LanguageCode>(defaultLanguage)
  const [genre, setGenre] = useState('')
  const [logline, setLogline] = useState('')
  const [targetWords, setTargetWords] = useState('')
  const [deadline, setDeadline] = useState('')
  const [busy, setBusy] = useState(false)

  // Sync fields whenever the modal opens (prefill in edit mode, fresh otherwise).
  useEffect(() => {
    if (!open) return
    if (project) {
      setTitle(project.title)
      setType(project.type)
      setAuthor(project.author ?? '')
      setLanguage(project.language)
      setGenre(project.genre ?? '')
      setLogline(project.logline ?? '')
      setTargetWords(project.targetWords ? String(project.targetWords) : '')
      setDeadline(project.deadline ?? '')
    } else {
      setTitle('')
      setType('novel')
      setAuthor('')
      setLanguage(defaultLanguage)
      setGenre('')
      setLogline('')
      setTargetWords('')
      setDeadline('')
    }
  }, [open, project, defaultLanguage])

  const submit = async () => {
    setBusy(true)
    const meta = {
      title: title.trim() || 'Untitled',
      author,
      language,
      genre,
      logline,
      deadline: deadline || undefined,
      targetWords: targetWords ? Number(targetWords) : 0,
    }
    if (project) {
      await updateProject(project.id, meta)
      setBusy(false)
      onClose()
      return
    }
    const color = ACCENT_PALETTE[Math.floor(Math.random() * ACCENT_PALETTE.length)]
    const created = await createProject({ ...meta, type, color, targetWords: targetWords ? Number(targetWords) : undefined })
    setBusy(false)
    onClose()
    onCreated?.(created)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Project details' : 'New project'}
      description={editing ? 'Update the title, deadline, target and other details.' : 'Pick a format — Parchment sets up a sensible structure you can reshape.'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {editing ? 'Save changes' : 'Create project'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Title">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Name of Your Work" />
        </Field>

        {!editing && (
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
        )}

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

        <div className="grid grid-cols-2 gap-4">
          <Field label="Word target" hint={editing ? 'Leave blank to clear' : 'Leave blank for the format default'}>
            <Input type="number" min={0} value={targetWords} onChange={(e) => setTargetWords(e.target.value)} placeholder="e.g. 80000" />
          </Field>
          <Field label="Deadline" hint="Optional target date">
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
