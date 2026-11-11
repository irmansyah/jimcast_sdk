// [sdk] packages/sdk/src/widgetNav.ts
import type { ExecutionContext } from "./context.js";

/**
 * Widget nav: lets a widget own Left/Right (and vim h/l) on its rows.
 * Plugin-side twin of core's WidgetNavSpec. Handlers mutate state and must NOT
 * call ctx.dispatch: core re-renders after they finish (then: "refresh").
 */
export type WidgetNavHandler = (ctx: ExecutionContext, itemId: string) => Promise<unknown> | unknown;

export interface WidgetNavSpec {
  /** Default: last segment of the widget id. */
  readonly id?: string;
  /** Item-id prefix(es) this widget's items start with. */
  readonly owns: string | readonly string[];
  readonly stickyFocus?: boolean;
  /** Row ids are `prefix + path`. Left lands on the parent row, Right on the first child row. */
  readonly tree?: { readonly prefix: string };
  readonly left?: WidgetNavHandler;
  readonly right?: WidgetNavHandler;
}
