/**
 * @internal
 * Plugin ↔ Core IPC transport.
 *
 * Protocol: newline-delimited JSON over stdin/stdout
 * Request (core → plugin):  {"id": "uuid", "command": "...", "args": {...}}
 * Response (plugin → core): {"id": "uuid", "result": {...}}
 *                        or {"id": "uuid", "error": "message"}
 */

import { createInterface } from "node:readline";
import type { Plugin } from "./command.js";
import type {
  EnvContext,
  ExecutionContext,
  HostContext,
  ToastOptions,
} from "./context.js";
import { createStorage } from "./storage.js";
import type { ExecOptions, ExecResult } from "./process.js";
import { resolveTheme } from "./themes/index.js";
import type { WidgetContent, WidgetItem, WidgetActionFn } from "./widget.js";
import type { ThemeContext } from "./context.js";

// ---------------------------------------------------------------------------
// Protocol types
// ---------------------------------------------------------------------------

interface CoreRequest {
  id:      string;
  command: string;
  args:    unknown;
}

interface CoreResponse {
  id:      string;
  result?: unknown;
  error?:  string;
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

type PendingResolve = (value: unknown) => void;
type PendingReject  = (reason: Error)  => void;

const PENDING_TIMEOUT_MS = 30_000;

export class RpcTransport {
  private readonly pending = new Map<string, [PendingResolve, PendingReject, ReturnType<typeof setTimeout>]>();

  constructor(
    private readonly stdin:     NodeJS.ReadableStream,
    private readonly stdout:    NodeJS.WritableStream,
    private readonly onRequest: (command: string, args: unknown, id: string) => Promise<unknown>,
  ) {
    this.listen();
  }

