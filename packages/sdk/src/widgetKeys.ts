// [sdk] packages/sdk/src/widgetKeys.ts

/**
 * Widget keys — key bindings active while the widget is the OPEN expandable
 * (core limitation: not for widgets merely sitting in a slot).
 * Plugin-side twin of core's WidgetKeySpec (application/widget/widgetKeys.ts).
 *
 * Users remap each action's `default` in `key_bindings.<spec id>` of config.json
 * or a profile in config_section.json; "" / null / false unbinds.
 *
 * Requires "widget-keys" in package.json `jimcast.capabilities`.
 */
import type { ExecutionContext } from "./context.js";
import type { WidgetItem } from "./widget.js";
import type { WidgetDispatchOptions } from "./widgetCli.js";

export interface WidgetKeyContext extends ExecutionContext {
  /** Id of the item under the cursor in the open expandable (null if none). */
  readonly focusedItemId: string | null;
  /** Same as WidgetCliContext.dispatch. */
  dispatch(item: WidgetItem<boolean>, opts?: WidgetDispatchOptions): Promise<void>;
}

export interface WidgetKeyAction {
  readonly id: string;
  readonly title?: string;
  /** "shift+h", "ctrl+x", "space", "left", "c", or a list of them. */
  readonly default: string | readonly string[];
  run(ctx: WidgetKeyContext): Promise<unknown> | unknown;
}

export interface WidgetKeySpec {
  /** Key under "key_bindings". Default: last segment of the widget id. */
  readonly id?: string;
  /** Item-id prefix(es) this widget's items start with. */
  readonly owns: string | readonly string[];
  readonly actions: readonly WidgetKeyAction[];
}
