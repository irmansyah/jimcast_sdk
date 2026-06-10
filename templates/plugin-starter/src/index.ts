/**
 * {{PLUGIN_NAME}} — a Jimcast plugin
 *
 * Replace this file with your plugin's logic.
 * See https://jimcast.dev/docs/plugins for the full API reference.
 */

import { definePlugin, createCommand } from "@jimcast/sdk";

const exampleCommand = createCommand({
  id: "{{PLUGIN_ID}}.example",
  title: "Example Command",
  subtitle: "Replace this with your first real command",

  async execute(context) {
    // Your command logic goes here.
    // Return an array of CommandItems to show a list, or return nothing
    // if your command performs a direct action.
    await context.showToast(`Hello from {{PLUGIN_NAME}}!`, { style: "success" });
  },
});

export default definePlugin({
  name: "{{PLUGIN_NAME}}",
  description: "{{PLUGIN_DESCRIPTION}}",
  commands: [exampleCommand],
});
