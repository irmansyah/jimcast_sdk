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
import { definePlugin, createWidget, type ExecutionContext, type WidgetContent } from "@jimcast/sdk";

const branchWidget = createWidget({
  id: "hello-world.widget.branch-widget",
  defaultSlot: "top",
  async render(context: ExecutionContext): Promise<WidgetContent> {
    const { host } = context;
    return {
      type: "rows",
      rows: [
        {
          label:      "cwd",
          value:      "cwd_example",
          valueColor: host.theme.colors.brightAqua,
        },
        {
          label:      "theme",
          value:      host.theme.mode,
          valueColor: host.theme.colors.brightYellow,
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
