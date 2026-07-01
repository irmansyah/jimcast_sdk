/**
 * Hello World — a minimal Jimcast plugin.
 *
 * Demonstrates:
 * - definePlugin / createCommand basics
 * - Returning CommandItems from execute()
 * - Attaching actions to items
 * - Using context.showToast
 * - Using context.copyToClipboard
 * - createWidget for persistent UI slots
 */

import { createWidget, definePlugin, type ExecutionContext, type WidgetContent } from "@jimcast/sdk";

const branchWidget = createWidget({
  id: "hello-world.widget.branch-widget",
  defaultSlot: "below-input",
  async render(context: ExecutionContext): Promise<WidgetContent> {
    const { host } = context;
    return {
      type: "rows",
      datas: [
        {
          id:      "cwd",
          attribute: {
            label1: "cwd",
            labelRight: "cwd_example",
            colorRight: host.theme.colors.brightAqua,
          }
        },
        {
          id:      "theme",
          attribute: {
            label1: "theme",
            labelRight: host.theme.mode,
            colorRight: host.theme.colors.brightYellow,
          }
        },
      ],
    };
  },
});

export default definePlugin({
  name: "Hello World",
  description: "A minimal example plugin showing the Jimcast SDK basics",
  commands: [],
  widgets: [branchWidget],
});
