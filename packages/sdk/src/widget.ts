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

/**
 * Named color presets for widget elements.
 * These map to the host theme's Gruvbox palette.
 *
 * The `(string & {})` tail keeps autocomplete for named presets while
 * also accepting any raw hex value from `context.host.theme.colors`.
 */
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
  image?:      string
}

export interface WidgetAction {
  cmd:               string
  params?:           Record<string, string>
  ignore_exit_code?: boolean
  timeout_secs?:     number
  then?:             'refresh' | 'dismiss' | 'both'
}

export type WidgetActionFn = (ctx: ExecutionContext) => Promise<void>

export interface WidgetItem {
  id:          string
  attribute?:  WidgetAttribute
  params?:     Record<string, string>
  action?:     WidgetAction | WidgetActionFn
}

export type WidgetContent =
  | { readonly type: 'text';    readonly data:    string;                }
  | { readonly type: 'error';   readonly message: string;                }
  | { readonly type: 'divider'; readonly data?:   string;                }
  | { readonly type: 'rows';    readonly datas:   readonly WidgetItem[]; }
  | { readonly type: 'columns'; readonly datas:   readonly WidgetItem[]; }
  | { readonly type: 'list';    readonly datas:   readonly WidgetItem[]; }
  | { readonly type: 'badges';  readonly datas:   readonly WidgetItem[]; }
  | { readonly type: 'grid-2';  readonly datas:   readonly WidgetItem[]; }
  | { readonly type: 'grid-3';  readonly datas:   readonly WidgetItem[]; }

// ---------------------------------------------------------------------------
// Slot
// ---------------------------------------------------------------------------

/**
 * Where in the command bar the widget appears by default.
 * Users can override this in ~/.jimcast/config.json.
 *
 * ```
 * ┌─────────────────┐
 * │   above-input   │
 * │─────────────────│
 * │   Search input  │
 * │─────────────────│
 * │   below-input   │
 * │─────────────────│
 * │  Inside-Scroll  │
 * └─────────────────┘
 * ```
 */
export type WidgetSlotName = 'above-input' | 'below-input' | 'inside-scroll'

// ---------------------------------------------------------------------------
// Widget definition
// ---------------------------------------------------------------------------

export interface WidgetDefinition {
  readonly id: string;

  readonly defaultSlot: WidgetSlotName;

  render(context: ExecutionContext): Promise<WidgetContent>;
}

export interface Widget extends WidgetDefinition {
  readonly _type: "widget";
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a widget — a persistent UI block rendered in the command bar.
 *
 * @example
 * ```typescript
 * ```
 */
export function createWidget(definition: WidgetDefinition): Widget {
  return { ...definition, _type: "widget" };
}
