import type { Theme } from '@/types'

/** Write a theme's tokens to CSS custom properties on :root. */
export function applyTheme(theme: Theme, interfaceScale = 1): void {
  const root = document.documentElement
  const c = theme.colors
  root.style.setProperty('--c-bg', c.bg)
  root.style.setProperty('--c-surface', c.surface)
  root.style.setProperty('--c-surface-2', c['surface-2'])
  root.style.setProperty('--c-border', c.border)
  root.style.setProperty('--c-text', c.text)
  root.style.setProperty('--c-muted', c.muted)
  root.style.setProperty('--c-accent', c.accent)
  root.style.setProperty('--c-accent-fg', c['accent-fg'])
  root.style.setProperty('--c-paper', c.paper)
  root.style.setProperty('--c-ink', c.ink)
  root.style.setProperty('--c-danger', c.danger)
  root.style.setProperty('--c-success', c.success)

  root.style.setProperty('--radius', `${theme.radius}px`)

  // Editor typography tokens.
  const t = theme.typography
  root.style.setProperty('--editor-font', t.fontFamily)
  root.style.setProperty('--editor-size', `${t.fontSize}px`)
  root.style.setProperty('--editor-line-height', String(t.lineHeight))
  root.style.setProperty('--editor-width', `${t.pageWidth}px`)
  root.style.setProperty('--editor-spacing', `${t.paragraphSpacing}em`)
  root.style.setProperty('--editor-indent', t.paragraphIndent ? '1.6em' : '0')
  root.style.setProperty('--editor-align', t.justify ? 'justify' : 'left')

  // Interface scale (affects rem-based sizing).
  root.style.setProperty('--ui-scale', String(interfaceScale))

  root.classList.toggle('dark', theme.dark)
  root.style.colorScheme = theme.dark ? 'dark' : 'light'
}
