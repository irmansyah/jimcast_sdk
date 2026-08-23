// [sdk] packages/react-sdk/src/client/theme.ts

import { useEffect, useState } from 'react'
import { resolveTheme, type ThemeContext } from '@jimcast/protocol'

let currentTheme: ThemeContext = resolveTheme(undefined)
const themeListeners = new Set<(t: ThemeContext) => void>()

window.addEventListener('message', (e: MessageEvent) => {
  const data = e.data
  if (!data || typeof data !== 'object' || data.source !== 'jimcast-host') return
  if (data.type === 'theme') {
    const { themeName } = data.payload as { themeName: string }
    currentTheme = resolveTheme(themeName)
    themeListeners.forEach(fn => fn(currentTheme))
  }
})

export function useTheme(): ThemeContext {
  const [theme, setTheme] = useState<ThemeContext>(currentTheme)
  useEffect(() => {
    themeListeners.add(setTheme)
    return () => { themeListeners.delete(setTheme) }
  }, [])
  return theme
}
