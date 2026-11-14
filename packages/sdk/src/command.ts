// [sdk] packages/sdk/src/command.ts
import type { ExecutionContext } from "./context.js";
import type { AnyWidget } from "./widget.js";
import type { SearchResultItem, Document } from "@jimcast/protocol";
import { pluginId } from "./identity.js";

export interface PluginDefinition {
  readonly description?: string;
  readonly widgets?: ReadonlyArray<AnyWidget>;
  readonly search?: (query: string, ctx: ExecutionContext) => Promise<SearchResultItem[]>;
  readonly corpus?: (ctx: ExecutionContext) => Promise<Document[]>;
}

export interface Plugin extends PluginDefinition {
  /** The plugin id: package.json "name", read from JIMCAST_PLUGIN_NAME. */
  readonly name: string;
  readonly _type: "plugin";
}

export function definePlugin(definition: PluginDefinition = {}): Plugin {
  return { ...definition, name: pluginId(), _type: "plugin" };
}
