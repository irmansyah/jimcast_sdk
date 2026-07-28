// [sdk] src/rpc.ts

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
import type {
  AnyWidget,
  WidgetContent,
  WidgetItem,
  WidgetActionFn,
} from "./widget.js";

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

// Keyed by a stable `wfn_<widgetId>_<itemId>` id, NOT a fresh randomUUID per
// render. Widgets with `repeat` re-render on a timer (e.g. every second) —
// minting a new random id each time and never removing the old one meant
// this map grew without bound for the life of the plugin process. Using a
// stable key means a re-render simply overwrites the previous entry (which
// also keeps `ctx` fresh, since re-render passes a new ExecutionContext).
const widgetActionRegistry = new Map<string, RegisteredAction>();

function actionFnId(widgetId: string, itemId: string): string {
  return `wfn_${widgetId}_${itemId}`;
}

function registerActionFn(fnId: string, fn: WidgetActionFn, ctx: ExecutionContext): void {
  widgetActionRegistry.set(fnId, { fn, ctx });
}

function serializeItem(widgetId: string, item: WidgetItem, ctx: ExecutionContext): unknown {
  if (typeof item.action === "function") {
    const fnId = actionFnId(widgetId, item.id);
    registerActionFn(fnId, item.action, ctx);
    return { ...item, action: { _fnId: fnId } };
  }
  return item;
}

