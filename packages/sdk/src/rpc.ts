// [sdk] packages/sdk/src/rpc.ts

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
  WidgetSectionOptions,
} from "./widget.js";
import {
  isRequest,
  isResponse,
  type IpcRequest,
  type IpcResponse,
  type SearchResultItem,
  type CorpusDocument,
} from "@jimcast/protocol";

// ---------------------------------------------------------------------------
// Protocol types
// ---------------------------------------------------------------------------

// CoreRequest/CoreResponse used to be defined locally here — they were
// structurally identical to @jimcast/protocol's IpcRequest/IpcResponse
// (which also serve the webview<->host transport in @jimcast/react-sdk).
// Now imported from there so there's exactly one JS-side copy of this wire
// shape to keep in sync with domain::plugin::protocol.rs, instead of two
// independently-drifting ones.

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

type PendingResolve = (value: unknown) => void;
type PendingReject  = (reason: Error)  => void;

const PENDING_TIMEOUT_MS = 30_000;
const SEARCH_RESULT_CAP = 5;

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
  send(command: string, args: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id      = crypto.randomUUID();
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: no response for command "${command}" (id=${id})`));
      }, PENDING_TIMEOUT_MS);

      this.pending.set(id, [resolve, reject, timeout]);
      this.write({ id, command, args } satisfies IpcRequest);
    });
  }

  respond(id: string, result: unknown): void {
    this.write({ id, result } satisfies IpcResponse);
  }

  respondError(id: string, message: string): void {
    this.write({ id, error: message } satisfies IpcResponse);
  }

  private write(message: unknown): void {
    this.stdout.write(JSON.stringify(message) + "\n");
  }

  private listen(): void {
    const rl = createInterface({ input: this.stdin, crlfDelay: Infinity });

    rl.on("line", (line) => {
      if (!line.trim()) return;

      let message: unknown;
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }

      if (isRequest(message)) {
        const req = message as IpcRequest;
        this.onRequest(req.command, req.args, req.id).then(
          (result) => this.respond(req.id, result),
          (err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.respondError(req.id, msg);
          },
        );
      } else if (isResponse(message)) {
        const res     = message as IpcResponse;
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
//
// `widgetId` here is really a "scope" string, not always a literal widget
// id — for items inside a 'group' section it's `${widgetId}:${sectionId}`
// (see serializeContent's 'group' case below), so that two different
// sections reusing the same item id (e.g. both having a "delete" row)
// don't collide in this registry. It's still stable across repeat
// re-renders since the scope string is deterministic given the same
// widgetId/section id, which is all that "stable key" behavior needs.
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
  // `style` (see widget.ts's WidgetItemStyle) needs no special handling
  // here — it's plain JSON-safe data, so it rides along in this spread
  // exactly like `attribute`/`params` already do.
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

  // 'group' content has no top-level `datas` — its items live nested
  // inside each section's own content — so without this case it would
  // fall through to the plain `return content` below and every function
  // `action` inside every section would be silently dropped by
  // JSON.stringify (functions serialize to nothing) instead of being
  // swapped for a `{ _fnId }` reference the way a top-level widget's
  // items are. Recursing here is what makes function actions work
  // identically whether an item sits directly on a widget or inside one
  // of its group's sections.
  //
  // Each section is serialized under its own scope
  // (`${widgetId}:${section.id}`) rather than the shared `widgetId`, so
  // two sections that happen to reuse the same item id don't collide in
  // widgetActionRegistry — see the comment on that map above.
  if (content.type === "group") {
    return {
      ...content,
      sections: content.sections.map((section) => ({
        ...section,
        content: serializeContent(`${widgetId}:${section.id}`, section.content, ctx),
      })),
    };
  }

  return content;
}

// Core's render_widget expects the wire's `section` object keyed in
// snake_case (`title_show`, `navigation_active`,
// `query_search_active` — see [core] plugins.rs), while WidgetSectionOptions
// stays camelCase on the JS/SDK side for authoring ergonomics. Translate
// here, at the RPC boundary, rather than asking plugin authors to know
// core's wire casing. Fields the plugin didn't set are simply omitted
// (JSON.stringify drops `undefined` values), so core's own defaulting
// logic still applies for anything left unspecified.
function serializeSection(section: WidgetSectionOptions | undefined): unknown {
  if (!section) return undefined;
  return {
    title_show:          section.titleShow,
    navigation_active:   section.navigationActive,
    query_search_active: section.querySearchActive,
  };
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

  // ── search ──────────────────────────────────────────────────────────────
  if (command === "search") {
    const { query, envContext, hostContext: rawHost } = args as {
      query:       string;
      envContext:  EnvContext;
      hostContext: RawHostContext;
    };

    if (!plugin.search) return { items: [] };

    const context = buildContext(envContext, buildHostContext(rawHost), transport);
    const items: SearchResultItem[] = await plugin.search(query, context);
    return { items: items.slice(0, SEARCH_RESULT_CAP) };
  }

  // ── corpus ──────────────────────────────────────────────────────────────
  if (command === "corpus") {
    const { envContext, hostContext: rawHost } = args as {
      envContext:  EnvContext;
      hostContext: RawHostContext;
    };

    if (!plugin.corpus) return { documents: [] };

    const context = buildContext(envContext, buildHostContext(rawHost), transport);
    // CorpusDocument, not the bare `Document`: without an import, `Document`
    // silently resolves to the browser DOM type when the DOM lib is enabled.
    const documents: CorpusDocument[] = await plugin.corpus(context);
    return { documents };
  }

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
      section: serializeSection(widget.section),
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
  const send    = (command: string, args: Record<string, unknown>) => transport.send(command, args);
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
