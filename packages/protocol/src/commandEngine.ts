// [sdk] packages/protocol/src/commandEngine.ts

import { findCollisions, type ArgSpec, type CommandSpec } from './manifest.js'

export type ParsedArgs = Record<string, unknown>
export type ParseArgsResult = { ok: true; args: ParsedArgs } | { ok: false; message: string }
export type ParseResult =
  | { ok: true; name: string; bang: boolean; args: ParsedArgs }
  | { ok: false; message: string }

export interface Token {
  /** Unquoted value. */
  value: string
  /** Offsets into the original string: input.slice(start) is the raw remainder starting at this token. */
  start: number
  end: number
}

/** Shell-style tokenizer: whitespace-separated; "double" or 'single' quotes group. Keeps offsets. */
export function tokenizeWithPos(input: string): Token[] {
  const out: Token[] = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(input))) {
    out.push({ value: m[1] ?? m[2] ?? m[3] ?? '', start: m.index, end: m.index + m[0].length })
  }
  return out
}

export function tokenize(input: string): string[] {
  return tokenizeWithPos(input).map((t) => t.value)
}

export function usageOf(name: string, spec: CommandSpec): string {
  const parts = (spec.args ?? []).map((a) => {
    const label = a.variadic ? `${a.name}...` : a.name
    return a.required === false ? `[${label}]` : `<${label}>`
  })
  if (spec.split && parts.length > 1) return `${name} ${parts[0]} ${spec.split} ${parts.slice(1).join(' ')}`
  return [name, ...parts].join(' ')
}

const aliasCache = new WeakMap<object, Map<string, string>>()

/** name-or-alias (lowercased) -> canonical name. Throws on duplicates. Cached per spec object. */
export function buildAliasIndex(spec: Record<string, CommandSpec>): Map<string, string> {
  const cached = aliasCache.get(spec)
  if (cached) return cached
  const errors = findCollisions(spec)
  if (errors.length) throw new Error(`Command collisions: ${errors.join('; ')}`)
  const idx = new Map<string, string>()
  for (const [name, s] of Object.entries(spec)) {
    for (const k of [name, ...(s.aliases ?? [])]) idx.set(k.toLowerCase(), name)
  }
  aliasCache.set(spec, idx)
  return idx
}

type Coerced = { ok: true; value: unknown } | { ok: false; message: string }

function coerce(a: ArgSpec, raw: string): Coerced {
  if (a.type === 'number') {
    const n = Number(raw)
    return Number.isNaN(n) ? { ok: false, message: `"${a.name}" must be a number` } : { ok: true, value: n }
  }
  if (a.type === 'boolean') {
    if (/^(1|true|yes|on)$/i.test(raw)) return { ok: true, value: true }
    if (/^(0|false|no|off)$/i.test(raw)) return { ok: true, value: false }
    return { ok: false, message: `"${a.name}" must be true or false` }
  }
  return { ok: true, value: raw } // string | path | glob | custom (app resolver runs later)
}

/**
 * Splits `rest` into at most `n` parts on `sep`; the LAST part keeps any further separators,
 * so `rename a :: b :: c` with n=2 gives ["a", "b :: c"] instead of dropping "c".
 */
function splitLimited(rest: string, sep: string, n: number): string[] {
  const parts: string[] = []
  let from = 0
  while (parts.length < n - 1) {
    const i = rest.indexOf(sep, from)
    if (i === -1) break
    parts.push(rest.slice(from, i).trim())
    from = i + sep.length
  }
  parts.push(rest.slice(from).trim())
  return parts
}

const usageError = (name: string, spec: CommandSpec) => ({ ok: false as const, message: `Usage: ${usageOf(name, spec)}` })

/**
 * Parses the text AFTER the command name against its arg spec.
 *
 * Value rules (chosen to match how the hand-written commands behaved):
 *  - `split`: rest is cut on the separator into one part per arg (extra separators stay in the last arg).
 *  - otherwise tokens are whitespace/quote separated, one per arg;
 *  - the LAST non-variadic arg absorbs any extra text, verbatim — so `select My Documents` selects
 *    "My Documents" without needing quotes;
 *  - `greedy: true` forces that raw-remainder behavior even for a single quoted token (use for shell text);
 *  - `variadic` collects all remaining tokens into an array.
 */
export function parseArgs(name: string, spec: CommandSpec, rest: string): ParseArgsResult {
  const defs = spec.args ?? []
  const args: ParsedArgs = {}
  if (defs.length === 0) return { ok: true, args }

  if (spec.split) {
    const parts = splitLimited(rest, spec.split, defs.length)
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i]
      if (!d) break
      const raw = parts[i]
      if (raw === undefined || raw === '') {
        if (d.required !== false) return usageError(name, spec)
        continue
      }
      const c = coerce(d, raw)
      if (!c.ok) return c
      args[d.name] = c.value
    }
    return { ok: true, args }
  }

  const tokens = tokenizeWithPos(rest)
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i]
    if (!d) break

    if (d.variadic) {
      const vals: unknown[] = []
      for (const t of tokens.slice(i)) {
        const c = coerce(d, t.value)
        if (!c.ok) return c
        vals.push(c.value)
      }
      if (vals.length === 0 && d.required !== false) return usageError(name, spec)
      args[d.name] = vals
      break
    }

    const tok = tokens[i]
    if (!tok) {
      if (d.required !== false) return usageError(name, spec)
      continue
    }

    const isLast = i === defs.length - 1
    const hasExtra = tokens.length > i + 1
    const raw = isLast && (d.greedy || hasExtra) ? rest.slice(tok.start).trim() : tok.value
    const c = coerce(d, raw)
    if (!c.ok) return c
    args[d.name] = c.value
  }
  return { ok: true, args }
}

/** Full-line parse: "rename! foo :: bar" -> { name, bang, args }. Used by backends. */
export function parseCommandLine(spec: Record<string, CommandSpec>, input: string): ParseResult {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, message: 'Empty command' }
  const sp = trimmed.search(/\s/)
  const raw = sp === -1 ? trimmed : trimmed.slice(0, sp)
  const rest = sp === -1 ? '' : trimmed.slice(sp + 1).trim()
  const bang = raw.endsWith('!')
  const key = (bang ? raw.slice(0, -1) : raw).toLowerCase()
  const name = buildAliasIndex(spec).get(key)
  if (!name) return { ok: false, message: `Unknown command: "${raw}"` }
  const cmd = spec[name]
  if (!cmd) return { ok: false, message: `Unknown command: "${raw}"` }
  const parsed = parseArgs(name, cmd, rest)
  return parsed.ok ? { ok: true, name, bang, args: parsed.args } : parsed
}
