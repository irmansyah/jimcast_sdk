// [sdk] src/widget.ts

/**
 * Widget API — plugins that render persistent UI blocks in the command bar.
 *
 * Widgets are rendered once when the command bar opens. They occupy a
 * configurable slot in the bar layout. Users control which slot via
 * ~/.jimcast/config.json.
 */

import type { ExecutionContext } from "./context.js";

// ---------------------------------------------------------------------------
// Color tokens
// ---------------------------------------------------------------------------

export type WidgetColor =
  | "default"
  | "green"
  | "red"
  | "yellow"
  | "blue"
  | "purple"
  | "aqua"
  | "orange"
  | (string & {});

// ── Item / action ─────────────────────────────────────────────────────────────

export type WidgetSlotName = 'above-input' | 'below-input' | 'inside-scroll'

export type WidgetMode = 'default' | 'search'

export interface WidgetAttribute {
  label1:      string
  label2?:     string
  label3?:     string
  label4?:     string
  labelRight?: string
  color1?:     string
  color2?:     string
  color3?:     string
  color4?:     string
  colorRight?: string
  textSize1?:      number | string
  textSize2?:      number | string
  textSize3?:      number | string
  textSize4?:      number | string
  textSizeRight?:  number | string
  image?:      string
}

// `then: 'expand'` is only legal when E is true — i.e. when the owning
// descriptor declared `expandable: true`.
export type ThenClause<E extends boolean = false> =
  | 'refresh'
  | 'dismiss'
  | 'refresh|dismiss'
  | (E extends true ? 'expand' : never)

export interface WidgetAction<E extends boolean = false> {
  cmd:               string
  params?:           Record<string, string>
  ignore_exit_code?: boolean
  timeout_secs?:     number
  then?:             ThenClause<E>
}

export type WidgetActionFn = (values?: Record<string, string>) => Promise<void>;

export interface WidgetItem<E extends boolean = false> {
  id:          string
  attribute?:  WidgetAttribute
  params?:     Record<string, string>
  action?:     WidgetAction<E> | WidgetActionFn
}

export interface WidgetFormField {
  id:           string
  kind:         'text' | 'textarea' | 'select'
  label?:       string
  placeholder?: string
  options?:     { label: string; value: string }[]
  default?:     string
}

export interface TerminalLaunchSpec {
  cmd:   string
  args?: string[]
}

type WidgetDatasVariant<E extends boolean> =
  | { readonly type: 'rows';    readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'columns'; readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'list';    readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'badges';  readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'grid-2';  readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'grid-3';  readonly datas: readonly WidgetItem<E>[]; }

export type WidgetContent<E extends boolean = false> =
  | { readonly type: 'terminal'; readonly data:    TerminalLaunchSpec; }
  | { readonly type: 'text';     readonly data:    WidgetItem<E>; }
  | { readonly type: 'error';   readonly message: string;  }
  | { readonly type: 'divider'; readonly data?:   string;  }
  | { readonly type: 'form';
      readonly fields:       readonly WidgetFormField[]
      readonly submitLabel?: string
      readonly action:       WidgetAction<E> | WidgetActionFn
    }
  | (E extends true
      ? WidgetDatasVariant<E> & { readonly expandable: readonly WidgetExpandableChild[] }
      : WidgetDatasVariant<E>)

// ---------------------------------------------------------------------------
// Widget definition
// ---------------------------------------------------------------------------

export interface WidgetExpandableChildWidget {
  id:       string   // matches an item.id in this descriptor's content
  kind:     'widget'
  widgetId: string   // id of another widget in THIS plugin's `widgets` array
}

export interface WidgetExpandableChildCustom {
  id:     string     // matches an item.id in this descriptor's content
  kind:   'custom'
  render: () => WidgetContent | Promise<WidgetContent>
}

// NOTE: intentionally no 'component' kind here, unlike core's
// WidgetExpandableChild. Plugin content is serialized to core over
// newline-delimited JSON on stdout (see rpc.ts's serializeContent /
// RpcTransport) — a `render: () => ReactNode` can't survive that trip.
// Widgets needing a raw-React-node expandable child are a core-only
// capability for now.
export type WidgetExpandableChild = WidgetExpandableChildWidget | WidgetExpandableChildCustom

// Just a boolean flag: unlike core's INTERNAL_WIDGET_REGISTRY entries (which
// keep a static `expandable.childs` list alongside their content, per
// widgetTypes.ts), plugin widgets have no other place to author a static
// child list authors could keep in sync with content — the RPC boundary
// means core can't reach into plugin closures anyway. `expandable: true`
// exists purely to (a) gate `ExpandEnabled<Exp>` for typing render's return
// value and `then: 'expand'`, and (b) let rpc.ts fail fast with a clear
// "not expandable" error without needing to render first.
export type WidgetDescriptorExpandable = boolean

type ExpandEnabled<Exp extends WidgetDescriptorExpandable | undefined> =
  Exp extends true ? true : false

