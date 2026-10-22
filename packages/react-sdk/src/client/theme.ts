// [sdk] packages/react-sdk/src/client/theme.ts

import { useEffect, useState } from 'react'
import { resolveTheme, type ThemeContext } from '@jimcast/protocol'

// Host -> plugin theme message. Current hosts send the fully resolved theme
// (including any `themes.colors` overrides from config.json) next to the
// name. Older hosts send only `themeName`, so the plugin falls back to
// resolving it from its own bundled copy of @jimcast/protocol.
interface ThemeMessagePayload {
  themeName?: string
  theme?:     ThemeContext
}

// Minimal shape check: a malformed `theme` must not replace a working one.
function isThemeContext(v: unknown): v is ThemeContext {
  if (!v || typeof v !== 'object') return false
  const t = v as Partial<ThemeContext>
  return (
    (t.mode === 'light' || t.mode === 'dark') &&
    !!t.colors && typeof t.colors === 'object'
  )
}

let currentTheme: ThemeContext = resolveTheme(undefined)
const themeListeners = new Set<(t: ThemeContext) => void>()

window.addEventListener('message', (e: MessageEvent) => {
  const data = e.data
  if (!data || typeof data !== 'object' || data.source !== 'jimcast-host') return
  if (data.type !== 'theme') return

  const payload = (data.payload ?? {}) as ThemeMessagePayload

  currentTheme = isThemeContext(payload.theme)
    ? payload.theme
    : resolveTheme(payload.themeName)

  themeListeners.forEach(fn => fn(currentTheme))
})

export function useTheme(): ThemeContext {
  const [theme, setTheme] = useState<ThemeContext>(currentTheme)
  useEffect(() => {
    themeListeners.add(setTheme)
    // A theme message may have arrived between the first render and this
    // effect running; sync once so the component doesn't stay stale.
    setTheme(currentTheme)
    return () => { themeListeners.delete(setTheme) }
  }, [])
  return theme
}
