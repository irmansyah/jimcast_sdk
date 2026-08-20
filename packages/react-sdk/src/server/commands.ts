// [sdk] packages/react-sdk/src/server/commands.ts
//
// A named, discoverable command layer on top of the flat
// WebviewBackendDefinition dispatch map in ./index.ts. A "command" is
// sugar over a normal handler: defineWebviewBackend() folds each
// CommandDefinition into its internal handlers map under `command.id`,
// and auto-registers one reserved introspection handler (LIST_COMMANDS_ID)
// that returns every command's metadata (without `run`) so the host can
// list runnable commands per plugin without a static manifest field.
//
// One-shot only, by design: a command call is a normal request/response
// over the existing stdio channel — send args, await result, done. If a
// command wants to report progress mid-run, it can call callHost() from
// hostRpc.ts (e.g. ui_show_toast) as a side effect while it's running.

/**
 * Reserved command id the host calls to discover what commands a plugin
 * backend exposes. Never invoke this yourself from application code —
 * defineWebviewBackend() wires it up automatically whenever `commands`
 * is non-empty.
 */
export const LIST_COMMANDS_ID = '__jimcast_list_commands__'

export interface CommandArgSpec {
  /** Key this arg will appear under in the `args` object passed to run(). */
  name: string
  /** Shown as a hint in the command bar's argument prompt. */
  description?: string
  /** Defaults to false — the command bar won't require a value to run. */
  required?: boolean
}

export interface CommandMeta {
  id: string
  title: string
  description?: string
  args: CommandArgSpec[]
}

export interface CommandDefinition {
  /**
   * Unique within this plugin. Also becomes the RPC dispatch key —
   * must not collide with a key already present in the handlers map
   * passed to defineWebviewBackend(), and must not be LIST_COMMANDS_ID.
   */
  id: string
  /** Shown in jimcast-core's command bar. */
  title: string
  description?: string
  args?: CommandArgSpec[]
  /** Runs one-shot: return (or resolve) the result, throw to fail. */
  run: (args: Record<string, string>) => unknown | Promise<unknown>
}

/**
 * Identity helper, purely for type inference at the call site — mirrors
 * @jimcast/sdk's createCommand() so both SDKs read the same way even
 * though react-sdk's runtime (webview backend, one-shot only) differs
 * from the plain sdk's (headless plugin, full Command/Plugin shape).
 */
export function defineCommand(definition: CommandDefinition): CommandDefinition {
  return definition
}

/** Strips `run` (not JSON-serializable) down to wire metadata. */
export function toCommandMeta(commands: CommandDefinition[]): CommandMeta[] {
  return commands.map(({ id, title, description, args }) => ({
    id,
    title,
    description,
    args: args ?? [],
  }))
}
