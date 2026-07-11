// [sdk] widget.ts

/**
 * Widget API — plugins that render persistent UI blocks in the command bar.
 *
 * Widgets are rendered once when the command bar opens. They occupy a
 * configurable slot in the bar layout. Users control which slot via
 * ~/.jimcast/config.json.
 */

import type { ExecutionContext } from "./context.js";

// ---------------------------------------------------------------------------
// Color tokens
// ---------------------------------------------------------------------------

export type WidgetColor =
  | "default"
  | "green"
  | "red"
  | "yellow"
  | "blue"
  | "purple"
  | "aqua"
  | "orange"
  | (string & {});

// ── Item / action ─────────────────────────────────────────────────────────────

export type WidgetSlotName = 'above-input' | 'below-input' | 'inside-scroll'

export type WidgetMode = 'default' | 'search' | 'apps' | 'ai' | 'shell'

export interface WidgetAttribute {
  label1:      string
  label2?:     string
  label3?:     string
  label4?:     string
  labelRight?: string
  color1?:     string
  color2?:     string
  color3?:     string
  color4?:     string
  colorRight?: string
  image?:      string
}

// `then: 'expand'` is only legal when E is true — i.e. when the owning
// descriptor declared `expandable: true`.
export type ThenClause<E extends boolean = false> =
  | 'refresh'
  | 'dismiss'
  | 'refresh|dismiss'
  | (E extends true ? 'expand' : never)

export interface WidgetAction<E extends boolean = false> {
  cmd:               string
  params?:           Record<string, string>
  ignore_exit_code?: boolean
  timeout_secs?:     number
  then?:             ThenClause<E>
}

export type WidgetActionFn = (ctx: ExecutionContext) => Promise<void>

export interface WidgetItem<E extends boolean = false> {
  id:          string
  attribute?:  WidgetAttribute
  params?:     Record<string, string>
  action?:     WidgetAction<E> | WidgetActionFn
}

type WidgetDatasVariant<E extends boolean> =
  | { readonly type: 'rows';    readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'columns'; readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'list';    readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'badges';  readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'grid-2';  readonly datas: readonly WidgetItem<E>[]; }
  | { readonly type: 'grid-3';  readonly datas: readonly WidgetItem<E>[]; }

export type WidgetContent<E extends boolean = false> =
  | { readonly type: 'text';    readonly data:    string;  }
  | { readonly type: 'error';   readonly message: string;  }
  | { readonly type: 'divider'; readonly data?:   string;  }
  // When a widget declares `expandable: true` on its descriptor, every
  // datas-bearing content variant it returns must carry the live list of
  // expandable children alongside `datas` — computed fresh in this same
  // render call, so it can depend on whatever this call fetched. This is
  // the ONLY place the child list lives for plugin widgets — there is no
  // separate static list on the descriptor to keep in sync with; rpc.ts's
  // resolveExpandableChild re-renders the widget and reads this field
  // directly rather than consulting anything static.
  | (E extends true
      ? WidgetDatasVariant<E> & { readonly expandable: readonly WidgetExpandableChild[] }
      : WidgetDatasVariant<E>)

// ---------------------------------------------------------------------------
// Widget definition
// ---------------------------------------------------------------------------

export interface WidgetExpandableChildWidget {
  id:       string   // matches an item.id in this descriptor's content
  kind:     'widget'
  widgetId: string   // id of another widget in THIS plugin's `widgets` array
}

export interface WidgetExpandableChildCustom {
  id:     string     // matches an item.id in this descriptor's content
  kind:   'custom'
  render: () => WidgetContent | Promise<WidgetContent>
}

// NOTE: intentionally no 'component' kind here, unlike core's
// WidgetExpandableChild. Plugin content is serialized to core over
// newline-delimited JSON on stdout (see rpc.ts's serializeContent /
// RpcTransport) — a `render: () => ReactNode` can't survive that trip.
// Widgets needing a raw-React-node expandable child are a core-only
// capability for now.
export type WidgetExpandableChild = WidgetExpandableChildWidget | WidgetExpandableChildCustom

// Just a boolean flag: unlike core's INTERNAL_WIDGET_REGISTRY entries (which
// keep a static `expandable.childs` list alongside their content, per
// widgetTypes.ts), plugin widgets have no other place to author a static
// child list authors could keep in sync with content — the RPC boundary
// means core can't reach into plugin closures anyway. `expandable: true`
// exists purely to (a) gate `ExpandEnabled<Exp>` for typing render's return
// value and `then: 'expand'`, and (b) let rpc.ts fail fast with a clear
// "not expandable" error without needing to render first.
export type WidgetDescriptorExpandable = boolean

type ExpandEnabled<Exp extends WidgetDescriptorExpandable | undefined> =
  Exp extends true ? true : false

interface WidgetDescriptorRepeat {
  enable?:  boolean
  seconds?: number
}

export interface WidgetDescriptorBase<Exp extends WidgetDescriptorExpandable | undefined = undefined> {
  readonly id:          string;
  readonly showIn?:     WidgetMode[]
  readonly action?:     WidgetAction<ExpandEnabled<Exp>>
  readonly repeat?:     WidgetDescriptorRepeat
  readonly expandable?: Exp;
  // NOTE: render/renderQuery intentionally live in WidgetDescriptorRenderVariant,
  // not here — see WidgetDescriptorRenderVariant for why.
}

type WidgetRenderFn<E extends boolean> =
  (ctx: ExecutionContext) => WidgetContent<E> | Promise<WidgetContent<E>>

type WidgetRenderQueryFn<E extends boolean> =
  (ctx: ExecutionContext, q: string) => WidgetContent<E> | Promise<WidgetContent<E> | null> | null

type WidgetDescriptorRenderVariant<E extends boolean> =
  | { render: WidgetRenderFn<E>;  renderQuery?: never }
  | { render?: never;             renderQuery: WidgetRenderQueryFn<E> }

export type WidgetDescriptor<Exp extends WidgetDescriptorExpandable | undefined = undefined> =
  WidgetDescriptorBase<Exp> & WidgetDescriptorRenderVariant<ExpandEnabled<Exp>>

export type Widget<Exp extends WidgetDescriptorExpandable | undefined = undefined> =
  WidgetDescriptor<Exp> & { readonly _type: "widget" };

export type AnyWidget = Widget<WidgetDescriptorExpandable | undefined>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a widget — a persistent UI block rendered in the command bar.
 *
 * @example
 * ```typescript
 * const clockWidget = createWidget({
 *   id: "example.widget.clock",
 *   async render(ctx) {
 *     return { type: "text", data: new Date().toLocaleTimeString() };
 *   },
 * });
 * ```
 */
export function createWidget<Exp extends WidgetDescriptorExpandable | undefined = undefined>(
  definition: WidgetDescriptor<Exp>
): Widget<Exp> {
  return { ...definition, _type: "widget" };
}
