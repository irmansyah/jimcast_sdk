/**
 * Global type augmentations for the Jimcast plugin environment.
 *
 * These types are automatically available in all plugin TypeScript files
 * when `@jimcast/sdk` is installed — no explicit import needed.
 */

declare global {
  /**
   * The Jimcast runtime version string, injected by the plugin loader.
   * Available as a global constant in all plugin processes.
   *
   * @example
   * ```typescript
   * console.log(__JIMCAST_VERSION__); // "1.3.0"
   * ```
   */
  const __JIMCAST_VERSION__: string;

  /**
   * The plugin's own version, as declared in its package.json.
   * Injected by the plugin loader at startup.
   *
   * @example
   * ```typescript
   * console.log(__PLUGIN_VERSION__); // "0.1.0"
   * ```
   */
  const __PLUGIN_VERSION__: string;
}

export {};
