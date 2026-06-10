/**
 * Widget API — plugins that render persistent UI blocks in the command bar.
 *
 * Widgets are rendered once when the command bar opens. They occupy a
 * configurable slot in the bar layout. Users control which slot via
 * ~/.jimcast/config.json.
 */

import type { ExecutionContext } from "./context.js";

// ---------------------------------------------------------------------------
// Widget content types
// ---------------------------------------------------------------------------

export type WidgetRow = {
  readonly label: string;
  readonly value: string;
  readonly valueColor?: "default" | "green" | "red" | "yellow" | "blue";
};

export type WidgetBadge = {
  readonly label: string;
  readonly color?: "default" | "green" | "red" | "yellow" | "blue" | "purple";
};

/**
 * What a widget's render() can return.
 *
 * - `rows`   — a key/value list, good for status info (branch, PRs, env vars)
 * - `text`   — a single line or short paragraph of text
 * - `badges` — a horizontal row of pills, good for tags or states
 */
export type WidgetContent =
  | { readonly type: "rows"; readonly rows: readonly WidgetRow[] }
  | { readonly type: "text"; readonly content: string }
  | { readonly type: "badges"; readonly badges: readonly WidgetBadge[] };

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
 * │   GitContext    │
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
 * │─────────────────│
 * │   Footer        │
 * └─────────────────┘
 * ```
 */
export type WidgetSlot = "top" | "above-input" | "below-input" | "below-results";

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
 * const branchWidget = createWidget({
 *   id: "git-status.branch-widget",
 *   defaultSlot: "below-input",
 *   async render(context) {
 *     return {
 *       type: "rows",
 *       rows: [
 *         { label: "branch", value: context.project.branch ?? "none" },
 *         { label: "open PRs", value: String(context.project.openPRs.length) },
 *       ],
 *     };
 *   },
 * });
 * ```
 */
export function createWidget(definition: WidgetDefinition): Widget {
  return { ...definition, _type: "widget" };
}
