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
  WidgetItem,
  WidgetActionFn,
  WidgetDescriptorBase,
  WidgetSlotName,
} from "./widget.js";

// Themes
export { resolveTheme, defaultTheme } from "./themes/index.js";
export type { ThemeName } from "./themes/index.js";
export type { 
  ThemeColors,
  ThemeTypography,
  ThemeSpacing,
  ThemeContext,
} from "./themes/theme.js";
