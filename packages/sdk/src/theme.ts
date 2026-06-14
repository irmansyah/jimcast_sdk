import { DEFAULT_THEME, THEMES, type Theme } from "./themes/index.js"

export type { Theme }
export let gruvbox: Theme = { ...DEFAULT_THEME }

export async function loadTheme(): Promise<void> {
  try {
    const raw = await invoke<Record<string, string>>('load_theme')

    // "theme" key selects a built-in preset
    const base = THEMES[raw.theme ?? ''] ?? DEFAULT_THEME

    // remaining keys are per-token overrides on top of the preset
    const { theme: _, ...overrides } = raw
    gruvbox = { ...base, ...overrides }

  } catch {
    // browser dev / tauri unavailable — keep default
  }
}
