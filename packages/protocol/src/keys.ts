// [sdk] packages/protocol/src/keys.ts

// Pure key-binding helpers shared by the SDK (plugin side).
// Mirrors [core] application/widget/widgetKeys.ts: parseKey, keyLabel,
// resolveBindings. The DOM half (matchesKey) stays in core's frontend.

export interface ParsedKey { key: string; ctrl: boolean; alt: boolean; meta: boolean; shift: boolean }

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape', del: 'delete', return: 'enter', space: ' ', spacebar: ' ',
  up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright',
}

/** "shift+h", "ctrl+x", "Delete", "c", "H" (a bare capital implies shift). */
export function parseKey(raw: string): ParsedKey | null {
  const s = raw.trim()
  if (!s) return null
  const parts = s.split('+')
  let key = parts.pop() ?? ''
  if (key === '') key = '+'
  const out: ParsedKey = { key: '', ctrl: false, alt: false, meta: false, shift: false }
  for (const m of parts.map((p) => p.trim().toLowerCase()).filter(Boolean)) {
    if (m === 'ctrl' || m === 'control') out.ctrl = true
    else if (m === 'alt' || m === 'option' || m === 'opt') out.alt = true
    else if (m === 'meta' || m === 'cmd' || m === 'command' || m === 'super') out.meta = true
    else if (m === 'shift') out.shift = true
    else return null
  }
  if (key.length === 1 && key !== key.toLowerCase()) out.shift = true
  const lower = key.toLowerCase()
  out.key = KEY_ALIASES[lower] ?? lower
  return out
}

export function keyLabel(k: ParsedKey): string {
  const base = k.key.length === 1 ? k.key : k.key.replace(/^arrow/, '')
  return `${k.ctrl ? '⌃' : ''}${k.alt ? '⌥' : ''}${k.shift ? '⇧' : ''}${k.meta ? '⌘' : ''}${base}`
}

/** { "<spec id>": { "<action id>": "c" | ["c","ctrl+c"] | "" | null | false } } */
export type KeyBindingsConfig = Record<string, Record<string, unknown>>

export interface KeyActionLike { id: string; default: string | readonly string[] }
export interface ResolvedBinding<A extends KeyActionLike = KeyActionLike> { action: A; keys: ParsedKey[] }

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Accepts { files: {...} } (nested) or { copy: "c", ... } (flat). */
function actionsOf(layer: unknown, specId: string): Record<string, unknown> {
  if (!isPlainObject(layer)) return {}
  const nested = layer[specId]
  if (isPlainObject(nested)) return nested
  const flat: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(layer)) if (!isPlainObject(v)) flat[k] = v
  return flat
}

/** `layers`: highest priority first. Same rules as core's resolveBindings. */
export function resolveBindings<A extends KeyActionLike>(
  specId: string,
  actions: readonly A[],
  ...layers: unknown[]
): ResolvedBinding<A>[] {
  const resolved = layers.map((l) => actionsOf(l, specId))
  return actions.map((action) => {
    const hit = resolved.find((r) => Object.prototype.hasOwnProperty.call(r, action.id))
    const v = hit ? hit[action.id] : action.default
    const list = v == null || v === false ? [] : Array.isArray(v) ? v : [v]
    const keys = list
      .filter((x): x is string => typeof x === 'string')
      .map(parseKey)
      .filter((x): x is ParsedKey => x !== null)
    return { action, keys }
  })
}
