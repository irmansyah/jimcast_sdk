// [sdk] packages/sdk/src/widgetCli.ts

/**
 * Widget CLI — commands reachable as `jimcast widget command <spec> <command> [args...]`.
 * Plugin-side twin of core's WidgetCliSpec (frontend/application/widget/widgetCli.ts).
 *
 * Differences from core, all caused by the process boundary:
 *  - `owns` is a list of item-id PREFIXES, not a function.
 *  - `ctx` is a full ExecutionContext (exec, storage, ...) instead of core's `port`.
 *  - `dispatch` is an RPC round trip: core runs the item's action in the widget's
 *    on-screen view, re-renders, then answers.
 *
 * Requires "widget-cli" in package.json `jimcast.capabilities`.
 */
import type { ExecutionContext } from "./context.js";
import type { WidgetItem } from "./widget.js";

export interface WidgetDispatchOptions {
  /** After the re-render, put the cursor on the item with this id (or the first one starting with `prefix`). */
  focus?: { id: string; prefix?: string };
}

export interface WidgetCliContext extends ExecutionContext {
  /** Positional arguments after the command name, flags included (`--show` is consumed by core). */
  readonly args: readonly string[];
  /** The caller's working directory, for resolving relative paths. */
  readonly cwd: string | null;
  /**
   * Runs `item`'s action as if the user had selected it, then awaits the re-render
   * (give the action `then: 'refresh'`). Function actions work: use `{ run, then }`.
   */
  dispatch(item: WidgetItem<boolean>, opts?: WidgetDispatchOptions): Promise<void>;
  /** Ask core to show the command bar once the command has finished. */
  showBar(): void;
}

export interface WidgetCliCommand {
  readonly id: string;
  /** Argument names, for `jimcast widget commands` (documentation only). */
  readonly args?: readonly string[];
  readonly title?: string;
  readonly description?: string;
  /** string -> printed as is, null/undefined -> nothing, else JSON. Throw to fail. */
  run(ctx: WidgetCliContext): Promise<unknown> | unknown;
}

export interface WidgetCliSpec {
  /** Short name on the command line. Default: last segment of the widget id ("acme.files" -> "files"). */
  readonly id?: string;
  /** Item-id prefix(es) this widget's items start with, e.g. "fm". Must be specific. */
  readonly owns: string | readonly string[];
  readonly commands: readonly WidgetCliCommand[];
}
