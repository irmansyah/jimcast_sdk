import { createWidget, definePlugin } from "@jimcast/sdk";
import { bootstrapPlugin } from "@jimcast/sdk/runtime";

export const widget = createWidget({            // no id: main widget = plugin id
  section: { title: "__NAME__", titleShow: true },
  render: () => ({ type: "text", data: { id: "hello", attribute: { label1: "Hello" } } }),
});

export const plugin = definePlugin({ description: "TODO", widgets: [widget] });
export default plugin;
bootstrapPlugin(plugin);
