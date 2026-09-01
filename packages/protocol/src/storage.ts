// [sdk] packages/protocol/src/storage.ts

/**
 * Plugin key-value storage.
 *
 * Each plugin gets its own isolated storage namespace — plugins cannot read
 * or write each other's data. Storage persists across Jimcast restarts.
 *
 * Keys and values are strings. For structured data, JSON-serialize yourself.
 * Storage is synchronous from the plugin's perspective; the underlying
 * JSON-RPC calls are handled transparently.
 *
 * Limits (enforced by core):
 * - Key length: max 512 characters
 * - Value length: max 100 KB per key
 * - Total storage per plugin: max 10 MB
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Options for listing storage keys.
 */
export interface ListKeysOptions {
  /**
   * If provided, only keys that start with this prefix are returned.
   * Useful for namespacing related keys — e.g. `"cache:"` to find all cached values.
   */
  readonly prefix?: string;
}

/**
 * The storage API available on {@link ExecutionContext.storage}.
 *
 * All methods are async — they route through the sandboxed RPC bridge.
 * There is no direct filesystem access.
 *
 * @example
 * ```typescript
 * // Store the last-used branch
 * await context.storage.set("last-branch", context.project.branch ?? "main");
 *
 * // Retrieve it next time
 * const lastBranch = await context.storage_get("last-branch");
 *
 * // Store structured data
 * await context.storage.set("config", JSON.stringify({ showDrafts: true }));
 * const raw = await context.storage.get("config");
 * const config = raw ? JSON.parse(raw) : {};
 * ```
 */
export interface PluginStorage {
  /**
   * Retrieves the value stored under `key`.
   *
   * @param key - The storage key.
   * @returns The stored string value, or `null` if the key does not exist.
   */
  get(key: string): Promise<string | null>;

  /**
   * Stores `value` under `key`, overwriting any existing value.
   *
   * @param key - The storage key. Max 512 characters.
   * @param value - The value to store. Max 100 KB.
   */
  set(key: string, value: string): Promise<void>;

  /**
   * Removes the value stored under `key`.
   *
   * Deleting a key that does not exist is a no-op — it does not throw.
   *
   * @param key - The storage key to remove.
   */
  delete(key: string): Promise<void>;

  /**
   * Checks whether a key exists in storage.
   *
   * @param key - The storage key to check.
   * @returns `true` if the key exists, `false` otherwise.
   */
  has(key: string): Promise<boolean>;

  /**
   * Returns all stored keys, optionally filtered by prefix.
   *
   * @param options - Optional prefix filter.
   * @returns An array of key strings. Order is not guaranteed.
   *
   * @example
   * ```typescript
   * // Get all cache keys
   * const cacheKeys = await context.storage.keys({ prefix: "cache:" });
   * for (const key of cacheKeys) {
   *   await context.storage.delete(key);
   * }
   * ```
   */
  keys(options?: ListKeysOptions): Promise<string[]>;

  /**
   * Removes all data stored by this plugin.
   *
   * Use with caution — this is irreversible.
   */
  clear(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Internal implementation (used by the RPC runtime, not exported publicly)
// ---------------------------------------------------------------------------

/**
 * @internal
 * Creates a PluginStorage implementation backed by the RPC transport.
 * This is called by the runtime when setting up the execution context —
 * plugin authors never construct this directly.
 */

export function createStorage(
  send: (method: string, params: Record<string, unknown>) => Promise<unknown>
): PluginStorage {
  return {
    async get(key: string): Promise<string | null> {
      const result = await send("storage_get", { key });
      return (result as { value: string | null }).value;
    },

    async set(key: string, value: string): Promise<void> {
      await send("storage_set", { key, value });
    },

    async delete(key: string): Promise<void> {
      await send("storage_delete", { key });
    },

    async has(key: string): Promise<boolean> {
      const result = await send("storage_has", { key });
      return (result as { exists: boolean }).exists;
    },

    async keys(options?: ListKeysOptions): Promise<string[]> {
      const result = await send("storage_keys", { prefix: options?.prefix ?? null });
      return (result as { keys: string[] }).keys;
    },

    async clear(): Promise<void> {
      await send("storage_clear", {});
    },
  };
}
