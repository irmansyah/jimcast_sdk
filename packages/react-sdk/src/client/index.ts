// [sdk] packages/react-sdk/src/client/index.ts 
//
// webview/iframe (served from jimcast-plugin://<plugin>/<entry>). Talks
// to the host purely over postMessage. Zero Node imports — this file
// must never import 'node:*' or anything that assumes a Node runtime.
//
// This is the SDK-ized version of what used to be hand-copied per-plugin
// as plugin-sdk-client.ts / plugin-sdk/client.ts.

export type NavDir = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

export interface NavArrowPayload { type: 'arrow'; dir: NavDir }
export interface NavActivatePayload { type: 'activate' }
export type NavPayload = NavArrowPayload | NavActivatePayload

export interface IframeLocalRect {
  x: number
  y: number
  width: number
  height: number
}

export interface FocusedItemInfo {
  name: string
  path: string
  rect: IframeLocalRect
}

type PendingCall = { resolve: (v: unknown) => void; reject: (e: unknown) => void }

const pending = new Map<string, PendingCall>()
const navListeners = new Set<(p: NavPayload) => void>()
let seq = 0
let listening = false

function ensureListening() {
  if (listening) return
  listening = true
  window.addEventListener('message', (e: MessageEvent) => {
    const data = e.data
    if (!data || typeof data !== 'object' || data.source !== 'jimcast-host') return

    if (data.type === 'result') {
      const p = pending.get(data.id)
      if (!p) return
      pending.delete(data.id)
      if ('error' in data) p.reject(new Error(data.error))
      else p.resolve(data.result)
      return
    }

    if (data.type === 'nav') {
      navListeners.forEach(fn => fn(data.payload as NavPayload))
    }
  })
}

/**
 * Calls a command implemented on the host side (ultimately a Rust
 * invoke_plugin_command). The host already knows which plugin this
 * iframe belongs to from the src it loaded, so no plugin name is passed.
 */
export function callHost<T = unknown>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  ensureListening()
  const id = `c${++seq}`
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    window.parent.postMessage({ source: 'jimcast-plugin', type: 'call', id, command, args }, '*')
  })
}

/** Subscribe to host-driven keyboard nav. Returns an unsubscribe fn. */
export function onHostNav(handler: (payload: NavPayload) => void): () => void {
  ensureListening()
  navListeners.add(handler)
  return () => navListeners.delete(handler)
}

/** Fire-and-forget: report the currently focused/hovered item + its rect. */
export function reportFocusedItem(info: FocusedItemInfo | null): void {
  window.parent.postMessage(
    { source: 'jimcast-plugin', type: 'event', event: 'focusedItemChange', payload: info },
    '*',
  )
}

/** Fire-and-forget: report that a native drag has started. */
export function reportDragStarted(paths: string[], rect: IframeLocalRect): void {
  window.parent.postMessage(
    { source: 'jimcast-plugin', type: 'event', event: 'dragStarted', payload: { paths, rect } },
    '*',
  )
}
