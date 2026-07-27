// [sdk] src/index.ts

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
// ✂️ REMOVED bootstrapPlugin FROM HERE TO PROTECT THE BROWSER
// Widget
export {
  createWidget,
  createTmuxTerminalWidget,
  createTmuxTerminalWidgets,
  buildTmuxAttachScript,
} from "./widget.js";
export type {
  Widget,
  AnyWidget,
  WidgetContent,
  WidgetItem,
  WidgetAction,
  WidgetActionFn,
  WidgetAttribute,
  WidgetColor,
  WidgetMode,
  ThenClause,
  WidgetDescriptor,
  WidgetDescriptorBase,
  WidgetDescriptorExpandable,
  WidgetExpandableChild,
  WidgetExpandableChildWidget,
  WidgetExpandableChildCustom,
  WidgetExpandableTerminalConfig,
  WidgetExpandableTerminalsConfig,
  WidgetSlotName,
  TerminalLaunchSpec,
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