interface WidgetDescriptorRepeat {
  enable?:  boolean
  seconds?: number
}

// Per-widget options for how it participates in the section it renders
// into. Mirrors core's `Section` shape (see [core] widgetTypes.ts) minus
// `title` — plugin widgets don't set their title explicitly; core derives
// it from the widget id when the plugin's render response doesn't include
// one (see [core] plugins.rs's render_widget).
export interface WidgetSectionOptions {
  // Whether the (derived) section title is shown above this widget's
  // content. Default: true.
  titleShow?: boolean
  // Whether this widget is a stop on the command bar's Tab/arrow-key
  // cursor navigation. When false, the widget still renders but is
  // skipped over when navigating. Default: true.
  navigationActive?: boolean
  // Whether this widget participates in query search filtering. When
  // false, the widget is never hidden by the search query. Default: true.
  querySearchActive?: boolean
}

export interface WidgetDescriptorBase<Exp extends WidgetDescriptorExpandable | undefined = undefined> {
  readonly id:          string;
  readonly showIn?:     WidgetMode[]
  readonly action?:     WidgetAction<ExpandEnabled<Exp>>
  readonly repeat?:     WidgetDescriptorRepeat
  readonly section?:    WidgetSectionOptions
  readonly expandable?: Exp;
  // NOTE: render/renderQuery intentionally live in WidgetDescriptorRenderVariant,
  // not here — see WidgetDescriptorRenderVariant for why.
}

type WidgetRenderFn<E extends boolean> =
  (ctx: ExecutionContext) => WidgetContent<E> | Promise<WidgetContent<E>>

type WidgetRenderQueryFn<E extends boolean> =
  (ctx: ExecutionContext, q: string) => WidgetContent<E> | Promise<WidgetContent<E> | null> | null

type WidgetDescriptorRenderVariant<E extends boolean> =
  | { render: WidgetRenderFn<E>;  renderQuery?: never }
  | { render?: never;             renderQuery: WidgetRenderQueryFn<E> }

export type WidgetDescriptor<Exp extends WidgetDescriptorExpandable | undefined = undefined> =
  WidgetDescriptorBase<Exp> & WidgetDescriptorRenderVariant<ExpandEnabled<Exp>>

export type Widget<Exp extends WidgetDescriptorExpandable | undefined = undefined> =
  WidgetDescriptor<Exp> & { readonly _type: "widget" };

export type AnyWidget = Widget<WidgetDescriptorExpandable | undefined>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a widget — a persistent UI block rendered in the command bar.
 *
 * @example
 * ```typescript
 * const clockWidget = createWidget({
 *   id: "example.widget.clock",
 *   async render(ctx) {
 *     return { type: "text", data: new Date().toLocaleTimeString() };
 *   },
 * });
 * ```
 */
export function createWidget<Exp extends WidgetDescriptorExpandable | undefined = undefined>(
  definition: WidgetDescriptor<Exp>
): Widget<Exp> {
  return { ...definition, _type: "widget" };
}

// ---------------------------------------------------------------------------
// Tmux terminal helper
// ---------------------------------------------------------------------------
//
// Core's built-in "Quick Tools" widget (see [core] widgetRegistry.ts) reads
// a `quick_tools` config section shaped as WidgetExpandableConfig — a map of
// id -> { label, kind: 'terminal' | 'component', ... } — and, for
// `kind: 'terminal'` entries, spins up a shared tmux session/window and
// hands back a `{ type: 'terminal' }` WidgetContent that attaches to it.
//
// Plugins can't reuse core's internal helpers directly (different module,
// different registry), and plugin WidgetExpandableChild has no 'component'
// kind (see the NOTE above), but the terminal half of that setup is plain
// shell scripting with no core-only dependencies. This section reproduces
// it for plugin authors so a plugin's own quick-tool-style terminals behave
// identically to core's — same session, same attach/create-if-missing
// semantics — and can be wired up as `kind: 'widget'` expandable children.

/**
 * Config shape for a single tmux-backed terminal tool, as read from a
 * plugin's own config (e.g. a section of ~/.jimcast/config.json the plugin
 * owns). Mirrors core's WidgetExpandableTerminalConfig field-for-field so
 * plugin authors can reuse the same config shape users already know from
 * the built-in Quick Tools.
 */
export interface WidgetExpandableTerminalConfig {
  label:  string
  kind:   'terminal'
  window: string
  cwd?:   string
  cmd:    string
}

export type WidgetExpandableTerminalsConfig = Record<string, WidgetExpandableTerminalConfig>

// Session name tmux windows get grouped under. This is the same session
// core's own terminal-tmux widget attaches to, so plugin-created windows
// show up alongside core's quick tools rather than in a separate session.
// Namespace `window` values per-plugin (e.g. "myplugin:logs") to avoid
// collisions with other plugins or with core's own window names.
const TMUX_TOOL_SESSION = '[tool]'

