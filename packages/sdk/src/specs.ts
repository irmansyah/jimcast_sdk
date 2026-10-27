// [sdk] packages/sdk/src/specs.ts

// Internal: collects the cli/keys specs declared on a plugin's widgets and
// converts them to wire form. Not exported from the package root.
import type { Plugin } from "./command.js";
import type { WidgetCliSpec } from "./widgetCli.js";
import type { WidgetKeySpec } from "./widgetKeys.js";
import {
  parseKey,
  type WidgetCliSpecWire,
  type WidgetKeySpecWire,
} from "@jimcast/protocol";

export interface Bound<S> {
  id:       string;
  widgetId: string;
  owns:     string[];
  spec:     S;
}

const lastSegment = (id: string) => id.split(".").pop() ?? id;
const prefixes = (o: string | readonly string[]) =>
  (typeof o === "string" ? [o] : [...o]).filter(Boolean);

export function boundCliSpecs(plugin: Plugin): Bound<WidgetCliSpec>[] {
  return (plugin.widgets ?? []).flatMap((w) =>
    w.cli
      ? [{ id: w.cli.id ?? lastSegment(w.id), widgetId: w.id, owns: prefixes(w.cli.owns), spec: w.cli }]
      : [],
  );
}

export function boundKeySpecs(plugin: Plugin): Bound<WidgetKeySpec>[] {
  return (plugin.widgets ?? []).flatMap((w) =>
    w.keys
      ? [{ id: w.keys.id ?? lastSegment(w.id), widgetId: w.id, owns: prefixes(w.keys.owns), spec: w.keys }]
      : [],
  );
}

export const toCliWire = (b: Bound<WidgetCliSpec>): WidgetCliSpecWire => ({
  id: b.id,
  widgetId: b.widgetId,
  owns: b.owns,
  commands: b.spec.commands.map(({ id, args, title, description }) => ({
    id, args: args ? [...args] : undefined, title, description,
  })),
});

export const toKeyWire = (b: Bound<WidgetKeySpec>): WidgetKeySpecWire => ({
  id: b.id,
  widgetId: b.widgetId,
  owns: b.owns,
  actions: b.spec.actions.map(({ id, title, default: d }) => ({
    id, title, default: typeof d === "string" ? d : [...d],
  })),
});

/** Human-readable problems; bootstrapPlugin logs them to stderr. Empty = fine. */
export function validateSpecs(plugin: Plugin): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();
  const dup = (kind: string, id: string, widgetId: string) => {
    const k = `${kind}:${id.toLowerCase()}`;
    const prev = seen.get(k);
    if (prev && prev !== widgetId) errors.push(`${kind} spec id "${id}" is used by both ${prev} and ${widgetId}`);
    seen.set(k, widgetId);
  };

  for (const b of boundCliSpecs(plugin)) {
    dup("cli", b.id, b.widgetId);
    if (!b.owns.length) errors.push(`cli spec "${b.id}": \`owns\` is empty`);
    const ids = new Set<string>();
    for (const c of b.spec.commands) {
      if (ids.has(c.id)) errors.push(`cli spec "${b.id}": duplicate command "${c.id}"`);
      ids.add(c.id);
    }
  }
  for (const b of boundKeySpecs(plugin)) {
    dup("keys", b.id, b.widgetId);
    if (!b.owns.length) errors.push(`keys spec "${b.id}": \`owns\` is empty`);
    for (const a of b.spec.actions) {
      const keys = typeof a.default === "string" ? [a.default] : a.default;
      for (const k of keys) {
        if (!parseKey(k)) errors.push(`keys spec "${b.id}": action "${a.id}" has an unparseable default "${k}"`);
      }
    }
  }
  return errors;
}
