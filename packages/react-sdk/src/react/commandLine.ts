// [sdk] packages/react-sdk/src/react/commandLine.ts

// In-webview vim-style ":" command line.
// Changes vs. before:
//  - run() may be async; errors thrown become error feedback
//  - ctx.confirm(msg) -> Promise<boolean> (bang resolves true immediately)
//  - legacy { confirm, onConfirm } result still supported (kanban / rest plugins)
//  - name/alias collisions are reported at registry creation
import { useCallback, useMemo, useRef, useState } from 'react'

export interface CommandContext {
  rest: string
  bang: boolean
  confirm: (message: string) => Promise<boolean>
}

export type CommandResult =
  | { ok: true; message?: string }
  | { ok: false; message: string }
  /** @deprecated use ctx.confirm() */
  | { confirm: true; message: string; onConfirm: () => void; onCancel?: () => void }
  | void

export interface CommandLineCommand {
  name: string
  aliases?: string[]
  usage?: string
  description?: string
  pending?: string
  run: (ctx: CommandContext) => CommandResult | Promise<CommandResult>
}

export type CommandLineRegistry = CommandLineCommand[]

export interface Feedback { type: 'ok' | 'error'; text: string }

export interface UseCommandLineResult {
  isOpen: boolean
  value: string
  setValue: (v: string) => void
  feedback: Feedback | null
  pendingConfirm: { message: string } | null
  /** Text of the in-flight async command, or null. */
  busy: string | null
  open: () => void
  close: () => void
  submit: () => void
  answerConfirm: (yes: boolean) => void
  historyUp: () => void
  historyDown: () => void
  notify: (f: Feedback) => void
}

const norm = (s: string) => s.toLowerCase()

function findCommand(registry: CommandLineRegistry, name: string) {
  const l = norm(name)
  return registry.find((c) => norm(c.name) === l || c.aliases?.some((a) => norm(a) === l))
}

export function findRegistryCollisions(registry: CommandLineRegistry): string[] {
  const seen = new Map<string, string>()
  const out: string[] = []
  for (const c of registry) {
    for (const k of [c.name, ...(c.aliases ?? [])].map(norm)) {
      const prev = seen.get(k)
      if (prev !== undefined) out.push(`"${k}" is used by both "${prev}" and "${c.name}"`)
      else seen.set(k, c.name)
    }
  }
  return out
}

const FEEDBACK_MS = 3200
type Pending = { message: string; resolve: (yes: boolean) => void }

export function useCommandLine(registry: CommandLineRegistry): UseCommandLineResult {
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<Pending | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useMemo(() => {
    const dupes = findRegistryCollisions(registry)
    if (dupes.length) console.error('[jimcast/react-sdk] command collisions:', dupes.join('; '))
  }, [registry])

  const notify = useCallback((f: Feedback) => {
    setFeedback(f)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setFeedback(null), FEEDBACK_MS)
  }, [])

  const open = useCallback(() => { setIsOpen(true); setValue(''); setHistoryIndex(null) }, [])
  const close = useCallback(() => { setIsOpen(false); setValue(''); setHistoryIndex(null); setPendingConfirm(null) }, [])

  const answerConfirm = useCallback((yes: boolean) => {
    if (!pendingConfirm) return
    pendingConfirm.resolve(yes)
    close()
  }, [pendingConfirm, close])

  const submit = useCallback(async () => {
    const trimmed = value.trim()
    if (pendingConfirm) {
      const l = trimmed.toLowerCase()
      answerConfirm(l === 'y' || l === 'yes')
      return
    }
    if (!trimmed) return close()
    setHistory((p) => [...p, trimmed])

    const sp = trimmed.indexOf(' ')
    const raw = sp === -1 ? trimmed : trimmed.slice(0, sp)
    const rest = sp === -1 ? '' : trimmed.slice(sp + 1).trim()
    const bang = raw.endsWith('!')
    const name = bang ? raw.slice(0, -1) : raw

    const cmd = findCommand(registry, name)
    if (!cmd) { notify({ type: 'error', text: `Unknown command: "${raw}"` }); return close() }

    const confirm = (message: string) =>
      bang
        ? Promise.resolve(true)
        : new Promise<boolean>((resolve) => { setPendingConfirm({ message, resolve }); setValue('') })

    let result: CommandResult
    if (cmd.pending) setBusy(cmd.pending)
    try {
      result = await cmd.run({ rest, bang, confirm })
    } catch (e) {
      result = { ok: false, message: e instanceof Error ? e.message : String(e) }
    } finally {
      setBusy(null)
    }

    if (result && 'confirm' in result) {
      if (bang) { result.onConfirm(); return close() }
      const r = result
      setPendingConfirm({ message: r.message, resolve: (yes) => (yes ? r.onConfirm() : r.onCancel?.()) })
      setValue('')
      return // stay open in y/n mode
    }
    if (result && 'ok' in result) {
      notify(result.ok ? { type: 'ok', text: result.message ?? 'Done' } : { type: 'error', text: result.message })
    }
    close()
  }, [value, pendingConfirm, registry, answerConfirm, close, notify])

  const historyUp = useCallback(() => {
    setHistoryIndex((idx) => {
      if (history.length === 0) return idx
      const next = idx === null ? history.length - 1 : Math.max(0, idx - 1)
      setValue(history[next] ?? ''); return next
    })
  }, [history])

  const historyDown = useCallback(() => {
    setHistoryIndex((idx) => {
      if (idx === null) return null
      const next = idx + 1
      if (next >= history.length) { setValue(''); return null }
      setValue(history[next] ?? ''); return next
    })
  }, [history])

  return { isOpen, value, setValue, feedback, pendingConfirm, busy, open, close, submit, answerConfirm, historyUp, historyDown, notify }
}