// Fallback cwd for the outer shell that hosts tmux itself. If the process
// spawning this terminal inherited a cwd that no longer exists (deleted
// directory, unmounted volume, etc.), `sh` fails at "shell-init" before it
// ever reaches the tmux commands below — the per-window `-c "$cwd"` flags
// never get a chance to run. `cd`-ing here first makes the script recover
// on its own regardless of what cwd it was spawned with. Same fallback core
// uses, kept identical on purpose.
const TMUX_FALLBACK_CWD = '$HOME'

/**
 * Builds the shell script that attaches to (creating first if needed) a
 * single tmux window inside the shared "[tool]" session. Plugin-side
 * equivalent of core's buildTmuxAttachScript — same script shape, so
 * windows created by a plugin are indistinguishable from core's own quick
 * tools once attached.
 */
export function buildTmuxAttachScript(config: WidgetExpandableTerminalConfig): string {
  const session = TMUX_TOOL_SESSION
  const win     = config.window
  const target  = `${session}:${win}`
  const cwdFlag = config.cwd ? `-c "${config.cwd}"` : ''

  return [
    `cd "${TMUX_FALLBACK_CWD}" 2>/dev/null || cd /`,
    `tmux has-session -t '${session}' 2>/dev/null || tmux new-session -d -s '${session}' ${cwdFlag} -n '${win}' 'set -g status off; ${config.cmd}'`,
    `tmux list-windows -t '${session}' -F '#{window_name}' 2>/dev/null | grep -qx '${win}' || tmux new-window -t '${session}' -n '${win}' ${cwdFlag} '${config.cmd}'`,
    `tmux select-window -t '${target}'`,
    `exec tmux attach-session -t '${session}' -d`,
  ].join(' && ')
}

/**
 * Creates a widget that launches (or attaches to) a tmux-backed terminal
 * for one WidgetExpandableTerminalConfig entry. Meant to be referenced as
 * the target of a `kind: 'widget'` WidgetExpandableChild — the plugin
 * equivalent of core's `jimcast-internal.terminal-tmux` widget.
 *
 * Unlike core's version, this is scoped to a single tool rather than taking
 * a `{ tool }` render-time param — plugin widgets are looked up by static
 * id (see WidgetExpandableChildWidget), so one widget id per tool is
 * created up front instead.
 *
 * @example
 * ```typescript
 * const tools: WidgetExpandableTerminalsConfig = {
 *   logs: { label: "Logs", kind: "terminal", window: "myplugin:logs", cmd: "tail -f app.log" },
 * }
 *
 * const logsTerminal = createTmuxTerminalWidget("myplugin.logs-terminal", tools.logs)
 *
 * const myWidget = createWidget({
 *   id: "myplugin.main",
 *   expandable: true,
 *   render(ctx) {
 *     return {
 *       type: "rows",
 *       datas: [
 *         { id: "logs", attribute: { label1: tools.logs.label }, action: { cmd: "true", then: "expand" } },
 *       ],
 *       expandable: [
 *         { id: "logs", kind: "widget", widgetId: "myplugin.logs-terminal" },
 *       ],
 *     }
 *   },
 * })
 *
 * export const widgets = [myWidget, logsTerminal]
 * ```
 */
export function createTmuxTerminalWidget(
  id:     string,
  config: WidgetExpandableTerminalConfig,
): Widget {
  return createWidget({
    id,
    render(_ctx): WidgetContent {
      return {
        type: 'terminal',
        data: {
          cmd:  'sh',
          args: ['-c', buildTmuxAttachScript(config)],
        },
      }
    },
  })
}

/**
 * Convenience for building one createTmuxTerminalWidget per entry of a
 * WidgetExpandableTerminalsConfig in one call — handy when a plugin wants
 * to expose several tmux tools (e.g. loaded from its own config file)
 * without hand-writing a widget per entry. Non-terminal entries (if the
 * config is shared with a shape that also allows other kinds) are skipped.
 *
 * Returned widgets are keyed by `${idPrefix}.${configKey}` — pass that same
 * id as `widgetId` in the corresponding WidgetExpandableChildWidget.
 *
 * @example
 * ```typescript
 * const tools: WidgetExpandableTerminalsConfig = {
 *   logs:  { label: "Logs",  kind: "terminal", window: "myplugin:logs",  cmd: "tail -f app.log" },
 *   redis: { label: "Redis", kind: "terminal", window: "myplugin:redis", cmd: "redis-cli" },
 * }
 *
 * const terminalWidgets = createTmuxTerminalWidgets("myplugin", tools)
 * // -> { "myplugin.logs": Widget, "myplugin.redis": Widget }
 * ```
 */
export function createTmuxTerminalWidgets(
  idPrefix: string,
  config:   WidgetExpandableTerminalsConfig,
): Record<string, Widget> {
  const out: Record<string, Widget> = {}
  for (const [key, entry] of Object.entries(config)) {
    if (entry.kind !== 'terminal') continue
    out[`${idPrefix}.${key}`] = createTmuxTerminalWidget(`${idPrefix}.${key}`, entry)
  }
  return out
}
