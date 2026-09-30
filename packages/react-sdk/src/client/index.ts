// [sdk] packages/react-sdk/src/client/index.ts

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

// Module state lives on globalThis, NOT in module-level variables.
//
// esbuild.config.js bundles src/client/* into BOTH client.mjs and react.mjs
// (useHostBridge -> ../client, createApp -> ../client/theme|storage), so a plugin
// that imports from both '@jimcast/react-sdk/client' and '/react' loads this file
// twice. With per-copy state, callHost ids ("c1", "c2", ...) collide across the
// copies — one host reply would resolve a pending call in BOTH — and the
// Escape / arrow-key / contentHeight window listeners would be registered twice.
// Sharing one state object makes any number of copies behave as one.
interface ClientState {
  pending: Map<string, PendingCall>
  navListeners: Set<(p: NavPayload) => void>
  seq: number
  listening: boolean
}
const g = globalThis as { __jimcastClient?: ClientState }
const S: ClientState = (g.__jimcastClient ??= {
  pending: new Map(),
  navListeners: new Set(),
  seq: 0,
  listening: false,
})

const ARROW_KEYS = new Set<string>(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

function ensureListening() {
  if (S.listening) return
  S.listening = true

  window.addEventListener('message', (e: MessageEvent) => {
    const data = e.data
    if (!data || typeof data !== 'object' || data.source !== 'jimcast-host') return
    if (data.type === 'result') {
      const p = S.pending.get(data.id)
      if (!p) return
      S.pending.delete(data.id)
      if ('error' in data) p.reject(new Error(data.error))
      else p.resolve(data.result)
      return
    }
    if (data.type === 'nav') {
      S.navListeners.forEach(fn => fn(data.payload as NavPayload))
    }
  })

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    queueMicrotask(() => {
      if (e.defaultPrevented) return
      window.parent.postMessage({ source: 'jimcast-plugin', type: 'event', event: 'escape' }, '*')
    })
  })

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!ARROW_KEYS.has(e.key)) return
    if (S.navListeners.size === 0) return

    const el = document.activeElement as HTMLElement | null
    const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA'
      || el?.tagName === 'SELECT' || el?.isContentEditable
    if (typing) return

    e.preventDefault()
    window.parent.postMessage(
      { source: 'jimcast-plugin', type: 'event', event: 'arrowKey', payload: { key: e.key } },
      '*',
    )
  })

  // ---- Content height reporting ------------------------------------------
  const measureHeight = () => Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
    document.documentElement.offsetHeight,
    document.body.offsetHeight,
  )

  let lastReportedHeight = -1
  let raf = 0
  const reportHeight = () => {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      const height = measureHeight()
      if (height === lastReportedHeight) return
      lastReportedHeight = height
      window.parent.postMessage(
        { source: 'jimcast-plugin', type: 'event', event: 'contentHeight', payload: { height } },
        '*',
      )
    })
  }

  new ResizeObserver(reportHeight).observe(document.body)
  new MutationObserver(reportHeight).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, characterData: true,
  })

  reportHeight()
  window.addEventListener('load', reportHeight)
}

export function callHost<T = unknown>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  const id = `c${++S.seq}`
  return new Promise<T>((resolve, reject) => {
    S.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    window.parent.postMessage({ source: 'jimcast-plugin', type: 'call', id, command, args }, '*')
  })
}

export function onHostNav(handler: (payload: NavPayload) => void): () => void {
  S.navListeners.add(handler)
  return () => S.navListeners.delete(handler)
}

export function reportFocusedItem(info: FocusedItemInfo | null): void {
  window.parent.postMessage(
    { source: 'jimcast-plugin', type: 'event', event: 'focusedItemChange', payload: info },
    '*',
  )
}

export function reportDragStarted(paths: string[], rect: IframeLocalRect): void {
  window.parent.postMessage(
    { source: 'jimcast-plugin', type: 'event', event: 'dragStarted', payload: { paths, rect } },
    '*',
  )
}

/** Manual escape-forwarding for plugins that want to report "nothing left
 *  to close locally" explicitly rather than relying on the automatic
 *  keydown-based forwarding above (e.g. from a non-keydown code path).
 *  NOTE: unlike the automatic forwarding, this does not check
 *  e.defaultPrevented — it's an explicit, unconditional signal. */
export function reportEscapePressed(): void {
  window.parent.postMessage(
    { source: 'jimcast-plugin', type: 'event', event: 'escape' },
    '*',
  )
}

export { useHostStorage } from './storage.js'
export { useTheme } from './theme.js'   // ← new

ensureListening()
