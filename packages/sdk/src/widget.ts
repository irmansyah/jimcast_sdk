// [sdk] packages/sdk/src/widget.ts

/**
 * Widget API — plugins that render persistent UI blocks in the command bar.
 *
 * Widgets are rendered when the command bar opens. They occupy a configurable
 * slot in the bar layout. Users control which slot via ~/.jimcast/config.json
 * (`widget_slot`) or a profile's `section_slot`.
 *
 * Relationship to core "panels": a panel is the user-facing config shape
 * (terminal, website, webview, widget...). A plugin never writes panel config;
 * it ships widgets. A user opens a plugin widget as a panel with
 * `{ kind: 'external-component', id: '<widgetId>' }` (rendered through
 * render_widget) or `{ kind: 'external-custom', id: '<widgetId>' }` (rendered
 * through the plugin's `renderExpandableChild`). NOTE: core's `kind: 'widget'`
 * panel only resolves core-internal widgets (`jimcast-internal.*`); it can NOT
 * reach a plugin widget.
 *
 * The types below mirror core's frontend/src/domain/widget/types.ts for
 * everything that can cross the JSON boundary.
 */

import type { WidgetCliSpec } from "./widgetCli.js";
import type { WidgetKeySpec } from "./widgetKeys.js";
import type { ExecutionContext } from "./context.js";
import type { WidgetNavSpec } from "./widgetNav.js";

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

// ── Slots / modes ─────────────────────────────────────────────────────────────

export type WidgetSlotName = 'above-input' | 'below-input' | 'inside-scroll'

/** Mirrors core's WidgetMode. A widget's `showIn` lists the modes it appears in. */
export type WidgetMode =
  | 'default' | 'apps' | 'ai' | 'shell' | 'search' | 'none'
  | (string & {})

// ── Item / action ─────────────────────────────────────────────────────────────

export interface WidgetAttribute {
  label1:      string
  label2?:     string
  label3?:     string
  label4?:     string
  labelRight?: string
  color1?:     WidgetColor
  color2?:     WidgetColor
  color3?:     WidgetColor
  color4?:     WidgetColor
  colorRight?: WidgetColor
  textSize1?:      number | string
  textSize2?:      number | string
  textSize3?:      number | string
  textSize4?:      number | string
  textSizeRight?:  number | string
  image?:      string
}

/**
 * Container-level styling for a WidgetItem or a WidgetGroupSection. Mirrors
 * core's WidgetItemStyle (resolved by core's resolveItemStyle). Colors accept
 * a preset key (see WidgetColor), hex, or any CSS color. Unset fields fall
 * back to core's default look. Plain JSON — no rpc.ts handling needed.
 */
export interface WidgetItemStyle {
  background?:   WidgetColor
  borderColor?:  WidgetColor
  borderWidth?:  number | string
  borderRadius?: number | string
  padding?:      number | string
}

// `then: 'expand'` is only legal when E is true — i.e. when the owning
// descriptor declared `expandable: true`.
export type ThenClause<E extends boolean = false> =
  | 'refresh'
  | 'dismiss'
  | 'refresh|dismiss'
  | (E extends true ? 'expand' : never)

export interface WidgetAction<E extends boolean = false> {
  cmd?:              string
  params?:           Record<string, string>
  ignore_exit_code?: boolean
  timeout_secs?:     number
  then?:             ThenClause<E>
  insertQuery?:      string
}

export type WidgetActionFn = (values?: Record<string, string>) => Promise<void>;

/**
 * A function action that also says what core should do afterwards.
 * Bare function actions cannot ask for a refresh; this can.
 * On the wire: `{ _fnId, then, insertQuery }`. Core must honor `then` after
 * invoking the fn (see CORE_CHANGES.md B1).
 */
export interface WidgetActionWithFn<E extends boolean = false> {
  run:          WidgetActionFn
  then?:        ThenClause<E>
  insertQuery?: string
}

export type AnyWidgetAction<E extends boolean = false> =
  | WidgetAction<E> | WidgetActionFn | WidgetActionWithFn<E>

