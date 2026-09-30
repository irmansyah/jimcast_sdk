// [sdk] packages/react-sdk/src/server/defineBackend.ts

import { parseArgs, parseCommandLine, usageOf, validateManifest, type PluginManifest, type CommandSpec } from '@jimcast/protocol'
import type { SearchResultItem, Document } from '@jimcast/protocol'
import { defineWebviewBackend, type Handler } from './webviewBackend'
import { defineCommand, defineSearch, defineCorpus, type CommandDefinition } from './commands'

export type HostCommandHandler = (args: Record<string, any>) => unknown | Promise<unknown>

export interface DefineBackendOptions {
  manifest: PluginManifest
  /** Handlers for contributes.host.commands, keyed by command name. */
  host?: Record<string, HostCommandHandler>
  search?: (query: string) => SearchResultItem[] | Promise<SearchResultItem[]>
  corpus?: () => Document[] | Promise<Document[]>
  /** Raw RPC handlers the webview calls directly via callHost(). */
  rpc?: Record<string, Handler>
}

export function defineBackend({ manifest, host = {}, search, corpus, rpc = {} }: DefineBackendOptions): void {
  const spec: Record<string, CommandSpec> = manifest.contributes?.host?.commands ?? {}
  const label = manifest.displayName ?? manifest.name

  // Backend process: validate ONLY the host surface (the webview validates commandLine/actions).
  const problems = validateManifest(manifest, { host: Object.keys(host) })
  if (problems.length) throw new Error(`[jimcast] invalid plugin backend:\n - ${problems.join('\n - ')}`)

  const call = (name: string, args: Record<string, any>) => {
    const h = host[name]
    if (!h) throw new Error(`[jimcast] no handler for host command "${name}"`)
    return h(args)
  }

  const commands: CommandDefinition[] = Object.entries(spec).map(([id, s]) =>
    defineCommand({
      id,
      title: `${label}: ${id}`,
      description: `usage: ${usageOf(id, s)}${s.description ? ` — ${s.description}` : ''}`,
      args: (s.args ?? []).map((a) => ({ name: a.name, required: a.required !== false, description: a.description })),
      run: (raw) => {
        // Host sends args already keyed by name; also accept { text } free-form.
        const text = (raw as any).text
        if (typeof text === 'string') {
          const p = parseArgs(id, s, text)
          if (!p.ok) return { ok: false, error: p.message }
          return call(id, p.args)
        }
        return call(id, raw)
      },
    }),
  )

  // Free-text fallback ("@plugin list Documents") — derived, not hand-written.
  commands.push(
    defineCommand({
      id: 'run',
      title: `${label}: Run`,
      description: `Free-text command. ${Object.entries(spec).map(([n, s]) => usageOf(n, s)).join(' | ')}`,
      run: async (raw) => {
        const parsed = parseCommandLine(spec, String((raw as any).text ?? ''))
        if (!parsed.ok) return { ok: false, error: parsed.message }
        return call(parsed.name, parsed.args)
      },
    }),
  )

  if (search) commands.push(defineSearch(search))
  if (corpus) commands.push(defineCorpus(corpus))

  defineWebviewBackend(rpc, commands)
}
