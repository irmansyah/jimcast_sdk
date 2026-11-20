// [plugin] __NAME__/src/commands.ts
//
// CLI: `jimcast widget command x__NAME__ <status|inc|reset>`.
// Changes go through ctx.dispatch so the widget re-renders as if a button was clicked.

import type { WidgetCliCommand } from "@jimcast/sdk";
import { INC_CMD, RESET_CMD, readCount } from "./shell.js";
import { cliItem } from "./render.js";

export const CLI_COMMANDS: WidgetCliCommand[] = [
  { id: "status", title: "Print the count", run: async (ctx) => String(await readCount(ctx)) },
  {
    id: "inc", title: "Add one",
    async run(ctx) {
      await ctx.dispatch(cliItem(ctx, "inc", INC_CMD));
      return String(await readCount(ctx));
    },
  },
  {
    id: "reset", title: "Set the count back to 0",
    async run(ctx) {
      await ctx.dispatch(cliItem(ctx, "reset", RESET_CMD));
      return "0";
    },
  },
];
