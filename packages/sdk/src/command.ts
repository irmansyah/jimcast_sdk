// [sdk] packages/sdk/src/command.ts
import type { ExecutionContext } from "./context.js";
import type { CommandItem } from "./ui.js";
import type { AnyWidget } from "./widget.js";
import type { SearchResultItem, Document } from "@jimcast/protocol";

export type CommandResult = CommandItem[] | void;

export interface CommandDefinition {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly keywords?: readonly string[];
  execute(context: ExecutionContext): Promise<CommandResult>;
}

export interface Command extends CommandDefinition {
  readonly _type: "command";
}

export interface CommandGroup {
  readonly _type: "command-group";
  readonly title: string;
  readonly commands: readonly Command[];
}

export interface PluginDefinition {
  readonly name: string;
  readonly description?: string;
  readonly commands: ReadonlyArray<Command | CommandGroup>;
  readonly widgets?: ReadonlyArray<AnyWidget>;

  /**
   * Interactive search provider. Called per (debounced) keystroke from the
   * command bar. Must be fast and cap its own results (5 is the house
   * convention — see rpc.ts's "search" handler, which also enforces a
   * hard cap regardless of what's returned here).
   */
  readonly search?: (
    query: string,
    ctx: ExecutionContext,
  ) => Promise<SearchResultItem[]>;

  /**
   * Full-corpus provider for the RAG index. Called rarely (plugin start,
   * or after this plugin signals a change — see notifyCorpusChanged in
   * a future revision). No query, no cap — return everything indexable.
   */
  readonly corpus?: (ctx: ExecutionContext) => Promise<Document[]>;
}

export interface Plugin extends PluginDefinition {
  readonly _type: "plugin";
}

export function createCommand(definition: CommandDefinition): Command {
  return { ...definition, _type: "command" };
}

export function createCommandGroup(options: {
  title: string;
  commands: readonly Command[];
}): CommandGroup {
  return { ...options, _type: "command-group" };
}

export function definePlugin(definition: PluginDefinition): Plugin {
  return { ...definition, _type: "plugin" };
}
