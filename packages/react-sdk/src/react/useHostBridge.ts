// jimcast-react-sdk/src/react/useHostBridge.ts — thin, OPTIONAL React binding over jimcast-react-sdk/client.
// A separate entry point on purpose: importing 'jimcast-react-sdk/server' or
// 'jimcast-react-sdk/client' alone never pulls React in. Only plugins that
// explicitly `import ... from 'jimcast-react-sdk/react'` need react as a peer
// dependency at all — a terminal-only or non-React webview plugin never
// triggers this file being bundled.

import { useEffect, useRef } from 'react'
import { onHostNav, type NavDir, type NavPayload } from '../client'

export interface HostNavHandlers {
  onArrow?: (dir: NavDir) => void
  onActivate?: () => void
}

/**
 * Subscribes to host-driven keyboard nav for the lifetime of the
 * component. Pass null to temporarily disable without unmounting.
 */
export function useHostNav(handlers: HostNavHandlers | null): void {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const unsubscribe = onHostNav((payload: NavPayload) => {
      const h = handlersRef.current
      if (!h) return
      if (payload.type === 'arrow') h.onArrow?.(payload.dir)
      if (payload.type === 'activate') h.onActivate?.()
    })
    return unsubscribe
  }, [])
}
