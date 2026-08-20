// [sdk] packages/react-sdk/src/protocol.ts
//
// (webview<->host over postMessage, backend<->host over stdio NDJSON).
// Mirrors domain::plugin::protocol.rs on the Rust side field-for-field —
// keep these in sync manually if that file changes; there's no
// codegen link between the two today.

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
