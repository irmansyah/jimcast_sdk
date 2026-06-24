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

// ---------------------------------------------------------------------------
// Widget content types
// ---------------------------------------------------------------------------

export type WidgetRow = {
  readonly label: string;
  readonly labelColor?: WidgetColor;
  readonly value?: string;
  readonly valueColor?: WidgetColor;
  readonly accessory?: string;
  readonly accessoryColor?: WidgetColor;
};

export type WidgetBadge = {
  readonly label: string;
  readonly color?: WidgetColor;
};

export type WidgetCard = {
  readonly id: string;
  readonly icon?: string;
  readonly title: string;
  readonly titleColor?: WidgetColor;
  readonly sub?: string;
  readonly subColor?: WidgetColor;
  readonly right?: string;
  readonly rightColor?: WidgetColor;
  onAction?(): Promise<void>;
};

/**
 * What a widget's render() can return.
 *
 * - `rows`   — a key/value list, good for status info (branch, env vars, etc.)
 * - `text`   — a single line or short paragraph of text
 * - `badges` — a horizontal row of pills, good for tags or states
 * - `grid-2` — 2-column card grid
 * - `grid-3` — 3-column card grid
 */
export type WidgetContent =
  | { readonly type: "rows";    readonly rows: readonly WidgetRow[] }
  | { readonly type: "text";    readonly content: string; readonly color?: WidgetColor }
  | { readonly type: "badges";  readonly badges: readonly WidgetBadge[] }
  | { readonly type: "grid-2";  readonly cards: readonly WidgetCard[] }
  | { readonly type: "grid-3";  readonly cards: readonly WidgetCard[] };

// ---------------------------------------------------------------------------
// Slot
// ---------------------------------------------------------------------------

/**
 * Where in the command bar the widget appears by default.
 * Users can override this in ~/.jimcast/config.json.
 *
 * ```
 * ┌─────────────────┐
 * │   top           │
 * │─────────────────│
 * │   above-input   │
 * │─────────────────│
 * │   Search input  │
 * │─────────────────│
 * │   below-input   │
 * │─────────────────│
 * │   Results list  │
 * │─────────────────│
 * │   below-results │
 * └─────────────────┘
 * ```
 */
// export type WidgetSlot = "top" | "above-input" | "below-input" | "inside-scroll";
export type WidgetSlot = "top" | 'above-input' | 'below-input' | 'inside-scroll'


// ---------------------------------------------------------------------------
// Widget definition
// ---------------------------------------------------------------------------

export interface WidgetDefinition {
  /**
   * Globally unique identifier. Convention: `plugin-name.widget-name`.
   */
  readonly id: string;

  /**
   * The slot this widget occupies by default.
   * Users can override in ~/.jimcast/config.json.
   */
  readonly defaultSlot: WidgetSlot;

  /**
   * Called once when the command bar opens.
   * Return the content to display.
   */
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
