// [sdk] packages/react-sdk/src/react/commandLine.ts
//
// Client-side "nested command line" primitive — the in-webview vim-style
// `:command` affordance a plugin's own UI exposes, standardized so every
// plugin gets bang-skip, y/n confirm, history recall, and timed feedback
// for free instead of hand-rolling them (see jimcast-react-rest/App.tsx's
// original runCommand()/commandHistory/deleteConfirmId state, which this
// replaces).
//
// Deliberately separate from ../server/commands.ts: that's the host
// invoking a named RPC in the backend process; this is the user typing
// into the plugin's own iframe. They can compose (a CommandLineCommand's
// run() is free to call callHost()) but neither depends on the other.
import { useCallback, useRef, useState } from 'react'

export interface CommandContext {
  /** Text after the command name, already trimmed. */
  rest: string
  /** True if the command name ended with "!" (bang = skip confirmation). */
  bang: boolean
}

export type CommandResult =
  | { ok: true; message?: string }
  | { ok: false; message: string }
  /** Ask before proceeding — the y/n sub-mode. */
  | { confirm: true; message: string; onConfirm: () => void; onCancel?: () => void }
  | void

export interface CommandLineCommand {
  /** Primary name, e.g. "send". Matched case-insensitively. */
  name: string
  /** Extra names resolving to this command, e.g. ["s"]. */
  aliases?: string[]
  /** Shown in help/placeholder, e.g. "send [name|#]". */
  usage?: string
  description?: string
  run: (ctx: CommandContext) => CommandResult
}

export type CommandLineRegistry = CommandLineCommand[]

export interface Feedback {
  type: 'ok' | 'error'
  text: string
}

export interface UseCommandLineResult {
  isOpen: boolean
  value: string
  setValue: (v: string) => void
  feedback: Feedback | null
  /** Non-null while waiting on a y/n confirm from a command's run(). */
  pendingConfirm: { message: string } | null
  open: () => void
  close: () => void
  /** Call on Enter in the command input. */
  submit: () => void
  /** Call when the user types y/yes or n/no while pendingConfirm is set. */
  answerConfirm: (yes: boolean) => void
  historyUp: () => void
  historyDown: () => void
  notify: (f: Feedback) => void
}

function findCommand(registry: CommandLineRegistry, name: string): CommandLineCommand | undefined {
  const lower = name.toLowerCase()
  return registry.find((c) => c.name.toLowerCase() === lower || c.aliases?.some((a) => a.toLowerCase() === lower))
}

const FEEDBACK_MS = 3200

export function useCommandLine(registry: CommandLineRegistry): UseCommandLineResult {
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<{
    message: string
    onConfirm: () => void
    onCancel?: () => void
  } | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showFeedback = useCallback((f: Feedback) => {
    setFeedback(f)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(null), FEEDBACK_MS)
  }, [])

  const open = useCallback(() => {
    setIsOpen(true)
    setValue('')
    setHistoryIndex(null)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setValue('')
    setHistoryIndex(null)
    setPendingConfirm(null)
  }, [])

  const answerConfirm = useCallback(
    (yes: boolean) => {
      if (!pendingConfirm) return
      if (yes) pendingConfirm.onConfirm()
      else pendingConfirm.onCancel?.()
      setPendingConfirm(null)
      close()
    },
    [pendingConfirm, close],
  )

  const submit = useCallback(() => {
    const trimmed = value.trim()

    if (pendingConfirm) {
      const lower = trimmed.toLowerCase()
      if (lower === 'y' || lower === 'yes') answerConfirm(true)
      else answerConfirm(false)
      return
    }

    if (!trimmed) return close()
    setHistory((prev) => [...prev, trimmed])

    const spaceIdx = trimmed.indexOf(' ')
    const cmdRaw = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)
    const rest = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim()
    const bang = cmdRaw.endsWith('!')
    const name = bang ? cmdRaw.slice(0, -1) : cmdRaw

    const cmd = findCommand(registry, name)
    if (!cmd) {
      showFeedback({ type: 'error', text: `Unknown command: "${cmdRaw}"` })
      return close()
    }

    const result = cmd.run({ rest, bang })
    if (result && 'confirm' in result) {
      // Bang skips the confirm step entirely.
      if (bang) {
        result.onConfirm()
        return close()
      }
      setPendingConfirm(result)
      setValue('')
      return // stay open, in confirm sub-mode
    }
    if (result && 'ok' in result) {
      showFeedback(
        result.ok
          ? { type: 'ok', text: result.message ?? 'Done' }
          : { type: 'error', text: result.message },
      )
    }
    close()
  }, [value, pendingConfirm, registry, answerConfirm, close, showFeedback])

  const historyUp = useCallback(() => {
    setHistoryIndex((idx) => {
      if (history.length === 0) return idx
      const next = idx === null ? history.length - 1 : Math.max(0, idx - 1)
      setValue(history[next])
      return next
    })
  }, [history])

  const historyDown = useCallback(() => {
    setHistoryIndex((idx) => {
      if (idx === null) return null
      const next = idx + 1
      if (next >= history.length) {
        setValue('')
        return null
      }
      setValue(history[next])
      return next
    })
  }, [history])

  return { isOpen, value, setValue, feedback, pendingConfirm, open, close, submit, answerConfirm, historyUp, historyDown, notify: showFeedback }
}
