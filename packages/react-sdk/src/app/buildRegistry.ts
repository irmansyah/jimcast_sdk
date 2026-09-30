// [sdk] packages/react-sdk/src/app/buildRegistry.ts

import { parseArgs, usageOf, type CommandSpec } from '@jimcast/protocol'
import type { CommandLineRegistry, CommandResult, Feedback } from '../react/commandLine'

export interface HandlerCtx<C = any> {
  config: C
  notify(f: Feedback): void
  confirm(message: string): Promise<boolean>
  /** One-line usage summary of every command, derived from the manifest. */
  usage(): string
}

export type CommandLineHandler<S = any, A = any> = (call: {
  args: A
  state: S
  ctx: HandlerCtx
}) => CommandResult | Promise<CommandResult>

/** custom arg type -> resolver. Return null/undefined = "not found". */
export type ArgResolvers<S = any> = Record<string, (value: string, state: S) => unknown | null | undefined>

export function buildRegistry<S>(opts: {
  spec: Record<string, CommandSpec>
  handlers: Record<string, CommandLineHandler<S>>
  resolvers?: ArgResolvers<S>
  getState: () => S
  getConfig: () => unknown
  notify: (f: Feedback) => void
}): CommandLineRegistry {
  const { spec, handlers, resolvers = {}, getState, getConfig, notify } = opts
  const usage = () => Object.entries(spec).map(([n, s]) => usageOf(n, s)).join('  ·  ')

  return Object.entries(spec).map(([name, s]) => ({
    name,
    aliases: s.aliases,
    description: s.description,
    usage: usageOf(name, s),
    pending: s.pending,
    run: async ({ rest, confirm }) => {
      const parsed = parseArgs(name, s, rest)
      if (!parsed.ok) return { ok: false, message: parsed.message }
      const state = getState() // always the latest render's state — no stale closures
      const args = parsed.args

      for (const def of s.args ?? []) {
        const resolver = def.type ? resolvers[def.type] : undefined
        const v = args[def.name]
        if (!resolver || v === undefined) continue
        const one = (x: unknown) => resolver(String(x), state)
        const resolved = Array.isArray(v) ? v.map(one) : one(v)
        const missing = Array.isArray(resolved) ? resolved.findIndex((r) => r == null) : resolved == null ? 0 : -1
        if (missing !== -1) {
          const raw = Array.isArray(v) ? v[missing] : v
          return { ok: false, message: `No ${def.type} found for "${raw}"` }
        }
        args[def.name] = resolved
      }
      const handler = handlers[name]
      if (!handler) return { ok: false, message: `No handler for "${name}"` }
      return handler({ args, state, ctx: { config: getConfig(), notify, confirm, usage } })
    },
  }))
}
