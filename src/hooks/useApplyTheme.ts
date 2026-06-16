import { useEffect } from 'react'
import { useSettings } from '@/store/useSettings'
import { applyTheme } from '@/features/themes/applyTheme'
import { BUILTIN_THEMES, findBuiltin } from '@/features/themes/themes'

/** Keeps CSS theme tokens in sync with the active theme + interface scale + density. */
export function useApplyTheme() {
  const activeThemeId = useSettings((s) => s.settings.activeThemeId)
  const interfaceScale = useSettings((s) => s.settings.interfaceScale)
  const sidebarDensity = useSettings((s) => s.settings.sidebarDensity)
  const customThemes = useSettings((s) => s.customThemes)

  useEffect(() => {
    const theme =
      customThemes.find((t) => t.id === activeThemeId) ?? findBuiltin(activeThemeId) ?? BUILTIN_THEMES[0]
    applyTheme(theme, interfaceScale)
  }, [activeThemeId, interfaceScale, customThemes])

  // Drive sidebar/binder row density via a root data attribute (see index.css).
  useEffect(() => {
    document.documentElement.dataset.density = sidebarDensity ?? 'cozy'
  }, [sidebarDensity])
}
