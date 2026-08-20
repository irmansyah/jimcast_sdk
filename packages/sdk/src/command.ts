// [sdk] packages/sdk/src/command.ts

/**
 * Types for defining commands and the plugin manifest.
 *
 * A command is a single thing a plugin can do — it appears in the Jimcast
 * command bar, the user triggers it, and it returns either a list of items
 * to display or performs an action directly.
 */

import type { ExecutionContext } from "./context.js";
import type { CommandItem } from "./ui.js";
import type { AnyWidget } from "./widget.js";

// ---------------------------------------------------------------------------
// Command result
// ---------------------------------------------------------------------------

/**
 * What a command's execute() can return.
 *
 * - Return `CommandItem[]` to populate the command bar with a list.
 * - Return `void` (or nothing) if the command performs a direct action
 *   (e.g. shows a toast, opens a URL, runs a script).
 */
export type CommandResult = CommandItem[] | void;

// ---------------------------------------------------------------------------
// Command definition
// ---------------------------------------------------------------------------

/**
 * Options passed to {@link createCommand}.
 */
export interface CommandDefinition {
  /**
   * Globally unique identifier for this command.
   * Convention: `<plugin-name>.<command-name>` — e.g. `"git-tools.open-pr"`.
   */
  readonly id: string;

  /**
   * Human-readable name shown in the command bar.
   * Keep this short — ideally 2–4 words.
   */
  readonly title: string;

  /**
   * Supporting text shown below the title in search results.
   * Optional but recommended — helps users understand what the command does
   * before triggering it.
   */
  readonly subtitle?: string;

  /**
   * Additional keywords for fuzzy search.
   * Use these when the title alone wouldn't surface the command for obvious
   * user queries — e.g. a command titled "Open PR" might add ["pull request"].
   */
  readonly keywords?: readonly string[];

  /**
   * The function that runs when the user triggers this command.
   *
   * @param context - The execution context, giving access to the current
   *   project state, shell execution, storage, and UI primitives.
   * @returns A list of {@link CommandItem}s to display, or void if the command
   *   performs a direct action.
   */
  execute(context: ExecutionContext): Promise<CommandResult>;
}

/**
 * A fully-resolved command, ready to be registered with the plugin system.
 * Produced by {@link createCommand}.
 */
export interface Command extends CommandDefinition {
  readonly _type: "command";
}

/**
 * A named group of related commands — shown as a collapsible section in the
 * command bar when the user browses a plugin's commands.
 */
export interface CommandGroup {
  readonly _type: "command-group";

  /** Label displayed as the group heading. */
  readonly title: string;

  /** The commands in this group. Order is preserved. */
  readonly commands: readonly Command[];
}

// ---------------------------------------------------------------------------
// Plugin manifest
// ---------------------------------------------------------------------------

/**
 * Options passed to {@link definePlugin}.
 */
export interface PluginDefinition {
  /**
   * The plugin's display name — shown in the Jimcast plugin manager.
   * This is NOT the npm package name; it's a human-readable label.
   */
  readonly name: string;

  /**
   * One-sentence description of what this plugin does.
   * Shown in search results and the plugin manager.
   */
  readonly description?: string;

  /**
   * The commands this plugin contributes.
   * Accepts a flat list of commands or a mix of commands and command groups.
   */
  readonly commands: ReadonlyArray<Command | CommandGroup>;

  /**
   * The widgets this plugin contributes — persistent UI blocks rendered in
   * the command bar (see widget.ts). Each renders into a slot the user
   * configures in ~/.jimcast/config.json, optionally on a timer (`repeat`)
   * and/or with expandable children (`expandable`).
   */
  readonly widgets?: ReadonlyArray<AnyWidget>;
}

/**
 * A fully-resolved plugin manifest. Produced by {@link definePlugin}.
 */
export interface Plugin extends PluginDefinition {
  readonly _type: "plugin";
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

/**
 * Creates a command.
 *
 * This is the primary building block of a Jimcast plugin. Every user-visible
 * action is a command.
 *
 * @example
 * ```typescript
 * const greetCommand = createCommand({
 *   id: "my-plugin.greet",
 *   title: "Say Hello",
 *   subtitle: "Shows a greeting toast",
 *   async execute(context) {
 *     await context.showToast("Hello!");
 *   },
 * });
 * ```
 */
export function createCommand(definition: CommandDefinition): Command {
  return { ...definition, _type: "command" };
}

/**
 * Groups related commands under a shared heading.
 *
 * @example
 * ```typescript
 * const gitGroup = createCommandGroup({
 *   title: "Git",
 *   commands: [openPRCommand, checkoutBranchCommand],
 * });
 * ```
 */
export function createCommandGroup(options: {
  title: string;
  commands: readonly Command[];
}): CommandGroup {
  return { ...options, _type: "command-group" };
}

/**
 * Defines a plugin and registers it with the Jimcast runtime.
 *
 * Every plugin must call this exactly once, as its default export.
 *
 * @example
 * ```typescript
 * export default definePlugin({
 *   name: "My Plugin",
 *   description: "Does useful things",
 *   commands: [greetCommand, openPRCommand],
 * });
 * ```
 */
export function definePlugin(definition: PluginDefinition): Plugin {
  return { ...definition, _type: "plugin" };
}
