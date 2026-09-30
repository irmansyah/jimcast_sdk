// [sdk] packages/react-sdk/src/app/createApp.tsx

import { createElement, useEffect, useMemo, useRef, type ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import { validateManifest, type ConfigField, type PluginManifest } from '@jimcast/protocol'
import { useTheme } from '../client/theme.js'
import { useCommandLine, type Feedback, type UseCommandLineResult } from '../react/commandLine'
import { useHostNav } from '../react/useHostBridge'
import { buildRegistry, type ArgResolvers, type CommandLineHandler } from './buildRegistry'
import { layerKeymap, mergeKeymap, normalizeKey, resolveAction, type Keymap } from './keymap'
import { useConfig } from './config'

/** Available to key actions. (No confirm(): use the ":" command line for y/n flows.) */
export interface ActionCtx<C = any> {
  config: C
  setConfig(patch: Partial<C>): void
  notify(f: Feedback): void
}
/** Return `false` to say "not applicable right now" — the key is then NOT consumed (no preventDefault). */
export type ActionHandler<S = any> = (call: { state: S; ctx: ActionCtx }) => void | boolean | Promise<void>

export interface AppViewProps<S, C> {
  workspace: S
  commandLine: UseCommandLineResult
  keymap: Keymap
  config: C
  setConfig: (patch: Partial<C>) => void
  theme: ReturnType<typeof useTheme>
  usage: string
}

export interface CreateAppOptions<S, C> {
  manifest: PluginManifest
  useWorkspace: () => S
  commandLine: Record<string, CommandLineHandler<S>>
  actions?: Record<string, ActionHandler<S>>
  argResolvers?: ArgResolvers<S>
  /** Return a keybindingLayers name to make the keyboard MODAL (only that layer is active), or null. */
  keyContext?: (state: S) => string | null
  view: ComponentType<AppViewProps<S, C>>
  mount?: string
}

/** Host arrow/activate events are routed to these conventional action names. */
const HOST_NAV_ACTIONS = { ArrowUp: 'moveUp', ArrowDown: 'moveDown', ArrowLeft: 'moveLeft', ArrowRight: 'moveRight', activate: 'activate' } as const

const isTypingTarget = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function createApp<S, C extends Record<string, any> = Record<string, any>>(opts: CreateAppOptions<S, C>) {
  const { manifest, view } = opts
  const contrib = manifest.contributes ?? {}
  const schema: Record<string, ConfigField> = contrib.config ?? {}
  const layers = contrib.keybindingLayers ?? {}

  const problems = validateManifest(manifest, {
    commandLine: Object.keys(opts.commandLine),
    actions: Object.keys(opts.actions ?? {}),
  })
  if (problems.length) throw new Error(`[jimcast] invalid plugin:\n - ${problems.join('\n - ')}`)

  function Root() {
    const theme = useTheme()
    const workspace = opts.useWorkspace()
    const { config, update, keyOverrides } = useConfig<C>(schema)

    // Latest-value refs: registry and key handler are created once and never go stale.
    const wsRef = useRef(workspace); wsRef.current = workspace
    const cfgRef = useRef(config); cfgRef.current = config
    const updateRef = useRef(update); updateRef.current = update
    const notifyRef = useRef<(f: Feedback) => void>(() => {})

    const keymap = useMemo(
      () => mergeKeymap(layerKeymap(contrib.keybindings, layers[String(config.keyMode)]), keyOverrides),
      [config.keyMode, keyOverrides],
    )
    const keymapRef = useRef(keymap); keymapRef.current = keymap

    const registry = useMemo(() => {
      const spec = { ...(contrib.commandLine ?? {}) }
      const handlers: Record<string, CommandLineHandler<S>> = { ...opts.commandLine }
      // Built-in ":set <key> [value]" driven by contributes.config
      if (Object.keys(schema).length > 0 && !spec.set) {
        spec.set = {
          description: 'Show or change a setting',
          args: [{ name: 'key', type: 'string' }, { name: 'value', type: 'string', required: false }],
        }
        handlers.set = ({ args }) => {
          const f = schema[args.key]
          if (!f) return { ok: false, message: `Unknown setting "${args.key}". Available: ${Object.keys(schema).join(', ')}` }
          if (args.value === undefined) return { ok: true, message: `${args.key} = ${JSON.stringify((cfgRef.current as any)[args.key])}` }
          let v: unknown = args.value
          if (f.type === 'boolean') v = /^(1|true|yes|on)$/i.test(String(v))
          else if (f.type === 'number') { v = Number(v); if (Number.isNaN(v)) return { ok: false, message: `"${args.key}" must be a number` } }
          else if (f.type === 'enum' && !f.values?.includes(String(v))) return { ok: false, message: `"${args.key}" must be one of: ${f.values?.join(', ')}` }
          updateRef.current({ [args.key]: v } as Partial<C>)
          return { ok: true, message: `${args.key} = ${JSON.stringify(v)}` }
        }
      }
      return buildRegistry({
        spec, handlers, resolvers: opts.argResolvers,
        getState: () => wsRef.current, getConfig: () => cfgRef.current, notify: (f) => notifyRef.current(f),
      })
    }, [])

    const commandLine = useCommandLine(registry)
    notifyRef.current = commandLine.notify
    const clRef = useRef(commandLine); clRef.current = commandLine

    const runAction = (name: string): boolean => {
      const h = opts.actions?.[name]
      if (!h) return false
      const r = h({
        state: wsRef.current,
        ctx: { config: cfgRef.current, setConfig: (p) => updateRef.current(p as Partial<C>), notify: (f) => notifyRef.current(f) },
      })
      if (r instanceof Promise) {
        r.catch((e) => notifyRef.current({ type: 'error', text: e instanceof Error ? e.message : String(e) }))
        return true
      }
      return r !== false
    }

    // Host arrow/activate protocol -> the same actions the keyboard drives.
    useHostNav({
      onArrow: (dir) => { runAction(HOST_NAV_ACTIONS[dir]) },
      onActivate: () => { runAction(HOST_NAV_ACTIONS.activate) },
    })

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (isTypingTarget(e.target) || clRef.current.isOpen) return
        const modal = opts.keyContext?.(wsRef.current) ?? null
        const map = modal ? (layers[modal] ?? {}) : keymapRef.current
        const action = resolveAction(map, normalizeKey(e))
        if (!action) return
        if (action === 'openCommandLine') { e.preventDefault(); clRef.current.open(); return }
        if (runAction(action)) e.preventDefault()
      }
      window.addEventListener('keydown', onKey)
      return () => window.removeEventListener('keydown', onKey)
    }, [])

    const usage = useMemo(() => registry.map((c) => c.usage).join('  ·  '), [registry])

    return createElement(view as ComponentType<AppViewProps<S, C>>, {
      workspace, commandLine, keymap, config, setConfig: update, theme, usage,
    })
  }

  const el = document.getElementById(opts.mount ?? 'root')
  if (!el) throw new Error('#root element not found')
  createRoot(el).render(createElement(Root))
}
