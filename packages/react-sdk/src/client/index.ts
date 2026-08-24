// [sdk] packages/react-sdk/src/client/index.ts
//
// webview/iframe (served from jimcast-plugin://<plugin>/<entry>). Talks
// to the host purely over postMessage. Zero Node imports — this file
// must never import 'node:*' or anything that assumes a Node runtime.
//
// This is the SDK-ized version of what used to be hand-copied per-plugin
// as plugin-sdk-client.ts / plugin-sdk/client.ts.
//
// Auto-forwarding (added): once this module loads, it starts listening
// immediately (ensureListening() is called at the bottom of this file,
// not lazily on first callHost/onHostNav) and does three things without
// any plugin-side opt-in:
//
//   - Escape typed inside the iframe's own document can never bubble to
//     the host window on its own, so it's forwarded as an 'escape' event.
//     The host turns it back into a real synthetic Escape KeyboardEvent
//     on its own window, so it flows through the host's existing
//     escape-stack / double-tap logic unchanged.
//   - Content height is measured explicitly (scrollHeight/offsetHeight,
//     NOT trusted from ResizeObserver's contentRect) and reported as a
//     'contentHeight' event, so the host can size the expandable to fit.
//     ResizeObserver/MutationObserver/'load' are only re-measure TRIGGERS
//     here — observing document.documentElement's own box directly is
//     unreliable when a plugin's CSS pins html/body to height:100%
//     (common for full-height app shells), since that box never resizes
//     even as its content overflows.
//   - Arrow keys are forwarded as 'arrowKey' events, but ONLY when this
//     plugin has actually subscribed to host-driven nav via onHostNav/
//     useHostNav (navListeners.size > 0), and only when focus isn't in a
//     text input. This is what lets the host re-drive dispatchArrow ->
//     registerNav -> onArrow -> a 'nav' message back into this iframe,
//     instead of the browser just scrolling the iframe document. Plugins
//     that never call onHostNav keep normal arrow-key/scroll behavior.

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
const ARROW_KEYS = new Set<string>(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
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

  // Escape forwarding — see file header.
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    window.parent.postMessage({ source: 'jimcast-plugin', type: 'event', event: 'escape' }, '*')
  })

  // Arrow-key forwarding — only steals arrows from default scroll
  // behavior when the plugin subscribed to host nav, and never while
  // focus is in a text field.
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!ARROW_KEYS.has(e.key)) return
    if (navListeners.size === 0) return

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
  const id = `c${++seq}`
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    window.parent.postMessage({ source: 'jimcast-plugin', type: 'call', id, command, args }, '*')
  })
}

export function onHostNav(handler: (payload: NavPayload) => void): () => void {
  navListeners.add(handler)
  return () => navListeners.delete(handler)
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

export function reportEscapePressed(): void {
  window.parent.postMessage(
    { source: 'jimcast-plugin', type: 'event', event: 'escape' },
    '*',
  )
}

export { useHostStorage } from './storage.js'
export { useTheme } from './theme.js'   // ← new

ensureListening()
