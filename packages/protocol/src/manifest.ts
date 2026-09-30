// [sdk] packages/protocol/src/manifest.ts

// Pure types + validation. No React, no Node — usable from every transport.

export type ArgType = 'string' | 'number' | 'boolean' | 'path' | 'glob' | (string & {}) // custom = app resolver

export interface ArgSpec {
  name: string
  type?: ArgType
  required?: boolean   // default true
  variadic?: boolean   // collects remaining tokens into an array
  greedy?: boolean     // consumes the rest of the line as ONE string (no quoting needed)
  description?: string
}

export interface CommandSpec {
  description?: string
  aliases?: string[]
  args?: ArgSpec[]
  split?: string       // e.g. "::" — split the rest-of-line on this instead of whitespace
  pending?: string     // text shown while an async handler is running
}

export interface ConfigField {
  type: 'boolean' | 'string' | 'number' | 'enum'
  default: unknown
  values?: string[]
}

export interface Contributes {
  config?: Record<string, ConfigField>
  keybindings?: Record<string, string[]>          // action -> keys (base layer)
  /**
   * Named extra keymaps. Two ways a layer is used:
   *  - config.keyMode === <layer name>  -> layer is ADDED on top of the base (keys are unioned per action)
   *  - app's keyContext(state) returns <layer name> -> MODAL: only that layer is consulted
   */
  keybindingLayers?: Record<string, Record<string, string[]>>
  commandLine?: Record<string, CommandSpec>       // in-iframe ":" commands (frontend, stateful)
  host?: {
    commands?: Record<string, CommandSpec>        // host-callable (backend, stateless)
    search?: string
    corpus?: string
  }
}

export interface PluginManifest {
  name: string
  displayName?: string
  version: string
  entry: string
  capabilities?: string[]
  contributes?: Contributes
}

export interface HandlerNames {
  commandLine?: string[]
  actions?: string[]
  host?: string[]
}

/** Every command name and alias must be unique within one surface. */
export function findCollisions(spec: Record<string, CommandSpec>): string[] {
  const seen = new Map<string, string>()
  const errors: string[] = []
  for (const [name, s] of Object.entries(spec)) {
    for (const key of [name, ...(s.aliases ?? [])].map((k) => k.toLowerCase())) {
      const prev = seen.get(key)
      if (prev && prev !== name) errors.push(`"${key}" is used by both "${prev}" and "${name}"`)
      seen.set(key, name)
    }
  }
  return errors
}

/**
 * Returns a list of human-readable problems. Empty = valid.
 *
 * A plugin has TWO processes and each only knows its own handlers, so each surface is checked
 * ONLY when the caller passes that surface's handler names:
 *   - webview  (createApp)     passes { commandLine, actions }
 *   - backend  (defineBackend) passes { host }
 * Passing `undefined` (omitting the key) means "not my process — skip". An empty array means
 * "I have none", so every manifest entry on that surface is reported.
 * Name/alias collisions are checked on every call (they don't depend on handlers).
 */
export function validateManifest(m: PluginManifest, h: HandlerNames): string[] {
  const c = m.contributes ?? {}
  const errors: string[] = []
  const need = (kind: string, keys: string[], have: string[]) => {
    for (const k of keys) if (!have.includes(k)) errors.push(`${kind} "${k}" is in manifest.json but has no handler`)
  }

  if (h.commandLine) need('commandLine command', Object.keys(c.commandLine ?? {}), h.commandLine)

  if (h.actions) {
    const known = [...h.actions, ...BUILTIN_ACTIONS]
    need('keybinding action', Object.keys(c.keybindings ?? {}), known)
    for (const [layer, map] of Object.entries(c.keybindingLayers ?? {})) {
      need(`keybinding action (layer "${layer}")`, Object.keys(map), known)
    }
  }

  if (h.host) need('host command', Object.keys(c.host?.commands ?? {}), h.host)

  errors.push(...findCollisions(c.commandLine ?? {}).map((e) => `commandLine: ${e}`))
  errors.push(...findCollisions(c.host?.commands ?? {}).map((e) => `host: ${e}`))
  return errors
}

/** Actions the SDK implements itself; the app needs no handler for these. */
export const BUILTIN_ACTIONS = ['openCommandLine']
