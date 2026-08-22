// [sdk] packages/react-sdk/src/server/index.ts
//
// execs (via package.json's "main"). This is the runtime any plugin
// backend needs, React-driven or not — the same dispatcher works whether
// there's a webview attached to this plugin at all.
//
// Owns the single stdin reader for the whole process. Every parsed line
// is first offered to hostRpc's resolvePending() (in case it's a reply to
// a callHost() call we made); only if that returns false is it dispatched
// as an inbound host->plugin request. This is what removes the need for
// every plugin to hand-write this disambiguation itself.
//
// `commands` (added alongside the original flat `handlers` map) is sugar
// over the same dispatch map — see ./commands.ts. Passing commands here
// (rather than a separate entry point) is deliberate: there can only be
// one stdin reader, so anything that dispatches on incoming lines has to
// go through this single map.
import * as readline from 'node:readline'
import { resolvePending } from './hostRpc'
import { LIST_COMMANDS_ID, toCommandMeta, type CommandDefinition } from './commands'
export { callHost } from './hostRpc'
export { defineCommand, LIST_COMMANDS_ID } from './commands'
export { getHostStorage } from './storage.js'
export type { CommandDefinition, CommandArgSpec, CommandMeta } from './commands'

export type Handler = (args: Record<string, any>) => unknown | Promise<unknown>
// Renamed from PluginDefinition — @jimcast/sdk's command.ts already owns
// that name for the full plugin manifest shape ({ name, commands, widgets? }).
// This is a different, narrower thing: a flat command-dispatch map for the
// lightweight webview-backend runtime. Keeping both named PluginDefinition
// meant importing from both packages in the same file forced an alias.
export interface WebviewBackendDefinition {
  [command: string]: Handler
}

let started = false

/**
 * Registers this process as a jimcast-core plugin backend and starts
 * reading stdin. Call once, at module top level or in your entry file —
 * calling it more than once is a no-op after the first call (guards
 * against double-registration if backend.ts is accidentally imported
 * twice by a bundler).
 *
 * `commands` is optional sugar: each CommandDefinition is folded into the
 * dispatch map under its `id` (must not collide with a key already in
 * `handlers`), and — only if the list is non-empty — LIST_COMMANDS_ID is
 * auto-registered so the host can discover them without a manifest field.
 */
export function defineWebviewBackend(
  handlers: WebviewBackendDefinition,
  commands: CommandDefinition[] = [],
): void {
  if (started) {
    console.error('[jimcast/react-sdk] defineWebviewBackend() called more than once — ignoring')
    return
  }
  started = true

  const dispatch: WebviewBackendDefinition = { ...handlers }
  for (const cmd of commands) {
    if (cmd.id === LIST_COMMANDS_ID) {
      console.error(`[jimcast/react-sdk] command id "${LIST_COMMANDS_ID}" is reserved — skipping`)
      continue
    }
    if (dispatch[cmd.id]) {
      console.error(`[jimcast/react-sdk] command "${cmd.id}" collides with an existing handler — skipping`)
      continue
    }
    dispatch[cmd.id] = (args) => cmd.run((args ?? {}) as Record<string, string>)
  }
  if (commands.length > 0) {
    dispatch[LIST_COMMANDS_ID] = () => toCommandMeta(commands)
  }

  function respond(id: string, result: unknown) {
    process.stdout.write(JSON.stringify({ id, result }) + '\n')
  }
  function respondErr(id: string, error: string) {
    process.stdout.write(JSON.stringify({ id, error }) + '\n')
  }
  const rl = readline.createInterface({ input: process.stdin })
  rl.on('line', async (line) => {
    if (!line.trim()) return
    let msg: any
    try {
      msg = JSON.parse(line)
    } catch {
      // Malformed line — matches the host's tolerance for "sent non-JSON"
      // (plugin_runtime.rs logs and continues rather than crashing).
      return
    }
    // First: is this a reply to something WE asked the host? If so,
    // hostRpc's pending map handles it and we're done with this line.
    if (resolvePending(msg)) return
    // Otherwise: the host is asking US to run a command.
    if (!msg.command) return
    const handler = dispatch[msg.command]
    if (!handler) return respondErr(msg.id, `unknown command: ${msg.command}`)
    try {
      respond(msg.id, await handler(msg.args ?? {}))
    } catch (e) {
      respondErr(msg.id, e instanceof Error ? e.message : String(e))
    }
  })
}
