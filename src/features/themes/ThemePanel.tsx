import { Check, Plus, Copy, Trash2, Palette } from 'lucide-react'
import type { Theme, ThemeColors } from '@/types'
import { useSettings } from '@/store/useSettings'
import { BUILTIN_THEMES } from './themes'
import { hexToTriplet, tripletToHex } from './color'
import { EDITOR_FONTS } from '@/lib/constants'
import { uid } from '@/lib/id'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Field, Input, Select } from '@/components/ui/Field'
import { Slider, Switch } from '@/components/ui/misc'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const COLOR_LABELS: { key: keyof ThemeColors; label: string }[] = [
  { key: 'bg', label: 'App background' },
  { key: 'surface', label: 'Panels' },
  { key: 'surface-2', label: 'Panel accent' },
  { key: 'border', label: 'Borders' },
  { key: 'paper', label: 'Editor paper' },
  { key: 'ink', label: 'Editor text' },
  { key: 'text', label: 'UI text' },
  { key: 'muted', label: 'Muted text' },
  { key: 'accent', label: 'Accent' },
  { key: 'accent-fg', label: 'Accent text' },
  { key: 'success', label: 'Success' },
  { key: 'danger', label: 'Danger' },
]

export function ThemePanel() {
  const settings = useSettings((s) => s.settings)
  const customThemes = useSettings((s) => s.customThemes)
  const setActiveTheme = useSettings((s) => s.setActiveTheme)
  const saveCustomTheme = useSettings((s) => s.saveCustomTheme)
  const deleteCustomTheme = useSettings((s) => s.deleteCustomTheme)
  const setSettings = useSettings((s) => s.setSettings)

  const allThemes = [...BUILTIN_THEMES, ...customThemes]
  const [editingId, setEditingId] = useState<string | null>(customThemes[0]?.id ?? null)
  const editing = customThemes.find((t) => t.id === editingId) ?? null

  const duplicate = (base: Theme) => {
    const copy: Theme = {
      ...base,
      id: uid(),
      name: `${base.name} Copy`,
      builtin: false,
      createdAt: Date.now(),
      colors: { ...base.colors },
      typography: { ...base.typography },
    }
    saveCustomTheme(copy)
    setEditingId(copy.id)
    setActiveTheme(copy.id)
  }

  const blank = () => duplicate(BUILTIN_THEMES[0])

  const update = (patch: Partial<Theme>) => {
    if (!editing) return
    saveCustomTheme({ ...editing, ...patch })
  }
  const updateColor = (key: keyof ThemeColors, hex: string) => {
    if (!editing) return
    saveCustomTheme({ ...editing, colors: { ...editing.colors, [key]: hexToTriplet(hex) } })
  }
  const updateType = (patch: Partial<Theme['typography']>) => {
    if (!editing) return
    saveCustomTheme({ ...editing, typography: { ...editing.typography, ...patch } })
  }

  return (
    <div className="space-y-8">
      {/* Gallery */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold text-ink">Themes</h3>
          <Button size="sm" variant="primary" onClick={blank}>
            <Plus size={15} /> New theme
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {allThemes.map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              active={settings.activeThemeId === t.id}
              editing={editingId === t.id}
              onSelect={() => setActiveTheme(t.id)}
              onEdit={t.builtin ? () => duplicate(t) : () => setEditingId(t.id)}
              onDuplicate={() => duplicate(t)}
              onDelete={t.builtin ? undefined : () => { deleteCustomTheme(t.id); if (editingId === t.id) setEditingId(null) }}
            />
          ))}
        </div>
      </section>

      {/* Editor */}
      {editing ? (
        <section className="space-y-6 rounded-xl border border-border bg-surface-2/30 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Palette size={18} className="text-accent" />
              <Input
                value={editing.name}
                onChange={(e) => update({ name: e.target.value })}
                className="w-56 font-serif text-base font-semibold"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              Dark mode <Switch checked={editing.dark} onChange={(v) => update({ dark: v })} />
            </label>
          </div>

          <div>
            <span className="label-text mb-2 block">Colors</span>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {COLOR_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5">
                  <input
                    type="color"
                    value={tripletToHex(editing.colors[key])}
                    onChange={(e) => updateColor(key, e.target.value)}
                    className="h-7 w-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                  />
                  <span className="truncate text-xs text-muted">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Editor font">
              <Select value={editing.typography.fontFamily} onChange={(e) => updateType({ fontFamily: e.target.value })}>
                {EDITOR_FONTS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
            <SliderRow label="Font size" value={editing.typography.fontSize} min={14} max={26} unit="px" onChange={(v) => updateType({ fontSize: v })} />
            <SliderRow label="Line height" value={editing.typography.lineHeight} min={1.3} max={2.4} step={0.05} onChange={(v) => updateType({ lineHeight: v })} />
            <SliderRow label="Page width" value={editing.typography.pageWidth} min={520} max={900} step={10} unit="px" onChange={(v) => updateType({ pageWidth: v })} />
            <SliderRow label="Paragraph spacing" value={editing.typography.paragraphSpacing} min={0} max={1.5} step={0.05} unit="em" onChange={(v) => updateType({ paragraphSpacing: v })} />
            <SliderRow label="Corner radius" value={editing.radius} min={0} max={20} unit="px" onChange={(v) => update({ radius: v })} />
          </div>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm">
              First-line indent <Switch checked={editing.typography.paragraphIndent} onChange={(v) => updateType({ paragraphIndent: v })} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              Justify text <Switch checked={editing.typography.justify} onChange={(v) => updateType({ justify: v })} />
            </label>
            {settings.activeThemeId !== editing.id && (
              <Button size="sm" variant="secondary" onClick={() => setActiveTheme(editing.id)}>
                Apply this theme
              </Button>
            )}
          </div>
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          Select a custom theme to edit, or duplicate a preset to make it your own. You can create unlimited themes.
        </p>
      )}

      {/* Interface scale & density live here too */}
      <section className="space-y-4 rounded-xl border border-border bg-surface-2/30 p-5">
        <h3 className="font-serif text-lg font-semibold text-ink">Interface</h3>
        <SliderRow label="Interface scale" value={settings.interfaceScale} min={0.85} max={1.25} step={0.05} unit="×" onChange={(v) => setSettings({ interfaceScale: v })} />
        <Field label="Sidebar density">
          <Select value={settings.sidebarDensity} onChange={(e) => setSettings({ sidebarDensity: e.target.value as typeof settings.sidebarDensity })}>
            <option value="comfortable">Comfortable</option>
            <option value="cozy">Cozy</option>
            <option value="compact">Compact</option>
          </Select>
        </Field>
      </section>
    </div>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums text-text">
          {value}
          {unit}
        </span>
      </div>
      <Slider value={value} min={min} max={max} step={step} onChange={onChange} />
    </div>
  )
}

function ThemeCard({
  theme,
  active,
  editing,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  theme: Theme
  active: boolean
  editing: boolean
  onSelect: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete?: () => void
}) {
  const c = theme.colors
  const rgb = (v: string) => `rgb(${v})`
  return (
    <div
      className={cn(
        'group overflow-hidden rounded-lg border transition-all',
        active ? 'border-accent ring-2 ring-accent/30' : editing ? 'border-accent/50' : 'border-border hover:border-accent/40',
      )}
    >
      <button onClick={onSelect} className="block w-full text-left">
        <div className="relative h-20" style={{ backgroundColor: rgb(c.bg) }}>
          <div className="absolute inset-x-3 top-3 h-3 rounded" style={{ backgroundColor: rgb(c.paper) }} />
          <div className="absolute inset-x-3 top-7 h-2 w-2/3 rounded" style={{ backgroundColor: rgb(c.ink), opacity: 0.55 }} />
          <div className="absolute bottom-3 left-3 h-5 w-5 rounded-full" style={{ backgroundColor: rgb(c.accent) }} />
          {active && (
            <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: rgb(c.accent), color: rgb(c['accent-fg']) }}>
              <Check size={12} />
            </span>
          )}
        </div>
      </button>
      <div className="flex items-center justify-between gap-1 px-2.5 py-1.5">
        <span className="truncate text-xs font-medium">{theme.name}</span>
        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
          {theme.builtin ? (
            <IconButton size="sm" label="Duplicate to edit" onClick={onEdit}>
              <Copy size={13} />
            </IconButton>
          ) : (
            <>
              <IconButton size="sm" label="Edit" onClick={onEdit}>
                <Palette size={13} />
              </IconButton>
              <IconButton size="sm" label="Duplicate" onClick={onDuplicate}>
                <Copy size={13} />
              </IconButton>
              {onDelete && (
                <IconButton size="sm" label="Delete" onClick={onDelete} className="text-danger">
                  <Trash2 size={13} />
                </IconButton>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
