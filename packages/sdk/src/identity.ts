// [sdk] packages/sdk/src/identity.ts
// The plugin id is defined once, in package.json "name". Core reads it,
// verifies it against the install dir, and passes it as JIMCAST_PLUGIN_NAME.
//
// Plugin data: the only place a plugin may persist its own files is
// ~/.jimcast/plugin-data/<plugin id>/. It is built here and nowhere else.

import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";

let cached: string | undefined;
let dataDir: string | undefined;

/** This plugin's id (package.json "name"). */
export function pluginId(): string {
  if (cached) return cached;
  const v = process.env.JIMCAST_PLUGIN_NAME?.trim();
  if (!v) {
    throw new Error(
      "JIMCAST_PLUGIN_NAME is not set. Plugins must be started by jimcast-core " +
      "(the id comes from package.json \"name\").",
    );
  }
  return (cached = v);
}

/**
 * Local id -> full widget id.
 *   undefined / "" / the plugin id   -> the plugin id (main widget)
 *   "<plugin id>.x"                  -> unchanged (already full)
 *   "rows"                           -> "<plugin id>.rows"
 *   any other dotted id              -> error
 */
export function qualifyWidgetId(local?: string): string {
  const id = pluginId();
  if (!local || local === id) return id;
  if (local.startsWith(id + ".")) return local;
  if (local.includes(".")) {
    throw new Error(`Widget id "${local}": local ids must not contain dots (plugin id is "${id}").`);
  }
  return `${id}.${local}`;
}

/**
 * Absolute path of this plugin's data dir (~/.jimcast/plugin-data/<plugin id>).
 * Created on first call (mkdir -p, synchronous), so it is safe at module load.
 */
export function pluginDataDir(): string {
  if (dataDir) return dataDir;
  const dir = join(homedir(), ".jimcast", "plugin-data", pluginId());
  mkdirSync(dir, { recursive: true });
  return (dataDir = dir);
}

// Safe inside double-quoted shell strings: no quotes, $, backticks, backslashes, spaces.
const SAFE_NAME = /^[A-Za-z0-9._/-]+$/;

/**
 * Absolute path of a file inside the plugin data dir. `name` is relative
 * ("state", "cache/feed.json"). Absolute paths, ".." segments and unsafe
 * characters are rejected. Parent dirs are created.
 */
export function pluginDataFile(name: string): string {
  if (!name || isAbsolute(name) || !SAFE_NAME.test(name) || name.split("/").includes("..")) {
    throw new Error(`pluginDataFile("${name}"): name must be relative, without "..", and match [A-Za-z0-9._/-].`);
  }
  const dir = pluginDataDir();
  const file = resolve(dir, name);
  if (!file.startsWith(dir + sep)) {
    throw new Error(`pluginDataFile("${name}"): escapes the plugin data dir.`);
  }
  mkdirSync(dirname(file), { recursive: true });
  return file;
}
