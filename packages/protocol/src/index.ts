// [sdk] packages/protocol/src/index.ts
// @jimcast/protocol — shared wire-format types for BOTH transports
// (webview<->host over postMessage, backend<->host over stdio NDJSON),
// plus shared plugin-author-facing modules that have no transport
// dependency of their own: storage (createStorage(send) is transport-
// agnostic, just needs a send fn) and themes (pure data + string helpers).
// Having @jimcast/sdk and @jimcast/react-sdk both depend on this package
// instead of each growing their own copy is what keeps storage/theme
// behavior identical across both — see packages/sdk/src/storage.ts and
// packages/react-sdk/src/client/storage.ts for the two transport adapters
// built on top of what's exported here.
//
// IpcRequest/IpcResponse mirror domain::plugin::protocol.rs on the Rust
// side field-for-field — keep these in sync manually if that file
// changes; there's no codegen link between the two today.
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
export * from './themes/index.js'
