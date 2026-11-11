// [sdk] packages/protocol/src/widgetSpecs.ts

// Wire contract for plugin-provided widget CLI commands and key actions.
// Functions can't cross the JSON boundary, so a plugin declares METADATA
// (this file) and core calls back into the plugin to run things.
//
// core -> plugin : listWidgetSpecs, runWidgetCli, runWidgetKey
// plugin -> core : widget_dispatch (host primitive), get_config (host primitive)
//
// Plugins opt in via package.json: "jimcast": { "capabilities": ["widget-cli", "widget-keys"] }
// so core only spawns plugins that need it (same convention as "search"/"index").

export const WIDGET_CLI_CAPABILITY  = 'widget-cli'
export const WIDGET_KEYS_CAPABILITY = 'widget-keys'

export const LIST_WIDGET_SPECS = 'listWidgetSpecs'
export const RUN_WIDGET_CLI    = 'runWidgetCli'
export const RUN_WIDGET_KEY    = 'runWidgetKey'

export const HOST_WIDGET_DISPATCH = 'widget_dispatch'
export const HOST_GET_CONFIG      = 'get_config'

/** Generous: a CLI command may run slow scripts (core's CLI waits up to 130 s). */
export const DISPATCH_TIMEOUT_MS = 130_000

export interface WidgetCliCommandWire {
  id:           string
  args?:        string[]
  title?:       string
  description?: string
}

export interface WidgetCliSpecWire {
  /** Short name on the command line: `jimcast widget command <id> ...` */
  id:       string
  widgetId: string
  /** Item-id prefixes this spec owns (core's `owns(itemId)` = startsWith any). */
  owns:     string[]
  commands: WidgetCliCommandWire[]
}

export interface WidgetKeyActionWire {
  id:      string
  title?:  string
  default: string | string[]
}

export interface WidgetKeySpecWire {
  /** Key under "key_bindings" in config.json / config_section.json. */
  id:       string
  widgetId: string
  owns:     string[]
  actions:  WidgetKeyActionWire[]
}

export interface WidgetNavSpecWire {
  id: string;
  widgetId: string;
  owns: string[];
  stickyFocus?: boolean;
  /** Row ids are `prefix + absolute path`; used to compute where the cursor lands. */
  tree?: { prefix: string };
  horizontal: { left: boolean; right: boolean };
}

export interface ListWidgetSpecsResult {
  cli:  WidgetCliSpecWire[]
  keys: WidgetKeySpecWire[]
  nav?: WidgetNavSpecWire[];
}

/** envContext / hostContext are optional: the handler tolerates their absence. */
export interface RunWidgetCliArgs {
  spec:         string
  command:      string
  args:         string[]
  cwd:          string | null
  envContext?:  unknown
  hostContext?: unknown
}
export interface RunWidgetCliResult { value: unknown; showBar: boolean }

export interface RunWidgetKeyArgs {
  spec:          string
  action:        string
  focusedItemId: string | null
  envContext?:   unknown
  hostContext?:  unknown
}

/** plugin -> core. Core runs `item`'s action as if selected in the widget's view, then awaits the re-render. */
export interface WidgetDispatchArgs {
  widgetId: string
  owns:     string[]
  item:     unknown   // serialized WidgetItem (function actions are `{ _fnId }`)
  focus?:   { id: string; prefix?: string }
}
