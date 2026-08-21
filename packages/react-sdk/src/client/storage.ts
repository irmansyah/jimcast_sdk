// [sdk] packages/react-sdk/src/client/storage.ts
//
// Webview-side storage adapter. createStorage()'s implementation is fully
// shared with @jimcast/sdk via @jimcast/protocol — this file supplies
// nothing but the transport: postMessage/callHost instead of stdio RPC.
import { createStorage, type PluginStorage } from '@jimcast/protocol'
import { callHost } from './index.js'

let instance: PluginStorage | null = null

/** Storage backed by the host, scoped to this plugin — same semantics,
 *  same limits (512-char keys, 100KB/key, 10MB/plugin, enforced by core)
 *  as @jimcast/sdk's context.storage. Safe to call multiple times; returns
 *  the same instance. */
export function useHostStorage(): PluginStorage {
  if (!instance) {
    instance = createStorage((method, params) => callHost(method, params as Record<string, unknown>))
  }
  return instance
}