export interface WidgetItem<E extends boolean = false> {
  id:          string
  attribute?:  WidgetAttribute
  params?:     Record<string, string>
  action?:      AnyWidgetAction<E>
  clickAction?: AnyWidgetAction<E>
  style?:      WidgetItemStyle
  pinned?:     boolean
}

export interface WidgetFormField {
  id:           string
  kind:         'text' | 'textarea' | 'select'
  label?:       string
  placeholder?: string
  options?:     { label: string; value: string }[]
  default?:     string
}

// ── Leaf content payloads ─────────────────────────────────────────────────────

export interface TerminalLaunchSpec {
  cmd:   string
  args?: string[]
}

/** Mirrors core's BrowserKind; unknown strings pass through to core untouched. */
export type BrowserKind = 'chrome' | 'brave' | 'firefox' | 'zen' | (string & {})

/** Content of `{ type: 'mirror_browser' }`: mirrors a browser tab into the bar. */
export interface MirrorBrowserTarget {
  browserKind: BrowserKind
  url:         string
}

/** Content of `{ type: 'website' }`: an embedded page. */
export interface WebsiteTarget {
  url:     string
  zoom?:   number
  height?: number
}

/** Content of `{ type: 'image' }`. */
export interface ImageTarget {
  src:     string
  alt?:    string
  height?: number
  fit?:    'contain' | 'cover'
}

// ── Panel content (JSON-safe subset of core's WidgetExpandableChild) ──────────

/** Another widget of THIS plugin, rendered in place. */
export interface WidgetPanelChildWidget {
  id:       string
  kind:     'widget'
  widgetId: string
  params?:  Record<string, string>
}
/** A plugin widget rendered through core's render_widget. */
export interface WidgetPanelChildExternalComponent {
  id:       string
  kind:     'external-component'
  widgetId: string
}
/** A plugin widget rendered through the plugin's `renderExpandableChild`. */
export interface WidgetPanelChildExternalCustom {
  id:       string
  kind:     'external-custom'
  widgetId: string
}
/** A plugin webview (`~/.jimcast/plugins/<plugin>/<entry>`) in a sandboxed iframe. */
export interface WidgetPanelChildWebview {
  id:     string
  kind:   'webview'
  plugin: string
  entry:  string
}

/**
 * What `{ type: 'panel' }` may carry from a plugin. Core's `component` and
 * `custom-component` children hold render functions and cannot cross JSON.
 * Typical use: return `{ type: 'panel', child: { kind: 'webview', ... } }`
 * from a widget or from a `custom` expandable child to show your own webview.
 */
export type WidgetPanelChild =
  | WidgetPanelChildWidget
  | WidgetPanelChildExternalComponent
  | WidgetPanelChildExternalCustom
  | WidgetPanelChildWebview

// ── Content ───────────────────────────────────────────────────────────────────

/**
 * One slice of a composed 'group' widget. `content` is any WidgetContent
 * variant, including another 'group'. Mirrors core's WidgetGroupSection.
 *
 * Sizing (generic, content-agnostic — same as core's WidgetGroup):
 * - `height` makes the section fixed-size; `maxHeight` caps it.
 * - A sized section scrolls vertically by default; `scrollable: false` clips
 *   instead (use for fixed chrome rows that must never show a scrollbar).
 * - `flex` sets flex-grow (default: 1 in a `row` group, unset in a `column`).
 * - `navigable` is forwarded to core's keyboard navigation.
 *
 * Function actions inside a section's content ARE supported: rpc.ts recurses
 * into `sections[].content` and registers them.
 *
 * Not to be confused with core's `{ kind: 'group' }` PANEL (a row of toggle
 * buttons in user config).
 */
export interface WidgetGroupSection<E extends boolean = false> {
  id:          string
  content:     WidgetContent<E>
  style?:      WidgetItemStyle
  flex?:       number
  navigable?:  boolean
  height?:     number
  maxHeight?:  number
  scrollable?: boolean
  /** @deprecated Not in core's WidgetGroupSection; core ignores it. */
  section?:    Pick<WidgetSectionOptions, 'titleShow'> & { title?: string }
}

