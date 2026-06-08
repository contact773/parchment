import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { debounce } from '@/lib/utils'
import { Field, Input, Textarea, Select } from './Field'

/**
 * Debounced auto-saving fields. `depKey` should identify the entity being
 * edited (e.g. node id) — when it changes, the field resets and the previous
 * pending save is flushed against the correct entity.
 */
function useAutosave(save: (v: string) => void, depKey: string, initial: string) {
  const [value, setValue] = useState(initial)
  // Capture `save` per depKey so a flush on switch targets the right entity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debounced = useMemo(() => debounce((v: string) => save(v), 500), [depKey])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setValue(initial), [depKey])
  useEffect(() => () => debounced.flush(), [debounced])
  const onChange = (v: string) => {
    setValue(v)
    debounced(v)
  }
  return { value, onChange, flush: () => debounced.flush() }
}

export function AutoInput({
  label,
  hint,
  value: initial,
  save,
  depKey,
  placeholder,
  type,
}: {
  label?: ReactNode
  hint?: ReactNode
  value: string
  save: (v: string) => void
  depKey: string
  placeholder?: string
  type?: string
}) {
  const f = useAutosave(save, depKey, initial)
  return (
    <Field label={label} hint={hint}>
      <Input type={type} value={f.value} placeholder={placeholder} onChange={(e) => f.onChange(e.target.value)} onBlur={f.flush} />
    </Field>
  )
}

export function AutoTextarea({
  label,
  value: initial,
  save,
  depKey,
  placeholder,
  rows,
}: {
  label?: ReactNode
  value: string
  save: (v: string) => void
  depKey: string
  placeholder?: string
  rows?: number
}) {
  const f = useAutosave(save, depKey, initial)
  return (
    <Field label={label}>
      <Textarea rows={rows} value={f.value} placeholder={placeholder} onChange={(e) => f.onChange(e.target.value)} onBlur={f.flush} />
    </Field>
  )
}

export function AutoSelect({
  label,
  value: initial,
  save,
  depKey,
  children,
}: {
  label?: ReactNode
  value: string
  save: (v: string) => void
  depKey: string
  children: ReactNode
}) {
  const f = useAutosave(save, depKey, initial)
  return (
    <Field label={label}>
      <Select value={f.value} onChange={(e) => { f.onChange(e.target.value); save(e.target.value) }}>
        {children}
      </Select>
    </Field>
  )
}
