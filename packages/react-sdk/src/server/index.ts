// [sdk] packages/react-sdk/src/server/index.ts

import * as readline from 'node:readline'
import { resolvePending } from './hostRpc'
import { LIST_COMMANDS_ID, SEARCH_ID, CORPUS_ID, toCommandMeta, type CommandDefinition } from './commands'
export { callHost } from './hostRpc'
export { defineCommand, defineSearch, defineCorpus, LIST_COMMANDS_ID, SEARCH_ID, CORPUS_ID } from './commands'
export type { CommandDefinition, CommandArgSpec, CommandMeta } from './commands'
export { useHostStorage } from './storage.js'

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
      return
    }
    if (resolvePending(msg)) return
    if (!msg.command) return

    let command = msg.command
    let args = msg.args ?? {}

    if (!dispatch[command]) {
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
