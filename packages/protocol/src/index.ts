// [sdk] packages/protocol/src/index.ts

import type { Document } from './search.js'

// ─── IPC wire types ──────────────────────────────────────────────────────────

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

// ─── Re-exports ──────────────────────────────────────────────────────────────

export * from './storage.js'
export * from './search.js'
export * from './manifest.js'
export * from './commandEngine.js'
export * from './sectionLabel.js'

// Themes: the six built-in themes, resolveTheme, ThemeName, and the
// ThemeContext / ThemeColors / ThemeTypography / ThemeSpacing types all
// come from themes/index.ts. fv / cv / px are helpers that live in
// themes/theme.ts and are not re-exported by themes/index.ts.
export * from './themes/index.js'
export { fv, cv, px } from './themes/theme.js'

/**
 * Alias of `Document` under a name that can't be confused with the DOM `Document` type
 * (which is what an un-imported `Document` silently resolves to when the DOM lib is on).
 * rpc.ts imports this name.
 */
export type CorpusDocument = Document
