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

// ---------------------------------------------------------------------------
// Protocol types
// ---------------------------------------------------------------------------

interface CoreRequest {
  id: string;
  command: string;
  args: unknown;
}

interface CoreResponse {
  id: string;
  result?: unknown;
  error?: string;
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

type PendingResolve = (value: unknown) => void;
type PendingReject  = (reason: Error) => void;

export class RpcTransport {
  private readonly pending = new Map<string, [PendingResolve, PendingReject]>();

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
      const id = crypto.randomUUID();
      this.pending.set(id, [resolve, reject]);
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
        this.pending.delete(res.id);
        const [resolve, reject] = pending;
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
// Bootstrap
// ---------------------------------------------------------------------------

export async function bootstrapPlugin(plugin: Plugin): Promise<void> {
  let transport: RpcTransport;

  const handler = async (command: string, args: unknown): Promise<unknown> => {
    return handleCoreRequest(command, args, plugin, transport!);
  };

  transport = new RpcTransport(process.stdin, process.stdout, handler);
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

async function handleCoreRequest(
  command: string,
  args: unknown,
  plugin: Plugin,
  transport: RpcTransport,
): Promise<unknown> {
  if (command === "executeCommand") {
    const { commandId, envContext, hostContext: rawHost } = args as {
      commandId: string;
      envContext: EnvContext;
      hostContext: { themeName?: string; project: { cwd: string } | null; providers?: Record<string, unknown> };
    };

    const cmd = findCommand(plugin, commandId);
    if (!cmd) throw new Error(`Unknown command: ${commandId}`);

    const context = buildContext(envContext, buildHostContext(rawHost), transport);
    const result  = await cmd.execute(context);
    return { items: result ?? [] };
  }

  if (command === "renderWidget") {
    const { widgetId, envContext, hostContext: rawHost } = args as {
      widgetId: string;
      envContext: EnvContext;
      hostContext: { themeName?: string; project: { cwd: string } | null; providers?: Record<string, unknown> };
    };

    const widget = plugin.widgets?.find((w) => w.id === widgetId);
    if (!widget) throw new Error(`Unknown widget: ${widgetId}`);

    const context = buildContext(envContext, buildHostContext(rawHost), transport);
    const content = await widget.render(context);
    return { content };
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
    // project:   raw.project ?? null,
    providers: raw.providers ?? {},
  };
}

function buildContext(
  env:      EnvContext,
  host:     HostContext,
  transport: RpcTransport,
): ExecutionContext {
  const send    = (command: string, args: unknown) => transport.send(command, args);
  const storage = createStorage(send);

  return {
    env,
    host,
    storage,

    // // Deprecated — kept for backward compat, mirrors host.project
    // project: host.project ?? { cwd: "" },

    // async exec(command, options = {}) {
    //   // return send("exec", { command, options }) as ReturnType<ExecutionContext["exec"]>;
    //   return send("exec", { command, options }) as ReturnType<ExecutionContext["execStreamed"]>;
    // },
    
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
      await send("ui.showToast", { title, options });
    },

    appendOutput(line) {
      void send("ui.appendOutput", { line });
    },

    async copyToClipboard(text) {
      await send("ui.copyToClipboard", { text });
    },

    async openUrl(url) {
      await send("ui.openUrl", { url });
    },
  };
}
