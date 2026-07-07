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

/**
 * Named color presets for widget elements.
 * These map to the host theme's Gruvbox palette.
 *
 * The `(string & {})` tail keeps autocomplete for named presets while
 * also accepting any raw hex value from `context.host.theme.colors`.
 */
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

export type WidgetContent<E extends boolean = false> =
  | { readonly type: 'text';    readonly data:    string;                   }
  | { readonly type: 'error';   readonly message: string;                   }
  | { readonly type: 'divider'; readonly data?:   string;                   }
  | { readonly type: 'rows';    readonly datas:   readonly WidgetItem<E>[]; }
  | { readonly type: 'columns'; readonly datas:   readonly WidgetItem<E>[]; }
  | { readonly type: 'list';    readonly datas:   readonly WidgetItem<E>[]; }
  | { readonly type: 'badges';  readonly datas:   readonly WidgetItem<E>[]; }
  | { readonly type: 'grid-2';  readonly datas:   readonly WidgetItem<E>[]; }
  | { readonly type: 'grid-3';  readonly datas:   readonly WidgetItem<E>[]; }
  | { readonly type: 'component'; render:  () => import('react').ReactNode; }

// ---------------------------------------------------------------------------
// Slot
// ---------------------------------------------------------------------------

/**
 * Where in the command bar the widget appears by default.
 * Users can override this in ~/.jimcast/config.json.
 *
 * ```
 * ┌─────────────────┐
 * │   above-input   │
 * │─────────────────│
 * │   Search input  │
 * │─────────────────│
 * │   below-input   │
 * │─────────────────│
 * │  Inside-Scroll  │
 * └─────────────────┘
 * ```
 */

// ---------------------------------------------------------------------------
// Widget definition
// ---------------------------------------------------------------------------

export interface WidgetExpandableChildWidget {
  id:       string   // matches an item.id in this descriptor's content
  kind:     'widget'
  widgetId: string   // id of another registered widget to render
}

export interface WidgetExpandableChildCustom {
  id:     string     // matches an item.id in this descriptor's content
  kind:   'custom'
  render: () => WidgetContent | Promise<WidgetContent>
}

export type WidgetExpandableChild = WidgetExpandableChildWidget | WidgetExpandableChildCustom

export type WidgetDescriptorExpandable =
  | { enable: true; childs: WidgetExpandableChild[] }
  | { enable?: false; childs?: never }

type ExpandEnabled<Exp extends WidgetDescriptorExpandable | undefined> =
  Exp extends { enable: true } ? true : false

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
  // not here. A `render(context): Promise<WidgetContent>` method on this base
  // interface used to collide with the render variant's signature once
  // intersected in WidgetDescriptor — nothing could satisfy both call
  // signatures on the same `render` key. Keep this interface signature-free.
}

// `ctx` is threaded through both render forms so widgets can read
// context.host.theme, context.storage, etc. at render time.
type WidgetRenderFn<E extends boolean> =
  (ctx: ExecutionContext) => WidgetContent<E> | Promise<WidgetContent<E>>

type WidgetRenderQueryFn<E extends boolean> =
  (ctx: ExecutionContext, q: string) => WidgetContent<E> | Promise<WidgetContent<E> | null> | null

type WidgetDescriptorRenderVariant<E extends boolean> =
  | { render: WidgetRenderFn<E>;  renderQuery?: never }
  | { render?: never;             renderQuery: WidgetRenderQueryFn<E> }

export type WidgetDescriptor<Exp extends WidgetDescriptorExpandable | undefined = undefined> =
  WidgetDescriptorBase<Exp> & WidgetDescriptorRenderVariant<ExpandEnabled<Exp>>

// Widget is generic over Exp so createWidget's return type can track the
// inferred Exp per call, instead of collapsing to the Exp=undefined default
// (which is what caused the exactOptionalPropertyTypes mismatch on `action`).
//
// Defined as an intersection with WidgetDescriptor (not just WidgetDescriptorBase)
// so that Widget actually carries `render`/`renderQuery` — interfaces can't
// `extends` a union type like WidgetDescriptorRenderVariant, so this has to be
// a type alias rather than an interface.
export type Widget<Exp extends WidgetDescriptorExpandable | undefined = undefined> =
  WidgetDescriptor<Exp> & { readonly _type: "widget" };

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