  /** Send a request to core and await the response. */
  send(command: string, args: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id      = crypto.randomUUID();
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: no response for command "${command}" (id=${id})`));
      }, PENDING_TIMEOUT_MS);

      this.pending.set(id, [resolve, reject, timeout]);
      this.write({ id, command, args });
    });
  }

  respond(id: string, result: unknown): void {
    this.write({ id, result });
  }

  respondError(id: string, message: string): void {
    this.write({ id, error: message });
  }

  private write(message: unknown): void {
    this.stdout.write(JSON.stringify(message) + "\n");
  }

  private listen(): void {
    const rl = createInterface({ input: this.stdin, crlfDelay: Infinity });

    rl.on("line", (line) => {
      if (!line.trim()) return;

      let message: CoreRequest | CoreResponse;
      try {
        message = JSON.parse(line) as CoreRequest | CoreResponse;
      } catch {
        return;
      }

      if ("command" in message) {
        const req = message as CoreRequest;
        this.onRequest(req.command, req.args, req.id).then(
          (result) => this.respond(req.id, result),
          (err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.respondError(req.id, msg);
          },
        );
      } else {
        const res     = message as CoreResponse;
        const pending = this.pending.get(res.id);
        if (!pending) return;

        const [resolve, reject, timeout] = pending;
        clearTimeout(timeout);
        this.pending.delete(res.id);

        if (res.error) {
          reject(new Error(res.error));
        } else {
          resolve(res.result);
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Widget action fn registry
// ---------------------------------------------------------------------------

interface RegisteredAction {
  fn:  WidgetActionFn;
  ctx: ExecutionContext;
}

const widgetActionRegistry = new Map<string, RegisteredAction>();

function registerActionFn(fn: WidgetActionFn, ctx: ExecutionContext): string {
  const fnId = `wfn_${crypto.randomUUID()}`;
  widgetActionRegistry.set(fnId, { fn, ctx });
  return fnId;
}

function serializeItem(item: WidgetItem, ctx: ExecutionContext): unknown {
  if (typeof item.action === "function") {
    const fnId = registerActionFn(item.action, ctx);
    return { ...item, action: { _fnId: fnId } };
  }
  return item;
}

function serializeContent(content: WidgetContent, ctx: ExecutionContext): unknown {
  if ("datas" in content) {
    return {
      ...content,
      datas: (content.datas as readonly WidgetItem[]).map((item) =>
        serializeItem(item, ctx),
      ),
    };
  }
  return content;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export async function bootstrapPlugin(plugin: Plugin): Promise<void> {
  let transport: RpcTransport;

  const handler = async (command: string, args: unknown, id: string): Promise<unknown> => {
    return handleCoreRequest(command, args, id, plugin, transport);
  };

  transport = new RpcTransport(process.stdin, process.stdout, handler);
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

async function handleCoreRequest(
  command:   string,
  args:      unknown,
  id:        string,
  plugin:    Plugin,
  transport: RpcTransport,
): Promise<unknown> {

  // ── executeCommand ────────────────────────────────────────────────────────
  if (command === "executeCommand") {
    const { commandId, envContext, hostContext: rawHost } = args as {
      commandId:   string;
      envContext:  EnvContext;
      hostContext: RawHostContext;
    };

    const cmd = findCommand(plugin, commandId);
    if (!cmd) throw new Error(`Unknown command: ${commandId}`);

    const context = buildContext(envContext, buildHostContext(rawHost), transport);
    const result  = await cmd.execute(context);
    return { items: result ?? [] };
  }

  // ── renderWidget ──────────────────────────────────────────────────────────
  if (command === "renderWidget") {
    const { widgetId, envContext, hostContext: rawHost } = args as {
      widgetId:    string;
      envContext:  EnvContext;
      hostContext: RawHostContext;
    };

    const widget = plugin.widgets?.find((w) => w.id === widgetId);
    if (!widget) throw new Error(`Unknown widget: ${widgetId}`);

    const context = buildContext(envContext, buildHostContext(rawHost), transport);
    const content = await widget.render(context);

    return { content: serializeContent(content, context) };
  }

  // ── invokeWidgetAction ────────────────────────────────────────────────────
  if (command === "invokeWidgetAction") {
    const { fnId } = args as { fnId: string };
    const entry    = widgetActionRegistry.get(fnId);
    if (!entry) throw new Error(`Unknown widget action fn: ${fnId}`);

    await entry.fn(entry.ctx);
    return {};
  }

  throw new Error(`Unknown command: ${command}`);
}

function findCommand(plugin: Plugin, commandId: string) {
  for (const entry of plugin.commands) {
    if (entry._type === "command" && entry.id === commandId) return entry;
    if (entry._type === "command-group") {
      for (const cmd of entry.commands) {
        if (cmd.id === commandId) return cmd;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Context builders
// ---------------------------------------------------------------------------

/** Raw wire shape of hostContext as sent by core. */
interface RawHostContext {
  themeName?: string;
  project:    { cwd: string } | null;
  providers?: Record<string, unknown>;
}

/**
 * Deserialises the raw `hostContext` payload sent by core into a typed
 * `HostContext`. Core sends only a theme name string — we resolve it to
 * the full ThemeContext here so plugins never deal with raw color maps.
 */
function buildHostContext(raw: RawHostContext): HostContext {
  return {
    theme:     resolveTheme(raw.themeName),
    providers: raw.providers ?? {},
  };
}

function buildContext(
  env:       EnvContext,
  host:      HostContext,
  transport: RpcTransport,
): ExecutionContext {
  const send    = (command: string, args: unknown) => transport.send(command, args);
  const storage = createStorage(send);

  return {
    env,
    host,
    storage,

    async exec(command: string, options: ExecOptions = {}): Promise<ExecResult> {
      return send("exec", { command, options }) as Promise<ExecResult>;
    },

    async execStreamed(command, options) {
      const { onLine, onStderrLine, ...rest } = options;
      const result = await send("execStreamed", { command, options: rest }) as {
        stdout:   string;
        stderr:   string;
        exitCode: number;
        timedOut: boolean;
      };
      for (const line of result.stdout.split("\n")) {
        if (line) onLine(line);
      }
      if (onStderrLine) {
        for (const line of result.stderr.split("\n")) {
          if (line) onStderrLine(line);
        }
      }
      return result;
    },

    async showToast(title: string, options: ToastOptions = {}): Promise<void> {
      await send("ui_show_toast", { title, options });
    },

    appendOutput(line) {
      send("ui_append_output", { line }).catch((err: unknown) => {
        console.error("[rpc] appendOutput failed:", err);
      });
    },

    async copyToClipboard(text) {
      await send("ui_copy_to_clipboard", { text });
    },

    async openUrl(url) {
      await send("ui_open_url", { url });
    },
  };
}
