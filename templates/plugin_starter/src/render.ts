// [plugin] __NAME__/src/render.ts
//
// What the widget looks like. render() returns plain data (a WidgetContent
// tree); buttons carry an action: a closure that runs a shell script, then
// tells core to refresh.

import type { ExecutionContext, WidgetContent, WidgetItem } from "@jimcast/sdk";
import { INC_CMD, RESET_CMD, readCount } from "./shell.js";

// Every item id starts with OWNS. It is the `owns` of the CLI spec, and it must
// NOT collide with a core prefix (fm, cp, em, cal-, pomodoro...). Hence "ext".
export const OWNS = "__SHORT__";

type Action = NonNullable<WidgetItem["action"]>;

/** An action: run a shell script, then ask core to re-render (or "dismiss" the bar). */
export const act = (ctx: ExecutionContext, cmd: string, then: "refresh" | "dismiss" = "refresh"): Action => ({
  run: async () => { await ctx.exec(cmd); },
  then,
});

/** A synthetic item, for ctx.dispatch (CLI and keys). */
export const cliItem = (ctx: ExecutionContext, id: string, cmd: string): WidgetItem => ({
  id: `${OWNS}-cli:${id}`,
  action: act(ctx, cmd),
});

export async function render(ctx: ExecutionContext): Promise<WidgetContent> {
  // Theme colors come from the host; always give a fallback.
  const raw = ctx.host.theme.colors as unknown as Record<string, string | undefined>;
  const c = { fg: raw.fg ?? "#ebdbb2", fg4: raw.fg4 ?? "#a89984", blue: raw.blue ?? "#458588" };

  const count = await readCount(ctx);
  return {
    type: "list",
    datas: [
      { id: `${OWNS}-count`, pinned: true, attribute: { label1: `Count: ${count}`, color1: c.fg } },
      { id: `${OWNS}-inc`,   pinned: true, attribute: { label1: "＋1",   color1: c.blue }, action: act(ctx, INC_CMD) },
      { id: `${OWNS}-reset`, pinned: true, attribute: { label1: "Reset", color1: c.fg4 },  action: act(ctx, RESET_CMD) },
    ],
  };
}
