// [sdk] packages/protocol/src/index.ts

import type { Document } from './search.js'

export interface IpcRequest {
  id: string
  command: string
  args: Record<string, unknown>
}
export interface IpcResponse {
  id: string
  result?: unknown
  error?: string
}
export interface IpcNotification {
  event: string
  data: unknown
}
export function isResponse(msg: any): msg is IpcResponse {
  return !!msg && typeof msg === 'object' && typeof msg.id === 'string' && !('command' in msg)
}
export function isRequest(msg: any): msg is IpcRequest {
  return !!msg && typeof msg === 'object' && typeof msg.id === 'string' && typeof msg.command === 'string'
}
export * from './storage.js'
export * from './search.js'
export * from './manifest.js'        // NEW: manifest types, validateManifest, findCollisions
export * from './commandEngine.js'   // NEW: tokenize, parseArgs, parseCommandLine, usageOf
export { resolveTheme, defaultTheme, type ThemeContext } from './themes/index.js'

/**
 * Alias of `Document` under a name that can't be confused with the DOM `Document` type
 * (which is what an un-imported `Document` silently resolves to when the DOM lib is on).
 * rpc.ts imports this name.
 */
export type CorpusDocument = Document
