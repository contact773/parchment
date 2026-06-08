import { useEffect } from 'react'
import { useSettings } from '@/store/useSettings'
import { applyTheme } from '@/features/themes/applyTheme'
import { BUILTIN_THEMES, findBuiltin } from '@/features/themes/themes'

/** Keeps CSS theme tokens in sync with the active theme + interface scale. */
export function useApplyTheme() {
  const activeThemeId = useSettings((s) => s.settings.activeThemeId)
  const interfaceScale = useSettings((s) => s.settings.interfaceScale)
  const customThemes = useSettings((s) => s.customThemes)

  useEffect(() => {
    const theme =
      customThemes.find((t) => t.id === activeThemeId) ?? findBuiltin(activeThemeId) ?? BUILTIN_THEMES[0]
    applyTheme(theme, interfaceScale)
  }, [activeThemeId, interfaceScale, customThemes])
}
