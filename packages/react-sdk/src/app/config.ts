// [sdk] packages/react-sdk/src/app/config.ts

import { useCallback, useEffect, useState } from 'react'
import type { ConfigField } from '@jimcast/protocol'
import { useHostStorage } from '../client/storage.js'

const KEY = '__config'
const KEYMAP_KEY = '__keybindings'

export function defaultsOf(schema: Record<string, ConfigField> = {}): Record<string, any> {
  return Object.fromEntries(Object.entries(schema).map(([k, f]) => [k, f.default]))
}

/** Layers: manifest defaults <- user values persisted in plugin storage. */
export function useConfig<C extends Record<string, any>>(schema?: Record<string, ConfigField>) {
  const storage = useHostStorage()
  const [config, setConfig] = useState<C>(defaultsOf(schema) as C)
  const [keyOverrides, setKeyOverrides] = useState<Record<string, string[]>>({})
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let live = true
    Promise.all([storage.get(KEY), storage.get(KEYMAP_KEY)])
      .then(([c, k]) => {
        if (!live) return
        if (c) setConfig((prev) => ({ ...prev, ...JSON.parse(c) }))
        if (k) setKeyOverrides(JSON.parse(k))
      })
      .catch(() => {})
      .finally(() => live && setReady(true))
    return () => { live = false }
  }, [storage])

  const update = useCallback((patch: Partial<C>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch }
      void storage.set(KEY, JSON.stringify(next))
      return next
    })
  }, [storage])

  return { config, update, keyOverrides, ready }
}
