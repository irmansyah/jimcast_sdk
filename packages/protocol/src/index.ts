// [sdk] packages/protocol/src/index.ts
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
export { resolveTheme, defaultTheme, type ThemeContext } from './themes/index.js'