type WidgetDatasVariant<E extends boolean> =
  | { readonly type: 'rows';     readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'columns';  readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'list';     readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'badges';   readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'grid-2';   readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'grid-3';   readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'progress'; readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'group';
      readonly sections:   readonly WidgetGroupSection<E>[]
      readonly direction?: 'column' | 'row'
      readonly gap?:       number
    }
  | { readonly type: 'tiles'
      readonly datas:     readonly WidgetItem<E>[]
      readonly columns?:  number
      readonly gap?:      number
      readonly labels?:   boolean
      readonly caption?:  boolean
    }

/** Everything a plugin widget can render. Mirrors core's WidgetContent. */
export type WidgetContent<E extends boolean = false> =
  | { readonly type: 'panel';          readonly child: WidgetPanelChild; readonly label?: string }
  | { readonly type: 'website';        readonly data: WebsiteTarget; }
  | { readonly type: 'image';          readonly data: ImageTarget; }
  | { readonly type: 'terminal';       readonly data: TerminalLaunchSpec; }
  | { readonly type: 'mirror_browser'; readonly data: MirrorBrowserTarget; }
  | { readonly type: 'text';           readonly data: WidgetItem<E>; }
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
  id:       string
  kind:     'widget'
  widgetId: string
  params?:  Record<string, string>
  keyBindings?: Record<string, unknown>
}

export interface WidgetExpandableChildCustom {
  id:     string     // matches an item.id in this descriptor's content
  kind:   'custom'
  render: () => WidgetContent | Promise<WidgetContent>
}

// Intentionally a subset of core's WidgetExpandableChild (six kinds). Core
// resolves a plugin's expandable child by calling back into the plugin
// (`resolveExpandableChild`), which returns CONTENT. So a plugin needs no
// 'component' / 'external-*' / 'webview' child: to show a webview or another
// widget, have the child return `{ type: 'panel', child: ... }`.
export type WidgetExpandableChild = WidgetExpandableChildWidget | WidgetExpandableChildCustom

// Just a boolean flag (core's internal descriptors carry a static `childs`
// list; plugins can't, the RPC boundary means core can't reach their closures).
export type WidgetDescriptorExpandable = boolean

type ExpandEnabled<Exp extends WidgetDescriptorExpandable | undefined> =
  Exp extends true ? true : false

interface WidgetDescriptorRepeat {
  enable?:  boolean
  seconds?: number
}

/**
 * Per-widget options for the section it renders into. Mirrors core's
 * `Section`. Sent over the wire in snake_case by rpc.ts's serializeSection.
 */
export interface WidgetSectionOptions {
  /** Section title. Default: derived by core from the widget id ("acme.todo-list" -> "Todo List"). */
  title?: string
  /** Show the title above the content. Default: true. */
  titleShow?: boolean
  /** Whether the widget is a stop on Tab/arrow cursor navigation. Default: true. */
  navigationActive?: boolean
  /** Whether the widget is filtered by the search query. Default: true. */
  querySearchActive?: boolean
  /** Inner padding of the section, in px. Default: 0. */
  padding?: number
}

export interface WidgetDescriptorBase<Exp extends WidgetDescriptorExpandable | undefined = undefined> {
  readonly id:          string;
  readonly showIn?:     WidgetMode[];
  readonly action?:     WidgetAction<ExpandEnabled<Exp>>;
  readonly repeat?:     WidgetDescriptorRepeat;
  readonly section?:    WidgetSectionOptions;
  readonly expandable?: Exp;
  readonly cli?:  WidgetCliSpec;
  readonly keys?: WidgetKeySpec;
  readonly nav?: WidgetNavSpec;
}

/**
 * `params` is only set when the widget is reached as a `kind: 'widget'`
 * expandable child that declared `params`. Otherwise it is undefined.
 */
type WidgetRenderFn<E extends boolean> =
  (ctx: ExecutionContext, params?: Record<string, string>) => WidgetContent<E> | Promise<WidgetContent<E>>

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
 *     return { type: "text", data: { id: "now", attribute: { label1: new Date().toLocaleTimeString() } } };
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
// Core's `kind: 'terminal'` PANEL (see [core] domain/widget/panelConfig.ts)
// runs `cmd` inside a persistent tmux session named after the panel. Plugins
// can't reuse core's helper, but the attach half is plain shell. This section
// reproduces it: one tmux session per tool, created if missing, then attached.
// Wire them up as `kind: 'widget'` expandable children of your own widget.

