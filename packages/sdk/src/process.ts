// [sdk] package/sdk/src/process.ts

/**
 * Shell process execution, available via {@link ExecutionContext.exec} and
 * {@link ExecutionContext.execStreamed}.
 *
 * Plugins run shell commands by asking the Jimcast runtime to run them —
 * there is no direct child_process access. The runtime executes commands
 * in the current project's working directory and returns the results.
 *
 * The sandbox enforces these constraints:
 * - Commands run as the user's own account (not elevated)
 * - Network access is permitted (plugins can call APIs via curl, etc.)
 * - The command's cwd is fixed to the project's working directory
 * - Commands are killed automatically if they exceed the timeout
 */

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Options for {@link ExecutionContext.exec}.
 */
export interface ExecOptions {
  /**
   * Additional environment variables to set for this command.
   * These are merged with (and may override) the user's existing environment.
   */
  readonly env?: Readonly<Record<string, string>>;

  /**
   * How long to wait for the command to complete, in milliseconds.
   * The command is killed and an error is returned if it exceeds this limit.
   * @default 30_000 (30 seconds)
   */
  readonly timeoutMs?: number;

  /**
   * Whether to capture stderr in the returned result.
   * When `false`, stderr is discarded.
   * @default true
   */
  readonly captureStderr?: boolean;

  /**
   * `exec` always resolves with a full {@link ExecResult} regardless of the
   * command's exit code — it never rejects just because the command failed
   * (see {@link execSucceeded}/{@link execFailed} for checking that after
   * the fact). This flag is forwarded to the runtime as-is; it does not
   * change anything about the plugin-side `exec`/`execStreamed` wrappers
   * themselves.
   * @default false
   */
  readonly ignoreExitCode?: boolean;
}

/**
 * Options for {@link ExecutionContext.execStreamed}.
 * Extends {@link ExecOptions} with streaming callbacks.
 */
export interface ExecStreamOptions extends ExecOptions {
  /**
   * Called for each line of stdout output as it arrives.
   * The line string does not include the trailing newline character.
   *
   * @param line - A single line of output from the command's stdout.
   */
  onLine(line: string): void;

  /**
   * Called for each line of stderr output as it arrives.
   * Only called if `captureStderr` is not `false`.
   *
   * @param line - A single line of output from the command's stderr.
   */
  onStderrLine?(line: string): void;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/**
 * The result of a completed shell command.
 */
export interface ExecResult {
  /**
   * Everything the command wrote to stdout, as a single string.
   * Includes all newlines. Call `.trim()` if you need a clean value.
   */
  readonly stdout: string;

  /**
   * Everything the command wrote to stderr, or an empty string if
   * `captureStderr` was `false`.
   */
  readonly stderr: string;

  /**
   * The process exit code.
   * - `0` conventionally means success.
   * - Non-zero conventionally means failure, but the meaning is command-specific.
   */
  readonly exitCode: number;

  /**
   * Whether the command was killed because it exceeded the timeout.
   */
  readonly timedOut: boolean;
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the {@link ExecResult} represents a successful execution
 * (exit code 0, not timed out).
 *
 * @example
 * ```typescript
 * const result = await context.exec("git status");
 * if (!execSucceeded(result)) {
 *   await context.showToast("git status failed", { style: "failure", message: result.stderr.trim() });
 *   return;
 * }
 * ```
 */
export function execSucceeded(result: ExecResult): boolean {
  return result.exitCode === 0 && !result.timedOut;
}

/**
 * Returns `true` if the {@link ExecResult} represents a failed execution.
 * Inverse of {@link execSucceeded}.
 */
export function execFailed(result: ExecResult): boolean {
  return !execSucceeded(result);
}
