// [sdk] packages/sdk/src/index.ts

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
export {
  scoreFields,
  attributeFields,
  documentFields,
  FIELD_WEIGHT,
} from "@jimcast/protocol";
export type {
  SearchField,
  AttributeLike,
  SearchResultItem,
  SearchResultAction,
  Document,
  DocumentAction,
} from "@jimcast/protocol";
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
// Widget
export {
  createWidget,
  createTmuxTerminalWidget,
  createTmuxTerminalWidgets,
  buildTmuxSessionAttachScript,
  buildTmuxAttachScript,
} from "./widget.js";
export type {
  Widget,
  AnyWidget,
  // content
  WidgetContent,
  WidgetItem,
  WidgetAttribute,
  WidgetItemStyle,
  WidgetColor,
  WidgetFormField,
  WidgetGroupSection,
  WebsiteTarget,
  ImageTarget,
  MirrorBrowserTarget,
  BrowserKind,
  TerminalLaunchSpec,
  // panel content
  WidgetPanelChild,
  WidgetPanelChildWidget,
  WidgetPanelChildExternalComponent,
  WidgetPanelChildExternalCustom,
  WidgetPanelChildWebview,
  // actions
  WidgetAction,
  WidgetActionFn,
  ThenClause,
  // descriptor
  WidgetDescriptor,
  WidgetDescriptorBase,
  WidgetDescriptorExpandable,
  WidgetSectionOptions,
  WidgetMode,
  WidgetSlotName,
  // expandable
  WidgetExpandableChild,
  WidgetExpandableChildWidget,
  WidgetExpandableChildCustom,
  // tmux
  TerminalPanelConfig,
  WidgetExpandableTerminalConfig,
  WidgetExpandableTerminalsConfig,
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
// Widget CLI + keys
export type {
  WidgetCliSpec, WidgetCliCommand, WidgetCliContext, WidgetDispatchOptions,
} from "./widgetCli.js";
export type {
  WidgetKeySpec, WidgetKeyAction, WidgetKeyContext,
} from "./widgetKeys.js";
export { parseKey, keyLabel, resolveBindings } from "@jimcast/protocol";
export type { ParsedKey, KeyBindingsConfig } from "@jimcast/protocol";
export type { WidgetNavSpec, WidgetNavHandler } from "./widgetNav.js";
