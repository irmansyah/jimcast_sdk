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
// Git / project types
// ---------------------------------------------------------------------------

/** A pull request visible on the current repo's remote. */
export interface PR {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly state: "open" | "draft" | "merged" | "closed";
  readonly author: string;
  /** ISO 8601 date string */
  readonly updatedAt: string;
}

/** A recent commit on the current branch. */
export interface Commit {
  readonly sha: string;
  /** Short (7-char) SHA for display. */
  readonly shortSha: string;
  readonly message: string;
  readonly author: string;
  /** ISO 8601 date string */
  readonly date: string;
}

// ---------------------------------------------------------------------------
// ProjectContext
// ---------------------------------------------------------------------------

/**
 * Snapshot of the current project state, provided by Jimcast core.
 *
 * This is computed once when the command fires — it will not change mid-execution.
 * If you need fresh data (e.g. after running `git fetch`), call `context.exec()`
 * and parse the output yourself.
 */
export interface ProjectContext {
  /**
   * Absolute path to the working directory Jimcast is currently focused on.
   * This is the directory your shell commands will run in.
   */
  readonly cwd: string;

  /**
   * Absolute path to the root of the git repository, or `null` if the
   * current directory is not inside a git repo.
   */
  readonly repoRoot: string | null;

  /**
   * Current branch name, or `null` if not in a git repo or in detached HEAD state.
   */
  readonly branch: string | null;

  /**
   * Name of the configured remote (typically `"origin"`), or `null`.
   */
  readonly remoteName: string | null;

  /**
   * Open pull requests on the current repo, fetched from the remote at startup.
   * Empty array if the repo has no open PRs or if fetching failed.
   */
  readonly openPRs: readonly PR[];

  /**
   * The most recent commits on the current branch (up to 20).
   * Empty array if not in a git repo.
   */
  readonly recentCommits: readonly Commit[];
}

// ---------------------------------------------------------------------------
// EnvContext
// ---------------------------------------------------------------------------

/**
 * Ambient environment information — things about Jimcast itself, not the project.
 */
export interface EnvContext {
  /**
   * The version of Jimcast core that is running this plugin.
   * Follows semver — e.g. `"1.3.0"`.
   */
  readonly jimcastVersion: string;

  /**
   * The user's platform.
   */
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
  /** State of the current project when the command fired. */
  readonly project: ProjectContext;

  /** Information about the Jimcast runtime environment. */
  readonly env: EnvContext;

  /** Persistent key-value storage, scoped to this plugin. */
  readonly storage: PluginStorage;

  // -------------------------------------------------------------------------
  // Shell execution
  // -------------------------------------------------------------------------

  /**
   * Runs a shell command in the current project's working directory and
   * returns the result when it completes.
   *
   * The command runs in a sandboxed subprocess — it cannot affect the
   * Jimcast process itself.
   *
   * @param command - The shell command string, e.g. `"git status --short"`.
   * @param options - Optional execution options (timeout, env vars, etc.).
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

  /**
   * Dismisses the Jimcast command bar.
   *
   * Call this after completing an action that should close the UI — for
   * example, after launching an application or opening a file.
   *
   * Safe to call from inside `execute()` or any `onAction` handler.
   *
   * @example
   * ```typescript
   * async onAction() {
   *   await context.exec(`open -a "${app.id}"`);
   *   await context.dismiss();
   * }
   * ```
   */
  dismiss(): Promise<void>;
}