function serializeContent(widgetId: string, content: WidgetContent<boolean>, ctx: ExecutionContext): unknown {
  // Only `WidgetContent` variants ever pass through here — plugin content is
  // sent to core as newline-delimited JSON over stdin/stdout (see file
  // header), so nothing that can't survive `JSON.stringify` (e.g. a raw
  // React node / render function) is representable in this type to begin
  // with. Widgets needing that escape hatch are a core-only capability;
  // see widget.ts's WidgetExpandableChild for why plugins only get
  // 'widget' | 'custom', not 'component'.
  if ("datas" in content) {
    return {
      ...content,
      datas: (content.datas as readonly WidgetItem[]).map((item) =>
        serializeItem(widgetId, item, ctx),
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
// Widget lookup
// ---------------------------------------------------------------------------

function findWidget(plugin: Plugin, widgetId: string): AnyWidget | undefined {
  return plugin.widgets?.find((w) => w.id === widgetId);
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

async function handleCoreRequest(
  command:   string,
  args:      unknown,
  _id:       string,
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

  // ── renderExpandableChild ──────────────────────────────────────────────────
  // Called by core for quick_tools entries configured as `kind: "external-custom"`
  // (see [core] widgetRegistry.ts). Unlike resolveExpandableChild, there is no
  // parent widget/childId pair here — the quick_tools config key IS the fully
  // qualified widgetId, and core wants that widget rendered directly, the same
  // way renderWidget does. Kept as a separate command (rather than reusing
  // "renderWidget") because core reaches it via invoke_plugin_command, not
  // render_widget — see the "external-component" vs "external-custom" split in
  // widgetRegistry.ts's buildWidgetExpandablesExpandableChilds for why a plugin
  // author would pick one over the other.
  if (command === "renderExpandableChild") {
    const { widgetId, envContext, hostContext: rawHost, query } = args as {
      widgetId:     string;
      envContext?:  EnvContext;
      hostContext?: RawHostContext;
      query?:       string;
    };

    const widget = findWidget(plugin, widgetId);
    if (!widget) throw new Error(`Unknown widget: ${widgetId}`);

    const context = buildContext(
      envContext ?? ({} as EnvContext),
      buildHostContext(rawHost ?? {}),
      transport,
    );

    let content: WidgetContent<boolean> | null;
    if (widget.render) {
      content = await widget.render(context);
    } else if (widget.renderQuery) {
      content = await widget.renderQuery(context, query ?? "");
    } else {
      throw new Error(`Widget "${widgetId}" defines neither render nor renderQuery`);
    }

    if (content == null) return { content: null };
    return { content: serializeContent(widgetId, content, context) };
  }

  if (command === "renderWidget") {
    const { widgetId, envContext, hostContext: rawHost, query } = args as {
      widgetId:    string;
      envContext:  EnvContext;
      hostContext: RawHostContext;
      query?:      string;
    };
  
    const widget = findWidget(plugin, widgetId);
    if (!widget) throw new Error(`Unknown widget: ${widgetId}`);
  
    const context = buildContext(envContext, buildHostContext(rawHost), transport);
  
    // A widget defines exactly one of `render` / `renderQuery` (see
    // WidgetDescriptorRenderVariant in widget.ts) — both must be handled,
    // not just `render`. renderQuery can also legitimately return `null`
    // (e.g. "no match for this query"), which must pass through as-is
    // rather than being force-fed into serializeContent.
    let content: WidgetContent<boolean> | null;
    if (widget.render) {
      content = await widget.render(context);
    } else if (widget.renderQuery) {
      content = await widget.renderQuery(context, query ?? "");
    } else {
      throw new Error(`Widget "${widgetId}" defines neither render nor renderQuery`);
    }
  
    if (content == null) return { content: null };
  
    return {
      content: serializeContent(widgetId, content, context),
      showSection: widget.showSection,
    };
  }

  // ── invokeWidgetAction ────────────────────────────────────────────────────
  if (command === "invokeWidgetAction") {
    const { fnId, values } = args as { fnId: string; values?: Record<string, string> };
    const entry = widgetActionRegistry.get(fnId);
    if (!entry) throw new Error(`Unknown widget action fn: ${fnId}`);
    await entry.fn(values);
    return {};
  }

  // ── resolveExpandableChild ────────────────────────────────────────────────
  if (command === "resolveExpandableChild") {
    const { widgetId, childId, envContext, hostContext: rawHost, query } = args as {
      widgetId:     string;
      childId:      string;
      envContext?:  EnvContext;
      hostContext?: RawHostContext;
      query?:       string;
    };

    const widget = findWidget(plugin, widgetId);
    if (!widget) throw new Error(`Unknown widget: ${widgetId}`);
    if (!widget.expandable) {
      throw new Error(`Widget "${widgetId}" is not expandable`);
    }

    const context = buildContext(
      envContext ?? ({} as EnvContext),
      buildHostContext(rawHost ?? {}),
      transport,
    );

    let ownContent: WidgetContent<boolean> | null;
    if (widget.render) {
      ownContent = await widget.render(context);
    } else if (widget.renderQuery) {
      ownContent = await widget.renderQuery(context, query ?? "");
    } else {
      throw new Error(`Widget "${widgetId}" defines neither render nor renderQuery`);
    }

    if (ownContent == null || !("expandable" in ownContent)) {
      throw new Error(`Widget "${widgetId}" did not return any expandable children`);
    }

    const child = ownContent.expandable.find((c) => c.id === childId);
    if (!child) {
      throw new Error(`Unknown expandable child "${childId}" on widget "${widgetId}"`);
    }

    if (child.kind === "widget") {
      // Only widgets registered on THIS plugin can be looked up here — the
      // plugin process only has its own `plugin.widgets` array in scope.
      // A widgetId belonging to a different plugin (e.g. another plugin's
      // "<other-plugin>.some-widget") can never resolve through this path.
      const target = findWidget(plugin, child.widgetId);
      if (!target) {
        throw new Error(
          `Expandable child "${childId}" on widget "${widgetId}" references widgetId ` +
          `"${child.widgetId}", which is not registered in this plugin's \`widgets\` ` +
          `array. Cross-plugin widget references are not supported — point childs[].widgetId ` +
          `at a widget defined in this same plugin.`,
        );
      }

      let content: WidgetContent<boolean> | null;
      if (target.render) {
        content = await target.render(context);
      } else if (target.renderQuery) {
        content = await target.renderQuery(context, "");
      } else {
        throw new Error(`Widget "${child.widgetId}" defines neither render nor renderQuery`);
      }

      if (content == null) return { content: null };
      return { content: serializeContent(target.id, content, context) };
    }

    // kind === "custom"
    const content = await child.render();
    if (content == null) return { content: null };
    return { content: serializeContent(`${widgetId}.${childId}`, content, context) };
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
 *
 * `raw` is optional to accommodate call sites (currently just
 * resolveExpandableChild) whose core→plugin tunnel doesn't populate
 * hostContext at all yet — see the comment above that handler.
 */
function buildHostContext(raw: Partial<RawHostContext>): HostContext {
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
