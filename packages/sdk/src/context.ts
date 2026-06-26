/**
 * Context objects passed to command `execute()` functions.
 *
 * The execution context is the primary interface between a plugin and
 * the Jimcast runtime. Everything a plugin can do — inspect the project,
 * run shell commands, show UI feedback, read/write storage — goes through here.
 *
 * Plugins never touch the filesystem directly or call the OS. They ask
 * the context, which routes through the sandboxed JSON-RPC bridge.
 */

import type { PluginStorage } from "./storage.js";
import type { ExecOptions, ExecResult, ExecStreamOptions } from "./process.js";

// ---------------------------------------------------------------------------
// ProjectContext
// ---------------------------------------------------------------------------

/**
 * Snapshot of the current project state, provided by Jimcast core.
 *
 * This is computed once when the command fires — it will not change mid-execution.
 * If you need fresh data (e.g. after running a shell command), call `context.exec()`
 * and parse the output yourself.
 */
// export interface ProjectContext {
//   /**
//    * Absolute path to the working directory Jimcast is currently focused on.
//    * This is the directory your shell commands will run in.
//    */
//   readonly cwd: string;
// }

// ---------------------------------------------------------------------------
// ThemeContext
// ---------------------------------------------------------------------------
export interface ThemeColors {
  readonly bg: string;
  readonly bg1: string;
  readonly bg2: string;
  readonly bg3: string;
  readonly bg4: string;
  readonly fg: string;
  readonly fg2: string;
  readonly fg3: string;
  readonly fg4: string;
  readonly red: string;
  readonly brightRed: string;
  readonly green: string;
  readonly brightGreen: string;
  readonly yellow: string;
  readonly brightYellow: string;
  readonly blue: string;
  readonly brightBlue: string;
  readonly purple: string;
  readonly brightPurple: string;
  readonly aqua: string;
  readonly brightAqua: string;
  readonly orange: string;
  readonly brightOrange: string;
}

export interface ThemeTypography {
  readonly family: string;
  readonly xs: number;
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
  readonly xl: number;
}

export interface ThemeSpacing {
  readonly radiusSm: number;
  readonly radiusMd: number;
  readonly radiusLg: number;
  readonly gapSm: number;
  readonly gapMd: number;
  readonly gapLg: number;
}

/**
 * The host application's current visual theme.
 *
 * All values are resolved at command fire time — they reflect what the user
 * actually sees, including any overrides from their settings.
 *
 * Use these to style any UI your plugin renders instead of hardcoding values.
 *
 * @example
 * ```typescript
 * const { primary } = context.host.theme.colors;
 * const { mode } = context.host.theme;
 * ```
 */
export interface ThemeContext {
  /** Current color mode. */
  readonly mode: "light" | "dark";
  readonly colors: ThemeColors;
  readonly typography: ThemeTypography;
  readonly spacing: ThemeSpacing;
}

// ---------------------------------------------------------------------------
// HostContext
// ---------------------------------------------------------------------------

/**
 * Everything the Jimcast host exposes about itself to plugins.
 *
 * This is intentionally open-ended: Jimcast ships `theme` and `project` here,
 * and third-party host integrations (CI providers, issue trackers, etc.) can
 * extend it via the provider registry without touching the core SDK types.
 *
 * @example
 * ```typescript
 * // Theme
 * const { primary } = context.host.theme.colors;
 *
 * // Project
 * const { cwd } = context.host.project ?? {};
 *
 * // Custom provider (type-augmented via module declaration merging)
 * const issue = context.host.providers.linearIssueTracker?.currentIssue;
 * ```
 */
export interface HostContext {
  /**
   * The host application's current visual theme.
   * Safe to read even when no project is open.
   */
  readonly theme: ThemeContext;

  /**
   * Current project state, or `null` if Jimcast is running without
   * an open project (e.g. in a global command palette).
   */
  // readonly project: ProjectContext | null;

  /**
   * Escape hatch for host-registered providers.
   *
   * Providers are declared in `jimcast.config.ts` and type-augmented
   * via module declaration merging, so downstream plugins stay fully typed.
   *
   * @example
   * ```typescript
   * // Augment in your plugin's type declarations:
   * declare module "@jimcast/sdk" {
   *   interface HostContext {
   *     providers: {
   *       linearIssueTracker?: { currentIssue: string };
   *     };
   *   }
   * }
   * ```
   */
  readonly providers: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// EnvContext
// ---------------------------------------------------------------------------

/**
 * Ambient environment information — things about Jimcast itself, not the project.
 */
export interface EnvContext {
  /**
   * The version of Jimcast core running this plugin.
   * Follows semver — e.g. `"1.3.0"`.
   */
  readonly jimcastVersion: string;

