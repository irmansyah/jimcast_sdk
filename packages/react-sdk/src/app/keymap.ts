// [sdk] packages/react-sdk/src/app/keymap.ts

export type Keymap = Record<string, string[]>

/**
 * Canonical key string for an event. Spec strings in manifest.json use the same form:
 *   "j"  "H"  ":"  "Space"  "Enter"  "ArrowUp"  "mod+a"  "mod+c"  "alt+x"  "shift+ArrowUp"
 * - mod = Cmd OR Ctrl
 * - Shift is implicit for printable single characters ("H", ":" already encode it)
 */
export function normalizeKey(e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }): string {
  let k = e.key === ' ' ? 'Space' : e.key
  const mods: string[] = []
  const mod = e.metaKey || e.ctrlKey
  if (mod) mods.push('mod')
  if (e.altKey) mods.push('alt')
  if (e.shiftKey && k.length > 1) mods.push('shift')
  if ((mod || e.altKey) && k.length === 1) k = k.toLowerCase()
  return [...mods, k].join('+')
}

/** base + layer: keys for the same action are UNIONED (vim adds "k" next to "ArrowUp"). */
export function layerKeymap(base: Keymap = {}, layer: Keymap = {}): Keymap {
  const out: Keymap = { ...base }
  for (const [action, keys] of Object.entries(layer)) out[action] = Array.from(new Set([...(out[action] ?? []), ...keys]))
  return out
}

/** defaults <- user overrides: an override REPLACES that action's keys. */
export function mergeKeymap(defaults: Keymap = {}, overrides: Keymap = {}): Keymap {
  return { ...defaults, ...overrides }
}

export function resolveAction(keymap: Keymap, key: string): string | null {
  for (const [action, keys] of Object.entries(keymap)) if (keys.includes(key)) return action
  return null
}
