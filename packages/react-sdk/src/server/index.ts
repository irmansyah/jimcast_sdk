// [sdk] packages/react-sdk/src/server/index.ts
//
import * as readline from 'node:readline'
import { resolvePending } from './hostRpc'
import { LIST_COMMANDS_ID, SEARCH_ID, CORPUS_ID, toCommandMeta, type CommandDefinition } from './commands'
export { callHost } from './hostRpc'
export { defineCommand, defineSearch, defineCorpus, LIST_COMMANDS_ID, SEARCH_ID, CORPUS_ID } from './commands'
export { getHostStorage } from './storage.js'
export type { CommandDefinition, CommandArgSpec, CommandMeta } from './commands'

export type Handler = (args: Record<string, any>) => unknown | Promise<unknown>
export interface WebviewBackendDefinition {
  [command: string]: Handler
}

let started = false

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

    let command = msg.command
    let args = msg.args ?? {}

    if (!dispatch[command]) {
      // Unknown command: if this plugin opted in to a "run" catch-all
      // (registered its own `run` command/handler), retry once as a
      // free-text dispatch through it, folding the original command back
      // into the text so `run`'s own parsing sees the full line. This is
      // pure dispatch-fallback plumbing — it doesn't know or care what
      // "run" does for any given plugin, only whether one exists. Plugins
      // that don't register `run` fall straight through to the original
      // "unknown command" error, unchanged.
      if (dispatch['run']) {
        const rest = typeof args.text === 'string' ? args.text : ''
        command = 'run'
        args = { text: `${msg.command} ${rest}`.trim() }
      } else {
        return respondErr(msg.id, `unknown command: ${msg.command}`)
      }
    }

    const handler = dispatch[command]
    try {
      respond(msg.id, await handler(args))
    } catch (e) {
      respondErr(msg.id, e instanceof Error ? e.message : String(e))
    }
  })
}