  /** The user's platform. */
  readonly platform: "macos" | "linux" | "windows";

  /**
   * The plugin's own version, as declared in its `package.json`.
   */
  readonly pluginVersion: string;
}

// ---------------------------------------------------------------------------
// UI feedback
// ---------------------------------------------------------------------------

/**
 * Options for {@link ExecutionContext.showToast}.
 */
export interface ToastOptions {
  /**
   * Visual style of the toast.
   * - `"default"` — neutral, informational
   * - `"success"` — green, for completed actions
   * - `"failure"` — red, for errors
   * @default "default"
   */
  readonly style?: "default" | "success" | "failure";

  /**
   * Secondary text shown below the main message. Keep this brief.
   */
  readonly message?: string;

  /**
   * How long the toast stays visible, in milliseconds.
   * @default 3000
   */
  readonly duration?: number;
}

// ---------------------------------------------------------------------------
// ExecutionContext
// ---------------------------------------------------------------------------

/**
 * The full execution context passed to every command's `execute()` function.
 *
 * This is the complete API surface available to a plugin at runtime.
 * The TypeScript types here ARE the documentation — if it's not on this
 * interface, your plugin cannot do it.
 */
export interface ExecutionContext {
  /** Information about the Jimcast runtime environment. */
  readonly env: EnvContext;

  /**
   * Generic host data: theme, project, and any registered providers.
   */
  readonly host: HostContext;

  /** Persistent key-value storage, scoped to this plugin. */
  readonly storage: PluginStorage;

  /**
   * @deprecated Use `context.host.project` instead. Will be removed in v2.
   */
  // readonly project: ProjectContext;

  // -------------------------------------------------------------------------
  // Shell execution
  // -------------------------------------------------------------------------

  /**
   * Runs a shell command and returns the result when it completes.
   *
   * @param command - The shell command string, e.g. `"git status --short"`.
   * @param options - Optional execution options (timeout, env overrides, etc.).
   * @returns The command's stdout, stderr, and exit code.
   *
   * @example
   * ```typescript
   * const { stdout, exitCode } = await context.exec("git branch --show-current");
   * if (exitCode === 0) {
   *   const branch = stdout.trim();
   * }
   * ```
   */
  exec(command: string, options?: ExecOptions): Promise<ExecResult>;

  /**
   * Runs a shell command and streams its output line by line.
   *
   * Use this for long-running commands (builds, test runners, etc.) where
   * you want to show progress as it happens rather than waiting for completion.
   *
   * @param command - The shell command string.
   * @param options - Stream callbacks and optional execution options.
   *
   * @example
   * ```typescript
   * await context.execStreamed("npm run build", {
   *   onLine(line) {
   *     context.appendOutput(line);
   *   },
   * });
   * ```
   */
  execStreamed(command: string, options: ExecStreamOptions): Promise<ExecResult>;

  // -------------------------------------------------------------------------
  // UI feedback
  // -------------------------------------------------------------------------

  /**
   * Shows a brief notification in the Jimcast UI.
   *
   * @param title - The main toast message.
   * @param options - Optional style, secondary message, and duration.
   *
   * @example
   * ```typescript
   * await context.showToast("Branch created", { style: "success" });
   * ```
   */
  showToast(title: string, options?: ToastOptions): Promise<void>;

  /**
   * Appends a line to the command's output panel.
   *
   * The output panel is an expandable area below the command bar that shows
   * live output from running processes. It auto-scrolls to the bottom.
   *
   * This is a fire-and-forget operation — it does not return a promise.
   *
   * @param line - A single line of text (newlines are stripped).
   */
  appendOutput(line: string): void;

  /**
   * Copies text to the system clipboard.
   *
   * @param text - The string to place on the clipboard.
   */
  copyToClipboard(text: string): Promise<void>;

  /**
   * Opens a URL in the user's default browser.
   *
   * The URL must use the `https:` or `http:` scheme.
   * File paths and custom schemes are not permitted.
   *
   * @param url - The URL to open.
   */
  openUrl(url: string): Promise<void>;
}
