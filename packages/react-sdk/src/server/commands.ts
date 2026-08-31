// [sdk] packages/react-sdk/src/server/commands.ts
import type { SearchResultItem, Document } from "@jimcast/protocol";

export interface CommandArgSpec {
  name: string;
  required?: boolean;
  description?: string;
}

export interface CommandMeta {
  id: string;
  title: string;
  description?: string;
  args?: CommandArgSpec[];
}

export interface CommandDefinition {
  id: string;
  title: string;
  description?: string;
  args?: CommandArgSpec[];
  run: (args: Record<string, string>) => unknown | Promise<unknown>;
}

export const LIST_COMMANDS_ID = "__jimcast_list_commands__";

// Reserved dispatch keys for search/corpus — same reservation mechanism
// server/index.ts already applies to LIST_COMMANDS_ID.
export const SEARCH_ID = "__jimcast_search__";
export const CORPUS_ID = "__jimcast_corpus__";

export function defineCommand(definition: CommandDefinition): CommandDefinition {
  return definition;
}

export function toCommandMeta(commands: CommandDefinition[]): CommandMeta[] {
  return commands.map(({ id, title, description, args }) => ({
    id, title, description, args: args ?? [],
  }));
}

/**
 * Registers an interactive search provider for a webview-backend plugin.
 * Dispatched under SEARCH_ID by defineWebviewBackend — see server/index.ts.
 * Same 5-item cap convention as @jimcast/sdk's rpc.ts; enforced here too
 * so both transports behave identically even if a plugin author forgets.
 */
export function defineSearch(
  fn: (query: string) => SearchResultItem[] | Promise<SearchResultItem[]>,
): CommandDefinition {
  return {
    id: SEARCH_ID,
    title: "Search",
    run: async (args: Record<string, string>) => {
      const results = await fn(args.query ?? "");
      return { items: results.slice(0, 5) };
    },
  };
}

/**
 * Registers a full-corpus provider for the RAG index. No query, no cap.
 */
export function defineCorpus(
  fn: () => Document[] | Promise<Document[]>,
): CommandDefinition {
  return {
    id: CORPUS_ID,
    title: "Corpus",
    run: async () => ({ documents: await fn() }),
  };
}
