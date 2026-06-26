// packages/sdk/src/index.ts

/**
 * @jimcast/sdk
 *
 * The official SDK for building Jimcast plugins.
 *
 * Everything exported from this module is part of the stable public API.
 * Internal modules (rpc.ts) are intentionally excluded.
 *
 * @example Basic plugin
 * ```typescript
 * import { definePlugin, createCommand } from "@jimcast/sdk";
 *
 * export default definePlugin({
 *   name: "My Plugin",
 *   description: "Does something useful",
 *   commands: [
 *     createCommand({
 *       id: "my-plugin.hello",
 *       title: "Say Hello",
 *       subtitle: "Shows a greeting toast",
 *       async execute(context) {
 *         await context.showToast("Hello from my plugin!", { style: "success" });
 *       },
 *     }),
 *   ],
 * });
 * ```
 */

// Command definition and plugin manifest
export {
  definePlugin,
  createCommand,
  createCommandGroup,
} from "./command.js";
export type {
  Command,
  CommandDefinition,
  CommandGroup,
  CommandResult,
  Plugin,
  PluginDefinition,
} from "./command.js";

// UI primitives
export type {
  Action,
  CommandItem,
  Preview,
} from "./ui.js";

// Execution context
export type {
  // ProjectContext,
  HostContext,
  ThemeContext,
  ThemeColors,
  ThemeTypography,
  ThemeSpacing,
  EnvContext,
  ExecutionContext,
  ToastOptions,
} from "./context.js";

// Process execution
export {
  execFailed,
  execSucceeded,
} from "./process.js";
export type {
  ExecOptions,
  ExecResult,
  ExecStreamOptions,
} from "./process.js";

// Storage
export type {
  ListKeysOptions,
  PluginStorage,
} from "./storage.js";

// RPC bootstrap (runtime-only, not for plugin authors)
export {
  bootstrapPlugin,
} from "./rpc.js";

// Widget
export { createWidget } from "./widget.js";
export type {
  Widget,
  WidgetContent,
  WidgetDefinition,
  WidgetSlot,
} from "./widget.js";

// Themes
export { resolveTheme, defaultTheme } from "./themes/index.js";
export type { ThemeName } from "./themes/index.js";
