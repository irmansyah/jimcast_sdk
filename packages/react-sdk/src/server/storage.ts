// [sdk] packages/react-sdk/src/server/storage.ts
//
// Symmetric to client/storage.ts — same createStorage(send) from
// @jimcast/protocol, different transport (stdio NDJSON via hostRpc.ts's
// callHost, instead of postMessage). Confirmed against hostRpc.ts's real
// exports this time — no unverified names.
import { createStorage, type PluginStorage } from '@jimcast/protocol'
import { callHost } from './hostRpc.js'

let instance: PluginStorage | null = null

export function useHostStorage(): PluginStorage {
  if (!instance) {
    instance = createStorage((method, params) => callHost(method, params as Record<string, unknown>))
  }
  return instance
}