/**
 * Config for one tmux-backed terminal. Same fields as core's TerminalPanel
 * (minus `id`/`display`), plus the SDK-only `session`.
 */
export interface TerminalPanelConfig {
  label:    string
  kind:     'terminal'
  cmd:      string
  cwd?:     string
  /**
   * tmux session to run in. Defaults to `window`, then to the widget id.
   * Namespace per plugin (e.g. "myplugin-logs"). '.' and ':' become '-'.
   */
  session?: string
  /** @deprecated Old shared-session model. Only used as a fallback session name. */
  window?:  string
}

/** @deprecated use TerminalPanelConfig */
export type WidgetExpandableTerminalConfig = TerminalPanelConfig

export type WidgetExpandableTerminalsConfig = Record<string, TerminalPanelConfig>

// Same fallback cwd core uses, for when the inherited cwd no longer exists.
const TMUX_FALLBACK_CWD = '$HOME'

/** tmux reads '.' and ':' in a target as separators, so they can't be in a session name. */
function sanitizeSessionName(name: string): string {
  return name.replace(/[.:]/g, '-')
}

/**
 * Builds the shell script that attaches to (creating first if needed) the
 * tmux session `session`. Plugin-side twin of core's buildTmuxSessionAttachScript.
 */
export function buildTmuxSessionAttachScript(session: string, config: TerminalPanelConfig): string {
  const s       = sanitizeSessionName(session)
  const cwd     = config.cwd?.replace(/^~(?=\/|$)/, '$HOME')
  const cwdFlag = cwd ? `-c "${cwd}"` : ''
  return [
    `cd "${TMUX_FALLBACK_CWD}" 2>/dev/null || cd /`,
    `tmux has-session -t '${s}' 2>/dev/null || tmux new-session -d -s '${s}' ${cwdFlag} 'set -g status off; ${config.cmd}'`,
    `exec tmux attach-session -t '${s}' -d`,
  ].join(' && ')
}

/**
 * Same as buildTmuxSessionAttachScript, choosing the session from the config
 * (`session`, else `window`). Pass `fallbackSession` for configs that set neither.
 *
 * @deprecated The name predates per-panel sessions; prefer buildTmuxSessionAttachScript.
 */
export function buildTmuxAttachScript(config: TerminalPanelConfig, fallbackSession = 'plugin-terminal'): string {
  return buildTmuxSessionAttachScript(config.session ?? config.window ?? fallbackSession, config)
}

/**
 * Creates a widget that launches (or attaches to) a tmux-backed terminal for
 * one TerminalPanelConfig. Reference it as the target of a `kind: 'widget'`
 * WidgetExpandableChild.
 *
 * @example
 * ```typescript
 * const logs: TerminalPanelConfig = { label: "Logs", kind: "terminal", session: "myplugin-logs", cmd: "tail -f app.log" }
 * const logsTerminal = createTmuxTerminalWidget("myplugin.logs-terminal", logs)
 *
 * const myWidget = createWidget({
 *   id: "myplugin.main",
 *   expandable: true,
 *   render() {
 *     return {
 *       type: "rows",
 *       datas: [{ id: "logs", attribute: { label1: logs.label }, action: { then: "expand" } }],
 *       expandable: [{ id: "logs", kind: "widget", widgetId: "myplugin.logs-terminal" }],
 *     }
 *   },
 * })
 *
 * export const widgets = [myWidget, logsTerminal]
 * ```
 */
export function createTmuxTerminalWidget(
  id:     string,
  config: TerminalPanelConfig,
): Widget {
  return createWidget({
    id,
    render(_ctx): WidgetContent {
      return {
        type: 'terminal',
        data: {
          cmd:  'sh',
          args: ['-c', buildTmuxAttachScript(config, id)],
        },
      }
    },
  })
}

/**
 * Builds one createTmuxTerminalWidget per entry of a
 * WidgetExpandableTerminalsConfig. Returned widgets are keyed by
 * `${idPrefix}.${configKey}` — use that id as `widgetId` in the matching
 * expandable child. Entries without `session`/`window` use that id as session.
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
