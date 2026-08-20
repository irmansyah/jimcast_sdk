// [sdk] packages/react-sdk/src/server/hostRpc.ts
//
// PLUGIN-INITIATED requests back to the host (e.g. storage_get,
// ui_show_toast) — same envelope plugin_runtime.rs::handle_plugin_request
// expects: a line with "id" + "command" + "args".
//
// IMPORTANT: this module does NOT own its own stdin reader. definePlugin()
// (in ./index.ts) owns the single stdin listener — there can only be one,
// or lines get split unpredictably between competing readline instances.
// definePlugin() calls resolvePending() for every line BEFORE trying to
// dispatch it as an inbound request, keeping "reply to our outbound call"
// and "host is calling us" cleanly separated without two readers racing.

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void }

const pending = new Map<string, Pending>()
let seq = 0

/**
 * Called by definePlugin()'s stdin reader for every parsed line. Returns
 * true if the line was a reply to one of our own outbound calls (and has
 * been resolved/rejected already) — false means it's not ours, the
 * caller should try dispatching it as an inbound request instead.
 */
export function resolvePending(msg: any): boolean {
  if (!msg || typeof msg !== 'object' || !msg.id) return false
  const p = pending.get(msg.id)
  if (!p) return false
  pending.delete(msg.id)
  if (msg.error) p.reject(new Error(msg.error))
  else p.resolve(msg.result)
  return true
}

/**
 * Call a host-side primitive (storage_get, storage_set, ui_show_toast,
 * exec, ...) from within a plugin backend process. Mirrors client's
 * callHost() but over stdio instead of postMessage.
 */
export function callHost<T = unknown>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  const id = `h${++seq}`
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    process.stdout.write(JSON.stringify({ id, command, args }) + '\n')
  })
}
