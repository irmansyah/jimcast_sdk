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
  WidgetAction,
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
// Transport
// ---------------------------------------------------------------------------
// Wire types (IpcRequest/IpcResponse) come from @jimcast/protocol so there is
// one JS-side copy to keep in sync with domain::plugin::protocol.rs.

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

// Keyed by a stable `wfn_<scope>_<itemId>` id, NOT a fresh randomUUID per
// render: widgets with `repeat` re-render on a timer, and random ids would
// grow this map without bound. A stable key means a re-render overwrites the
// previous entry (which also refreshes `ctx`).
//
// `scope` is usually the widget id; inside a 'group' it is
// `${widgetId}:${sectionId}` so two sections reusing an item id don't collide.
const widgetActionRegistry = new Map<string, RegisteredAction>();

const FORM_ACTION_ITEM_ID = "__form__";

function actionFnId(scope: string, itemId: string): string {
  return `wfn_${scope}_${itemId}`;
}

function registerActionFn(fnId: string, fn: WidgetActionFn, ctx: ExecutionContext): void {
  widgetActionRegistry.set(fnId, { fn, ctx });
}

function serializeItem(scope: string, item: WidgetItem<boolean>, ctx: ExecutionContext): unknown {
  let out: Record<string, unknown> = { ...item };

  if (typeof item.action === "function") {
    const fnId = actionFnId(scope, item.id);
    registerActionFn(fnId, item.action, ctx);
    out.action = { _fnId: fnId };
  }
  if (typeof item.clickAction === "function") {
    const fnId = actionFnId(scope, `${item.id}:click`);
    registerActionFn(fnId, item.clickAction, ctx);
    out.clickAction = { _fnId: fnId };
  }
  // style / pinned / attribute / params are plain JSON and ride along as-is.
  return out;
}

function serializeContent(scope: string, content: WidgetContent<boolean>, ctx: ExecutionContext): unknown {
  // Only JSON-representable content reaches here (see widget.ts), so the only
  // thing that can't survive JSON.stringify is a function `action`. Every
  // variant that can hold one must be walked:

  // rows / columns / list / badges / grid-* / progress
  if ("datas" in content) {
    return {
      ...content,
      datas: (content.datas as readonly WidgetItem<boolean>[]).map((item) =>
        serializeItem(scope, item, ctx),
      ),
    };
  }

  // 'text' carries a single item in `data` (not `datas`); without this case a
  // function action on it was silently dropped.
  if (content.type === "text") {
    return { ...content, data: serializeItem(scope, content.data, ctx) };
  }

  // 'form' carries its submit action on the content itself.
  if (content.type === "form" && typeof content.action === "function") {
    const fnId = actionFnId(scope, FORM_ACTION_ITEM_ID);
    registerActionFn(fnId, content.action, ctx);
    return { ...content, action: { _fnId: fnId } as WidgetAction<boolean> };
  }

  // 'group' nests content per section; each section gets its own scope so
  // item ids can repeat across sections. direction/gap and the per-section
  // sizing fields (flex, height, maxHeight, scrollable, navigable) are plain
  // JSON and pass through the spreads.
  if (content.type === "group") {
    return {
      ...content,
      sections: content.sections.map((section) => ({
        ...section,
        content: serializeContent(`${scope}:${section.id}`, section.content, ctx),
      })),
    };
  }

  // panel / website / image / terminal / mirror_browser / error / divider
  return content;
}

// Core expects `section` in snake_case ([core] RenderWidgetResult.section);
// WidgetSectionOptions is camelCase for authoring. `undefined` fields are
// dropped by JSON.stringify, so core's defaults still apply.
function serializeSection(section: WidgetSectionOptions | undefined): unknown {
  if (!section) return undefined;
  return {
    title:               section.title,
    title_show:          section.titleShow,
    navigation_active:   section.navigationActive,
    query_search_active: section.querySearchActive,
    padding:             section.padding,
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
// Widget lookup / rendering
// ---------------------------------------------------------------------------

function findWidget(plugin: Plugin, widgetId: string): AnyWidget | undefined {
  return plugin.widgets?.find((w) => w.id === widgetId);
}

/** A widget defines exactly one of `render` / `renderQuery`; `renderQuery` may return null. */
async function renderOwn(
  widget: AnyWidget,
  ctx:    ExecutionContext,
  query?: string,
  params?: Record<string, string>,
): Promise<WidgetContent<boolean> | null> {
  if (widget.render)      return widget.render(ctx, params);
  if (widget.renderQuery) return widget.renderQuery(ctx, query ?? "");
  throw new Error(`Widget "${widget.id}" defines neither render nor renderQuery`);
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
    // CorpusDocument, not the bare `Document` (which resolves to the DOM type
    // when the DOM lib is enabled).
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
  // Called by core for panels configured as `kind: "external-custom"`. Unlike
  // resolveExpandableChild there is no parent widget/childId pair: the panel
  // id IS the fully qualified widgetId and is rendered directly. (Contrast
  // `external-component`, which core reaches through render_widget instead and
  // which also returns the section options.)
  if (command === "renderExpandableChild") {
    const { widgetId, envContext, hostContext: rawHost, query, params } = args as {
      widgetId:     string;
      envContext?:  EnvContext;
      hostContext?: RawHostContext;
      query?:       string;
      params?:      Record<string, string>;
    };

    const widget = findWidget(plugin, widgetId);
    if (!widget) throw new Error(`Unknown widget: ${widgetId}`);

    const context = buildContext(
      envContext ?? ({} as EnvContext),
      buildHostContext(rawHost ?? {}),
      transport,
    );

    const content = await renderOwn(widget, context, query, params);
    if (content == null) return { content: null };
    return { content: serializeContent(widgetId, content, context) };
  }

  // ── renderWidget ────────────────────────────────────────────────────────────
  if (command === "renderWidget") {
    const { widgetId, envContext, hostContext: rawHost, query, params } = args as {
      widgetId:    string;
      envContext:  EnvContext;
      hostContext: RawHostContext;
      query?:      string;
      params?:     Record<string, string>;
    };

    const widget = findWidget(plugin, widgetId);
    if (!widget) throw new Error(`Unknown widget: ${widgetId}`);

    const context = buildContext(envContext, buildHostContext(rawHost), transport);

    const content = await renderOwn(widget, context, query, params);
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

    const ownContent = await renderOwn(widget, context, query);
    if (ownContent == null || !("expandable" in ownContent)) {
      throw new Error(`Widget "${widgetId}" did not return any expandable children`);
    }

    const child = ownContent.expandable.find((c) => c.id === childId);
    if (!child) {
      throw new Error(`Unknown expandable child "${childId}" on widget "${widgetId}"`);
    }

    if (child.kind === "widget") {
      // Only widgets registered on THIS plugin can be looked up here.
      const target = findWidget(plugin, child.widgetId);
      if (!target) {
        throw new Error(
          `Expandable child "${childId}" on widget "${widgetId}" references widgetId ` +
          `"${child.widgetId}", which is not registered in this plugin's \`widgets\` ` +
          `array. Cross-plugin widget references are not supported.`,
        );
      }

      const content = await renderOwn(target, context, "", child.params);
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
 * Core sends only a theme name; resolve it to the full ThemeContext here.
 * `raw` is partial because some core->plugin paths don't populate hostContext.
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
